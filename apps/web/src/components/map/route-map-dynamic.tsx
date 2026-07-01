"use client";

import dynamic from "next/dynamic";
import type { RouteMapProps } from "./route-map";

export const RouteMapDynamic = dynamic<RouteMapProps>(
  () => import("./route-map").then((module) => module.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[360px] animate-pulse rounded-lg bg-[var(--fv-surface)]"
        data-testid="route-map-loading"
      />
    ),
  },
);
