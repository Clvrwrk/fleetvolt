# FleetVolt Docker Desktop review build

This is a web-only visual review environment. It deliberately does not use the retired root `docker-compose.yml` stack. Convex remains the application backend.

## Start or rebuild

From the repository root:

```bash
pnpm docker:review
```

Open the review-session URL, which bypasses WorkOS only inside this explicitly enabled local review container:

```text
http://localhost:3000/api/review-session?next=/caas
```

Docker binds port `3000` to `127.0.0.1` only. FleetVolt uses this port because `http://localhost:3000/*` is already authorized by the Google Maps browser-key policy. Reviewers and agents operating on this Mac can share the same immutable container instead of starting competing development servers. Other LAN devices cannot reach the WorkOS-bypass review endpoint.

## Operate only this container

```bash
pnpm docker:review:status
pnpm docker:review:logs
pnpm docker:review:down
```

The Compose project is `fleetvolt-review`; the container is `fleetvolt-review-web`. These names and the dedicated port prevent this environment from modifying or colliding with other Docker projects and local Next.js servers.

The runtime reads `apps/web/.env.local`. Docker build context rules exclude all `.env` files, so secrets are not copied into image layers; only `NEXT_PUBLIC_*` values are provided as build arguments because Next.js embeds public browser configuration at build time.
