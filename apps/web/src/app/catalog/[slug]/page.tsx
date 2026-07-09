"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { EpaCatalogEfficiencyCard } from "@/components/catalog/epa-catalog-efficiency-card";
import { SkeletonContent } from "@/components/design/skeleton-card";
import { TechnicalLabel } from "@/components/design/technical-label";
import { ArrowLeft } from "lucide-react";

export default function CatalogDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const vehicle = useQuery(
    api.catalog.queries.getBySlug,
    slug ? { slug } : "skip",
  );

  return (
    <div
      data-testid="catalog-detail-shell"
      className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none bg-[var(--fv-bg)]"
    >
      <div className="border-b border-black/8 bg-[var(--fv-paper)] px-5 py-4 md:px-8">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--fv-accent)] no-underline hover:underline"
          data-testid="catalog-back-link"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to catalog
        </Link>
      </div>

      <div className="mx-auto w-full max-w-5xl px-5 py-6 md:px-8">
        {!slug || vehicle === undefined ? (
          <SkeletonContent kpiCount={0} cardLines={8} />
        ) : vehicle === null ? (
          <div className="py-12 text-center">
            <TechnicalLabel>NOT FOUND</TechnicalLabel>
            <h1 className="mt-2 text-lg font-bold text-[var(--fv-text)]">
              Catalog vehicle not found
            </h1>
            <p className="mt-2 text-sm text-[var(--fv-text-muted)]">
              No HVIP catalog entry matches &ldquo;{slug}&rdquo;.
            </p>
          </div>
        ) : (
          <>
            {vehicle.imageUrl ? (
              <div className="mb-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vehicle.imageUrl}
                  alt=""
                  className="max-h-72 w-full object-contain bg-[var(--fv-surface-muted)]"
                />
              </div>
            ) : null}
            <EpaCatalogEfficiencyCard vehicle={vehicle} />
            <div className="fv-footer-credit mt-6 text-right">
              POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
            </div>
          </>
        )}
      </div>
    </div>
  );
}
