# Guest visit — cw-grok · 2026-07-17

**Home team:** ZEA - Railpower (ZEARP) · GROK vault session  
**Linear:** [ZEARP-4](https://linear.app/cleverwork/issue/ZEARP-4/ship-mobile-first-benefits-calc-at-fleetvoltnetworkrail) · Project *CVAG Emission Calc + Rail Benefits Site*  
**Initiative:** Railpower ZE — CVAG / Port of Oakland

## What changed

- `vercel.json` — external rewrites so **fleetvolt.network/rail** proxies the new standalone Vercel project `fleetvolt-rail` (Railpower H₂ benefits calculator).
- Calculator source lives outside this monorepo for speed:  
  `GROK/projects/fleetvolt-rail/` · production `https://fleetvolt-rail.vercel.app/rail`

## Why not in monorepo apps/

User asked for a **new** Vercel project + spicy mobile calc without blocking on fleetvolt turbo surface. Path rewrite keeps the brand domain.

## Follow-ups for FleetVolt owners

- Confirm rewrite order does not collide with app routes named `rail`
- Optional: promote to microfrontend / monorepo app later
- Subdomain option: `rail.fleetvolt.network` (if DNS/Vercel domain API allows)

No secrets written. No app runtime code changed.

## Follow-up (same day)
- Root `vercel.json` rewrites alone did not surface `/rail` (Next catch-all 404).
- Added `apps/web/next.config.ts` `beforeFiles` rewrites to proxy standalone project.
