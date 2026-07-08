"use client";

// ── Phase 16 / Wave 5 / Task 5.2 + 5.3: Chat Panel ──────────────────────────
//
// Task 5.2: Error handling — errors render in a Caution Amber-bordered
// SkeuomorphicCard with a "Retry" SecondaryButton. No raw API paths visible.
//
// Task 5.3: Visual hierarchy — chat input de-emphasized to SecondaryButton/pill
// style. Role selector REMOVED (handled by sidebar). The only PrimaryButton on
// the planner page is "Run Simulation" (in the page, not here).
//
// UX checks: EMPTY-2 (human-readable errors with retry), VIS-1 (one primary action)

import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { RouteMap } from "./route-map";
import { Heatmap } from "./heatmap";
import { SkeuomorphicCard } from "@/components/design/skeuomorphic-card";
import { SecondaryButton } from "@/components/design/secondary-button";
import { TechnicalLabel } from "@/components/design/technical-label";
import { Send, Loader2, Sparkles, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type VizType = "heatmap" | "route_map" | "table" | "text";

interface PlannerResult {
  answer: string;
  visualization: { type: VizType; data: unknown };
  queries_run: { name: string; args: unknown; result_summary: unknown }[];
  role: string;
  model?: string;
  fallback?: boolean;
}

// Detect if an answer is an error message (from Task 5.2 error handling)
function isErrorResponse(result: PlannerResult): boolean {
  return (
    result.fallback === true &&
    (result.answer.includes("couldn't retrieve") ||
      result.answer.includes("couldn't connect") ||
      result.answer.includes("I couldn't") ||
      result.answer.includes("Error:"))
  );
}

const EXAMPLE_QUERIES: string[] = [
  "What class 8 chargers are available along my route from SF to Modesto? What amenities are available?",
  "I need to move 3 containers/day M-F from Port of SF to Modesto. How many trucks do I need?",
  "Show me charging infrastructure gaps for a fully laden drayage truck from Port of SF to Modesto on a heatmap.",
];

export function ChatPanel() {
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<PlannerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQueries, setShowQueries] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string>("");
  const planWithAi = useAction(api.planner.planWithAi);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [results, loading]);

  async function submit(msg?: string) {
    const text = msg ?? message;
    if (!text.trim() || loading) return;
    lastMessageRef.current = text;
    setMessage("");
    setLoading(true);
    try {
      const result = (await planWithAi({ message: text, role: "caas" })) as unknown as PlannerResult;
      setResults((prev) => [...prev, result]);
    } catch (e) {
      // Client-side error (network, action throw) — human-readable
      const errMsg = e instanceof Error ? e.message : String(e);
      setResults((prev) => [
        ...prev,
        {
          answer: `## I couldn't process your request\n\n${errMsg}\n\n**What to try:**\n- Check your network connection\n- Verify the Convex backend is running\n- Try again in a moment`,
          visualization: { type: "text", data: null },
          queries_run: [],
          role: "caas",
          fallback: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function retryLast() {
    if (lastMessageRef.current) {
      // Remove the last error result
      setResults((prev) => {
        if (prev.length > 0 && isErrorResponse(prev[prev.length - 1])) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      submit(lastMessageRef.current);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <Sparkles size={48} className="text-[var(--fv-accent,#3b82f6)]" />
            <h2 className="text-xl font-semibold text-[var(--fv-text,#e0e0e8)]">Plan with AI</h2>
            <p className="text-sm text-[var(--fv-text-muted,#888)] max-w-md">
              Ask any freight, charging, or planning question. I&apos;ll query the live data and give you a grounded answer with visualizations.
            </p>
            <div className="flex flex-col gap-2 mt-4 max-w-2xl w-full">
              {EXAMPLE_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => submit(q)}
                  className="text-left p-3 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)] text-sm text-[var(--fv-text,#e0e0e8)] hover:border-[var(--fv-accent,#3b82f6)] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {results.map((r, i) => {
          const isError = isErrorResponse(r);

          if (isError) {
            // Render error in a Caution Amber-bordered SkeuomorphicCard with Retry
            return (
              <div key={i}>
                <SkeuomorphicCard
                  padding="md"
                  className="border-2 border-[var(--fv-caution-amber)]"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      size={20}
                      className="text-[var(--fv-caution-amber)] flex-shrink-0 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <TechnicalLabel>ERROR</TechnicalLabel>
                      </div>
                      <div className="prose prose-sm prose-invert max-w-none text-[var(--fv-text,#e0e0e8)] whitespace-pre-wrap">
                        {String(r.answer)}
                      </div>
                      <div className="mt-4">
                        <SecondaryButton
                          onClick={retryLast}
                          className="flex items-center gap-2"
                        >
                          <RefreshCw size={14} />
                          Retry
                        </SecondaryButton>
                      </div>
                    </div>
                  </div>
                </SkeuomorphicCard>
              </div>
            );
          }

          // Normal result rendering
          return (
            <div key={i} className="space-y-3">
              {/* Visualization */}
              {r.visualization.type === "route_map" ? (
                <RouteMap data={r.visualization.data as Record<string, unknown>} />
              ) : null}
              {r.visualization.type === "heatmap" ? (
                <Heatmap data={r.visualization.data as Record<string, unknown>} />
              ) : null}
              {r.visualization.type === "table" ? (
                <ResultTable data={r.visualization.data as Record<string, unknown>} />
              ) : null}

              {/* Answer */}
              <div className="rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-[var(--fv-accent,#3b82f6)]" />
                  <span className="text-xs text-[var(--fv-text-muted,#888)]">
                    {r.model ? `AI Planner (${r.model})` : "AI Planner"}
                    {r.fallback && !isError && " — Fallback"}
                  </span>
                </div>
                <div className="prose prose-sm prose-invert max-w-none text-[var(--fv-text,#e0e0e8)] whitespace-pre-wrap">
                  {String(r.answer)}
                </div>
              </div>

              {/* Queries executed — internal names hidden by default */}
              {r.queries_run.length > 0 && (
                <div className="rounded-lg border border-[var(--fv-stroke,#2a2a3e)] overflow-hidden">
                  <button
                    onClick={() => setShowQueries((s) => ({ ...s, [i]: !s[i] }))}
                    className="w-full flex items-center justify-between p-2 bg-[var(--fv-surface,#1a1a2e)] text-xs text-[var(--fv-text-muted,#888)]"
                  >
                    <span>{r.queries_run.length} data {r.queries_run.length === 1 ? "query" : "queries"} executed</span>
                    {showQueries[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showQueries[i] && (
                    <div className="p-2 space-y-1">
                      {r.queries_run.map((q, j) => (
                        <div key={j} className="text-xs font-mono text-[var(--fv-text-muted,#888)] p-1.5 rounded bg-[var(--fv-bg,#0d0d1a)]">
                          {q.result_summary && typeof q.result_summary === "string" && q.result_summary.startsWith("ERROR:") ? (
                            <span className="text-[var(--fv-caution-amber)]">{q.result_summary}</span>
                          ) : (
                            <span>{q.result_summary ? String(q.result_summary) : "completed"}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--fv-text-muted,#888)]">
            <Loader2 size={16} className="animate-spin" />
            Planning...
          </div>
        )}
      </div>

      {/* Input — de-emphasized to pill/secondary style (Task 5.3) */}
      <div className="p-4 border-t border-[var(--fv-stroke,#2a2a3e)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ask about routes, chargers, or fleet planning..."
            className="flex-1 px-4 py-2.5 rounded-full bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)] text-sm text-[var(--fv-text,#e0e0e8)] placeholder:text-[var(--fv-text-muted,#555)] focus:outline-none focus:border-[var(--fv-accent,#3b82f6)]"
          />
          <button
            onClick={() => submit()}
            disabled={loading || !message.trim()}
            className="px-4 py-2.5 rounded-full bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] disabled:opacity-50 hover:border-[var(--fv-accent,#3b82f6)] transition-colors"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultTable({ data }: { data: unknown }) {
  const rows = (data as { rows?: unknown[] })?.rows ?? (Array.isArray(data) ? data : []);
  if (!Array.isArray(rows) || rows.length === 0) return <p className="text-sm text-[var(--fv-text-muted,#888)]">No data</p>;
  const keys = Object.keys(rows[0] as Record<string, unknown>).slice(0, 5);
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--fv-stroke,#2a2a3e)]">
      <table className="w-full text-xs">
        <thead className="bg-[var(--fv-surface,#1a1a2e)]">
          <tr>
            {keys.map((k) => <th key={k} className="p-2 text-left text-[var(--fv-text-muted,#888)]">{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((r, i) => (
            <tr key={i} className="border-t border-[var(--fv-stroke,#2a2a3e)]">
              {keys.map((k) => <td key={k} className="p-2 text-[var(--fv-text,#e0e0e8)]">{String((r as Record<string, unknown>)?.[k] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
