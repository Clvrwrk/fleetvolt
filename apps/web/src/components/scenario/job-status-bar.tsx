"use client";

import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useScenarioStore } from "@/stores/scenario-store";

export function JobStatusBar() {
  const pollStatus = useScenarioStore((s) => s.pollStatus);
  const isPolling = useScenarioStore((s) => s.isPolling);
  const isCacheHit = useScenarioStore((s) => s.isCacheHit);
  const pollResult = useScenarioStore((s) => s.pollResult);
  const error = useScenarioStore((s) => s.error);
  const submitScenario = useScenarioStore((s) => s.submitScenario);
  const resetError = useScenarioStore((s) => s.resetError);

  const inputsHash = pollResult?.inputs_hash;
  const hashPrefix = inputsHash?.slice(0, 8);

  if (!isPolling && !pollStatus && !error) {
    return null;
  }

  return (
    <div
      data-testid="job-status"
      aria-live="polite"
      className="space-y-3 border-t border-[var(--fv-stroke)] pt-4"
    >
      {isPolling && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {pollStatus === "RUNNING" ? "Simulation running…" : "Submitting…"}
          </span>
        </div>
      )}

      {isCacheHit && hashPrefix && (
        <span className="badge badge-ok inline-flex items-center gap-1">
          Cached result · {hashPrefix}
        </span>
      )}

      {!isCacheHit && inputsHash && pollStatus === "COMPLETE" && hashPrefix && (
        <p className="mono text-xs text-muted-foreground">
          inputs_hash: {inputsHash}
        </p>
      )}

      {error && (
        <Alert>
          <AlertTitle>Simulation failed</AlertTitle>
          <AlertDescription>
            {error.stage ? `[${error.stage}] ` : ""}
            {error.message}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              resetError();
              void submitScenario();
            }}
          >
            Retry simulation
          </Button>
        </Alert>
      )}
    </div>
  );
}
