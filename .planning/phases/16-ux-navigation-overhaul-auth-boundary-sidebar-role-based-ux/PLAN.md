---
phase: 16-ux-navigation-overhaul-auth-boundary-sidebar-role-based-ux
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/middleware.ts
  - apps/web/src/lib/auth.ts
  - apps/web/src/app/ConvexClientProvider.tsx
  - apps/web/src/lib/use-user-role.ts
  - apps/web/src/components/auth/user-menu.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/page.tsx
  - apps/web/src/app/role-select/page.tsx
  - apps/web/src/app/callback/page.tsx
  - apps/web/src/components/nav/sidebar.tsx
  - apps/web/src/components/nav/use-role-nav.ts
  - apps/web/src/components/nav/app-shell.tsx
  - apps/web/src/components/nav/page-header.tsx
  - apps/web/src/components/nav/mobile-tab-bar.tsx
  - apps/web/src/app/driver/page.tsx
  - apps/web/src/app/fleet/page.tsx
  - apps/web/src/app/caas/page.tsx
  - apps/web/src/app/planner/page.tsx
  - apps/web/src/components/ui/empty-state.tsx
  - apps/web/src/components/ui/error-boundary.tsx
  - apps/web/src/components/ui/skeleton.tsx
  - apps/web/src/app/status/page.tsx
  - apps/web/src/app/network/page.tsx
  - apps/web/src/app/unit/page.tsx
  - apps/web/src/app/load/page.tsx
autonomous: true
requirements: [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, UX-09]
must_haves:
  truths:
    - "Unauthenticated users visiting /planner, /driver, /fleet, /caas, /hotspot are redirected to / (welcome page). Only /, /role-select, /callback are public."
    - "A left sidebar (260px, collapsible to 56px) renders on all authenticated desktop pages, with nav items filtered by the user's role."
    - "User avatar + name + role badge is visible in the top-right on every authenticated page. Clicking opens a dropdown with Settings and Sign Out."
    - "The / welcome page shows a hero headline, 3 role cards, and a single primary CTA 'Get Started' → /role-select."
    - "The /role-select page shows 3 large clickable role cards BEFORE auth. Clicking a role stores it and redirects to WorkOS."
    - "After WorkOS callback, user lands on their role-specific home page: Driver→/driver, Fleet Manager→/fleet, CaaS→/caas."
    - "Role-specific dashboards replace registration wizards. Driver shows Today's Route + Vehicle Status + Charging. Fleet shows KPI row + vehicle table. CaaS shows KPI row + hotspot analysis."
    - "Every empty state shows headline + context + next action. Every AI planner error is human-readable with a retry button."
    - "Dead routes (/network, /unit, /load, /status) are either implemented or removed from navigation."
    - "Every page scores 95%+ on the fleetvolt-ux-audit 15-check skill."
  artifacts:
    - "apps/web/middleware.ts: Next.js middleware enforcing auth boundary on protected routes"
    - "apps/web/src/lib/auth.ts: rewritten useWorkOSAuth hook using Convex AuthKit session, no sessionStorage"
    - "apps/web/src/lib/use-user-role.ts: useRole() hook returning the authenticated user's role from Convex"
    - "apps/web/src/components/auth/user-menu.tsx: avatar + name + role badge dropdown"
    - "apps/web/src/components/nav/sidebar.tsx: 260px collapsible left sidebar with role-filtered nav"
    - "apps/web/src/components/nav/use-role-nav.ts: useRoleNav(role) hook returning nav items per role"
    - "apps/web/src/components/nav/app-shell.tsx: layout wrapper with sidebar + top bar + user menu"
    - "apps/web/src/components/nav/page-header.tsx: breadcrumb/page title component"
    - "apps/web/src/components/nav/mobile-tab-bar.tsx: bottom tab bar for mobile"
    - "apps/web/src/components/ui/empty-state.tsx: reusable empty state (headline + context + CTA)"
    - "apps/web/src/components/ui/error-boundary.tsx: human-readable error with retry"
    - "apps/web/src/components/ui/skeleton.tsx: skeleton loading components"
  key_links:
    - "apps/web/convex/schema.ts (userAccounts table with role field, by_userId index)"
    - "apps/web/convex/auth.ts (AuthKit instance from @convex-dev/workos-authkit)"
    - "apps/web/convex/convex.config.ts (workOSAuthKit component registered)"
    - "apps/web/src/app/ConvexClientProvider.tsx (must swap to ConvexProviderWithAuth)"
    - "apps/web/src/components/design/* (FramedPanel, SkeuomorphicCard, KpiCell, StatusBadge, PrimaryButton, SecondaryButton, TechnicalLabel)"
    - ".planning/research/UX-NAVIGATION-RESEARCH.md (Hick's Law, Fitts's Law, Jakob's Law, Von Restorff, Miller's Law)"
    - ".planning/research/UX-AUDIT-FULL.md (37 problems, 28/100 score, 8-step fix order)"
    - "~/.hermes/skills/software-development/fleetvolt-ux-audit/SKILL.md (15-check audit criteria)"
---

# Phase 16: UX Navigation Overhaul — Auth Boundary, Sidebar, Role-Based UX

## Objective

Transform FleetVolt from a public demo tool (28/100 UX score) into an intuitive, role-gated product (95%+ pass rate). The 37 problems identified in the UX audit are addressed across 6 waves following the audit's recommended fix order: auth boundary → welcome/onboarding → navigation architecture → role-specific dashboards → planner fixes → error handling + dead route cleanup.

## Design Foundation

Every task in this plan references the **Brand Bible design system** (Technical Brand Geometry aesthetic):
- **Components:** FramedPanel, SkeuomorphicCard, KpiCell, StatusBadge, PrimaryButton, SecondaryButton, TechnicalLabel, DimensionCallout, MetadataBlock
- **Fonts:** Inter (body) + JetBrains Mono (data values, labels)
- **Colors:** Graphite #141416, Slate #4A4A52, Steel #8A8A93, Fog #DEDEE6, Paper #EFEFF5, Blueprint Blue #4C8FB8, Signal Green #3F9B6B, Caution Amber #B8874C, Alert Red #C0392B
- **UX Laws governing this phase:** Hick's Law (minimize choices), Fitts's Law (large targets), Jakob's Law (match conventions), Von Restorff Effect (one primary CTA), Miller's Law (≤7 items), Serial Position Effect (first/last matter most)

## UX Audit Checks Addressed

Each task maps to the 15-check fleetvolt-ux-audit skill: NAV-1, NAV-2, NAV-3, AUTH-1, AUTH-2, AUTH-3, HOME-1, HOME-2, VIS-1, VIS-2, VIS-3, COG-1, COG-2, EMPTY-1, EMPTY-2.

## Execution Context

Monorepo root: /Volumes/M4 Application SSD/Projects/FleetVolt. Web app: apps/web/. Next.js 16, Node 22, pnpm 11. Deployed on Vercel (fleetvolt.network). Convex deployment: sensible-oriole-832. WorkOS AuthKit Convex component installed (convex.config.ts, auth.ts, http.ts). WORKOS_API_KEY + WORKOS_CLIENT_ID in Convex env. userAccounts table in schema with role field (driver|fleet_manager|caas), by_userId/by_email/by_role indexes. 19 design components in src/components/design/. 16 page.tsx files in src/app/. No middleware.ts currently exists. ConvexClientProvider uses plain ConvexProvider (not auth variant). Build: `cd apps/web && pnpm build`. tsc: `./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -v scenario-form`.

## Context Files

- @.planning/ROADMAP.md (Phase 16 success criteria, 9 items)
- @.planning/phases/16-ux-navigation-overhaul-auth-boundary-sidebar-role-based-ux/CONTEXT.md
- @.planning/research/UX-NAVIGATION-RESEARCH.md (642 lines, UX psychology laws)
- @.planning/research/UX-VISUAL-COMPARISON.md (11 screenshots, good vs bad)
- @.planning/research/UX-AUDIT-FULL.md (37 problems, 28/100 score, fix order)
- @apps/web/convex/schema.ts (userAccounts, driverProfiles, fleetCompanies, caasCompanies)
- @apps/web/convex/auth.ts (AuthKit instance)
- @apps/web/src/lib/auth.ts (current useWorkOSAuth — sessionStorage based, to be rewritten)
- @apps/web/src/app/layout.tsx (current layout with NavHeader — to be replaced)
- @apps/web/src/components/design/nav-header.tsx (current top-bar nav — to be replaced)

## Tasks (Waves 1–6)

This plan contains 6 waves with 14 tasks total. Each wave depends on the prior wave's completion.

---

## Wave 1: Auth Boundary + User Identity (Critical Path)

**Audit problems addressed:** B1 (no user identity), B2 (no login/logout), B3 (no auth boundary), B4 (sessionStorage insecurity), B6 (callback doesn't complete auth flow), B7 (no session expiration)
**UX checks addressed:** AUTH-1, AUTH-2, AUTH-3
**UX principles:** Jakob's Law (standard auth flow), "User identity is non-negotiable" (Research §4.3)

### Task 1.1: Next.js middleware — auth boundary enforcement

**Files to create/modify:**
- `apps/web/middleware.ts` (NEW)
- `apps/web/src/lib/auth-config.ts` (NEW)

**What this task does:**
Creates Next.js middleware that checks for the WorkOS AuthKit session cookie on all protected routes (`/planner`, `/driver`, `/fleet`, `/caas`, `/hotspot`, `/pulse`). Unauthenticated users are redirected to `/` (welcome page). Public routes (`/`, `/role-select`, `/callback`) are excluded from the check. The middleware uses the `@convex-dev/workos-authkit` cookie name to detect session presence.

**Dependencies:** None (first task)

**Acceptance criteria:**
- `apps/web/middleware.ts` exists and exports a default `middleware` function
- Protected routes list: `/planner`, `/driver`, `/fleet`, `/caas`, `/hotspot`, `/pulse`
- Public routes list: `/`, `/role-select`, `/callback`
- Unauthenticated visit to `/planner` redirects to `/` with `?redirect=/planner` query param
- Authenticated user visiting `/` is NOT redirected (welcome page shows for everyone when logged out)
- `matcher` config excludes `/_next/`, `/api/`, static files
- No `sessionStorage` reads in middleware (cookie-based only)

**UX audit checks addressed:** AUTH-3 (auth boundary — logged-out users see welcome, not app pages)

**Design system reference:** No visual components — this is infrastructure. But the redirect target (`/`) must render the welcome page (Wave 2).

### Task 1.2: Rewrite useWorkOSAuth + ConvexClientProvider for session-based auth

**Files to create/modify:**
- `apps/web/src/lib/auth.ts` (REWRITE)
- `apps/web/src/app/ConvexClientProvider.tsx` (MODIFY)
- `apps/web/src/lib/use-user-role.ts` (NEW)

**What this task does:**
Rewrites the `useWorkOSAuth` hook to use Convex AuthKit's `useAuth` from `convex/react` instead of `sessionStorage`. Swaps `ConvexClientProvider` from plain `ConvexProvider` to `ConvexProviderWithAuth` (or the AuthKit provider). Creates a `useUserRole()` hook that queries the `userAccounts` table by the authenticated user's WorkOS subject ID to return their role (`driver` | `fleet_manager` | `caas` | `null`). Removes ALL `sessionStorage.getItem("fleetvolt_user")` and `sessionStorage.setItem("fleetvolt_auth_code", ...)` code.

**Dependencies:** Task 1.1 (middleware establishes the boundary; this task makes the client side work within it)

**Acceptance criteria:**
- `apps/web/src/lib/auth.ts` no longer contains any `sessionStorage` references
- `ConvexClientProvider` uses `ConvexProviderWithAuth` (or AuthKit equivalent) instead of plain `ConvexProvider`
- `useUserRole()` returns `{ role: "driver" | "fleet_manager" | "caas" | null, loading: boolean }`
- `useUserRole()` queries `userAccounts` table via `withIndex("by_userId")` matching the WorkOS subject
- `signIn()` redirects to WorkOS hosted login with the correct `client_id`, `redirect_uri`, `response_type=code`, `provider=authkit`
- `signOut()` calls WorkOS logout endpoint and clears Convex auth state
- No raw `sessionStorage` or `localStorage` auth code remains in `auth.ts`

**UX audit checks addressed:** AUTH-1 (user identity visible), AUTH-2 (login/sign-out accessible)

### Task 1.3: UserMenu component — avatar + name + role badge dropdown

**Files to create/modify:**
- `apps/web/src/components/auth/user-menu.tsx` (NEW)

**What this task does:**
Creates a `<UserMenu />` component for the top-right corner of every authenticated page. Shows: avatar (user photo from WorkOS, or initials fallback in a colored circle), display name (first name + last initial), and a color-coded role badge (Driver=Blueprint Blue, Fleet Manager=Signal Green, CaaS=Caution Amber). Clicking the avatar opens a dropdown with: "Settings" link, "Sign Out" button. The dropdown uses a SkeuomorphicCard for the panel. Role badge uses StatusBadge component. Avatar circle uses the role color as background with white initials.

**Dependencies:** Task 1.2 (needs `useWorkOSAuth` rewritten with session-based user data, and `useUserRole` for the role badge)

**Acceptance criteria:**
- Component renders `[Avatar] [Name] [RoleBadge]` in a horizontal row
- Avatar is 36px circle; if no photo, shows initials on role-colored background
- Role badge color: Driver=Blueprint Blue `#4C8FB8`, Fleet Manager=Signal Green `#3F9B6B`, CaaS=Caution Amber `#B8874C`
- Clicking avatar toggles a dropdown with "Settings" and "Sign Out"
- Dropdown uses SkeuomorphicCard for the panel container
- "Sign Out" calls `signOut()` from `useWorkOSAuth()`
- Component handles loading state (shows skeleton avatar while `loading=true`)
- Component handles logged-out state (returns `null` — the layout shows a "Sign In" button instead)
- No `sessionStorage` reads

**UX audit checks addressed:** AUTH-1 (avatar + name + role visible at all times), AUTH-2 (sign-out in dropdown)
**UX principles:** Jakob's Law (avatar dropdown is the standard SaaS pattern — Linear, Stripe, Vercel all do this), Von Restorff (role badge color makes identity instantly scannable)
**Design system:** SkeuomorphicCard (dropdown panel), StatusBadge (role badge), TechnicalLabel (menu items)

### Task 1.4: AppShell layout — sidebar + top bar + user menu (replaces NavHeader)

**Files to create/modify:**
- `apps/web/src/components/nav/app-shell.tsx` (NEW)
- `apps/web/src/app/layout.tsx` (MODIFY — replace NavHeader with AppShell)
- `apps/web/src/components/design/nav-header.tsx` (DEPRECATE — keep file but stop importing)

**What this task does:**
Creates an `<AppShell>` component that wraps all authenticated pages with: (1) a persistent left sidebar (260px, collapsible to 56px) on desktop, (2) a slim top bar (56px height) with logo, page title/breadcrumb, and the `<UserMenu />` component in the top-right, (3) a main content area. On mobile (<768px), the sidebar is hidden and a `<MobileTabBar />` renders at the bottom. The `layout.tsx` root layout replaces `<NavHeader />` with `<AppShell>`. Public routes (`/`, `/role-select`, `/callback`) bypass the AppShell and render without sidebar/top bar.

**Dependencies:** Task 1.3 (needs UserMenu component)

**Acceptance criteria:**
- `AppShell` renders: sidebar (left), top bar (with logo + page title + UserMenu), main content area
- Sidebar is 260px wide on desktop (>1024px), collapses to 56px icon-only on tablet (768-1024px)
- Top bar is 56px tall, sticky, with logo left, page title center-left, UserMenu right
- On mobile (<768px): no sidebar, bottom tab bar renders, compact top bar (56px)
- `layout.tsx` imports `AppShell` instead of `NavHeader`
- `NavHeader` file still exists but is no longer imported by `layout.tsx`
- Public routes (`/`, `/role-select`, `/callback`) do NOT render the AppShell — they render children directly
- AppShell uses `usePathname()` to determine if current route is public (skip shell) or protected (render shell)
- Uses FramedPanel or TechnicalFrame as the outer container for brand consistency

**UX audit checks addressed:** NAV-1 (left sidebar on desktop), AUTH-1 (user identity in top bar)
**UX principles:** Jakob's Law (left sidebar + top bar is the dominant SaaS pattern — Linear, Stripe, Vercel, Notion, Retool all use it), Fitts's Law (sidebar items are persistent and large)
**Design system:** FramedPanel (outer frame), TechnicalLabel (page title), uses CSS variables `--fv-graphite`, `--fv-fog`, `--fv-paper` for background

---

## Wave 2: Welcome Page + Onboarding Flow

**Audit problems addressed:** C1 (no welcome page), C2 (no sign-up flow), C4 (competing CTAs), C5 (sign-in buried), B5 (role-select shows sign-in, not role cards), B6 (callback doesn't complete)
**UX checks addressed:** HOME-1, HOME-2, AUTH-3
**UX principles:** Von Restorff (one primary CTA), Hick's Law (3 choices max on role-select), Fitts's Law (entire role card clickable), Serial Position (role-select first, dashboard celebration last), Jakob's Law (standard auth flow)

### Task 2.1: Welcome page — hero + 3 role cards + "Get Started" CTA

**Files to create/modify:**
- `apps/web/src/app/page.tsx` (REWRITE)
- `apps/web/src/components/welcome/welcome-hero.tsx` (NEW)
- `apps/web/src/components/welcome/role-card.tsx` (NEW)

**What this task does:**
Rewrites the `/` route as a welcome/landing page for unauthenticated users. Shows: (1) hero headline "Plan EV freight routes with AI" with sub-headline explaining value (find charger gaps, model energy, save 62% vs diesel), (2) three role cards (Driver, Fleet Manager, CaaS) each with an icon, title, and one-sentence description, (3) a single primary CTA "Get Started" button linking to `/role-select`. Removes the current route schematic, KPI strip, and 7 competing action buttons. The current home content (route SVG, KPIs) moves to the planner or is deleted. Uses FramedPanel as outer container. The "Get Started" button uses PrimaryButton (Von Restorff — visually dominant). Role cards are display-only on this page (clicking "Get Started" goes to /role-select, not directly to a role).

**Dependencies:** Wave 1 (needs auth boundary so logged-in users see their dashboard, not welcome)

**Acceptance criteria:**
- `/` shows hero headline + sub-headline + 3 role cards + 1 primary CTA
- Hero headline is "Plan EV freight routes with AI" (or equivalent value prop)
- Role cards show: Driver (Truck icon, "I drive vehicles and manage my routes"), Fleet Manager (Users icon, "I manage fleets, dispatch, and drivers"), CaaS (Building2 icon, "I operate charging infrastructure")
- Exactly ONE primary CTA: "Get Started" → links to `/role-select`
- No more than 2 secondary actions (e.g., "Sign In" link for returning users)
- Bottom action bar (Driver Preferences, Fleet Management, CaaS, Sign In) is REMOVED
- Route schematic SVG moved or deleted (not on welcome page)
- KPI strip removed from welcome page
- Uses FramedPanel, SkeuomorphicCard for role cards, PrimaryButton for CTA
- Page passes squint test: "Get Started" button is the most prominent element
- No jargon (POLB, Cajon Pass, Drayage) visible to first-time visitors

**UX audit checks addressed:** HOME-1 (welcome page with "what is this" + CTA), VIS-1 (one primary action — Von Restorff), VIS-2 (squint test — "Get Started" stands out)
**Design system:** FramedPanel (page container), SkeuomorphicCard (role cards), PrimaryButton (CTA), TechnicalLabel (section labels), Inter for headlines, JetBrains Mono for data labels

### Task 2.2: Role-select page — 3 role cards before auth + redirect to WorkOS

**Files to create/modify:**
- `apps/web/src/app/role-select/page.tsx` (REWRITE)

**What this task does:**
Rewrites `/role-select` to show 3 large clickable role cards BEFORE authentication (currently shows only a "Sign in with WorkOS" button). Each card displays: icon (Truck/Users/Building2), role name, one-sentence description, and the entire card is clickable (Fitts's Law — large target). When a user clicks a role card: (1) the selected role is stored in a short-lived cookie or URL query param, (2) the user is redirected to WorkOS hosted login. After auth, the callback reads the stored role and redirects to the role-specific home page. Removes the current dual-state behavior (sign-in button for logged-out, role cards for logged-in). The page uses FramedPanel. Cards use SkeuomorphicCard with hover lift effect.

**Dependencies:** Task 2.1 (welcome page links here), Task 1.2 (needs `signIn()` that accepts a role parameter for redirect)

**Acceptance criteria:**
- `/role-select` shows 3 role cards to unauthenticated users (no "Sign in with WorkOS" button)
- Each card is fully clickable (entire card area, not just a button inside)
- Cards are at least 200px wide × 160px tall (Fitts's Law — large targets)
- Clicking a role card stores the role (cookie or query param) and calls `signIn()` with the role context
- After WorkOS auth + callback, user lands on role-specific home (Driver→/driver, Fleet→/fleet, CaaS→/caas)
- No security jargon text (SOC 2, encryption, MFA) on the role-select page — keep it simple
- Uses FramedPanel as container, SkeuomorphicCard for each role card
- Hover effect: card lifts slightly (`hover:-translate-y-0.5`) and border color shifts to Blueprint Blue
- Icons: Truck (Driver), Users (Fleet Manager), Building2 (CaaS) from lucide-react

**UX audit checks addressed:** HOME-2 (role-select → auth → role-specific home), VIS-3 (Z-pattern for focused page)
**UX principles:** Hick's Law (exactly 3 choices, no additional options), Fitts's Law (entire card is clickable, 48px+ target), Jakob's Law (role/persona selection during signup is standard — Notion, Asana, Slack all do this)

### Task 2.3: Callback page — complete auth flow + role-based redirect

**Files to create/modify:**
- `apps/web/src/app/callback/page.tsx` (REWRITE)

**What this task does:**
Rewrites the `/callback` route to properly complete the WorkOS auth flow. Receives the authorization code, lets the Convex AuthKit component exchange it for a session (sets httpOnly cookie), reads the stored role from the cookie/query param, and redirects to the role-specific home page: Driver→/driver, Fleet Manager→/fleet, CaaS→/caas. If no role was stored (user navigated to /callback directly), redirect to /role-select. Removes ALL `sessionStorage.setItem` calls. Shows a skeleton loading state (not a spinner) during the exchange.

**Dependencies:** Task 2.2 (role is stored before redirect to WorkOS), Task 1.2 (AuthKit session management)

**Acceptance criteria:**
- `/callback` no longer contains any `sessionStorage` references
- Page shows skeleton loading state (gray placeholder shapes) during auth exchange, not a spinner
- After session established: reads stored role → redirects to `/driver`, `/fleet`, or `/caas`
- If no role stored: redirects to `/role-select`
- If auth code missing: redirects to `/role-select`
- No `WORKOS_API_KEY` or `WORKOS_CLIENT_ID` referenced in client-side code
- Redirect uses `router.replace()` (not `router.push()` — no back button to callback)

**UX audit checks addressed:** HOME-2 (role-select → auth → role-specific home), EMPTY-2 (skeleton state, not spinner)
**UX principles:** Skeleton screens reduce perceived wait time by 30%+ (Research §Cross-Cutting), Serial Position Effect (end with celebration — landing on personalized dashboard)

---

## Wave 3: Navigation Architecture — Sidebar + Role-Filtered Nav

**Audit problems addressed:** A1 (top-bar-only nav), A2 (all nav items shown to all users), A4 (no breadcrumb), A6 (no mobile nav), A8 (ambiguous labels)
**UX checks addressed:** NAV-1, NAV-2, NAV-3
**UX principles:** Jakob's Law (left sidebar is the SaaS standard), Hick's Law (fewer choices = faster decisions), Fitts's Law (persistent sidebar items are always reachable), Miller's Law (≤7 nav items per role)

### Task 3.1: useRoleNav hook — role-filtered nav items

**Files to create/modify:**
- `apps/web/src/components/nav/use-role-nav.ts` (NEW)
- `apps/web/src/components/nav/nav-items.ts` (NEW)

**What this task does:**
Creates a `useRoleNav(role)` hook that returns the navigation items appropriate for the user's role. The nav item definitions live in `nav-items.ts` as a static map:

- **Driver:** Dashboard (/driver), My Routes (/driver/routes), Charging (/driver/charging), Vehicle (/driver/vehicle), Messages (/driver/messages)
- **Fleet Manager:** Dashboard (/fleet), Fleet (/fleet/vehicles), Routes (/fleet/routes), Drivers (/fleet/drivers), Reports (/fleet/reports), Settings (/fleet/settings)
- **CaaS:** Dashboard (/caas), Network (/caas/network), Analytics (/caas/analytics), Billing (/caas/billing), Settings (/caas/settings)

Each nav item has: `href`, `label` (concrete noun — "Routes" not "Manage"), `icon` (lucide-react). The hook uses `usePathname()` to mark the active item. Labels use domain-specific nouns (Research §1.5 — "Routes" not "Plan", "Vehicles" not "Assets").

**Dependencies:** Task 1.2 (needs `useUserRole` for the role), Task 1.4 (AppShell will consume this hook)

**Acceptance criteria:**
- `useRoleNav("driver")` returns exactly 5 nav items
- `useRoleNav("fleet_manager")` returns exactly 6 nav items
- `useRoleNav("caas")` returns exactly 5 nav items
- No role sees more than 7 items (Miller's Law)
- No role sees another role's items (Driver never sees "Billing", CaaS never sees "Drivers")
- Each item has `href`, `label`, `icon`
- Labels are concrete nouns (no "Manage", "Optimize", "Build")
- Active item detection: `pathname === item.href` or `pathname.startsWith(item.href + "/")`
- Hook returns `{ items: NavItem[], activeHref: string | null }`

**UX audit checks addressed:** NAV-2 (nav items filtered by role)
**UX principles:** Hick's Law (fewer choices per role), Miller's Law (≤7 items), Research §1.2 ("Never show nav items that a user's role doesn't permit")

### Task 3.2: Sidebar component — 260px collapsible left nav

**Files to create/modify:**
- `apps/web/src/components/nav/sidebar.tsx` (NEW)

**What this task does:**
Creates the `<Sidebar />` component rendered inside AppShell. On desktop (>1024px): 260px wide, fixed left, with logo at top, nav items below (from `useRoleNav`), and a collapse toggle at the bottom. Collapsed state is 56px icon-only (persisted in localStorage). Active item highlighted with Blueprint Blue accent bar on the left edge. Nav items show icon + label; collapsed state shows icon only with tooltip. Uses the Brand Bible color system: Graphite background, Paper text, Steel muted text. Each nav item is at least 40px tall (Fitts's Law). The sidebar header shows the FleetVolt logo (compact version when collapsed).

**Dependencies:** Task 3.1 (useRoleNav for items), Task 1.4 (AppShell renders the sidebar)

**Acceptance criteria:**
- Sidebar is 260px wide on desktop, 56px when collapsed
- Collapse toggle persists in `localStorage` key `fleetvolt_sidebar_collapsed`
- Active nav item has a 3px Blueprint Blue accent bar on the left edge
- Nav items are ≥40px height with 8px spacing
- Collapsed state shows icon-only with `title` attribute tooltip
- Sidebar background uses `var(--fv-graphite)` (#141416), text uses `var(--fv-paper)` (#EFEFF5)
- Logo renders at top (compact icon when collapsed, full horizontal logo when expanded)
- Uses `usePathname()` from next/navigation for active detection
- Smooth width transition on collapse (200ms ease)

**UX audit checks addressed:** NAV-1 (left sidebar, 260px, collapsible to 56px)
**UX principles:** Jakob's Law (every major SaaS app uses left sidebar), Fitts's Law (persistent, large targets), Research §1.1 ("240-280px wide, collapsible to ~48px")
**Design system:** Uses CSS variables for brand colors, TechnicalLabel for section headers, lucide-react icons

### Task 3.3: PageHeader component — breadcrumb + page title

**Files to create/modify:**
- `apps/web/src/components/nav/page-header.tsx` (NEW)

**What this task does:**
Creates a `<PageHeader title="" breadcrumb="" actions="" />` component for the top bar area. Shows the current page title in Inter bold, an optional breadcrumb trail (e.g., "Fleet > Drivers > Add Driver") in JetBrains Mono small text, and an optional actions slot (for primary CTAs like "Dispatch New Route"). The component is rendered inside the AppShell top bar. Breadcrumb items are links. This provides persistent location context (Research §A4 — "user feels lost without it").

**Dependencies:** Task 1.4 (AppShell renders this in the top bar)

**Acceptance criteria:**
- Component accepts `title: string`, `breadcrumb?: {label, href}[]`, `actions?: ReactNode`
- Page title uses Inter bold, 16-18px
- Breadcrumb uses JetBrains Mono, 11px, `var(--fv-steel)` color
- Breadcrumb items are clickable links
- Actions slot renders in the top-right (before UserMenu)
- Component is rendered inside the AppShell top bar on every authenticated page
- No page renders its own custom header — all use this component

**UX audit checks addressed:** NAV-3 (breadcrumbs/page title showing current location)
**UX principles:** Research §A4 ("Add wayfinding before adding more links"), Jakob's Law (breadcrumbs are standard in SaaS)

### Task 3.4: MobileTabBar — bottom tab bar for mobile

**Files to create/modify:**
- `apps/web/src/components/nav/mobile-tab-bar.tsx` (NEW)

**What this task does:**
Creates a `<MobileTabBar />` component that renders on mobile (<768px) as a fixed bottom tab bar with 4-5 role-specific items (top 4 from `useRoleNav`). Each tab has an icon + text label. Touch targets are ≥44px (Apple HIG) / 48px (Material Design). Labels are always visible (no icon-only tabs — Research §7.2 "icons alone are ambiguous"). The tab bar is hidden on tablet/desktop. Active tab highlighted with Blueprint Blue.

**Dependencies:** Task 3.1 (useRoleNav for items)

**Acceptance criteria:**
- Renders only on screens <768px (CSS media query or Tailwind `md:hidden`)
- Shows top 4 nav items for the current role
- Each tab is ≥44px height with icon + text label
- Active tab has Blueprint Blue accent (top border or background)
- Touch targets have ≥8px spacing between them
- Fixed to bottom of viewport, full width
- Does not render on public routes (`/`, `/role-select`, `/callback`)

**UX audit checks addressed:** NAV-1 (sidebar on desktop → bottom tab bar on mobile), part of A6 fix
**UX principles:** Fitts's Law (bottom of screen is closer to thumb), Research §7.1 ("bottom tab bar for ≤5 items"), §7.3 ("minimum 44pt touch target")

---

## Wave 4: Role-Specific Dashboards

**Audit problems addressed:** E1 (no role persistence), E2 (no role-specific home pages), E3 (driver page is a wizard), E4 (fleet page is an empty form), E5 (CaaS not role-gated), D2 (planner role selector non-functional)
**UX checks addressed:** HOME-2, VIS-1, VIS-3, COG-1
**UX principles:** F-pattern (dashboards), Inverted pyramid (summary→trends→details), Miller's Law (3-5 KPIs), 5-second test, Von Restorff (one primary CTA per dashboard)

### Task 4.1: Driver dashboard — replace registration wizard with mobile-first dashboard

**Files to create/modify:**
- `apps/web/src/app/driver/page.tsx` (REWRITE)
- `apps/web/src/components/dashboard/driver-dashboard.tsx` (NEW)
- `apps/web/src/app/driver/register/page.tsx` (NEW — moved registration wizard here)

**What this task does:**
Replaces the current 6-step driver registration wizard at `/driver` with a mobile-first dashboard. The registration wizard moves to `/driver/register`. The new dashboard shows: (1) "Welcome, [Name]" header with role badge (blue), (2) Today's Route card — empty state "No routes assigned yet" with "Refresh" secondary button, (3) Vehicle Status card — empty state "No vehicle assigned" with placeholder, (4) Charging card — empty state "No charging sessions" with nearest-station info. Single-column, card-based layout optimized for mobile. Primary CTA: "Start Navigation" (disabled when no route assigned). Each card uses SkeuomorphicCard. KPIs: next stop ETA, battery %, range — all empty states until data exists.

**Dependencies:** Wave 3 (needs Sidebar + PageHeader), Task 1.2 (needs useUserRole for role-gated rendering)

**Acceptance criteria:**
- `/driver` shows a dashboard, NOT a registration wizard
- Registration wizard is accessible at `/driver/register`
- Dashboard shows 3 cards: Today's Route, Vehicle Status, Charging
- Each card shows an empty state (headline + context + next action) when no data
- "Start Navigation" is the primary CTA (PrimaryButton), disabled when no route
- Layout is single-column, mobile-first (works on 375px viewport)
- Page uses PageHeader with title "Driver Dashboard"
- Role badge (blue) visible in UserMenu
- No hardcoded KPIs — all values are empty states until real data exists
- 5-second test passes: user can identify "Start Navigation" as the primary action

**UX audit checks addressed:** HOME-2 (role-specific home page), VIS-1 (one primary CTA), EMPTY-1 (empty states with guidance)
**UX principles:** Fitts's Law (full-width primary CTA on mobile), Research §5 ("empty state: headline + context + next action"), Research §6.4 ("Driver needs mobile-first, single-column layout")
**Design system:** SkeuomorphicCard (route/vehicle/charging cards), PrimaryButton (Start Navigation), KpiCell (battery/range when data exists), StatusBadge (route status), TechnicalLabel

### Task 4.2: Fleet Manager dashboard — replace empty form with KPI dashboard

**Files to create/modify:**
- `apps/web/src/app/fleet/page.tsx` (REWRITE)
- `apps/web/src/components/dashboard/fleet-dashboard.tsx` (NEW)
- `apps/web/src/app/fleet/setup/page.tsx` (NEW — moved fleet registration wizard here)

**What this task does:**
Replaces the current "No Fleet Created" 4-step wizard at `/fleet` with a Fleet Manager dashboard. The wizard moves to `/fleet/setup`. The new dashboard shows: (1) "Welcome, [Name]" + role badge (green), (2) KPI row (4 cells using KpiCell): Active Vehicles (0), Routes In Progress (0), Charging Sessions (0), Fleet Utilization (0%), (3) Empty state: "Your fleet is empty. Add your first vehicle to get started." with primary CTA "Add Vehicle", (4) Vehicle status table placeholder (empty state when no vehicles). F-pattern layout: KPIs top, content below. Primary CTA: "Add Vehicle" (PrimaryButton, top-right). The existing fleet registration wizard is moved, not deleted.

**Dependencies:** Wave 3 (needs Sidebar + PageHeader)

**Acceptance criteria:**
- `/fleet` shows a dashboard, NOT a registration wizard
- Fleet registration wizard is accessible at `/fleet/setup`
- KPI row shows exactly 4 KpiCells (not more — Miller's Law)
- Each KPI shows "0" or "0%" when no data (not hardcoded fake numbers)
- Empty state has headline + context + "Add Vehicle" CTA
- "Add Vehicle" is the single primary CTA (Von Restorff)
- Layout follows F-pattern: KPIs top row, content below
- Page uses PageHeader with title "Fleet Dashboard"
- Role badge (green) visible in UserMenu
- 5-second test: "Add Vehicle" is identifiable as the primary action

**UX audit checks addressed:** HOME-2, VIS-1 (one primary CTA), VIS-3 (F-pattern), COG-1 (≤5 KPIs), EMPTY-1 (empty state with CTA)
**UX principles:** Research §6.1 ("Limit to 3-5 KPIs"), §6.2 ("inverted pyramid: summary→trends→details"), Von Restorff (one primary CTA)
**Design system:** KpiCell (4 KPIs), SkeuomorphicCard (empty state container), PrimaryButton (Add Vehicle), StatusBadge, TechnicalLabel, FramedPanel

### Task 4.3: CaaS dashboard — keep existing content, add auth gating + KPI row

**Files to create/modify:**
- `apps/web/src/app/caas/page.tsx` (MODIFY)
- `apps/web/src/components/dashboard/caas-dashboard.tsx` (NEW — extracted from existing page)

**What this task does:**
The CaaS page already has real content (hotspots, county scores, AI planner CTA). This task: (1) wraps it in the AppShell with auth gating (CaaS role only), (2) adds a KPI row at top (4 cells): Active Stations (0), Sessions Today (0), Revenue ($0), Network Utilization (0%), (3) adds "Welcome, [Name]" + role badge (amber), (4) standardizes the page header using PageHeader. The existing hotspot analysis and county scores content is preserved but moved below the KPI row. Primary CTA: "Open AI Planner" (links to /planner). Registration/setup flow (if any) moves to `/caas/setup`.

**Dependencies:** Wave 3 (needs Sidebar + PageHeader)

**Acceptance criteria:**
- `/caas` renders inside AppShell with sidebar + top bar
- Page is auth-gated (middleware redirects unauthenticated users to `/`)
- KPI row shows exactly 4 KpiCells
- Existing hotspot analysis and county scores content preserved below KPI row
- "Open AI Planner" is the primary CTA (PrimaryButton)
- Page uses PageHeader with title "CaaS Dashboard"
- Role badge (amber) visible in UserMenu
- No content visible to non-CaaS roles (backend enforced separately in future)

**UX audit checks addressed:** HOME-2, VIS-1, VIS-3 (F-pattern), COG-1 (4 KPIs)
**Design system:** KpiCell, SkeuomorphicCard (hotspot content), PrimaryButton (Open AI Planner), FramedPanel, TechnicalLabel


---

## Wave 5: Planner Fixes — Empty States, Error Handling, One Primary Action

### Task 5.1: Planner empty state — replace checkerboard with guided empty state
**Files to create/modify:**
- `apps/web/src/components/planner/empty-state.tsx` (new)
- `apps/web/src/app/planner/page.tsx` (modify — render empty state when no route selected)

**What it does:**
When no route/corridor is selected, the planner center area shows a proper empty state instead of the gray checkerboard. The empty state contains:
1. Headline: "No Route Selected" (Inter 19px bold)
2. Context: "Choose a corridor to see the route visualization, charging stops, and energy profile." (Inter 13px Slate)
3. Primary action: "Select Corridor" button (PrimaryButton) that focuses the corridor selector
4. Optional visual: a faint technical SVG of a truck outline (Steel stroke, 0.5px)

**UX principle:** Pixxen empty state pattern — headline + context + next action + optional visual.

**Acceptance criteria:**
- Empty state shows when no corridor is selected
- "Select Corridor" button focuses/highlights the corridor dropdown in the left sidebar
- No raw gray checkerboard visible at any time
- Empty state uses FramedPanel with SkeuomorphicCard inner elements

**UX audit checks addressed:** EMPTY-1
**Design system:** FramedPanel, SkeuomorphicCard, PrimaryButton, TechnicalLabel

### Task 5.2: AI planner error handling — human-readable messages with next steps
**Files to create/modify:**
- `apps/web/convex/planner.ts` (modify — wrap query execution in try/catch, return human-readable error)
- `apps/web/src/components/planner/chat-panel.tsx` (modify — render errors with suggested actions)

**What it does:**
When Convex queries fail inside the planner action, the AI returns a human-readable error message instead of raw API paths. The error message:
1. States what happened in plain language ("I couldn't retrieve charging data for this route.")
2. Suggests a fix ("Try selecting a specific corridor first, or check that the Convex backend is connected.")
3. Offers a retry button

The chat panel renders errors in a Caution Amber-bordered SkeuomorphicCard with a "Retry" SecondaryButton.

**UX principle:** Brand Bible voice — "Status is factual: Within limit / Near limit / Over limit — severity from data, not adjectives."

**Acceptance criteria:**
- No raw API paths (e.g., `chargers/queries:class8Gap`) visible in chat
- Error card has amber border + retry button
- Error message explains what happened + what to do next
- Successful queries still render normally

**UX audit checks addressed:** EMPTY-2
**Design system:** SkeuomorphicCard (amber variant), SecondaryButton, TechnicalLabel

### Task 5.3: Planner visual hierarchy — one primary action per page
**Files to modify:**
- `apps/web/src/app/planner/page.tsx` (restructure — single primary CTA)
- `apps/web/src/components/planner/chat-panel.tsx` (de-emphasize chat input)

**What it does:**
The planner page gets exactly ONE primary action: "Run Simulation" (PrimaryButton, Graphite gradient, prominent). The AI chat input is de-emphasized to a SecondaryButton/pill style. The role selector moves out of the planner (it was already handled in Wave 3 sidebar). The corridor context becomes the left sidebar content.

**UX principle:** Von Restorff Effect — the item that stands out is the one users act on. Only one element should be visually dominant.

**Acceptance criteria:**
- Exactly one PrimaryButton visible ("Run Simulation") 
- Chat input is secondary (SecondaryButton styling, smaller)
- Role selector removed from planner (handled by sidebar)
- KPIs remain in right column (3 KpiCells max — Miller's Law)
- Squint test passes: "Run Simulation" is the visually dominant element

**UX audit checks addressed:** VIS-1, VIS-2, COG-1
**Design system:** PrimaryButton, SecondaryButton, KpiCell, FramedPanel

---

## Wave 6: Error Handling, Loading States, Dead Route Cleanup

### Task 6.1: Loading states — skeleton screens for all data-heavy pages
**Files to create:**
- `apps/web/src/components/design/skeleton-card.tsx` (new — animated placeholder card)
- `apps/web/src/components/design/skeleton-row.tsx` (new — animated placeholder table row)

**What it does:**
Create skeleton screen components that show animated placeholders while Convex queries are loading. Apply to:
- Driver dashboard (while route/vehicle data loads)
- Fleet dashboard (while fleet/KPI data loads)
- CaaS dashboard (while hotspot/zone data loads)
- Planner results panel (while simulation runs)

Skeletons use the SkeuomorphicCard shape with a subtle pulse animation (CSS only, no JS).

**UX principle:** Jakob's Law — users expect loading states they've seen elsewhere (LinkedIn, Facebook, Stripe all use skeleton screens).

**Acceptance criteria:**
- All data-heavy pages show skeleton cards during load (not blank, not spinner)
- Skeleton pulse animation is ≤ 1.5s, CSS-only
- Skeleton shape matches the final content shape (card, row, KPI cell)
- No "flash of unstyled content" — skeleton renders immediately

**UX audit checks addressed:** EMPTY-1 (prevents empty flash during load)
**Design system:** SkeuomorphicCard (skeleton variant), KpiCell (skeleton variant)

### Task 6.2: Dead route cleanup — remove or fix 404 routes
**Files to modify:**
- `apps/web/src/app/network/` (remove or redirect to /caas)
- `apps/web/src/app/unit/` (keep, add to sidebar nav for Fleet Manager)
- `apps/web/src/app/load/` (keep, add to sidebar nav for Fleet Manager)
- `apps/web/src/app/status/` (keep, add to sidebar nav as "System Status")
- `apps/web/src/app/pulse/` (fix or remove — currently fails to load)

**What it does:**
- `/network` → redirect to `/caas` (it's the CaaS network page)
- `/pulse` → fix the loading error or remove the route
- `/unit`, `/load` → keep, add to Fleet Manager sidebar nav
- `/status` → keep, add to all roles' sidebar nav as "System Status"

**Acceptance criteria:**
- No route returns a 404 (except genuinely non-existent paths)
- `/network` redirects to `/caas`
- `/pulse` either works or is removed from the codebase
- `/unit` and `/load` are accessible from the Fleet Manager sidebar
- `/status` is accessible from all role sidebars

**UX audit checks addressed:** NAV-3 (no dead links)

### Task 6.3: Global error boundary — graceful error page
**Files to create:**
- `apps/web/src/app/error.tsx` (new — Next.js error boundary)
- `apps/web/src/app/not-found.tsx` (new — custom 404 page)

**What it does:**
- `error.tsx`: Catches runtime errors and shows a branded error page with "Something went wrong" headline + "Reload" button. Uses FramedPanel with Alert Red accent.
- `not-found.tsx`: Custom 404 page with "Page not found" + "Go to Dashboard" link. Uses FramedPanel.

**Acceptance criteria:**
- Runtime errors show branded error page (not raw Next.js error)
- 404 shows branded not-found page with link to user's role home
- Both pages use the Technical Brand Geometry aesthetic
- Both are server components (no client-side state)

**UX audit checks addressed:** EMPTY-2 (errors are human-readable)
**Design system:** FramedPanel, PrimaryButton (Reload), SecondaryButton (Go to Dashboard)

---

## Verification: UX Audit Pass

After all 6 waves are complete, run the `fleetvolt-ux-audit` skill against every page:

1. `/` (welcome) — 15 checks
2. `/role-select` — 15 checks
3. `/callback` — 15 checks
4. `/driver` — 15 checks
5. `/fleet` — 15 checks
6. `/caas` — 15 checks
7. `/planner` — 15 checks
8. `/hotspot` — 15 checks

**Pass threshold: 95% per page** (maximum 1 minor issue). Any page below 95% must be fixed before the phase is complete.

## Summary

| Wave | Tasks | UX Checks Addressed | Dependencies |
|------|-------|---------------------|-------------|
| 1 | 4 (auth boundary, session, UserMenu, AppShell) | AUTH-1, AUTH-2, AUTH-3 | None |
| 2 | 3 (welcome, role-select, callback) | HOME-1, HOME-2 | Wave 1 |
| 3 | 4 (useRoleNav, Sidebar, PageHeader, MobileTabBar) | NAV-1, NAV-2, NAV-3 | Wave 1 |
| 4 | 3 (Driver, Fleet, CaaS dashboards) | VIS-1, VIS-2, VIS-3, COG-1, COG-2 | Waves 1+3 |
| 5 | 3 (empty state, error handling, one primary action) | EMPTY-1, EMPTY-2, VIS-1, VIS-2, COG-1 | Waves 1+3 |
| 6 | 3 (loading states, dead routes, error boundary) | NAV-3, EMPTY-1, EMPTY-2 | All prior |

**Total: 20 tasks across 6 waves.** All tasks reference the Brand Bible design system and UX research principles.
