"""Export FastAPI OpenAPI schema to openapi.json for shared-types codegen."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SIMULATOR_ROOT = Path(__file__).resolve().parents[1]
if str(SIMULATOR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIMULATOR_ROOT))

from app.main import app  # noqa: E402


def export_openapi(output_path: Path | None = None) -> Path:
    """Write OpenAPI 3.x JSON schema for the simulator service."""
    destination = output_path or (SIMULATOR_ROOT / "openapi.json")
    schema = app.openapi()
    destination.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    return destination


def main() -> None:
    path = export_openapi()
    print(f"Wrote OpenAPI schema to {path}")


if __name__ == "__main__":
    main()
