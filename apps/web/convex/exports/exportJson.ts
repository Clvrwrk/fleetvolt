// JSON export helper — trivial serialization of the full simulation response.
// Convex/Vercel safe: no Node APIs.

export function exportJson(simulation: unknown): string {
  return JSON.stringify(simulation, null, 2);
}
