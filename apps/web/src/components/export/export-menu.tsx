"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Download, FileJson, FileText, Loader2 } from "lucide-react";
import type { components } from "@fleetvolt/shared-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildCsvExport } from "@/lib/export-csv";
import {
  buildJsonExport,
  downloadBlob,
  hashPrefix,
} from "@/lib/export-json";
import { postPdfExport } from "@/lib/api-client";
import { useScenarioStore } from "@/stores/scenario-store";

type SimulationJobPollResponse =
  components["schemas"]["SimulationJobPollResponse"];

export function ExportMenu() {
  const pollResult = useScenarioStore((s) => s.pollResult);
  const captureMapSnapshot = useScenarioStore((s) => s.captureMapSnapshot);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isComplete = pollResult?.status === "COMPLETE" && Boolean(pollResult.outputs);

  const handleCsvDownload = useCallback(() => {
    if (!pollResult || !isComplete) {
      return;
    }
    const csv = buildCsvExport(pollResult);
    downloadBlob(csv, `fleetvolt-${hashPrefix(pollResult.inputs_hash)}.csv`, "text/csv");
  }, [isComplete, pollResult]);

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

  const handlePdfExport = useCallback(async () => {
    if (!pollResult || !isComplete || isPdfGenerating) {
      return;
    }

    setIsPdfGenerating(true);
    setStatusMessage("Preparing PDF…");

    try {
      let mapSnapshot: string | null = null;
      if (captureMapSnapshot) {
        mapSnapshot = await captureMapSnapshot();
      }

      const pdfBlob = await postPdfExport({
        job_id: pollResult.job_id,
        map_snapshot_base64: mapSnapshot
          ? mapSnapshot.replace(/^data:image\/png;base64,/, "")
          : null,
      });

      downloadBlob(
        pdfBlob,
        `fleetvolt-${hashPrefix(pollResult.inputs_hash)}.pdf`,
        "application/pdf",
      );
      setStatusMessage("PDF report downloaded");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "PDF export failed",
      );
    } finally {
      setIsPdfGenerating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }, [captureMapSnapshot, isComplete, isPdfGenerating, pollResult]);

  return (
    <div className="flex items-center gap-3">
      {statusMessage && (
        <span className="text-xs text-muted-foreground" role="status">
          {statusMessage}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={!isComplete || isPdfGenerating}
            data-testid="export-menu-trigger"
          >
            {isPdfGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={handleCsvDownload}
            disabled={!isComplete}
            data-testid="export-csv-item"
          >
            <FileText className="h-4 w-4" />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleJsonDownload}
            disabled={!isComplete}
            data-testid="export-json-item"
          >
            <FileJson className="h-4 w-4" />
            Download JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void handlePdfExport();
            }}
            disabled={!isComplete || isPdfGenerating}
            data-testid="export-pdf-item"
          >
            {isPdfGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isPdfGenerating ? "Generating report…" : "Export PDF report"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export type { SimulationJobPollResponse };
