import assert from "node:assert/strict";
import { describe, it, mock, afterEach } from "node:test";
import { buildApp } from "./app.js";
import type { SimulationsDeps } from "./simulations.js";

const CORRIDOR_BODY = {
  route: { corridor_key: "polb_cajon_pass" },
  truck: { slug: "ecascadia_438" },
  conditions: {
    weather_preset: "ideal",
    payload_lbs: 34000,
    port_drayage_enabled: false,
  },
  overrides: {},
  options: { include_charging: true },
};

const MOCK_OUTPUTS = {
  segments: [{ segment_index: 0 }],
  charging_stops: [{ station_id: "station-1" }],
  feasibility: { verdict: "feasible" },
};

function createMockPool(handlers: {
  onCacheLookup?: (hash: string) => unknown;
  onInsert?: (body: unknown, hash: string) => { id: string };
  onGet?: (id: string) => unknown;
}) {
    return {
      query: mock.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes("inputs_hash = $1") && sql.includes("COMPLETE")) {
          const hash = params[0] as string;
          const row = handlers.onCacheLookup?.(hash);
          return { rows: row ? [row as Record<string, unknown>] : [] };
        }
        if (sql.includes("INSERT INTO simulation_runs")) {
          const body = params[0];
          const hash = params[1] as string;
          const row = handlers.onInsert?.(body, hash) ?? {
            id: "00000000-0000-4000-8000-000000000001",
          };
          return { rows: [row as Record<string, unknown>] };
        }
        if (sql.includes("WHERE id = $1") && sql.includes("duration_ms")) {
          const id = params[0] as string;
          const row = handlers.onGet?.(id);
          return { rows: row ? [row as Record<string, unknown>] : [] };
        }
        if (sql.includes("UPDATE simulation_runs")) {
          return { rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }),
    } satisfies SimulationsDeps["pool"];
}

describe("POST /v1/simulations", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("returns PENDING on cache miss and enqueues job", async () => {
    const fetchCalls: string[] = [];
    const mockFetch = mock.fn(async (url: string | URL | Request) => {
      fetchCalls.push(String(url));
      return new Response(JSON.stringify({ enqueued: true }), { status: 200 });
    });

    const deps: SimulationsDeps = {
      pool: createMockPool({
        onCacheLookup: () => undefined,
        onInsert: () => ({
          id: "11111111-1111-4111-8111-111111111111",
        }),
      }),
      fetchFn: mockFetch as unknown as typeof fetch,
      simulatorUrl: "http://simulator:8000",
    };

    const app = await buildApp({ logger: false, simulationsDeps: deps });

    const response = await app.inject({
      method: "POST",
      url: "/v1/simulations",
      payload: CORRIDOR_BODY,
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.job_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(payload.status, "PENDING");
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0]!, /\/v1\/internal\/jobs\/11111111-1111-4111-8111-111111111111\/enqueue$/);

    await app.close();
  });

  it("returns COMPLETE on cache hit without enqueue", async () => {
    const fetchCalls: string[] = [];
    const mockFetch = mock.fn(async (url: string | URL | Request) => {
      fetchCalls.push(String(url));
      return new Response(JSON.stringify({ enqueued: true }), { status: 200 });
    });

    const deps: SimulationsDeps = {
      pool: createMockPool({
        onCacheLookup: () => ({
          id: "cached-run-id",
          status: "COMPLETE",
          outputs: MOCK_OUTPUTS,
        }),
      }),
      fetchFn: mockFetch as unknown as typeof fetch,
      simulatorUrl: "http://simulator:8000",
    };

    const app = await buildApp({ logger: false, simulationsDeps: deps });

    const response = await app.inject({
      method: "POST",
      url: "/v1/simulations",
      payload: CORRIDOR_BODY,
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.job_id, "cached-run-id");
    assert.equal(payload.status, "COMPLETE");
    assert.deepEqual(payload.outputs, MOCK_OUTPUTS);
    assert.equal(fetchCalls.length, 0);

    await app.close();
  });
});

describe("GET /v1/simulations/:id", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("returns status and outputs when row is COMPLETE", async () => {
    const runId = "22222222-2222-4222-8222-222222222222";
    const deps: SimulationsDeps = {
      pool: createMockPool({
        onGet: (id) =>
          id === runId
            ? {
                id: runId,
                status: "COMPLETE",
                outputs: MOCK_OUTPUTS,
                error: null,
                duration_ms: 1234,
              }
            : undefined,
      }),
      fetchFn: fetch,
      simulatorUrl: "http://simulator:8000",
    };

    const app = await buildApp({ logger: false, simulationsDeps: deps });

    const response = await app.inject({
      method: "GET",
      url: `/v1/simulations/${runId}`,
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.job_id, runId);
    assert.equal(payload.status, "COMPLETE");
    assert.deepEqual(payload.outputs, MOCK_OUTPUTS);
    assert.equal(payload.duration_ms, 1234);

    await app.close();
  });

  it("returns 404 for unknown id", async () => {
    const deps: SimulationsDeps = {
      pool: createMockPool({
        onGet: () => undefined,
      }),
      fetchFn: fetch,
      simulatorUrl: "http://simulator:8000",
    };

    const app = await buildApp({ logger: false, simulationsDeps: deps });

    const response = await app.inject({
      method: "GET",
      url: "/v1/simulations/00000000-0000-4000-8000-000000009999",
    });

    assert.equal(response.statusCode, 404);
    const payload = response.json();
    assert.equal(payload.error, "not_found");

    await app.close();
  });
});
