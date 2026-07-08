"use client";

import { useMemo, useState } from "react";
import { useAction } from "convex/react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { TechnicalLabel } from "@/components/design/technical-label";
import { cn } from "@/lib/utils";
import { useMapWorkbenchStore } from "@/stores/map-workbench-store";
import type { WorkbenchAiResult, WorkbenchMode } from "./types";

type AiCommandBarProps = {
  mode: WorkbenchMode;
  className?: string;
};

const EXAMPLE_PROMPTS: Record<WorkbenchMode, string[]> = {
  driver_day_plan: ["Draft POLB to Barstow day plan", "Enable charger layers for my route"],
  fleet_contract_plan: [
    "Apply Oakland to Tracy contract assumptions",
    "Draft fleet contract layers",
  ],
  caas_gap_map: ["Toggle gap and carrier layers", "Show Class 8 gap opportunity map"],
};

function humanizeClientError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/workbench\/ai:[a-zA-Z0-9_]+/g, "the planning assistant")
    .replace(/convex\/[a-zA-Z0-9_./:-]+/g, "the planning service")
    .slice(0, 220);
}

export function AiCommandBar({ mode, className }: AiCommandBarProps) {
  const [prompt, setPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const applyAiResult = useMapWorkbenchStore((state) => state.applyAiResult);
  const runWorkbenchAi = useAction(api.workbench.ai.workbenchPlanWithAi);
  const examples = useMemo(() => EXAMPLE_PROMPTS[mode], [mode]);

  async function submit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isRunning) return;

    setIsRunning(true);
    setError(null);
    try {
      const result = (await runWorkbenchAi({
        message: trimmed,
        mode,
      })) as WorkbenchAiResult;

      applyAiResult(result);
      setLastSummary(result.answerSummary);
      if (result.error) {
        setError(result.error);
      }
      setPrompt("");
    } catch (err) {
      setError(humanizeClientError(err));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section
      data-testid="ai-command-bar"
      className={cn(
        "rounded-2xl border border-black/10 bg-white/80 p-3 shadow-sm",
        className,
      )}
      aria-label="AI map command bar"
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--fv-accent)]" />
        <TechnicalLabel>AI map actions</TechnicalLabel>
      </div>
      <p className="mt-1 text-[11px] leading-4 text-[var(--fv-steel)]">
        Commands update draft, layers, and cards first. Prose stays secondary.
      </p>

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(prompt);
        }}
      >
        <label className="sr-only" htmlFor="workbench-ai-command">
          AI planning command
        </label>
        <input
          id="workbench-ai-command"
          data-testid="ai-command-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={examples[0]}
          className="min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-[var(--fv-graphite)] shadow-sm outline-none focus-visible:border-[var(--fv-accent)] focus-visible:ring-2 focus-visible:ring-[var(--fv-accent)]/30"
        />
        <button
          type="submit"
          data-testid="ai-command-submit"
          disabled={isRunning || prompt.trim().length === 0}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--fv-graphite)] px-4 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fv-accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Apply to map
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            data-testid="ai-command-example"
            onClick={() => void submit(example)}
            disabled={isRunning}
            className="min-h-9 rounded-xl border border-black/10 bg-[var(--fv-surface)] px-3 text-[11px] font-semibold text-[var(--fv-graphite)] transition hover:border-[var(--fv-accent)] disabled:opacity-60"
          >
            {example}
          </button>
        ))}
      </div>

      {lastSummary ? (
        <p
          data-testid="ai-command-summary"
          className="mt-3 rounded-xl border border-black/10 bg-[var(--fv-surface)] px-3 py-2 text-xs leading-5 text-[var(--fv-steel)]"
        >
          {lastSummary}
        </p>
      ) : null}

      {error ? (
        <div
          data-testid="ai-command-error"
          className="mt-2 flex gap-2 rounded-xl border border-red-300 bg-red-50 p-2 text-xs leading-5 text-red-900"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </section>
  );
}
