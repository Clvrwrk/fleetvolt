import assert from "node:assert/strict";
import { describe, it, mock, afterEach } from "node:test";
import { buildApp } from "./app.js";
import type { ExportsDeps } from "./exports.js";

const JOB_ID = "11111111-1111-4111-8111-111111111111";

const MOCK_ROW = {
  id: JOB_ID,
  status: "COMPLETE",
  inputs_hash: "abc123def4567890",
  physics_version: "phys-v1.0.0",
  charger_version: "chrg-v1.0.0",
  inputs: {
    route: { corridor_key: "polb_cajon_pass" },
    truck: { slug: "ecascadia_438" },
    conditions: { weather_preset: "ideal", payload_lbs: 34000 },
  },
  outputs: {
    segments: [
      {
        dist_m: 1000,
        grade: 0.5,
        speed: 25,
        energy_kwh: 1.2,
        soc_pct: 95,
        charging_event: false,
      },
    ],
    kpis: {
      total_kwh: 100,
      wh_per_mi: 2000,
      regen_kwh: 5,
      total_time_s: 3600,
    },
    disclaimer: "Planning tool only.",
    charging_stops: [],
    feasibility: { verdict: "feasible", tier: "public_hd", stop_count: 0 },
  },
};

function createMockPool(handlers: {
  onGet?: (id: string) => unknown;
}) {
  return {
    query: mock.fn(async (_sql: string, params: unknown[]) => {
      const id = params[0] as string;
      const row = handlers.onGet?.(id);
      return { rows: row ? [row as Record<string, unknown>] : [] };
    }),
  } satisfies ExportsDeps["pool"];
}

describe("POST /v1/exports/pdf", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("test_pdf_route_returns_pdf", async () => {
    const fakePdf = Buffer.from("%PDF-1.4 fake");
    const deps: ExportsDeps = {
      pool: createMockPool({
        onGet: (id) => (id === JOB_ID ? MOCK_ROW : undefined),
      }),
      renderPdf: mock.fn(async () => fakePdf),
    };

    const app = await buildApp({ logger: false, exportsDeps: deps });

    const response = await app.inject({
      method: "POST",
      url: "/v1/exports/pdf",
      payload: { job_id: JOB_ID },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "application/pdf");
    assert.ok(response.rawPayload.length > 0);

    await app.close();
  });

  it("returns 404 for unknown job_id", async () => {
    const deps: ExportsDeps = {
      pool: createMockPool({ onGet: () => undefined }),
      renderPdf: mock.fn(async () => Buffer.from("%PDF")),
    };

    const app = await buildApp({ logger: false, exportsDeps: deps });

    const response = await app.inject({
      method: "POST",
      url: "/v1/exports/pdf",
      payload: { job_id: "00000000-0000-4000-8000-000000009999" },
    });

    assert.equal(response.statusCode, 404);

    await app.close();
  });

  it("returns 400 for invalid job_id UUID", async () => {
    const deps: ExportsDeps = {
      pool: createMockPool({}),
      renderPdf: mock.fn(async () => Buffer.from("%PDF")),
    };

    const app = await buildApp({ logger: false, exportsDeps: deps });

    const response = await app.inject({
      method: "POST",
      url: "/v1/exports/pdf",
      payload: { job_id: "not-a-uuid" },
    });

    assert.equal(response.statusCode, 400);

    await app.close();
  });

  it("test_pdf_rejects_oversized_png", async () => {
    const oversized = "A".repeat(5 * 1024 * 1024 + 1);
    const deps: ExportsDeps = {
      pool: createMockPool({ onGet: () => MOCK_ROW }),
      renderPdf: mock.fn(async () => Buffer.from("%PDF")),
    };

    const app = await buildApp({ logger: false, exportsDeps: deps });

    const response = await app.inject({
      method: "POST",
      url: "/v1/exports/pdf",
      payload: { job_id: JOB_ID, map_snapshot_base64: oversized },
    });

    assert.equal(response.statusCode, 413);

    await app.close();
  });
});
