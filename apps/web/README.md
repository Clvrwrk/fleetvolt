# FleetVolt Web (Next.js)

Desktop-first analyst UI stub for Phase 1 walking skeleton.

## Local full stack

From the repository root:

```bash
docker compose up --build
```

Verify the simulation service directly:

```bash
curl http://localhost:8000/v1/meta/stack
```

Open the stack status page:

http://localhost:3000

The home page fetches `GET /v1/meta/stack` through the Fastify API (`http://localhost:4000`) and displays PostGIS version plus spatial table row counts.
