// Detour time validation via Google Directions API — port of detour_validator.py (D-18).
// Uses Google Directions (Valhalla retired in Phase 11).

export interface LatLonPoint {
  lat: number;
  lon: number;
}

interface DirectionsResponse {
  routes?: Array<{
    legs?: Array<{
      duration?: { value: number }; // seconds
    }>;
  }>;
  status?: string;
  error_message?: string;
}

async function getRouteDurationS(
  origin: LatLonPoint,
  dest: LatLonPoint,
  apiKey: string,
): Promise<number> {
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origin.lat},${origin.lon}&destination=${dest.lat},${dest.lon}` +
    `&key=${apiKey}&mode=driving`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Google Directions API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as DirectionsResponse;
  if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
    throw new Error(
      `Google Directions API returned no route: ${data.status ?? "unknown"} ${data.error_message ?? ""}`,
    );
  }
  const duration = data.routes[0].legs?.[0]?.duration?.value;
  if (duration == null) {
    throw new Error("Google Directions API: missing duration in response");
  }
  return duration;
}

async function getRouteDurationViaS(
  origin: LatLonPoint,
  charger: LatLonPoint,
  rejoin: LatLonPoint,
  apiKey: string,
): Promise<number> {
  // Google Directions supports waypoints — charger is a via point
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origin.lat},${origin.lon}&destination=${rejoin.lat},${rejoin.lon}` +
    `&waypoints=${charger.lat},${charger.lon}` +
    `&key=${apiKey}&mode=driving`;

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Google Directions API error: ${resp.status} ${resp.statusText}`);
  }
  const data = (await resp.json()) as DirectionsResponse;
  if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
    throw new Error(
      `Google Directions API returned no via-route: ${data.status ?? "unknown"} ${data.error_message ?? ""}`,
    );
  }
  // Sum all legs' durations
  let totalDuration = 0;
  const legs = data.routes[0].legs ?? [];
  for (const leg of legs) {
    if (leg.duration?.value) {
      totalDuration += leg.duration.value;
    }
  }
  return totalDuration;
}

/**
 * Return extra travel seconds for corridor→charger→rejoin vs direct continuation.
 * Port of detour_seconds from detour_validator.py — uses Google Directions API.
 */
export async function detourSeconds(
  origin: LatLonPoint,
  charger: LatLonPoint,
  rejoin: LatLonPoint,
  apiKey: string,
): Promise<number> {
  const [directS, viaS] = await Promise.all([
    getRouteDurationS(origin, rejoin, apiKey),
    getRouteDurationViaS(origin, charger, rejoin, apiKey),
  ]);
  return Math.max(0.0, viaS - directS);
}
