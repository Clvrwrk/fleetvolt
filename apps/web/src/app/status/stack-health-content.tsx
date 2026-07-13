import Link from "next/link";

type StackMeta = {
  postgres_version: string;
  table_counts: Record<string, number>;
};

type NhfnStats = {
  segment_count: number;
  bbox_west: number | null;
  bbox_south: number | null;
  bbox_east: number | null;
  bbox_north: number | null;
  source_sample: string | null;
  ingested_at_max: string | null;
};

type DataFreshnessEntry = {
  dataset_name: string;
  last_ingested_at: string | null;
  row_count: number | null;
  source: string | null;
};

type ChargerNearEntry = {
  station_id: string;
  name: string | null;
  power_kw: number;
  hd_capable: boolean;
  operator: string | null;
  distance_m: number;
};

type TruckSummary = {
  id: number;
  name: string;
  nameplate_kwh: number;
  usable_kwh: number;
  version?: string;
  source_notes?: string;
};

type ServiceStatus = {
  name: string;
  ok: boolean;
  detail?: string;
};

async function fetchNhfnStats(): Promise<
  { ok: true; data: NhfnStats } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { ok: false, error: "API_URL not configured (Docker stack decommissioned)" };
  try {
    const response = await fetch(`${apiUrl}/v1/spatial/nhfn/stats`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
    const data = (await response.json()) as NhfnStats;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchStackMeta(): Promise<
  { ok: true; data: StackMeta } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { ok: false, error: "API_URL not configured (Docker stack decommissioned)" };
  try {
    const response = await fetch(`${apiUrl}/v1/meta/stack`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
    const data = (await response.json()) as StackMeta;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchTrucks(): Promise<
  { ok: true; data: TruckSummary[] } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { ok: false, error: "API_URL not configured (Docker stack decommissioned)" };
  try {
    const response = await fetch(`${apiUrl}/v1/trucks`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
    const data = (await response.json()) as TruckSummary[];
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchFreshness(): Promise<
  { ok: true; data: DataFreshnessEntry[] } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { ok: false, error: "API_URL not configured (Docker stack decommissioned)" };
  try {
    const response = await fetch(`${apiUrl}/v1/data/freshness`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
    const data = (await response.json()) as DataFreshnessEntry[];
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchChargersNearPolb(): Promise<
  { ok: true; data: ChargerNearEntry[] } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return { ok: false, error: "API_URL not configured (Docker stack decommissioned)" };
  const params = new URLSearchParams({
    lat: "33.754",
    lon: "-118.216",
    radius_m: "100000",
    hd_only: "true",
  });
  try {
    const response = await fetch(`${apiUrl}/v1/chargers/near?${params}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `API returned ${response.status}: ${await response.text()}`,
      };
    }
    const data = (await response.json()) as ChargerNearEntry[];
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function usablePct(truck: TruckSummary): string {
  const pct = (truck.usable_kwh / truck.nameplate_kwh) * 100;
  return `${pct.toFixed(1)}%`;
}

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-bad"}`}>
      {ok ? "ok" : "down"}
    </span>
  );
}

export default async function StackHealthPage() {
  const [result, nhfnResult, trucksResult, freshnessResult, chargersResult] =
    await Promise.all([
      fetchStackMeta(),
      fetchNhfnStats(),
      fetchTrucks(),
      fetchFreshness(),
      fetchChargersNearPolb(),
    ]);

  if (!result.ok) {
    return (
      <div>
        <h1>FleetVolt Route</h1>
        <p className="subtitle">Local stack status</p>
        <div className="card">
          <p className="error">Failed to load stack metadata: {result.error}</p>
          <div className="service-row">
            <span>web</span>
            <Badge ok={true} />
          </div>
          <div className="service-row">
            <span>api</span>
            <Badge ok={false} />
          </div>
          <div className="service-row">
            <span>simulator</span>
            <Badge ok={false} />
          </div>
          <div className="service-row">
            <span>postgres</span>
            <Badge ok={false} />
          </div>
        </div>
      </div>
    );
  }

  const { data } = result;
  const postgresOk =
    Boolean(data.postgres_version) &&
    data.table_counts !== undefined &&
    Object.keys(data.table_counts).length > 0;

  const services: ServiceStatus[] = [
    { name: "web", ok: true },
    { name: "api", ok: true },
    { name: "simulator", ok: true },
    {
      name: "postgres",
      ok: postgresOk,
      detail: data.postgres_version.split(" ")[0],
    },
  ];

  const chargerFreshness = freshnessResult.ok
    ? freshnessResult.data.find((d) => d.dataset_name === "nrel_afdc_chargers")
    : undefined;
  const hdChargerCount = chargersResult.ok ? chargersResult.data.length : null;
  const totalChargerCount = data.table_counts.chargers ?? 0;

  return (
    <div>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/" className="fv-nav-pill" style={{ display: "inline-block" }}>
          ← Home
        </Link>
        {" · "}
        <Link href="/planner" className="fv-nav-pill" style={{ display: "inline-block" }}>
          Route Planner
        </Link>
      </p>
      <h1>FleetVolt Route</h1>
      <p className="subtitle">
        Live stack health — Next.js → Fastify → FastAPI → PostGIS
      </p>

      <div className="card">
        <h2>Services</h2>
        {services.map((service) => (
          <div key={service.name} className="service-row">
            <span>{service.name}</span>
            <span>
              {service.detail && (
                <span className="mono" style={{ marginRight: "0.75rem" }}>
                  {service.detail}
                </span>
              )}
              <Badge ok={service.ok} />
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Postgres</h2>
        <p className="mono">{data.postgres_version}</p>
      </div>

      <div className="card">
        <h2>Spatial data</h2>
        {nhfnResult.ok ? (
          <table>
            <tbody>
              <tr>
                <td>NHFN segments</td>
                <td>{nhfnResult.data.segment_count}</td>
              </tr>
              {nhfnResult.data.source_sample && (
                <tr>
                  <td>NHFN source</td>
                  <td className="mono">{nhfnResult.data.source_sample}</td>
                </tr>
              )}
              {nhfnResult.data.ingested_at_max && (
                <tr>
                  <td>NHFN last ingested</td>
                  <td className="mono">{nhfnResult.data.ingested_at_max}</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <p className="error">NHFN stats unavailable: {nhfnResult.error}</p>
        )}
      </div>

      <div className="card">
        <h2>Spatial table row counts</h2>
        <table>
          <thead>
            <tr>
              <th>Table</th>
              <th>Rows</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.table_counts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([table, count]) => (
                <tr key={table}>
                  <td>{table}</td>
                  <td>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Chargers (NREL AFDC)</h2>
        {freshnessResult.ok ? (
          <>
            <p>
              Total in database: <strong>{totalChargerCount}</strong>
              {hdChargerCount !== null && (
                <>
                  {" "}
                  · HD-capable within 100 km of POLB:{" "}
                  <strong>{hdChargerCount}</strong>
                </>
              )}
            </p>
            {chargerFreshness?.last_ingested_at ? (
              <p className="mono">
                nrel_afdc_chargers last ingested:{" "}
                {new Date(chargerFreshness.last_ingested_at).toLocaleString()}
              </p>
            ) : (
              <p>
                No freshness record yet. Run{" "}
                <code>python -m data.ingest.refresh_chargers --fixture</code>.
              </p>
            )}
          </>
        ) : (
          <p className="error">
            Failed to load freshness: {freshnessResult.error}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Truck configs</h2>
        {trucksResult.ok ? (
          trucksResult.data.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Usable / Nameplate</th>
                  <th>Usable %</th>
                </tr>
              </thead>
              <tbody>
                {trucksResult.data.map((truck) => (
                  <tr key={truck.id}>
                    <td>{truck.name}</td>
                    <td className="mono">
                      {truck.usable_kwh} / {truck.nameplate_kwh} kWh
                    </td>
                    <td>{usablePct(truck)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No truck configs seeded yet. Run <code>python -m data.ingest.seed_trucks</code>.</p>
          )
        ) : (
          <p className="error">Failed to load trucks: {trucksResult.error}</p>
        )}
      </div>
    </div>
  );
}
