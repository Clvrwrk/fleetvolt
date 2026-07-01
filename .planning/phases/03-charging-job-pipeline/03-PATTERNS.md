# Phase 3: Charging & Job Pipeline - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 27
**Analogs found:** 22 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/simulator/app/simulation/charge_curve.py` | utility | transform | `services/simulator/app/simulation/soc_integrator.py` | role-match |
| `services/simulator/app/simulation/charging_planner.py` | service | batch | `services/simulator/app/simulation/orchestrator.py` | partial |
| `services/simulator/app/simulation/feasibility.py` | service | transform | `services/simulator/app/simulation/overrides.py` | role-match |
| `services/simulator/app/simulation/detour_validator.py` | utility | request-response | `services/simulator/app/simulation/route_provider.py` | exact |
| `services/simulator/app/simulation/inputs_hash.py` | utility | transform | — | no analog |
| `services/simulator/app/simulation/orchestrator.py` | service | batch | `services/simulator/app/simulation/orchestrator.py` (extend) | exact |
| `services/simulator/app/simulation/route_provider.py` | service | request-response | `services/simulator/app/simulation/route_provider.py` (extend) | exact |
| `services/simulator/app/simulation/schemas.py` | model | transform | `services/simulator/app/simulation/schemas.py` (extend) | exact |
| `services/simulator/app/routes/simulate.py` | route | request-response | `services/simulator/app/routes/simulate.py` | exact |
| `services/simulator/app/routes/simulations.py` | route | request-response | `services/simulator/app/routes/simulate.py` | role-match |
| `services/simulator/app/worker.py` | config | event-driven | — | no analog |
| `services/simulator/app/main.py` | config | request-response | `services/simulator/app/main.py` (extend) | exact |
| `services/simulator/alembic/versions/003_simulation_runs.py` | migration | CRUD | `services/simulator/alembic/versions/001_spatial_core.py` | exact |
| `services/simulator/tests/test_charge_curve.py` | test | transform | `services/simulator/tests/test_physics_engine.py` | role-match |
| `services/simulator/tests/test_charging_planner.py` | test | batch | `services/simulator/tests/test_simulate_api.py` | partial |
| `services/simulator/tests/test_feasibility.py` | test | transform | `services/simulator/tests/test_overrides.py` | role-match |
| `services/simulator/tests/test_simulations_job.py` | test | event-driven | `services/simulator/tests/test_valhalla_route.py` | partial |
| `services/simulator/tests/test_inputs_hash.py` | test | transform | `services/simulator/tests/test_physics_engine.py` | role-match |
| `services/simulator/tests/test_simulate_api.py` | test | request-response | `services/simulator/tests/test_simulate_api.py` (extend) | exact |
| `services/api/src/db.ts` | config | CRUD | `services/simulator/app/db.py` | partial |
| `services/api/src/simulations.ts` | route | CRUD | `services/api/src/index.ts` | partial |
| `services/api/src/inputs_hash.ts` | utility | transform | — | no analog |
| `services/api/src/index.ts` | route | request-response | `services/api/src/index.ts` (extend) | exact |
| `packages/shared/inputs-hash-spec.md` | config | transform | — | no analog |
| `docker-compose.yml` | config | event-driven | `docker-compose.yml` (extend) | exact |
| `services/simulator/docs/model_assumptions.md` | config | file-I/O | `services/simulator/docs/model_assumptions.md` (extend) | exact |
| `packages/shared-types/src/schema.d.ts` | model | transform | `services/simulator/app/simulation/schemas.py` | partial |

## Pattern Assignments

### `services/simulator/app/simulation/charge_curve.py` (utility, transform)

**Analog:** `services/simulator/app/simulation/soc_integrator.py`

**Imports pattern** (lines 1-8):
```python
"""Sequential SoC forward integration with regen caps (PHYS-05)."""

from __future__ import annotations

import numpy as np

from app.simulation.constants import MPS_PER_MPH
from app.simulation.physics_engine import TruckParams
```

**Core numeric loop pattern** (lines 11-56):
```python
def integrate_soc(
    p_traction_w: np.ndarray,
    p_aux_w: np.ndarray,
    dist_m: np.ndarray,
    speed_mph: np.ndarray,
    truck: TruckParams,
    *,
    initial_soc_pct: float = 100.0,
) -> dict[str, np.ndarray]:
    """Integrate SoC segment-by-segment with SOC-dependent regen limits."""
    n = len(dist_m)
    # ... array setup ...
    soc = float(initial_soc_pct)
    for i in range(n):
        # ... per-band computation using truck.usable_kwh ...
        soc -= (net_kwh / truck.usable_kwh) * 100.0
        soc_pct[i] = soc
    return {"soc_pct": soc_pct, "energy_kwh": energy_kwh, "regen_kwh": regen_kwh}
```

**Charge curve input shape** — copy from `data/trucks/ecascadia_438.json` (lines 13-18):
```json
"charge_curve": [
  { "soc_pct": 10, "max_kw": 350 },
  { "soc_pct": 40, "max_kw": 320 },
  { "soc_pct": 70, "max_kw": 180 },
  { "soc_pct": 90, "max_kw": 80 }
]
```

**Pattern to copy:** Pure function, no DB/HTTP; band-wise loop using `usable_kwh` (not nameplate); return `(dwell_s, energy_kwh, departure_soc_pct)` tuple.

---

### `services/simulator/app/simulation/charging_planner.py` (service, batch)

**Analog:** `services/simulator/app/simulation/orchestrator.py` + `services/simulator/app/routes/chargers.py`

**Orchestrator pipeline pattern** (orchestrator.py lines 159-275):
```python
def run_simulation(
    db: Session,
    request: SimulateRequest,
    *,
    route_provider: RouteProvider | None = None,
    elevation_service: ElevationService | None = None,
) -> SimulateResponse:
    """Synchronous simulation pipeline per D-01."""
    provider = route_provider or RouteProvider()
    # ... route → elevation → segments → physics → soc → kpis ...
    soc_result = integrate_soc(p_traction, p_aux, dist_m, speed_arr, truck)
    segments = [SegmentResult(...) for i in range(len(raw_segments))]
    return SimulateResponse(segments=segments, kpis=KpiResult(**kpis_raw), ...)
```

**Spatial charger search pattern** (chargers.py lines 44-68):
```python
rows = db.execute(
    text(
        f"""
        SELECT station_id, name, power_kw, hd_capable, operator,
               ST_Distance(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS distance_m
        FROM chargers
        WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_m)
        {hd_clause}
        ORDER BY distance_m
        """
    ),
    {"lat": lat, "lon": lon, "radius_m": radius_m},
).mappings().all()
```

**Geo interpolation at segment index** (segment_builder.py lines 69-98):
```python
def interpolate_point_at_dist(
    coordinates: list[list[float]],
    dist_m: float,
) -> tuple[float, float]:
    """Interpolate (lon, lat) at distance along route polyline."""
    # ... haversine cumulative distance ...
    return float(lon), float(lat)
```

**Pattern to copy:** Extract planner as `plan_greedy_stops(db, segments, soc_pct, coordinates, truck, charge_curve, conditions, route_provider)` called from orchestrator after physics; reuse inline SQL from chargers route (not HTTP to self); post-filter `power_kw >= 350`; call `interpolate_point_at_dist` for low-SoC trigger point.

---

### `services/simulator/app/simulation/feasibility.py` (service, transform)

**Analog:** `services/simulator/app/simulation/overrides.py`

**Imports + pure classifier pattern** (overrides.py lines 1-38):
```python
"""Override merge and assumptions audit trail (D-14)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.simulation.physics_engine import TruckParams
from app.simulation.schemas import AssumptionEntry, OverridesSpec

def validate_override_bounds(field: str, value: float, oem_default: float) -> None:
    """Reject override values outside ±20% of OEM default."""
    low = oem_default * (1.0 - BOUNDS_TOLERANCE)
    high = oem_default * (1.0 + BOUNDS_TOLERANCE)
    if value < low or value > high:
        raise HTTPException(status_code=422, detail=(...))
```

**Pattern to copy:** Pure `classify_feasibility(stops, final_soc_pct, conditions) -> FeasibilityResult` with no side effects; verdict enum literals in return model; optional shadow-pass for `depot_required` tier per RESEARCH recommendation.

---

### `services/simulator/app/simulation/detour_validator.py` (utility, request-response)

**Analog:** `services/simulator/app/simulation/route_provider.py`

**Truck costing body pattern** (route_provider.py lines 217-232):
```python
def _route_body(
    self,
    origin_lat: float,
    origin_lon: float,
    dest_lat: float,
    dest_lon: float,
) -> dict:
    return {
        "locations": [
            {"lat": origin_lat, "lon": origin_lon},
            {"lat": dest_lat, "lon": dest_lon},
        ],
        "costing": "truck",
        "costing_options": {"truck": CLASS8_TRUCK_OPTIONS},
        "shape_format": "geojson",
    }
```

**HTTP call + error handling** (route_provider.py lines 245-263):
```python
with httpx.Client() as client:
    status_payload = _valhalla_status(client, self.base_url)
    if not _valhalla_ready(status_payload):
        raise RuntimeError("Valhalla routing service unavailable ...")
    try:
        response = client.post(f"{self.base_url}/route", json=route_body, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Valhalla route request failed: {exc}") from exc
    return parse_route_response(response.json())
```

**Pattern to copy:** Add `get_route_via()` on `RouteProvider` with multi-location `via` type; `detour_seconds = via.duration_s - direct.duration_s`; reuse `CLASS8_TRUCK_OPTIONS` and `parse_route_response` — do not hand-roll haversine detour.

---

### `services/simulator/app/simulation/inputs_hash.py` (utility, transform)

**Analog:** None in codebase — use RESEARCH Pattern 5 (canonical JSON → SHA-256).

**Reference spec from RESEARCH.md:**
1. Hash input: `{ scenario, physics_version, charger_version }`
2. Recursively sort object keys
3. JSON serialize: no whitespace, UTF-8
4. Round floats to 6 decimal places
5. `hashlib.sha256(canonical_bytes).hexdigest()`

**Cross-language test vector pattern** — mirror `test_physics_engine.py` fixture loading (lines 21-28):
```python
PROJECT_ROOT = Path(__file__).resolve().parents[3]
REFERENCE_CASES_PATH = PROJECT_ROOT / "data" / "validation" / "reference_cases.json"
```

---

### `services/simulator/app/simulation/orchestrator.py` (service, batch) — MODIFY

**Analog:** Self (extend existing pipeline)

**Extension hook pattern** (orchestrator.py lines 242-275):
```python
soc_result = integrate_soc(p_traction, p_aux, dist_m, speed_arr, truck)
kpis_raw = aggregate_kpis(...)
segments = [SegmentResult(...) for i in range(len(raw_segments))]

return SimulateResponse(
    segments=segments,
    kpis=KpiResult(**kpis_raw),
    disclaimer=DISCLAIMER,
    assumptions=assumptions,
    ...
)
```

**Truck file payload load** (orchestrator.py lines 94-137):
```python
def _load_truck_params(db: Session, slug: str, conditions: ConditionsSpec) -> tuple[TruckParams, dict, dict]:
    truck_path = TRUCKS_DIR / f"{slug}.json"
    with truck_path.open(encoding="utf-8") as handle:
        file_payload = json.load(handle)
    # ... DB merge into TruckParams ...
    return truck, params, file_payload
```

**Pattern to copy:** After `integrate_soc`, if `options.include_charging` (new field): call planner with `file_payload["charge_curve"]`, inject SoC forward on same arrays, annotate segments with `charging_event`/`stop_sequence`, attach `charging_stops` and `feasibility` to response. Add `include_charging: bool = True` kwarg to `run_simulation` for worker reuse.

**Error handling** (orchestrator.py lines 203-217):
```python
except ElevationServiceError as exc:
    raise HTTPException(status_code=422, detail=str(exc)) from exc
except RuntimeError as exc:
    raise HTTPException(status_code=503, detail=str(exc)) from exc
except ValueError as exc:
    raise HTTPException(status_code=422, detail=str(exc)) from exc
```

---

### `services/simulator/app/simulation/route_provider.py` (service, request-response) — MODIFY

**Analog:** Self — add multi-stop method alongside `get_route`.

**Dataclass + Pydantic response models** (route_provider.py lines 34-46):
```python
class RouteGeometry(BaseModel):
    distance_m: float = Field(description="Route length in meters")
    duration_s: float = Field(description="Estimated travel time in seconds")
    coordinates: list[list[float]] = Field(default_factory=list, ...)
```

**Pattern to copy:** New `get_route_locations(locations: list[dict]) -> RouteGeometry` sharing `_route_body` truck costing; used by detour_validator only.

---

### `services/simulator/app/simulation/schemas.py` (model, transform) — MODIFY

**Analog:** Self — extend existing Pydantic v2 models.

**Nested request pattern** (schemas.py lines 78-83):
```python
class SimulateRequest(BaseModel):
    route: RouteSpec
    truck: TruckSpec
    conditions: ConditionsSpec = Field(default_factory=ConditionsSpec)
    overrides: OverridesSpec = Field(default_factory=OverridesSpec)
```

**Enum + Field validation** (schemas.py lines 11-15, 52-55):
```python
class WeatherPreset(str, Enum):
    ideal = "ideal"
    hot = "hot"
    ...

class ConditionsSpec(BaseModel):
    weather_preset: WeatherPreset = WeatherPreset.ideal
    payload_lbs: float = Field(default=0, ge=0, le=80000)
```

**Response extension pattern** (schemas.py lines 85-107):
```python
class SegmentResult(BaseModel):
    dist_m: float
    grade: float
    speed: float
    energy_kwh: float
    soc_pct: float

class SimulateResponse(BaseModel):
    segments: list[SegmentResult]
    kpis: KpiResult
    disclaimer: str
    assumptions: list[AssumptionEntry] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
```

**Pattern to copy:** Add `ChargingConditionsSpec` nested under `ConditionsSpec` (soc_trigger_pct, soc_floor_pct, target_soc_pct, min_arrival_soc_pct); add `SimulateOptions` with `include_charging: bool = True`; add `ChargingStopResult`, `FeasibilityResult`; extend `SegmentResult` with optional `charging_event: bool = False`, `stop_sequence: int | None = None`; add job models in same file or separate module imported by simulations route.

---

### `services/simulator/app/routes/simulate.py` (route, request-response) — MODIFY

**Analog:** Self

**Thin route handler** (simulate.py lines 14-22):
```python
router = APIRouter(prefix="/v1", tags=["simulate"])

@router.post("/simulate", response_model=SimulateResponse)
def simulate(
    body: SimulateRequest,
    db: Annotated[Session, Depends(get_db)],
) -> SimulateResponse:
    return run_simulation(db, body)
```

**Pattern to copy:** No logic in route — delegate to orchestrator; response_model auto-documents new fields once schemas extended.

---

### `services/simulator/app/routes/simulations.py` (route, request-response) — NEW

**Analog:** `services/simulator/app/routes/simulate.py` + DB update pattern from orchestrator

**Route registration pattern** (simulate.py + main.py lines 17-30):
```python
from app.db import get_db
from app.simulation.orchestrator import run_simulation

router = APIRouter(prefix="/v1", tags=["simulations"])

@router.post("/internal/jobs/{run_id}/enqueue")
def enqueue_job(run_id: str, body: EnqueueRequest, db: Annotated[Session, Depends(get_db)]):
    # task.delay(run_id) — Celery only here, not from Node
    ...
```

**DB raw SQL pattern** (orchestrator.py lines 107-117):
```python
row = db.execute(
    text("SELECT params FROM truck_configs WHERE model_name = :model_name AND is_active = true LIMIT 1"),
    {"model_name": model_name},
).fetchone()
```

**Pattern to copy:** Internal enqueue endpoint only (not public); worker UPDATE uses same `text()` + Session pattern:
```python
db.execute(text("UPDATE simulation_runs SET status = :status, outputs = :outputs WHERE id = :id"), {...})
db.commit()
```

---

### `services/simulator/app/worker.py` (config, event-driven) — NEW

**Analog:** None — first Celery worker in repo. Follow RESEARCH Pattern 1 + `docker-compose.yml` service block.

**Compose service pattern** (docker-compose.yml lines 43-60):
```yaml
simulator:
  build: ./services/simulator
  environment:
    DATABASE_URL: postgresql+psycopg://...
    VALHALLA_URL: http://valhalla:8002
  command: >
    sh -c "alembic upgrade head &&
           uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

**Pattern to copy:** New `sim-worker` service with `command: celery -A app.worker worker -c 2`; import `run_simulation` from orchestrator; use same `DATABASE_URL` and `SessionLocal` as `app/db.py`; set visibility_timeout=600, task_acks_late=True per RESEARCH.

---

### `services/simulator/app/main.py` (config) — MODIFY

**Analog:** Self

**Router registration** (main.py lines 22-30):
```python
app = FastAPI(title="FleetVolt Simulator", version="0.1.0")
app.include_router(chargers_router)
app.include_router(corridors_router)
# ...
app.include_router(simulate_router)
```

**Pattern to copy:** `from app.routes.simulations import router as simulations_router` + `app.include_router(simulations_router)`; add `simulation_runs` to `SPATIAL_TABLES` tuple for stack meta counts.

---

### `services/simulator/alembic/versions/003_simulation_runs.py` (migration, CRUD) — NEW

**Analog:** `services/simulator/alembic/versions/001_spatial_core.py`

**Migration header + revision chain** (001_spatial_core.py lines 1-12):
```python
"""Spatial core schema — PostGIS extension and foundation tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
```

**Table + index pattern** (001_spatial_core.py lines 72-90):
```python
op.create_table(
    "elevation_profiles",
    sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
    sa.Column("route_hash", sa.Text(), nullable=False, unique=True),
    sa.Column("profile", sa.dialects.postgresql.JSONB(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
)
```

**Pattern to copy:** `revision = "003"`, `down_revision = "002"`; UUID PK with `gen_random_uuid()`; JSONB for `inputs`/`outputs`/`error`; indexes on `inputs_hash` and `status` per RESEARCH; matching downgrade drops indexes then table.

---

### `services/simulator/tests/test_charge_curve.py` (test, transform) — NEW

**Analog:** `services/simulator/tests/test_physics_engine.py`

**Fixture from truck JSON** (test_physics_engine.py lines 21-40):
```python
PROJECT_ROOT = Path(__file__).resolve().parents[3]

@pytest.fixture
def ecascadia_truck() -> TruckParams:
    truck_json = json.loads(
        (PROJECT_ROOT / "data" / "trucks" / "ecascadia_438.json").read_text()
    )
    return TruckParams(usable_kwh=truck_json["usable_kwh"], ...)
```

**Assertion style** (test_physics_engine.py lines 43-46):
```python
def test_constants_exports():
    assert G == pytest.approx(9.80665)
```

**Pattern to copy:** Load `charge_curve` from same JSON; assert taper slows dwell above 70% SOC vs naive linear lower bound; no DB, no `@integration`.

---

### `services/simulator/tests/test_charging_planner.py` (test, batch) — NEW

**Analog:** `services/simulator/tests/test_simulate_api.py` + `test_charger_filter.py`

**Mock external deps** (test_simulate_api.py lines 130-145):
```python
def test_simulate_custom_od_happy_path(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    mock_route_provider = MagicMock()
    mock_route_provider.get_route.return_value = MOCK_ROUTE
    monkeypatch.setattr("app.simulation.orchestrator.RouteProvider", lambda *a, **k: mock_route_provider)
```

**HD filter assertions** (test_charger_filter.py lines 24-36):
```python
class TestHdHeuristic:
    def test_hd_heuristic_ccs_350(self):
        assert hd_capable(power=350, connectors={"CCS"}) is True
    def test_hd_heuristic_low_power(self):
        assert hd_capable(power=150, connectors={"CCS"}) is False
```

**Pattern to copy:** Unit-test planner with mocked `RouteProvider` detour times and in-memory charger candidate list; assert greedy tie-break (shorter detour, then higher power_kw).

---

### `services/simulator/tests/test_feasibility.py` (test, transform) — NEW

**Analog:** `services/simulator/tests/test_overrides.py` (via simulate_api override tests)

**422/200 contract tests** (test_simulate_api.py lines 181-186):
```python
def test_overrides_out_of_bounds_returns_422(client: TestClient):
    body = _corridor_body()
    body["overrides"] = {"C_rr": 0.02}
    response = client.post("/v1/simulate", json=body)
    assert response.status_code == 422
```

**Pattern to copy:** Pure function tests calling `classify_feasibility` with synthetic stop lists and final SoC values; assert `verdict`, `tier`, `soc_deficit_kwh`, `blocking_reason` fields.

---

### `services/simulator/tests/test_simulations_job.py` (test, event-driven) — NEW

**Analog:** `services/simulator/tests/test_valhalla_route.py`

**Integration skip gates** (test_valhalla_route.py lines 40-45):
```python
@pytest.mark.integration
def test_polb_to_san_bernardino():
    if not _simulator_reachable():
        pytest.skip(f"Simulator unreachable at {SIMULATOR_URL}")
    if not _valhalla_ready():
        pytest.skip(f"Valhalla not ready at {VALHALLA_BASE_URL}")
```

**CI skip marker** (conftest.py lines 26-33):
```python
def pytest_collection_modifyitems(config, items) -> None:
    if not os.environ.get("CI"):
        return
    skip_integration = pytest.mark.skip(reason="integration test skipped in CI")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)
```

**Pattern to copy:** `@pytest.mark.integration` for full POST → poll → COMPLETE lifecycle; use `simulate_db` fixture pattern from test_simulate_api for migrations + seeds.

---

### `services/simulator/tests/test_inputs_hash.py` (test, transform) — NEW

**Analog:** `services/simulator/tests/test_physics_engine.py` (pure unit, fixture JSON)

**Pattern to copy:** Shared test vectors committed in test file; assert known SHA-256 hex for canonical scenario fixture; no network.

---

### `services/simulator/tests/test_simulate_api.py` (test) — MODIFY

**Analog:** Self

**Phase 2 contract guard** (test_simulate_api.py lines 111-121):
```python
def _assert_simulate_response(body: dict) -> None:
    assert "segments" in body
    for segment in body["segments"]:
        for key in SEGMENT_KEYS:
            assert key in segment
    assert "charging_stops" not in body
    assert "job_id" not in body
```

**Client fixture** (test_simulate_api.py lines 67-79):
```python
@pytest.fixture
def client(simulate_db):
    from app.db import get_db
    def override_get_db():
        try:
            yield simulate_db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
```

**Pattern to copy:** Update `_assert_simulate_response` — when `options.include_charging=true`, assert `charging_stops` and `feasibility` present; preserve SEGMENT_KEYS unchanged; add test with `include_charging: false` for Phase 2 parity path.

---

### `services/api/src/db.ts` (config, CRUD) — NEW

**Analog:** `services/simulator/app/db.py`

**Python pool pattern** (db.py lines 10-16):
```python
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://fleetvolt:fleetvolt@localhost:5432/fleetvolt",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
```

**Pattern to copy:** Node equivalent using `pg.Pool` with `process.env.DATABASE_URL`; export `pool` singleton; parameterized queries only (RESEARCH security table).

---

### `services/api/src/simulations.ts` (route, CRUD) — NEW

**Analog:** `services/api/src/index.ts` (hybrid: DB logic + fetch enqueue)

**Proxy POST helper** (index.ts lines 145-184):
```typescript
async function proxySimulatorPost(
  request: { log: { error: (obj: object, msg: string) => void }; body: unknown },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  path: string,
  timeoutMs = 15000,
) {
  const simulatorUrl = process.env.SIMULATOR_URL ?? "http://localhost:8000";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${simulatorUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    });
    // ... error mapping to simulator_error / simulator_unreachable ...
  }
}
```

**Simulate route registration** (index.ts lines 194-196):
```typescript
app.post("/v1/simulate", async (request, reply) => {
  return proxySimulatorPost(request, reply, "/v1/simulate");
});
```

**Pattern to copy:** `POST /v1/simulations` is NOT pure proxy — Node owns cache SELECT + INSERT, then `fetch` enqueue to `/v1/internal/jobs/{id}/enqueue`; `GET /v1/simulations/:id` reads Postgres directly (no Python round-trip on poll). Register routes in `index.ts` or export handlers from `simulations.ts` and import.

---

### `services/api/src/inputs_hash.ts` (utility, transform) — NEW

**Analog:** None — mirror Python `inputs_hash.py` per shared spec.

**Pattern to copy:** Implement recursive key sort + float rounding + SHA-256; export `computeInputsHash(body, physicsVersion, chargerVersion)`; add vitest/tsc test file matching Python test vector.

---

### `services/api/src/index.ts` (route) — MODIFY

**Analog:** Self

**Host binding** (index.ts lines 206-209):
```typescript
const port = Number(process.env.PORT ?? 4000);
const host = "0.0.0.0";
await app.listen({ port, host });
```

**Pattern to copy:** Add `DATABASE_URL` to api service in docker-compose; register new simulation routes; keep `/v1/simulate` as pure proxy unchanged.

---

### `docker-compose.yml` (config) — MODIFY

**Analog:** Self

**Redis + healthcheck pattern** (docker-compose.yml lines 18-26):
```yaml
redis:
  image: redis:8-alpine
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
```

**Simulator depends_on pattern** (docker-compose.yml lines 55-60):
```yaml
depends_on:
  postgres:
    condition: service_healthy
command: >
  sh -c "alembic upgrade head &&
         uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

**Pattern to copy:** Add `sim-worker` service; wire `CELERY_BROKER_URL: redis://redis:6379/0`; add `DATABASE_URL` to `api` environment; `depends_on: redis: { condition: service_healthy }`.

---

### `services/simulator/docs/model_assumptions.md` (config) — MODIFY

**Analog:** Self — extend existing assumptions doc with CHRG-06 deferred weights section per D-07.

---

### `packages/shared/inputs-hash-spec.md` (config) — NEW

**Analog:** None — greenfield contract doc; reference RESEARCH Pattern 5 and link to test vectors in both languages.

---

## Shared Patterns

### FastAPI Route Thin Handler
**Source:** `services/simulator/app/routes/simulate.py`
**Apply to:** `simulate.py`, `simulations.py`
```python
@router.post("/simulate", response_model=SimulateResponse)
def simulate(body: SimulateRequest, db: Annotated[Session, Depends(get_db)]) -> SimulateResponse:
    return run_simulation(db, body)
```

### PostGIS Parameterized Spatial Query
**Source:** `services/simulator/app/routes/chargers.py`
**Apply to:** `charging_planner.py` (inline SQL, not HTTP)
```python
WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_m)
AND hd_capable = true
ORDER BY distance_m
```

### Valhalla Truck Costing
**Source:** `services/simulator/app/simulation/route_provider.py`
**Apply to:** `route_provider.py`, `detour_validator.py`
```python
"costing": "truck",
"costing_options": {"truck": CLASS8_TRUCK_OPTIONS},
```

### HTTPException Error Mapping in Orchestrator
**Source:** `services/simulator/app/simulation/orchestrator.py`
**Apply to:** orchestrator extensions, worker error → `simulation_runs.error` JSONB
```python
except RuntimeError as exc:
    raise HTTPException(status_code=503, detail=str(exc)) from exc
```

### Fastify Simulator Proxy + Error Envelope
**Source:** `services/api/src/index.ts`
**Apply to:** sync `/v1/simulate` only; async routes use DB + selective fetch
```typescript
return reply.status(response.status).send({ error: "simulator_error", message });
// ...
return reply.status(503).send({ error: "simulator_unreachable", message: ... });
```

### Pydantic v2 Request/Response Models
**Source:** `services/simulator/app/simulation/schemas.py`
**Apply to:** all new charging and job models
```python
class SimulateRequest(BaseModel):
    route: RouteSpec
    truck: TruckSpec
    conditions: ConditionsSpec = Field(default_factory=ConditionsSpec)
```

### Pytest DB Fixture with Alembic + Dependency Override
**Source:** `services/simulator/tests/test_simulate_api.py`
**Apply to:** `test_simulate_api.py`, `test_simulations_job.py`
```python
command.upgrade(alembic_cfg, "head")
seed_trucks(db_session)
app.dependency_overrides[get_db] = override_get_db
yield TestClient(app)
app.dependency_overrides.clear()
```

### Integration Test Gating
**Source:** `services/simulator/tests/test_valhalla_route.py`, `conftest.py`
**Apply to:** `test_simulations_job.py`
```python
@pytest.mark.integration
def test_async_job_lifecycle():
    if not _simulator_reachable():
        pytest.skip(...)
```

### Alembic Revision Chain
**Source:** `services/simulator/alembic/versions/002_truck_config_columns.py`
**Apply to:** `003_simulation_runs.py`
```python
revision = "003"
down_revision = "002"
```

### Queue Boundary (Node → HTTP → Celery)
**Source:** RESEARCH Pattern 1 + `services/api/src/index.ts`
**Apply to:** `simulations.ts`, `worker.py`, `simulations.py` (Python)
- Node NEVER imports Celery/redis for task dispatch
- Only FastAPI `/v1/internal/jobs/{id}/enqueue` calls `task.delay()`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `services/simulator/app/worker.py` | config | event-driven | First Celery worker — use RESEARCH Pattern 1 + Celery Redis docs |
| `services/simulator/app/simulation/inputs_hash.py` | utility | transform | No existing hash/canonical JSON utility in repo |
| `services/api/src/inputs_hash.ts` | utility | transform | Node-side mirror of new Python module — shared spec + test vectors |
| `packages/shared/inputs-hash-spec.md` | config | transform | Greenfield cross-language contract |
| `packages/shared-types/src/schema.d.ts` | model | transform | Codegen output — extend OpenAPI from schemas.py per Phase 1–2 pattern |

## Metadata

**Analog search scope:** `services/simulator/app/`, `services/simulator/tests/`, `services/simulator/alembic/`, `services/api/src/`, `docker-compose.yml`, `data/trucks/`
**Files scanned:** 48
**Pattern extraction date:** 2026-07-01
