/**
 * Temporary alpha-access gate. Keep WorkOS integrated, but allow approved
 * non-production environments to bypass sign-in friction with one env flag.
 */
export const ALPHA_AUTH_BYPASS =
  process.env.NEXT_PUBLIC_FLEETVOLT_ALPHA_AUTH_BYPASS === "true";
