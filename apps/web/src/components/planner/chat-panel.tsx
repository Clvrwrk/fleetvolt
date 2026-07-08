"use client";

import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { RouteMap } from "./route-map";
import { Heatmap } from "./heatmap";
import { Send, Loader2, Sparkles, Truck, Users, Building2, ChevronDown, ChevronUp } from "lucide-react";

type Role = "driver" | "fleet_manager" | "caas";
type VizType = "heatmap" | "route_map" | "table" | "text";

interface PlannerResult {
  answer: string;
  visualization: { type: VizType; data: unknown };
  queries_run: { name: string; args: unknown; result_summary: unknown }[];
  role: Role;
  model?: string;
  fallback?: boolean;
}

const ROLE_CONFIG: Record<Role, { label: string; icon: typeof Truck; placeholder: string }> = {
  driver: { label: "Driver", icon: Truck, placeholder: "What chargers are on my route? Can I do 3 runs in 10 hours?" },
  fleet_manager: { label: "Fleet Manager", icon: Users, placeholder: "How many trucks do I need for 3 containers/day SF→Modesto?" },
  caas: { label: "CaaS", icon: Building2, placeholder: "Show me charger gaps for SF→Modesto drayage on a heatmap. Top 10 carriers?" },
};

const EXAMPLE_QUERIES: Record<Role, string[]> = {
  driver: [
    "What class 8 chargers are available along my route from SF to Modesto? What amenities are available? Can I do 3 runs under 10 hours?",
  ],
  fleet_manager: [
    "I need to move 3 containers/day M-F from Port of SF to Modesto. How many trucks do I need? What charging do I need at my Modesto yard by 4:30AM?",
  ],
  caas: [
    "Show me charging infrastructure gaps for a fully laden drayage truck from Port of SF to Modesto on a heatmap. Who are the top 10 carriers in this region?",
  ],
};

export function ChatPanel({ defaultRole = "caas" }: { defaultRole?: Role }) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<PlannerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQueries, setShowQueries] = useState<Record<number, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const planWithAi = useAction(api.planner.planWithAi);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [results, loading]);

  async function submit(msg?: string) {
    const text = msg ?? message;
    if (!text.trim() || loading) return;
    setMessage("");
    setLoading(true);
    try {
      const result = (await planWithAi({ message: text, role })) as unknown as PlannerResult;
      setResults((prev) => [...prev, result]);
    } catch (e) {
      setResults((prev) => [
        ...prev,
        { answer: `Error: ${(e as Error).message}`, visualization: { type: "text", data: null }, queries_run: [], role },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Role selector */}
      <div className="flex gap-2 p-3 border-b border-[var(--fv-stroke,#2a2a3e)]">
        {(Object.keys(ROLE_CONFIG) as Role[]).map((r) => {
          const cfg = ROLE_CONFIG[r];
          const Icon = cfg.icon;
          const active = role === r;
          return (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--fv-accent,#3b82f6)] text-white"
                  : "bg-[var(--fv-surface,#1a1a2e)] text-[var(--fv-text,#e0e0e8)] hover:bg-[var(--fv-surface-hover,#24244a)]"
              }`}
            >
              <Icon size={16} />
              {cfg.label}
            </button>
          );
        })}
      </div>

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
              {EXAMPLE_QUERIES[role].map((q, i) => (
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

        {results.map((r, i) => (
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
                  {r.fallback && " — Fallback"}
                </span>
              </div>
              <div className="prose prose-sm prose-invert max-w-none text-[var(--fv-text,#e0e0e8)] whitespace-pre-wrap">
                {String(r.answer)}
              </div>
            </div>

            {/* Queries executed */}
            {r.queries_run.length > 0 && (
              <div className="rounded-lg border border-[var(--fv-stroke,#2a2a3e)] overflow-hidden">
                <button
                  onClick={() => setShowQueries((s) => ({ ...s, [i]: !s[i] }))}
                  className="w-full flex items-center justify-between p-2 bg-[var(--fv-surface,#1a1a2e)] text-xs text-[var(--fv-text-muted,#888)]"
                >
                  <span>{r.queries_run.length} queries executed</span>
                  {showQueries[i] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showQueries[i] && (
                  <div className="p-2 space-y-1">
                    {r.queries_run.map((q, j) => (
                      <div key={j} className="text-xs font-mono text-[var(--fv-text-muted,#888)] p-1.5 rounded bg-[var(--fv-bg,#0d0d1a)]">
                        <span className="text-[var(--fv-accent,#3b82f6)]">{q.name}</span>
                        <span className="text-[var(--fv-text-muted,#666)]">({JSON.stringify(q.args).slice(0, 80)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--fv-text-muted,#888)]">
            <Loader2 size={16} className="animate-spin" />
            Planning...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--fv-stroke,#2a2a3e)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={ROLE_CONFIG[role].placeholder}
            className="flex-1 px-4 py-3 rounded-lg bg-[var(--fv-surface,#1a1a2e)] border border-[var(--fv-stroke,#2a2a3e)] text-[var(--fv-text,#e0e0e8)] placeholder:text-[var(--fv-text-muted,#555)] focus:outline-none focus:border-[var(--fv-accent,#3b82f6)]"
          />
          <button
            onClick={() => submit()}
            disabled={loading || !message.trim()}
            className="px-4 py-3 rounded-lg bg-[var(--fv-accent,#3b82f6)] text-white disabled:opacity-50 hover:bg-[var(--fv-accent-hover,#2985f5)] transition-colors"
          >
            <Send size={18} />
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
