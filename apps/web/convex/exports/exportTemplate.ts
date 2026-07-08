// Export HTML template — ported from services/api/src/export-template.ts (Phase 4).
// Pure HTML string builder. No Puppeteer, no Node APIs — Convex/Vercel safe.
//
// Produces the same visual structure as the shipped Phase 4 PDF:
//   - KPI summary table
//   - Route map snapshot (optional base64 image)
//   - Charging plan table
//   - Physics parameter snapshot
//   - Assumptions table
//   - Disclaimer

const PLANNING_DISCLAIMER =
  "Planning tool only — Physics-based estimate. Not for real-time dispatch, HOS compliance, or weight-limit decisions. Real-world performance varies with driver behavior, traffic, and vehicle condition.";

export interface SimulationRunExportRow {
  id: string;
  status: string;
  inputs_hash?: string | null;
  physics_version?: string | null;
  charger_version?: string | null;
  inputs?: Record<string, unknown> | null;
  outputs?: {
    segments?: Array<Record<string, unknown>>;
    kpis?: {
      total_kwh?: number;
      wh_per_mi?: number;
      regen_kwh?: number;
      total_time_s?: number;
    };
    disclaimer?: string;
    assumptions?: Array<{
      field: string;
      value: number;
      source: string;
      oem_default: number;
      category?: string | null;
      note?: string | null;
    }>;
    charging_stops?: Array<Record<string, unknown>> | null;
    feasibility?: {
      verdict?: string;
      tier?: string;
      stop_count?: number;
    } | null;
  } | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function readConditions(inputs: Record<string, unknown> | null | undefined) {
  const conditions = inputs?.conditions;
  if (!conditions || typeof conditions !== "object") {
    return {};
  }
  return conditions as Record<string, unknown>;
}

function mapImageSection(mapDataUrl: string | null): string {
  if (mapDataUrl) {
    return `<img src="${escapeHtml(mapDataUrl)}" alt="Route map snapshot" style="max-width:100%;border:1px solid #ccc;" />`;
  }
  return `<p style="color:#666;font-style:italic;">Map unavailable</p>`;
}

export function renderExportHtml(
  row: SimulationRunExportRow,
  mapDataUrl: string | null,
  exportTimestamp: string,
): string {
  const outputs = row.outputs ?? {};
  const kpis = outputs.kpis ?? {};
  const stops = outputs.charging_stops ?? [];
  const assumptions = outputs.assumptions ?? [];
  const feasibility = outputs.feasibility;
  const conditions = readConditions(row.inputs ?? null);
  const disclaimer = outputs.disclaimer ?? PLANNING_DISCLAIMER;

  const stopRows = stops
    .map((stop) => {
      const dwellMin = Math.round(Number(stop.dwell_s ?? 0) / 60);
      return `<tr>
        <td>${escapeHtml(String(stop.name ?? stop.station_id ?? ""))}</td>
        <td>${escapeHtml(String(stop.power_kw ?? ""))}</td>
        <td>${escapeHtml(String(stop.arrival_soc_pct ?? ""))}</td>
        <td>${escapeHtml(String(stop.energy_added_kwh ?? ""))}</td>
        <td>${dwellMin}</td>
        <td>${escapeHtml(String(stop.departure_soc_pct ?? ""))}</td>
      </tr>`;
    })
    .join("");

  const assumptionRows = assumptions
    .map(
      (entry) => `<tr>
        <td>${escapeHtml(entry.field)}</td>
        <td>${escapeHtml(String(entry.value))}</td>
        <td>${escapeHtml(entry.source)}</td>
        <td>${escapeHtml(String(entry.oem_default))}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>FleetVolt Route Report</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 24px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f8; }
    .meta { color: #555; font-size: 11px; margin-bottom: 16px; }
    .disclaimer { margin-top: 32px; padding: 12px; background: #fef3c7; border: 1px solid #d97706; font-size: 11px; }
  </style>
</head>
<body>
  <h1>FleetVolt Route — Simulation Report</h1>
  <p class="meta">
    Job ID: ${escapeHtml(row.id)}<br />
    Export timestamp: ${escapeHtml(exportTimestamp)}<br />
    inputs_hash: ${escapeHtml(row.inputs_hash ?? "unknown")}<br />
    physics_version: ${escapeHtml(row.physics_version ?? "unknown")}<br />
    charger_version: ${escapeHtml(row.charger_version ?? "unknown")}
  </p>

  <h2>KPI Summary</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total energy</td><td>${Number(kpis.total_kwh ?? 0).toFixed(1)} kWh</td></tr>
    <tr><td>Energy intensity</td><td>${Math.round(Number(kpis.wh_per_mi ?? 0))} Wh/mi</td></tr>
    <tr><td>Trip time</td><td>${formatDuration(Number(kpis.total_time_s ?? 0))}</td></tr>
    <tr><td>Regen energy</td><td>${Number(kpis.regen_kwh ?? 0).toFixed(1)} kWh</td></tr>
    <tr><td>Charging stops</td><td>${feasibility?.stop_count ?? stops.length}</td></tr>
    <tr><td>Feasibility</td><td>${escapeHtml(String(feasibility?.verdict ?? "unknown"))} (${escapeHtml(String(feasibility?.tier ?? "n/a"))})</td></tr>
  </table>

  <h2>Route Map</h2>
  ${mapImageSection(mapDataUrl)}

  <h2>Charging Plan</h2>
  <table>
    <tr>
      <th>Location</th><th>Power (kW)</th><th>Arrival SoC (%)</th>
      <th>Energy added (kWh)</th><th>Dwell (min)</th><th>Departure SoC (%)</th>
    </tr>
    ${stopRows || "<tr><td colspan=\"6\">No charging stops</td></tr>"}
  </table>

  <h2>Physics Parameter Snapshot</h2>
  <table>
    <tr><th>Parameter</th><th>Value</th></tr>
    <tr><td>Truck</td><td>${escapeHtml(String((row.inputs?.truck as { slug?: string } | undefined)?.slug ?? ""))}</td></tr>
    <tr><td>Corridor</td><td>${escapeHtml(String((row.inputs?.route as { corridor_key?: string } | undefined)?.corridor_key ?? ""))}</td></tr>
    <tr><td>Weather preset</td><td>${escapeHtml(String(conditions.weather_preset ?? ""))}</td></tr>
    <tr><td>Payload (lbs)</td><td>${escapeHtml(String(conditions.payload_lbs ?? ""))}</td></tr>
    <tr><td>Port drayage</td><td>${escapeHtml(String(conditions.port_drayage_enabled ?? false))}</td></tr>
  </table>

  <h2>Assumptions</h2>
  <table>
    <tr><th>Field</th><th>Value</th><th>Source</th><th>OEM default</th></tr>
    ${assumptionRows || "<tr><td colspan=\"4\">No assumption overrides recorded</td></tr>"}
  </table>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> ${escapeHtml(disclaimer)}
  </div>
</body>
</html>`;
}
