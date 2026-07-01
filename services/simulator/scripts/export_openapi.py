"""Export FastAPI OpenAPI schema to openapi.json for shared-types codegen."""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

from fastapi import FastAPI

SIMULATOR_ROOT = Path(__file__).resolve().parents[1]
if str(SIMULATOR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIMULATOR_ROOT))

from app.main import app  # noqa: E402
from app.simulation.schemas import (  # noqa: E402
    SimulateRequest,
    SimulationJobPollResponse,
    SimulationJobSubmitResponse,
)


def _build_gateway_contract_app() -> FastAPI:
    """OpenAPI-only contract for Fastify job routes (PLAT-02, D-01)."""
    contract = FastAPI(title="FleetVolt Gateway Job Contract", version="0.1.0")

    @contract.post(
        "/v1/simulations",
        response_model=SimulationJobSubmitResponse,
        tags=["simulations"],
        summary="Submit Simulation Job",
        description="Async simulation job submit — implemented on API gateway (:4000).",
    )
    def submit_simulation_job(body: SimulateRequest) -> SimulationJobSubmitResponse:
        raise NotImplementedError("Documented for OpenAPI codegen only")

    @contract.get(
        "/v1/simulations/{job_id}",
        response_model=SimulationJobPollResponse,
        tags=["simulations"],
        summary="Poll Simulation Job",
        description="Poll async job status and outputs — implemented on API gateway (:4000).",
    )
    def poll_simulation_job(job_id: uuid.UUID) -> SimulationJobPollResponse:
        raise NotImplementedError("Documented for OpenAPI codegen only")

    return contract


def _merge_openapi_schemas(base: dict, extension: dict) -> dict:
    """Merge paths and component schemas from extension into base."""
    base.setdefault("paths", {}).update(extension.get("paths", {}))
    base_components = base.setdefault("components", {})
    ext_components = extension.get("components", {})
    base_schemas = base_components.setdefault("schemas", {})
    for name, schema in ext_components.get("schemas", {}).items():
        base_schemas.setdefault(name, schema)
    return base


def export_openapi(output_path: Path | None = None) -> Path:
    """Write OpenAPI 3.x JSON schema for the simulator service."""
    destination = output_path or (SIMULATOR_ROOT / "openapi.json")
    schema = app.openapi()
    contract_schema = _build_gateway_contract_app().openapi()
    schema = _merge_openapi_schemas(schema, contract_schema)
    destination.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    return destination


def main() -> None:
    path = export_openapi()
    print(f"Wrote OpenAPI schema to {path}")


if __name__ == "__main__":
    main()
