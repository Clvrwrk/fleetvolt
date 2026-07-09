"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { EpaCatalogEfficiencyCard } from "@/components/catalog/epa-catalog-efficiency-card";
import { FramedPanel } from "@/components/design/framed-panel";
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

  if (!slug || vehicle === undefined) {
    return (
      <FramedPanel maxWidthClass="max-w-[900px]">
        <SkeletonContent kpiCount={0} cardLines={8} />
      </FramedPanel>
    );
  }

  if (vehicle === null) {
    return (
      <FramedPanel maxWidthClass="max-w-[900px]">
        <Link
          href="/catalog"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--fv-accent)] no-underline hover:underline"
        >
          <ArrowLeft size={14} aria-hidden />
          Back to catalog
        </Link>
        <div className="py-12 text-center">
          <TechnicalLabel>NOT FOUND</TechnicalLabel>
          <h1 className="mt-2 text-lg font-bold text-[var(--fv-text)]">
            Catalog vehicle not found
          </h1>
          <p className="mt-2 text-sm text-[var(--fv-text-muted)]">
            No HVIP catalog entry matches &ldquo;{slug}&rdquo;.
          </p>
        </div>
      </FramedPanel>
    );
  }

  return (
    <FramedPanel maxWidthClass="max-w-[900px]">
      <Link
        href="/catalog"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--fv-accent)] no-underline hover:underline"
        data-testid="catalog-back-link"
      >
        <ArrowLeft size={14} aria-hidden />
        Back to catalog
      </Link>

      <EpaCatalogEfficiencyCard vehicle={vehicle} />

      <div className="fv-footer-credit mt-6 text-right">
        POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS
      </div>
    </FramedPanel>
  );
}
