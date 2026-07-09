"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { FramedPanel } from "@/components/design/framed-panel";
import { PrimaryButton } from "@/components/design/primary-button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("FleetVolt error:", error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <FramedPanel className="max-w-md w-full">
        <div className="text-center space-y-4 p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--fv-alert-red)]/10">
            <AlertCircle size={32} className="text-[var(--fv-alert-red)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--fv-text)]">Something went wrong</h1>
          <p className="text-sm text-[var(--fv-text-muted)]">
            An unexpected error occurred. Your data is safe — try reloading the page.
          </p>
          {process.env.NODE_ENV === "development" && error.message ? (
            <p className="max-h-32 overflow-y-auto rounded-lg bg-black/5 px-3 py-2 text-left text-xs font-mono text-[var(--fv-text-muted)]">
              {error.message}
            </p>
          ) : null}
          {error.digest && (
            <p className="text-xs text-[var(--fv-text-muted)] font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <PrimaryButton onClick={reset} className="w-full">
            <RefreshCw size={16} className="mr-2" />
            Reload
          </PrimaryButton>
        </div>
      </FramedPanel>
    </div>
  );
}
