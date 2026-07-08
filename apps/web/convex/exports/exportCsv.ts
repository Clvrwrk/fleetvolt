// CSV export helper — serializes a SimulateResponse-like object to CSV.
// Convex/Vercel safe: pure string building, no Node APIs.
//
// Two sections:
//   1. Segments (dist_m, grade, speed, energy_kwh, soc_pct, charging_event, stop_sequence)
//   2. Charging stops + KPIs + assumptions

import type { SimulationRunExportRow } from "./exportTemplate";

const FORMULA_PREFIX = /^[=+\-@]/;

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) {
    return "";
  }
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if ((/[",\n\r]/).test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(escapeCsvCell).join(",");
}

export interface ExportCsvInput {
  segments?: Array<Record<string, unknown>>;
  kpis?: {
    total_kwh?: number;
    wh_per_mi?: number;
    regen_kwh?: number;
    total_time_s?: number;
  };
  charging_stops?: Array<Record<string, unknown>> | null;
  feasibility?: {
    verdict?: string;
    tier?: string;
    stop_count?: number;
  } | null;
  assumptions?: Array<{
    field: string;
    value: number;
    source: string;
    oem_default: number;
  }>;
}

export function exportCsv(sim: ExportCsvInput): string {
  const lines: string[] = [];

  // Section 1: Segments
  lines.push("# section: segments");
  lines.push(formatRow(["dist_m", "grade", "speed", "energy_kwh", "soc_pct", "charging_event", "stop_sequence"]));

  const segments = sim.segments ?? [];
  for (const seg of segments) {
    lines.push(
      formatRow([
        seg.dist_m as number,
        seg.grade as number,
        seg.speed as number,
        seg.energy_kwh as number,
        seg.soc_pct as number,
        seg.charging_event as boolean,
        (seg.stop_sequence as number | undefined) ?? "",
      ]),
    );
  }

  lines.push("");

  // Section 2: KPIs
  lines.push("# section: kpis");
  lines.push(formatRow(["metric", "value"]));
  const kpis = sim.kpis ?? {};
  lines.push(formatRow(["total_kwh", kpis.total_kwh ?? ""]));
  lines.push(formatRow(["wh_per_mi", kpis.wh_per_mi ?? ""]));
  lines.push(formatRow(["regen_kwh", kpis.regen_kwh ?? ""]));
  lines.push(formatRow(["total_time_s", kpis.total_time_s ?? ""]));

  lines.push("");

  // Section 3: Charging stops
  lines.push("# section: charging_stops");
  lines.push(formatRow(["station_id", "name", "lat", "lon", "power_kw", "arrival_soc_pct", "departure_soc_pct", "dwell_s", "energy_added_kwh", "detour_s"]));

  const stops = sim.charging_stops ?? [];
  for (const stop of stops) {
    lines.push(
      formatRow([
        stop.station_id as string,
        (stop.name as string | undefined) ?? "",
        stop.lat as number,
        stop.lon as number,
        stop.power_kw as number,
        stop.arrival_soc_pct as number,
        stop.departure_soc_pct as number,
        stop.dwell_s as number,
        stop.energy_added_kwh as number,
        (stop.detour_s as number | undefined) ?? "",
      ]),
    );
  }

  lines.push("");

  // Section 4: Feasibility
  const feasibility = sim.feasibility;
  if (feasibility) {
    lines.push("# section: feasibility");
    lines.push(formatRow(["verdict", "tier", "stop_count"]));
    lines.push(formatRow([feasibility.verdict ?? "", feasibility.tier ?? "", feasibility.stop_count ?? ""]));
    lines.push("");
  }

  // Section 5: Assumptions
  lines.push("# section: assumptions");
  lines.push(formatRow(["field", "value", "source", "oem_default"]));
  const assumptions = sim.assumptions ?? [];
  for (const a of assumptions) {
    lines.push(formatRow([a.field, a.value, a.source, a.oem_default]));
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Build an export row from a simulations table record (for use with renderExportHtml).
 * Adapts the Convex simulations row (camelCase) to the export row shape (snake_case).
 */
export function simulationRowToExportRow(row: {
  _id: string;
  inputsHash: string;
  status: string;
  physicsVersion?: string | null;
  chargerVersion?: string | null;
  inputs?: Record<string, unknown> | null;
  results?: Record<string, unknown> | null;
}): SimulationRunExportRow {
  return {
    id: row._id,
    status: row.status,
    inputs_hash: row.inputsHash,
    physics_version: row.physicsVersion ?? null,
    charger_version: row.chargerVersion ?? null,
    inputs: row.inputs ?? null,
    outputs: (row.results as SimulationRunExportRow["outputs"]) ?? null,
  };
}
