/**
 * /health — production health endpoint for Vercel + manual verification.
 * Returns JSON with status, timestamp, and service env-var presence (boolean).
 * Does NOT make external network calls — fast and non-blocking.
 */
export async function GET() {
  const convexConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
  const googleMapsConfigured = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  );

  return Response.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        convex: convexConfigured,
        googleMaps: googleMapsConfigured,
      },
    },
    { status: 200 },
  );
}
