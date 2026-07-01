# Phase 4: User Setup Required

**Generated:** 2026-07-01
**Phase:** 04-analyst-dashboard-export
**Status:** Incomplete

Complete these items for map rendering in Plan 02. Claude automated everything possible; these items require human access to external dashboards/accounts.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [ ] | `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox account → Access tokens → Default public token | `apps/web/.env.local` |

## Account Setup

- [ ] **Create Mapbox account** (if needed)
  - URL: https://account.mapbox.com/auth/signup/
  - Skip if: Already have a Mapbox account with a public token

## Dashboard Configuration

- [ ] **Copy default public access token**
  - Location: Mapbox Dashboard → Access tokens
  - Set to: A token with `styles:read` and `tiles:read` scopes (default public token)
  - Notes: Required for SoC-gradient map rendering in Plan 04-02

## Verification

After completing setup, verify with:

```bash
grep NEXT_PUBLIC_MAPBOX_TOKEN apps/web/.env.local
pnpm --filter @fleetvolt/web dev
```

Expected results:
- Token is present in `.env.local` (not committed to git)
- Map components in Plan 02 load without the "Map unavailable" banner

---

**Once all items complete:** Mark status as "Complete" at top of file.
