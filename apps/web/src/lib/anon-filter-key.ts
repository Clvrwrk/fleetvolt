// Anonymous filter-key helper (D-07).
//
// Convex runs UNAUTHENTICATED in Phase 7 (D-06), so `userFilters` cannot key on
// a WorkOS subject id yet. Instead we mint a stable, session-surviving anonymous
// UUID on the client (localStorage) and use it as the `filterKey`. In Phase 10
// this trivially rekeys to a WorkOS subject id by swapping the key SOURCE — the
// shape (a string) and every call site stay identical.

/** localStorage key under which the anonymous filter UUID is persisted. */
export const ANON_FILTER_STORAGE_KEY = "fv-pulse-filter-key";

/** SSR / no-window fallback so server renders don't throw (D-07). */
export const ANON_FILTER_FALLBACK = "anonymous";

/**
 * Return a stable anonymous filterKey for the current browser.
 *
 * - On the client: reads the persisted UUID from localStorage, generating and
 *   persisting a fresh `crypto.randomUUID()` on first access.
 * - During SSR (or if localStorage is unavailable): returns the fixed
 *   "anonymous" fallback so the caller never crashes and reads still resolve.
 */
export function getAnonFilterKey(): string {
  if (typeof window === "undefined") {
    return ANON_FILTER_FALLBACK;
  }

  try {
    const existing = window.localStorage.getItem(ANON_FILTER_STORAGE_KEY);
    if (existing) return existing;

    const fresh =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(ANON_FILTER_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Private-mode / disabled storage — degrade to the singleton fallback.
    return ANON_FILTER_FALLBACK;
  }
}
