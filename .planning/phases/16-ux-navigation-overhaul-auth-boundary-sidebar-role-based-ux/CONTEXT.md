# Phase 16 Context — UX Navigation Overhaul

## Problem Statement

FleetVolt currently functions as a **public demo tool, not a product** (UX score: 28/100). There is no auth boundary, no user identity, no role-gated navigation, no onboarding flow, and no welcome page. All routes are accessible to all visitors with no login required. The core problems are structural, not cosmetic.

## Research Foundation

Three research documents exist in `.planning/research/`:

1. **UX-NAVIGATION-RESEARCH.md** (642 lines) — SaaS navigation patterns (Linear, Stripe, Vercel, Notion, Retool), UX psychology laws (Hick's, Fitts's, Jakob's, Von Restorff, Miller's), visual hierarchy, auth UX, empty states, dashboard layout, mobile nav. Sources: lawsofux.com, NN/G, WorkOS, Exa, Tavily.

2. **UX-VISUAL-COMPARISON.md** — 11 screenshots (5 good examples, 6 FleetVolt bad examples) captured via ScreenshotOne API. Annotated analysis via vision AI. Linear and Stripe are the primary reference patterns.

3. **UX-AUDIT-FULL.md** (391 lines) — 37 UX problems across 6 categories. Score: 28/100. Ideal user journey mapped. Role→Home page mapping defined. 8-step recommended fix order.

## Key Decisions (from research)

### Navigation Architecture
- **Left sidebar** (260px, collapsible to 56px) replaces top-bar nav
- Nav items **filtered by role** (Driver sees Driver items, Fleet sees Fleet items, CaaS sees CaaS items)
- Top bar retains: logo, page title/breadcrumb, user avatar
- Reference: Linear, Stripe, Vercel all use left sidebar

### Auth & User Identity
- **Auth boundary**: unauthenticated users redirected from app pages to `/` (welcome)
- Public routes: `/`, `/role-select`, `/callback`
- **User identity**: avatar + name + role badge in top-right, always visible
- Clicking avatar → dropdown: Settings, Sign Out
- Role switching (if multi-role) in avatar dropdown, not main nav

### Welcome / Onboarding Flow
- `/` = welcome page: "What is FleetVolt" + 3 role cards + "Get Started" CTA
- `/role-select` = 3 large clickable role cards (NOT a login button)
- After role select → WorkOS AuthKit hosted login
- After auth → redirect to role-specific home: Driver→/driver, Fleet→/fleet, CaaS→/caas

### Role-Specific Home Pages
| Role | Home Route | Content | Primary CTA | Nav Items |
|------|-----------|---------|-------------|-----------|
| Driver | /driver | Today's Route, Vehicle Status, Charging | "Start Navigation" | Dashboard, My Routes, Charging, Vehicle, Messages |
| Fleet Manager | /fleet | KPI row, utilization, vehicle table | "Dispatch New Route" | Dashboard, Fleet, Routes, Drivers, Reports, Settings |
| CaaS | /caas | KPI row, hotspot analysis, county scores | "Open AI Planner" | Dashboard, Network, Analytics, Billing, Settings |

### Empty States
4 essential elements: headline (why empty) + context + next action + optional visual

### Error Handling
- AI planner errors: human-readable with suggested next steps, no raw API paths
- Status: factual ("Within limit / Near limit / Over limit")

### Design System (existing, from Brand Bible)
- Technical Brand Geometry aesthetic (skeuomorphic cards, corner brackets, JetBrains Mono labels)
- FramedPanel, SkeuomorphicCard, KpiCell, StatusBadge, PrimaryButton, SecondaryButton components
- Inter + JetBrains Mono fonts
- Brand colors: Graphite #141416, Slate #4A4A52, Steel #8A8A93, Fog #DEDEE6, Paper #EFEFF5, Blueprint Blue #4C8FB8, Signal Green #3F9B6B, Caution Amber #B8874C, Alert Red #C0392B

### Existing Infrastructure
- WorkOS AuthKit Convex component installed (convex.config.ts, auth.ts, http.ts)
- WORKOS_API_KEY + WORKOS_CLIENT_ID set in Convex env
- useWorkOSAuth hook in src/lib/auth.ts (sign in/out, session management)
- /callback route handles WorkOS authorization code
- userAccounts, driverProfiles, fleetCompanies, caasCompanies tables in Convex schema
- Deployed on Vercel (fleetvolt.network + staging.fleetvolt.network)
- 19 design components in src/components/design/

## Recommended Fix Order (from audit)

1. Auth boundary + user identity (CRITICAL — without this, nothing else matters)
2. Welcome page + onboarding flow (the entry point)
3. Role persistence + role-specific redirects (makes the app feel personal)
4. Navigation architecture (sidebar + role-filtered nav)
5. Role-specific dashboards (replace wizards with dashboards)
6. Planner fixes (empty states, error handling)
7. Error handling + loading states (polish)
8. Dead route cleanup (hygiene)

## UX Audit Skill

A `fleetvolt-ux-audit` skill exists at `~/.hermes/skills/software-development/fleetvolt-ux-audit/` with 15 checks. Every page must score 95%+ to pass. Each issue detracts 5%.

## Constraints

- Build must pass on Vercel (Next.js 16, Node 22, pnpm 11)
- typescript.ignoreBuildErrors is set (pre-existing type errors are tolerated)
- Convex bundler rejects node:crypto/fs/path in convex/ files
- Git hygiene: explicit `git add <path>`, never `git add -A`
- The app is live on fleetvolt.network — changes deploy automatically via Vercel git integration
