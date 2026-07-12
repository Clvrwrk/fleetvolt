"use client";

import { useQuery } from "convex/react";
import { X } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { TechnicalLabel } from "@/components/design/technical-label";

export type PortDetailPopupProps = {
  portCode: string | null;
  onClose: () => void;
};

function formatTeu(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return `${(n / 1_000_000).toFixed(2)}M TEU`;
}

/** Card overlay with port TEU + nearby Major Traffic Generators. */
export function PortDetailPopup({ portCode, onClose }: PortDetailPopupProps) {
  const detail = useQuery(
    api.generators.queries.portPopup,
    portCode ? { portCode, radiusMiles: 20 } : "skip",
  );

  if (!portCode) return null;

  return (
    <div
      data-testid="port-detail-popup"
      className="pointer-events-auto absolute bottom-4 left-4 z-20 w-[min(100%-2rem,22rem)] rounded-2xl border border-black/10 bg-white/95 p-4 shadow-xl backdrop-blur md:left-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <TechnicalLabel>PORT</TechnicalLabel>
          <h3 className="text-base font-bold text-[var(--fv-graphite)]">
            {detail?.name ?? portCode}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-[var(--fv-steel)]">
            {portCode}
            {detail?.provenanceYear ? ` · ${detail.provenanceYear}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-[var(--fv-steel)] hover:bg-black/5"
          aria-label="Close port details"
        >
          <X size={16} />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-[var(--fv-canvas)] px-2.5 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--fv-steel)]">
            Annual TEU
          </dt>
          <dd className="mt-0.5 font-semibold text-[var(--fv-graphite)]">
            {detail === undefined ? "…" : formatTeu(detail?.annualTEU)}
          </dd>
        </div>
        <div className="rounded-lg bg-[var(--fv-canvas)] px-2.5 py-2">
          <dt className="font-mono text-[9px] uppercase tracking-wider text-[var(--fv-steel)]">
            Generators
          </dt>
          <dd className="mt-0.5 font-semibold text-[var(--fv-graphite)]">
            {detail === undefined ? "…" : (detail?.generators.length ?? 0)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
        <TechnicalLabel>Nearby traffic generators</TechnicalLabel>
        {detail === undefined ? (
          <p className="text-xs text-[var(--fv-text-muted)]">Loading…</p>
        ) : !detail || detail.generators.length === 0 ? (
          <p className="text-xs text-[var(--fv-text-muted)]">
            No generators loaded yet — run generators ingest.
          </p>
        ) : (
          detail.generators.slice(0, 12).map((g) => (
            <div
              key={g.generatorId}
              className="rounded-lg border border-black/6 px-2.5 py-2"
            >
              <p className="truncate text-xs font-semibold text-[var(--fv-graphite)]">
                {g.name}
              </p>
              <p className="truncate text-[10px] text-[var(--fv-text-muted)]">
                {g.assoc}
                {g.distanceMiles != null ? ` · ${g.distanceMiles} mi` : ""}
              </p>
              <p className="truncate text-[10px] text-[var(--fv-steel)]">
                {g.address}
                {g.city ? `, ${g.city}` : ""}
              </p>
            </div>
          ))
        )}
      </div>

      <a
        href={`/caas?view=summary&carriers=1&port=${encodeURIComponent(portCode)}`}
        data-testid="port-carriers-link"
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--fv-blueprint-blue)]/30 bg-[var(--fv-blueprint-blue)]/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--fv-blueprint-blue)] hover:bg-[var(--fv-blueprint-blue)]/15"
      >
        See carriers near this port
      </a>
    </div>
  );
}
