# Phase 18 responsive review receipt

Reviewed the rebuilt Docker instance at `http://localhost:3000/caas` on 2026-07-11.

| Viewport | Result | Evidence |
| --- | --- | --- |
| Desktop 1440x900 | Pass: page rendered at the requested viewport with no document-level horizontal overflow. | `desktop-1440x900.png` |
| iPad 1024x1366 | Pass: page rendered at the requested viewport with no document-level horizontal overflow. | `ipad-1024x1366.png` |
| Mobile 390x844 | Pass: page rendered at the requested viewport with zero horizontal overflow. | `mobile-390x844.png` |

Phase 18 changes the route service and persistence boundary, not the visible map composition. The decisive behavioral receipt is the paired live Convex request:

1. First identical PTV request: `database-miss-write`, 800 road points, `refreshCount: 1`, 90-day expiry.
2. Second identical PTV request: `database-hit`, same geometry and expiry, `accessCount: 2`, `refreshCount: 1`.

ScreenshotOne is connected through Composio, but its capture service cannot reach a host-only `localhost:3000` Docker URL. These local screenshots were captured through the in-app browser against the exact container Chris reviews.
