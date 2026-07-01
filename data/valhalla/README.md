# Valhalla SoCal Routing Graph (D-14)

FleetVolt uses a **SoCal regional** OpenStreetMap extract — not a US West or national graph — for Class 8 truck routing via Valhalla.

The `socal.osm.pbf` file is **local-only** (~100 MB+) and is never committed to git.

## Bbox

`-121.0,32.5,-114.0,37.0` (west,south,east,north) — covers POLB, Inland Empire, Cajon Pass, and the southern NV border.

## Build the OSM extract

Primary workflow:

```bash
make valhalla-pbf
make valhalla-verify-pbf
```

Or run the script directly:

```bash
bash scripts/build_socal_pbf.sh
```

**Requirements:** `curl`, `osmium-tool` (`brew install osmium-tool` on macOS).

The script downloads `california-latest.osm.pbf` from [Geofabrik](https://download.geofabrik.de/north-america/us/california.html) (HTTPS) into `data/raw/osm/` (gitignored) and clips to `data/valhalla/custom_files/socal.osm.pbf`.

### Fallback without osmium

If `osmium-tool` is unavailable:

1. Install osmium-tool and re-run `make valhalla-pbf`, **or**
2. Set `VALHALLA_SOCAL_PBF_URL` to a trusted team prebuilt artifact (HTTPS) and re-run:

   ```bash
   export VALHALLA_SOCAL_PBF_URL="https://example.com/artifacts/socal.osm.pbf"
   make valhalla-pbf
   ```

   Only use URLs from trusted internal sources. The verify script prints SHA256 for integrity checking.

3. Manually place a pre-built `socal.osm.pbf` at `data/valhalla/custom_files/socal.osm.pbf` (same bbox), then run `make valhalla-verify-pbf`.

## Start Valhalla

```bash
docker compose up valhalla
```

The container mounts `./data/valhalla/custom_files` at `/custom_files` and builds routing tiles from `socal.osm.pbf`.

### First tile build: 30–90 minutes

The initial tile build is CPU-heavy and may take **30–90 minutes**. During this time:

- `make valhalla-status` or `curl http://localhost:8002/status` may return errors or show tiles still loading
- The Compose healthcheck uses a **3600s start period** so the container is not marked unhealthy prematurely
- Built tiles persist in `data/valhalla/custom_files/` on the host — subsequent starts are much faster

### Ready signal

Wait until status reports tiles loaded:

```bash
make valhalla-status
# or
curl -s http://localhost:8002/status | jq .
```

Look for `"tileset_last_modified"` or an `"available_actions"` entry including `"route"`.

## Verify truck route (POLB → San Bernardino)

With Valhalla ready and the simulator running:

```bash
curl "http://localhost:8000/v1/routing/route?origin_lat=33.754&origin_lon=-118.216&dest_lat=34.108&dest_lon=-117.290"
```

Expect `distance_m` > 50000 and non-empty `coordinates`.
