"use client";

import { Loader2 } from "lucide-react";
import { useScenarioStore } from "@/stores/scenario-store";

/** Inline errors below the run button — header shows primary status pill */
export function JobStatusBar() {
  const isPolling = useScenarioStore((s) => s.isPolling);
  const isCacheHit = useScenarioStore((s) => s.isCacheHit);
  const pollResult = useScenarioStore((s) => s.pollResult);
  const error = useScenarioStore((s) => s.error);
  const submitScenario = useScenarioStore((s) => s.submitScenario);
  const resetError = useScenarioStore((s) => s.resetError);

  const inputsHash = pollResult?.inputs_hash;
  const hashPrefix = inputsHash?.slice(0, 8);

  if (!isPolling && !error && !isCacheHit) {
    return null;
  }

  return (
    <div className="space-y-2 font-mono text-[10px]" aria-live="polite">
      {isPolling && (
        <div className="flex items-center gap-2 text-[#8a8a92]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Physics engine running…</span>
        </div>
      )}

      {isCacheHit && hashPrefix ? (
        <span className="inline-block rounded-full bg-[#3f9b6b]/15 px-2 py-0.5 text-[#3f9b6b]">
          Cached · {hashPrefix}
        </span>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[#c0392b]/30 bg-[#c0392b]/5 p-2 text-[#c0392b]">
          <p>
            {error.stage ? `[${error.stage}] ` : ""}
            {error.message}
          </p>
          <button
            type="button"
            className="fv-btn-secondary mt-2 px-3 py-1 text-[11px]"
            onClick={() => {
              resetError();
              void submitScenario();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
