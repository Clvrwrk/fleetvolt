export const MAX_PROVIDER_ATTEMPTS = 3;
export const PROVIDER_RETRY_BASE_MS = 30_000;

const MIN_PTV_ROAD_POINTS = 8;

export type Coordinate = {
  latitude: number;
  longitude: number;
};

/** A designated pair is already resolved to either its explicit or nearest port. */
export type DesignatedRoutePair = {
  generatorId: string;
  portCode: string;
};

/** The Phase-18 receipt proving the geometry's independent 90-day lifecycle. */
export type GeometryFreshnessReceipt = {
  requestHash: string;
  pulledAt: number;
  expiresAt: number;
};

export type PromotedRouteEvidence = {
  generatorId: string;
  originPortCode: string;
  requestHash: string;
  geometry?: {
    requestHash: string;
    provider: string;
    coordinates: Coordinate[];
    freshness: GeometryFreshnessReceipt;
  };
};

export type DesignatedCoverageState =
  | "fresh-verified"
  | "stale-cache-owned"
  | "missing"
  | "invalid"
  | "duplicate";

export type DesignatedCoverageRow = {
  pair: DesignatedRoutePair;
  pairKey: string;
  state: DesignatedCoverageState;
  requestHash?: string;
  reason?:
    | "no-promotion"
    | "duplicate-promotion"
    | "pair-identity-mismatch"
    | "missing-geometry"
    | "request-hash-mismatch"
    | "non-ptv-provider"
    | "unusable-road-geometry"
    | "missing-or-invalid-freshness";
};

export type DesignatedCoverageSummary = {
  expected: number;
  freshVerified: number;
  cacheOwned: number;
  missing: number;
  invalid: number;
  duplicate: number;
  complete: boolean;
};

export type AttemptReceipt = {
  pairKey: string;
  attemptNumber: number;
  status: "success" | "failure";
  recordedAt: number;
};

export type ProviderLease = {
  pairKey: string;
  leaseUntil: number;
};

export type NextEligiblePair = {
  pair: DesignatedRoutePair;
  pairKey: string;
  attemptNumber: number;
};

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** Coordinates never participate in pair identity. */
export function designatedPairKey(pair: DesignatedRoutePair): string {
  if (!nonEmpty(pair.generatorId) || !nonEmpty(pair.portCode)) {
    throw new Error("Designated route identity requires generatorId and portCode");
  }
  return `${encodeURIComponent(pair.generatorId)}::${encodeURIComponent(pair.portCode)}`;
}

/** Stable order is generator id first, after port resolution has already occurred. */
export function sortDesignatedPairs(
  pairs: readonly DesignatedRoutePair[],
): DesignatedRoutePair[] {
  return [...pairs].sort(
    (left, right) =>
      left.generatorId.localeCompare(right.generatorId) ||
      left.portCode.localeCompare(right.portCode),
  );
}

function validCoordinate(value: Coordinate): boolean {
  return (
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function validFreshnessReceipt(
  receipt: GeometryFreshnessReceipt | undefined,
  requestHash: string,
  now: number,
): receipt is GeometryFreshnessReceipt {
  return Boolean(
    receipt &&
      nonEmpty(receipt.requestHash) &&
      receipt.requestHash === requestHash &&
      Number.isFinite(receipt.pulledAt) &&
      receipt.pulledAt <= now &&
      Number.isFinite(receipt.expiresAt) &&
      receipt.expiresAt > receipt.pulledAt,
  );
}

function classifyPair(
  pair: DesignatedRoutePair,
  promotions: readonly PromotedRouteEvidence[],
  now: number,
): DesignatedCoverageRow {
  const pairKey = designatedPairKey(pair);
  const candidates = promotions.filter(
    (promotion) => promotion.generatorId === pair.generatorId,
  );

  if (candidates.length === 0) {
    return { pair, pairKey, state: "missing", reason: "no-promotion" };
  }
  if (candidates.length > 1) {
    return {
      pair,
      pairKey,
      state: "duplicate",
      reason: "duplicate-promotion",
    };
  }

  const promotion = candidates[0];
  if (
    promotion.generatorId !== pair.generatorId ||
    promotion.originPortCode !== pair.portCode
  ) {
    return {
      pair,
      pairKey,
      state: "invalid",
      requestHash: promotion.requestHash,
      reason: "pair-identity-mismatch",
    };
  }

  const geometry = promotion.geometry;
  if (!geometry) {
    return {
      pair,
      pairKey,
      state: "invalid",
      requestHash: promotion.requestHash,
      reason: "missing-geometry",
    };
  }
  if (
    !nonEmpty(promotion.requestHash) ||
    geometry.requestHash !== promotion.requestHash
  ) {
    return {
      pair,
      pairKey,
      state: "invalid",
      requestHash: promotion.requestHash,
      reason: "request-hash-mismatch",
    };
  }
  if (geometry.provider !== "ptv") {
    return {
      pair,
      pairKey,
      state: "invalid",
      requestHash: promotion.requestHash,
      reason: "non-ptv-provider",
    };
  }
  if (
    geometry.coordinates.length < MIN_PTV_ROAD_POINTS ||
    !geometry.coordinates.every(validCoordinate)
  ) {
    return {
      pair,
      pairKey,
      state: "invalid",
      requestHash: promotion.requestHash,
      reason: "unusable-road-geometry",
    };
  }
  if (!validFreshnessReceipt(geometry.freshness, promotion.requestHash, now)) {
    return {
      pair,
      pairKey,
      state: "invalid",
      requestHash: promotion.requestHash,
      reason: "missing-or-invalid-freshness",
    };
  }

  return {
    pair,
    pairKey,
    requestHash: promotion.requestHash,
    state:
      geometry.freshness.expiresAt > now
        ? "fresh-verified"
        : "stale-cache-owned",
  };
}

export function classifyDesignatedCoverage(
  expectedPairs: readonly DesignatedRoutePair[],
  promotions: readonly PromotedRouteEvidence[],
  now: number,
): DesignatedCoverageRow[] {
  return expectedPairs.map((pair) => classifyPair(pair, promotions, now));
}

export function coverageSummary(
  rows: readonly DesignatedCoverageRow[],
): DesignatedCoverageSummary {
  const count = (state: DesignatedCoverageState) =>
    rows.filter((row) => row.state === state).length;
  const freshVerified = count("fresh-verified");
  const cacheOwned = count("stale-cache-owned");
  const missing = count("missing");
  const invalid = count("invalid");
  const duplicate = count("duplicate");
  return {
    expected: rows.length,
    freshVerified,
    cacheOwned,
    missing,
    invalid,
    duplicate,
    complete: rows.length > 0 && freshVerified + cacheOwned === rows.length,
  };
}

export function retryBackoffMs(completedAttemptNumber: number): number {
  const normalized = Math.max(1, Math.trunc(completedAttemptNumber));
  return PROVIDER_RETRY_BASE_MS * 2 ** (normalized - 1);
}

function receiptsForPair(
  receipts: readonly AttemptReceipt[],
  pairKey: string,
): AttemptReceipt[] {
  const byAttempt = new Map<number, AttemptReceipt>();
  for (const receipt of receipts) {
    if (receipt.pairKey !== pairKey || receipt.attemptNumber < 1) continue;
    if (!byAttempt.has(receipt.attemptNumber)) {
      byAttempt.set(receipt.attemptNumber, receipt);
    }
  }
  return [...byAttempt.values()].sort(
    (left, right) => left.attemptNumber - right.attemptNumber,
  );
}

/**
 * Returns at most one claim. Any active lease globally blocks selection, so a
 * caller cannot create concurrent provider work by asking for a different pair.
 */
export function nextEligiblePair(args: {
  pairs: readonly DesignatedRoutePair[];
  coverage: readonly DesignatedCoverageRow[];
  receipts: readonly AttemptReceipt[];
  leases: readonly ProviderLease[];
  now: number;
}): NextEligiblePair | null {
  if (args.leases.some((lease) => lease.leaseUntil > args.now)) return null;

  const coverageByPair = new Map(
    args.coverage.map((row) => [row.pairKey, row] as const),
  );
  const seen = new Set<string>();

  for (const pair of sortDesignatedPairs(args.pairs)) {
    const pairKey = designatedPairKey(pair);
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const state = coverageByPair.get(pairKey)?.state;
    if (state !== "missing" && state !== "invalid") continue;

    const receipts = receiptsForPair(args.receipts, pairKey);
    if (receipts.some((receipt) => receipt.status === "success")) continue;

    const last = receipts.at(-1);
    if (!last) return { pair, pairKey, attemptNumber: 1 };
    if (last.attemptNumber >= MAX_PROVIDER_ATTEMPTS) continue;
    if (args.now < last.recordedAt + retryBackoffMs(last.attemptNumber)) {
      continue;
    }
    return { pair, pairKey, attemptNumber: last.attemptNumber + 1 };
  }

  return null;
}

/** First writer wins for a pair+attempt identity; retries use a new attempt. */
export function upsertAttemptReceipt(
  receipts: readonly AttemptReceipt[],
  incoming: AttemptReceipt,
): AttemptReceipt[] {
  if (!Number.isInteger(incoming.attemptNumber) || incoming.attemptNumber < 1) {
    throw new Error("Attempt number must be a positive integer");
  }
  if (
    receipts.some(
      (receipt) =>
        receipt.pairKey === incoming.pairKey &&
        receipt.attemptNumber === incoming.attemptNumber,
    )
  ) {
    return [...receipts];
  }
  return [...receipts, incoming];
}
