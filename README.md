# FleetVolt Route v2 — Documentation Set

**Purpose**: Revised, realistic, and buildable documentation for the Class 8 EV drayage & corridor energy modeling platform.  
**Based on**: Original PRD teardown + strategic alignment with POLB / zero-emission freight work.  
**Date**: June 17, 2026

## Documents in This Set

| # | Document | Description | Primary Audience |
|---|----------|-------------|------------------|
| 00 | [PRD_FleetVolt_Route_v2.md](./00_PRD_FleetVolt_Route_v2.md) | Full revised Product Requirements Document with MoSCoW, personas, success metrics, risks, and clear MVP scope. | Product, stakeholders, engineering leads |
| 01 | [Technical_Architecture_FleetVolt.md](./01_Technical_Architecture_FleetVolt.md) | Hybrid Node + Python architecture, data flows, component design, tech choices with rationale. | Engineering, architects, AI agents implementing |
| 02 | [Development_Roadmap_Phases.md](./02_Development_Roadmap_Phases.md) | Phased plan (0-3) with gates, deliverables, validation strategy, and realistic timelines. | Project management, engineering, resource planning |
| 03 | [Data_Integration_Spec.md](./03_Data_Integration_Spec.md) | Detailed source-by-source integration plan, schemas, refresh, limitations, and Phase 0 execution order. | Data engineers, Phase 0 team, validation |

## Quick Start for Building

1. Review **PRD v2** first (especially Sections 4-8: Scope, Requirements, Assumptions/Open Questions).
2. Align on **Open Questions** in PRD (priority corridors, truck models, optimization objective, etc.).
3. Execute **Phase 0** using the Data Spec + Roadmap (data ingest, validation framework, scaffolding).
4. Use Technical Architecture as the implementation blueprint (especially Python simulation service design).
5. Iterate at each gate with domain input (port/drayage/energy expertise).

## Key Improvements vs Original PRD

- Realistic scoping & MVP definition (narrow & deep first).
- Physics validation gates before heavy UI investment.
- Hybrid tech stack (Python for scientific core) to avoid numeric limitations.
- Explicit infrastructure reality (sparse MCS in 2026) surfaced in model & UI.
- Comprehensive risks, success metrics, and non-functional requirements.
- Actionable data pipeline + phased roadmap with clear DoD criteria.
- Designed for your existing agent/VPS patterns and consulting use cases.

## Local development stack (Phase 1)

From the repository root:

```bash
docker compose up --build
```

Verify the simulation service:

```bash
curl http://localhost:8000/v1/meta/stack
```

Open the stack status page at http://localhost:3000.

See [apps/web/README.md](./apps/web/README.md) for web-specific notes.

## Next Actions

- Schedule alignment session on Open Questions & priority corridors.
- Kick off Phase 0 data work (NHFN + Chargers ingest scripts).
- Decide on initial validation corridors and truck configs to seed.
- (Optional) Use your multi-agent system to assist with ingest scripts, test case generation, or initial physics prototype in Python.

This set is ready for handoff to engineering, AI agents, or client review. All documents are living — update at phase gates. 

**Contact / Owner**: CleverWork FleetVolt Initiative.