"use client";

// BriefPanel — renders the LLM-generated executive sales brief.
//
// Uses useAction(api.brief.generateSalesBrief) to call the Convex action which:
//   1. Fetches the hotspotReport payload (grounding)
//   2. Constructs the prompt per 15-AI-SPEC §3
//   3. Calls OpenAI (or returns fallback)
//   4. Returns {brief, grounded, model, fallback}
//
// Renders: loading skeleton, error state, or the brief as markdown text.
// Header shows: model name, "grounded" badge, fallback indicator.
// "Regenerate" button re-invokes the action.
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useCallback, useEffect } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { FvInsetCard } from "@/components/design/fv-inset-card";

export interface BriefPanelProps {
  lat: number;
  lng: number;
  hotspotId: Id<"hotspots">;
}

export function BriefPanel({ lat, lng, hotspotId }: BriefPanelProps) {
  const generateBrief = useAction(api.brief.generateSalesBrief);
  const [result, setResult] = useState<{
    brief: string;
    grounded: boolean;
    model: string;
    fallback: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateBrief({
        lat,
        lng,
        radiusM: 5000,
        hotspotId,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  }, [generateBrief, lat, lng, hotspotId]);

  // Auto-run on mount / when hotspot changes
  useState(() => {
    void run();
  });

  return (
    <FvInsetCard className="p-4" data-testid="brief-panel">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          AI Sales Brief
        </h3>
        <button
          onClick={() => void run()}
          disabled={loading}
          className="rounded border px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-line-subtle)] disabled:opacity-50"
          style={{ borderColor: "var(--color-line)" }}
        >
          {loading ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {/* Status badges */}
      {result && (
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{
              backgroundColor: "var(--color-line-subtle)",
              color: "var(--color-text-secondary)",
            }}
          >
            {result.model}
          </span>
          {result.grounded && (
            <span
              className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white"
              style={{ backgroundColor: "var(--color-accent-success, #2ecc71)" }}
            >
              grounded
            </span>
          )}
          {result.fallback && (
            <span
              className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white"
              style={{ backgroundColor: "var(--color-accent-warning, #f39c12)" }}
            >
              Template brief — LLM unavailable
            </span>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div
          data-testid="brief-loading"
          className="space-y-2"
        >
          <div className="h-4 animate-pulse rounded" style={{ backgroundColor: "var(--color-line-subtle)" }} />
          <div className="h-4 w-3/4 animate-pulse rounded" style={{ backgroundColor: "var(--color-line-subtle)" }} />
          <div className="h-4 w-1/2 animate-pulse rounded" style={{ backgroundColor: "var(--color-line-subtle)" }} />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Error: {error}
        </p>
      )}

      {/* Brief content — rendered as preformatted text for MVP */}
      {result && !loading && (
        <div
          data-testid="brief-content"
          className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]"
        >
          {result.brief}
        </div>
      )}
    </FvInsetCard>
  );
}
