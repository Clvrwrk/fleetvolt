import type { components } from "@fleetvolt/shared-types";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];
type SegmentResult = components["schemas"]["SegmentResult"];
type ChargingStopResult = components["schemas"]["ChargingStopResult"];

const FORMULA_PREFIX = /^[=+\-@]/;

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) {
    return "";
  }

  let text = String(value);
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(escapeCsvCell).join(",");
}

function segmentHeaders(): string[] {
  return [
    "dist_m",
    "soc_pct",
    "energy_kwh",
    "grade",
    "speed",
    "charging_event",
    "stop_sequence",
  ];
}

function segmentRow(segment: SegmentResult): string {
  return formatRow([
    segment.dist_m,
    segment.soc_pct,
    segment.energy_kwh,
    segment.grade,
    segment.speed,
    segment.charging_event,
    segment.stop_sequence ?? "",
  ]);
}

function chargingStopHeaders(): string[] {
  return [
    "station_id",
    "name",
    "lat",
    "lon",
    "power_kw",
    "arrival_soc_pct",
    "departure_soc_pct",
    "dwell_s",
    "energy_added_kwh",
    "detour_s",
  ];
}

function chargingStopRow(stop: ChargingStopResult): string {
  return formatRow([
    stop.station_id,
    stop.name ?? "",
    stop.lat,
    stop.lon,
    stop.power_kw,
    stop.arrival_soc_pct,
    stop.departure_soc_pct,
    stop.dwell_s,
    stop.energy_added_kwh,
    stop.detour_s,
  ]);
}

export function buildCsvExport(pollResult: SimulationJobPollResponse): string {
  const lines: string[] = [
    `# inputs_hash: ${pollResult.inputs_hash ?? ""}`,
    `# physics_version: ${pollResult.physics_version ?? ""}`,
    `# charger_version: ${pollResult.charger_version ?? ""}`,
    "",
    "# section: segments",
    formatRow(segmentHeaders()),
  ];

  const segments = pollResult.outputs?.segments ?? [];
  for (const segment of segments) {
    lines.push(segmentRow(segment));
  }

  lines.push("");
  lines.push("# section: charging_stops");
  lines.push(formatRow(chargingStopHeaders()));

  const stops = pollResult.outputs?.charging_stops ?? [];
  for (const stop of stops) {
    lines.push(chargingStopRow(stop));
  }

  return `${lines.join("\n")}\n`;
}
