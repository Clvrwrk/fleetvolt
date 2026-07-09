"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type MapSoftBoundaryProps = {
  children: ReactNode;
  /** Optional label for console diagnostics. */
  label?: string;
};

type MapSoftBoundaryState = {
  failed: boolean;
  message: string | null;
};

/**
 * Catch Google Maps / AdvancedMarker runtime failures so a bad key, referrer
 * block, or marker init crash cannot white-screen the whole workbench.
 */
export class MapSoftBoundary extends Component<MapSoftBoundaryProps, MapSoftBoundaryState> {
  state: MapSoftBoundaryState = { failed: false, message: null };

  static getDerivedStateFromError(error: Error): MapSoftBoundaryState {
    return {
      failed: true,
      message: error?.message ? String(error.message) : "Map runtime error",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(
      `[MapSoftBoundary${this.props.label ? `:${this.props.label}` : ""}]`,
      error.message,
      info.componentStack,
    );
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          data-testid="map-soft-boundary-fallback"
          className="flex h-full min-h-[420px] w-full items-center justify-center p-4"
        >
          <Alert className="max-w-lg border-[var(--fv-stroke)] bg-[var(--fv-surface)]">
            <AlertTitle>Map unavailable</AlertTitle>
            <AlertDescription className="space-y-2 text-muted-foreground">
              <p>
                Google Maps failed to initialize. Tools and result cards still work — reload after
                the Maps API key / referrer allowlist is fixed.
              </p>
              {this.state.message ? (
                <p className="rounded-lg bg-black/5 px-3 py-2 font-mono text-xs text-[var(--fv-text-muted)]">
                  {this.state.message}
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
