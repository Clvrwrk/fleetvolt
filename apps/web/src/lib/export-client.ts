// Client-side export functions — calls Convex query to fetch simulation,
// then generates CSV/JSON/PDF exports client-side.
//
// Replaces the old Fastify POST /v1/exports/pdf path (Phase 13-05).
// No server round-trip for CSV/JSON. PDF uses browser print (no Puppeteer).

import { api } from "../../convex/_generated/api";
import type { SimulationRunExportRow } from "../../convex/exports/exportTemplate";
import { renderExportHtml } from "../../convex/exports/exportTemplate";
import { exportCsv as buildCsv, simulationRowToExportRow } from "../../convex/exports/exportCsv";
import { exportJson as buildJson } from "../../convex/exports/exportJson";
import { generatePdf } from "../../convex/exports/exportPdf";
import { downloadBlob, hashPrefix } from "./export-json";

// Re-export for convenience
export { downloadBlob, hashPrefix };

/** Result of fetching a simulation for export from Convex. */
export interface SimulationExportData {
  _id: string;
  inputsHash: string;
  status: string;
  physicsVersion: string | null;
  chargerVersion: string | null;
  inputs: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
}

/**
 * Fetch a simulation from the Convex simulations table by inputsHash.
 * Uses the ConvexReactClient (same pattern as api-client.ts).
 */
async function fetchSimulation(inputsHash: string): Promise<SimulationExportData | null> {
  const { ConvexReactClient } = await import("convex/react");
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  const client = new ConvexReactClient(url);
  try {
    const result = await client.query(api.exports.exports.getSimulationForExport, {
      inputsHash,
    });
    return result as SimulationExportData | null;
  } finally {
    void client.close();
  }
}

/**
 * Convert the Convex simulation row to the export row shape,
 * then to the outputs needed for CSV/JSON.
 */
function toExportRow(sim: SimulationExportData): SimulationRunExportRow {
  return simulationRowToExportRow({
    _id: sim._id,
    inputsHash: sim.inputsHash,
    status: sim.status,
    physicsVersion: sim.physicsVersion,
    chargerVersion: sim.chargerVersion,
    inputs: sim.inputs,
    results: sim.results,
  });
}

/**
 * Export a simulation as CSV. Fetches from Convex, generates CSV client-side,
 * triggers download.
 */
export async function exportCsv(inputsHash: string): Promise<void> {
  const sim = await fetchSimulation(inputsHash);
  if (!sim) {
    throw new Error(`No simulation found for inputsHash: ${inputsHash}`);
  }

  const row = toExportRow(sim);
  const outputs = (row.outputs ?? {}) as Parameters<typeof buildCsv>[0];
  const csv = buildCsv(outputs);
  downloadBlob(csv, `fleetvolt-${hashPrefix(sim.inputsHash)}.csv`, "text/csv");
}

/**
 * Export a simulation as JSON. Fetches from Convex, serializes full response,
 * triggers download.
 */
export async function exportJson(inputsHash: string): Promise<void> {
  const sim = await fetchSimulation(inputsHash);
  if (!sim) {
    throw new Error(`No simulation found for inputsHash: ${inputsHash}`);
  }

  const json = buildJson({
    id: sim._id,
    inputsHash: sim.inputsHash,
    status: sim.status,
    physicsVersion: sim.physicsVersion,
    chargerVersion: sim.chargerVersion,
    inputs: sim.inputs,
    results: sim.results,
  });
  downloadBlob(json, `fleetvolt-${hashPrefix(sim.inputsHash)}.json`, "application/json");
}

/**
 * Export a simulation as PDF. Fetches from Convex, renders HTML template,
 * opens in a new window and triggers browser print (Save as PDF).
 *
 * @param inputsHash - The simulation inputs hash
 * @param mapSnapshot - Optional base64 data URL of the route map snapshot
 */
export async function exportPdf(
  inputsHash: string,
  mapSnapshot?: string | null,
): Promise<void> {
  const sim = await fetchSimulation(inputsHash);
  if (!sim) {
    throw new Error(`No simulation found for inputsHash: ${inputsHash}`);
  }

  const row = toExportRow(sim);
  const html = renderExportHtml(
    row,
    mapSnapshot ?? null,
    new Date().toISOString(),
  );
  generatePdf(html, `fleetvolt-${hashPrefix(sim.inputsHash)}.pdf`);
}
