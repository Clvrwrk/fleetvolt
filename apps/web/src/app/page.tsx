type StackMeta = {
  postgres_version: string;
  table_counts: Record<string, number>;
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

async function fetchStackMeta(): Promise<
  { ok: true; data: StackMeta } | { ok: false; error: string }
> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
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
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
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

export default async function HomePage() {
  const [result, trucksResult] = await Promise.all([
    fetchStackMeta(),
    fetchTrucks(),
  ]);

  if (!result.ok) {
    return (
      <main>
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
      </main>
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

  return (
    <main>
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
    </main>
  );
}
