"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MapWorkbenchShell } from "@/components/workbench/map-workbench/map-workbench-shell";
import { resolveWorkbenchMode } from "@/components/workbench/map-workbench/mode-config";
import type { WorkbenchMode } from "@/components/workbench/map-workbench/types";

export default function WorkbenchPage() {
  return (
    <Suspense fallback={<WorkbenchLoadingFallback />}>
      <WorkbenchPageContent />
    </Suspense>
  );
}

function WorkbenchPageContent() {
  const searchParams = useSearchParams();
  const mode = useMemo(
    () => resolveWorkbenchMode(searchParams.get("mode")) as WorkbenchMode,
    [searchParams],
  );

  return <MapWorkbenchShell mode={mode} />;
}

function WorkbenchLoadingFallback() {
  return (
    <div
      data-testid="map-workbench-loading"
      className="h-[calc(100dvh-3.5rem)] min-h-0 bg-[var(--fv-paper)] p-4"
    >
      <div className="h-full rounded-3xl border border-black/10 bg-white/60" />
    </div>
  );
}
