"use client";

// Unauthenticated Convex provider (D-06). Phase 7 has no WorkOS token, so this
// uses the PLAIN ConvexProvider — NEVER ConvexProviderWithAuth. Swapping to the
// auth variant is a Phase 10 change touching only this file.
//
// The ConvexReactClient is instantiated at MODULE SCOPE (once), not inside the
// component body, to avoid reconnect storms on re-render (Pitfall #5).
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Non-null assertion is deliberate: if NEXT_PUBLIC_CONVEX_URL is missing the
// client construction may proceed and only throws lazily on the first query,
// which is acceptable for the demo shell (the app still renders).
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export { convex };

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
