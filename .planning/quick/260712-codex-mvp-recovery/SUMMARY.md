---
status: human_needed
implementation_status: complete
acceptance_status: pending_human
release_status: not_deployed
date: 2026-07-12
---

# FleetVolt CaaS MVP recovery summary

## Completed

- Replaced the stale handoff and normalized the active project/roadmap/state around FLE-5, the current Vercel/Convex/Google stack, the desktop-only release, and PR-only delivery.
- Applied the 16px readable-text floor to active enterprise and Phase 20 design contracts.
- Used three Codex harness workers to independently audit UI/MVP behavior, folder ambiguity, and Executive Briefing parity.
- Bound workbench dataset filters to visible map assets, added freight-amenities filtering and a discoverable Amenities layer toggle, and persisted/restored role-scoped profiles while preserving all-on first use.
- Removed the homepage blank-screen readiness gate and visually verified the rendered hero/navigation.
- Restored the cinematic ignition sequence on every home entry and replaced the hydrated lane button with a native CaaS sign-in link.
- Added the correct WorkOS sign-in route and prevented loopback callbacks from crossing between local FleetVolt instances on different ports.
- Fixed the PKCE loop by canonicalizing the auth-start host before verifier-cookie creation and deriving the callback base URL from the browser-facing host. Full cinematic → home → lane choice → WorkOS → CaaS flow verified.
- Corrected and deployed the Convex WorkOS User Management provider using the live token contract: environment-wide issuer, FleetVolt application audience, and FleetVolt application JWKS. Fresh authenticated browser verification returned a ready CaaS workbench with zero Convex auth errors.
- Added Google's documented `gm_authFailure` guard before Maps loads, preventing an unauthorized key from mounting Advanced Markers and crashing on `getRootNode`; the UI now names the exact referrer that must be allowlisted.
- Added a prominent DEMO / MODELED disclosure to the static briefing and renamed the browser action to Print / Save PDF.

## Verification

- Focused auth/filter/store unit tests: 22 passed, 0 failed.
- TypeScript typecheck: passed.
- Focused ESLint across changed application files: passed.
- Harness browser: homepage and briefing render; disclosure and action naming verified.

## Human / connected-system gates

- Verify the live Google map and exact POLB → Shafter interaction in Chrome; authentication now passes through to the CaaS workbench.
- Synchronize the prepared issue/ledger reconciliation through an authorized in-harness Linear connector. CLI/API workarounds are prohibited.
- Review the localhost after Codex completes the authenticated workbench visual gate.
