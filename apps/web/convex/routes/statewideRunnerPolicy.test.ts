import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_PROVIDER_ATTEMPTS,
  classifyDesignatedCoverage,
  coverageSummary,
  designatedPairKey,
  nextEligiblePair,
  retryBackoffMs,
  sortDesignatedPairs,
  upsertAttemptReceipt,
  type AttemptReceipt,
  type DesignatedRoutePair,
  type PromotedRouteEvidence,
} from "./statewideRunnerPolicy";

const NOW = Date.UTC(2026, 6, 12, 20);
const road = Array.from({ length: 8 }, (_, index) => ({
  latitude: 33.75 + index * 0.01,
  longitude: -118.21 + index * 0.01,
}));

const pairs: DesignatedRoutePair[] = [
  { generatorId: "MTG-9", portCode: "OAK" },
  { generatorId: "MTG-1", portCode: "POLB" },
  { generatorId: "MTG-47", portCode: "POLB" },
];

function promoted(
  pair: DesignatedRoutePair,
  overrides: Partial<PromotedRouteEvidence> = {},
): PromotedRouteEvidence {
  const requestHash = `hash:${designatedPairKey(pair)}`;
  return {
    generatorId: pair.generatorId,
    originPortCode: pair.portCode,
    requestHash,
    geometry: {
      requestHash,
      provider: "ptv",
      coordinates: road,
      freshness: {
        requestHash,
        pulledAt: NOW - 1_000,
        expiresAt: NOW + 1_000,
      },
    },
    ...overrides,
  };
}

describe("statewide designated-route runner policy", () => {
  it("E-01/E-03 keys pairs by generator and resolved port, then orders by generator id", () => {
    assert.notEqual(
      designatedPairKey({ generatorId: "MTG-1", portCode: "POLB" }),
      designatedPairKey({ generatorId: "MTG-1", portCode: "OAK" }),
    );
    assert.deepEqual(
      sortDesignatedPairs(pairs).map((pair) => pair.generatorId),
      ["MTG-1", "MTG-47", "MTG-9"],
    );
  });

  it("E-01 keeps coincident generators distinct because coordinates are not identity", () => {
    const coincident = sortDesignatedPairs([
      { generatorId: "MTG-2", portCode: "POLB" },
      { generatorId: "MTG-1", portCode: "POLB" },
    ]);
    assert.equal(coincident.length, 2);
    assert.notEqual(designatedPairKey(coincident[0]), designatedPairKey(coincident[1]));
  });

  it("E-02 reports empty promotion coverage as 0/69 without fabricating rows", () => {
    const expected = Array.from({ length: 69 }, (_, index) => ({
      generatorId: `MTG-${index + 1}`,
      portCode: "POLB",
    }));
    const rows = classifyDesignatedCoverage(expected, [], NOW);
    const summary = coverageSummary(rows);

    assert.equal(rows.length, 69);
    assert.equal(summary.expected, 69);
    assert.equal(summary.freshVerified, 0);
    assert.equal(summary.cacheOwned, 0);
    assert.equal(summary.missing, 69);
    assert.equal(summary.complete, false);
  });

  it("E-04 verifies only exact, fresh PTV evidence with eight valid road points", () => {
    const pair = pairs[1];
    const requestHash = `hash:${designatedPairKey(pair)}`;
    const cases: Array<[PromotedRouteEvidence, string]> = [
      [promoted(pair), "fresh-verified"],
      [promoted(pair, { originPortCode: "OAK" }), "invalid"],
      [promoted(pair, { geometry: undefined }), "invalid"],
      [
        promoted(pair, {
          geometry: {
            requestHash,
            provider: "google",
            coordinates: road,
            freshness: { requestHash, pulledAt: NOW - 1_000, expiresAt: NOW + 1_000 },
          },
        }),
        "invalid",
      ],
      [
        promoted(pair, {
          geometry: {
            requestHash,
            provider: "ptv",
            coordinates: road.slice(0, 7),
            freshness: { requestHash, pulledAt: NOW - 1_000, expiresAt: NOW + 1_000 },
          },
        }),
        "invalid",
      ],
      [
        promoted(pair, {
          geometry: {
            requestHash,
            provider: "ptv",
            coordinates: road,
            freshness: { requestHash: "wrong", pulledAt: NOW - 1_000, expiresAt: NOW + 1_000 },
          },
        }),
        "invalid",
      ],
    ];

    for (const [evidence, state] of cases) {
      assert.equal(
        classifyDesignatedCoverage([pair], [evidence], NOW)[0]?.state,
        state,
      );
    }
  });

  it("E-04 skips fresh pairs and leaves usable stale PTV geometry cache-owned", () => {
    const fresh = pairs[0];
    const stale = pairs[1];
    const staleEvidence = promoted(stale);
    staleEvidence.geometry!.freshness.expiresAt = NOW;
    const rows = classifyDesignatedCoverage(
      [fresh, stale, pairs[2]],
      [promoted(fresh), staleEvidence],
      NOW,
    );

    assert.deepEqual(
      rows.map((row) => row.state),
      ["fresh-verified", "stale-cache-owned", "missing"],
    );
    assert.deepEqual(
      nextEligiblePair({ pairs: [fresh, stale, pairs[2]], coverage: rows, receipts: [], leases: [], now: NOW }),
      { pair: pairs[2], pairKey: designatedPairKey(pairs[2]), attemptNumber: 1 },
    );
  });

  it("E-04 resumes at the first stable unverified pair and never repeats a successful attempt", () => {
    const ordered = sortDesignatedPairs(pairs);
    const coverage = classifyDesignatedCoverage(ordered, [], NOW);
    const first = ordered[0];
    const receipts: AttemptReceipt[] = [
      {
        pairKey: designatedPairKey(first),
        attemptNumber: 1,
        status: "success",
        recordedAt: NOW - 1,
      },
    ];

    assert.deepEqual(
      nextEligiblePair({ pairs: ordered, coverage, receipts, leases: [], now: NOW }),
      {
        pair: ordered[1],
        pairKey: designatedPairKey(ordered[1]),
        attemptNumber: 1,
      },
    );
  });

  it("E-05/P-03 refuses a claim while any provider lease is active", () => {
    const coverage = classifyDesignatedCoverage(pairs, [], NOW);
    assert.equal(
      nextEligiblePair({
        pairs,
        coverage,
        receipts: [],
        leases: [{ pairKey: designatedPairKey(pairs[2]), leaseUntil: NOW + 1 }],
        now: NOW,
      }),
      null,
    );
    assert.notEqual(
      nextEligiblePair({
        pairs,
        coverage,
        receipts: [],
        leases: [{ pairKey: designatedPairKey(pairs[2]), leaseUntil: NOW }],
        now: NOW,
      }),
      null,
    );
  });

  it("E-05 applies deterministic bounded exponential retry", () => {
    const pair = sortDesignatedPairs(pairs)[0];
    const coverage = classifyDesignatedCoverage([pair], [], NOW);
    const failure: AttemptReceipt = {
      pairKey: designatedPairKey(pair),
      attemptNumber: 1,
      status: "failure",
      recordedAt: NOW,
    };

    assert.equal(MAX_PROVIDER_ATTEMPTS, 3);
    assert.equal(retryBackoffMs(1), 30_000);
    assert.equal(retryBackoffMs(2), 60_000);
    assert.equal(retryBackoffMs(3), 120_000);
    assert.equal(
      nextEligiblePair({ pairs: [pair], coverage, receipts: [failure], leases: [], now: NOW + 29_999 }),
      null,
    );
    assert.equal(
      nextEligiblePair({ pairs: [pair], coverage, receipts: [failure], leases: [], now: NOW + 30_000 })?.attemptNumber,
      2,
    );

    const exhausted = [1, 2, 3].map((attemptNumber) => ({
      ...failure,
      attemptNumber,
      recordedAt: NOW + attemptNumber,
    }));
    assert.equal(
      nextEligiblePair({ pairs: [pair], coverage, receipts: exhausted, leases: [], now: NOW + 1_000_000 }),
      null,
    );
  });

  it("E-04 makes receipt writes idempotent by pair and attempt number", () => {
    const receipt: AttemptReceipt = {
      pairKey: designatedPairKey(pairs[0]),
      attemptNumber: 1,
      status: "failure",
      recordedAt: NOW,
    };
    const once = upsertAttemptReceipt([], receipt);
    const twice = upsertAttemptReceipt(once, { ...receipt, recordedAt: NOW + 100 });

    assert.equal(twice.length, 1);
    assert.deepEqual(twice[0], receipt);
  });
});
