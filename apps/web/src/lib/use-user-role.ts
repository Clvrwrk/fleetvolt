// Re-export useUserRole from auth.ts for convenience.
// The hook is defined in auth.ts alongside useWorkOSAuth since they share
// the Convex auth state. This file provides the import path referenced in
// the Phase 16 plan (apps/web/src/lib/use-user-role.ts).
export { useUserRole } from "./auth";
export type { FleetVoltRole } from "./auth";
