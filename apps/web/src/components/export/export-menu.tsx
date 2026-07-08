"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { buildCsvExport } from "@/lib/export-csv";
import {
  buildJsonExport,
  downloadBlob,
  hashPrefix,
} from "@/lib/export-json";
import {
  exportCsv as convexExportCsv,
  exportJson as convexExportJson,
  exportPdf as convexExportPdf,
} from "@/lib/export-client";
import { useScenarioStore } from "@/stores/scenario-store";

type ExportMenuProps = {
  variant?: "default" | "secondary";
};

export function ExportMenu({ variant = "default" }: ExportMenuProps) {
  const pollResult = useScenarioStore((s) => s.pollResult);
  const captureMapSnapshot = useScenarioStore((s) => s.captureMapSnapshot);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isCsvGenerating, setIsCsvGenerating] = useState(false);
  const [isJsonGenerating, setIsJsonGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isComplete = pollResult?.status === "COMPLETE" && Boolean(pollResult.outputs);

  // CSV download — uses in-memory pollResult (no server round-trip needed)
  const handleCsvDownload = useCallback(() => {
    if (!pollResult || !isComplete) {
      return;
    }
    const csv = buildCsvExport(pollResult);
    downloadBlob(csv, `fleetvolt-${hashPrefix(pollResult.inputs_hash)}.csv`, "text/csv");
  }, [isComplete, pollResult]);

  // JSON download — uses in-memory pollResult (no server round-trip needed)
  const handleJsonDownload = useCallback(() => {
    if (!pollResult || !isComplete) {
      return;
    }
    const json = buildJsonExport(pollResult);
    downloadBlob(
      json,
      `fleetvolt-${hashPrefix(pollResult.inputs_hash)}.json`,
      "application/json",
    );
  }, [isComplete, pollResult]);

  // PDF export — fetches from Convex simulations table, renders HTML, triggers print
  const handlePdfExport = useCallback(async () => {
    if (!pollResult || !isComplete || isPdfGenerating) {
      return;
    }

    const inputsHash = pollResult.inputs_hash;
    if (!inputsHash) {
      setStatusMessage("No inputs hash — cannot fetch simulation for PDF");
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    setIsPdfGenerating(true);
    setStatusMessage("Preparing PDF…");

    try {
      let mapSnapshot: string | null = null;
      if (captureMapSnapshot) {
        mapSnapshot = await captureMapSnapshot();
      }

      await convexExportPdf(inputsHash, mapSnapshot);
      setStatusMessage("PDF print dialog opened");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "PDF export failed",
      );
    } finally {
      setIsPdfGenerating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }, [captureMapSnapshot, isComplete, isPdfGenerating, pollResult]);

  // Convex-backed CSV export (fetches fresh from simulations table)
  const handleConvexCsvExport = useCallback(async () => {
    if (!pollResult?.inputs_hash || !isComplete || isCsvGenerating) {
      return;
    }
    setIsCsvGenerating(true);
    try {
      await convexExportCsv(pollResult.inputs_hash);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "CSV export failed",
      );
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsCsvGenerating(false);
    }
  }, [isComplete, isCsvGenerating, pollResult]);

  // Convex-backed JSON export (fetches fresh from simulations table)
  const handleConvexJsonExport = useCallback(async () => {
    if (!pollResult?.inputs_hash || !isComplete || isJsonGenerating) {
      return;
    }
    setIsJsonGenerating(true);
    try {
      await convexExportJson(pollResult.inputs_hash);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "JSON export failed",
      );
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsJsonGenerating(false);
    }
  }, [isComplete, isJsonGenerating, pollResult]);

  if (variant === "secondary") {
    return (
      <div className="relative">
        <button
          type="button"
          className="fv-btn-secondary"
          disabled={!isComplete || isPdfGenerating}
          data-testid="export-menu-trigger"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {isPdfGenerating ? (
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
          ) : null}
          Export Report
        </button>
        {menuOpen && isComplete ? (
          <div className="absolute bottom-full left-0 z-20 mb-2 min-w-[180px] rounded-lg border border-black/10 bg-[#fbfbfd] p-1 shadow-lg">
            <button
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-black/5"
              data-testid="export-csv-item"
              disabled={isCsvGenerating}
              onClick={() => {
                void handleConvexCsvExport();
                setMenuOpen(false);
              }}
            >
              {isCsvGenerating ? "Generating…" : "Download CSV"}
            </button>
            <button
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-black/5"
              data-testid="export-json-item"
              disabled={isJsonGenerating}
              onClick={() => {
                void handleConvexJsonExport();
                setMenuOpen(false);
              }}
            >
              {isJsonGenerating ? "Generating…" : "Download JSON"}
            </button>
            <button
              type="button"
              className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium hover:bg-black/5"
              data-testid="export-pdf-item"
              disabled={isPdfGenerating}
              onClick={() => {
                void handlePdfExport();
                setMenuOpen(false);
              }}
            >
              {isPdfGenerating ? "Generating…" : "Export PDF report"}
            </button>
          </div>
        ) : null}
        {statusMessage ? (
          <span className="sr-only" role="status">
            {statusMessage}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {statusMessage && (
        <span className="text-xs text-muted-foreground" role="status">
          {statusMessage}
        </span>
      )}
      <button
        type="button"
        className="fv-btn-secondary"
        disabled={!isComplete || isPdfGenerating}
        data-testid="export-menu-trigger"
        onClick={() => setMenuOpen((o) => !o)}
      >
        Export
      </button>
      {menuOpen && isComplete ? (
        <div className="absolute z-20 mt-1 min-w-[160px] rounded-lg border bg-white p-1 shadow-lg">
          <button type="button" className="block w-full px-3 py-2 text-left text-sm" onClick={handleCsvDownload}>
            CSV
          </button>
        </div>
      ) : null}
    </div>
  );
}
