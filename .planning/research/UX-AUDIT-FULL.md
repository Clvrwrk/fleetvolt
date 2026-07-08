I have all the data I need from the live site inspection and source code review. Here is the comprehensive UX audit.

---

# FleetVolt UX/Navigation Audit — Pre-Planning Document

**Auditor:** UX Auditor Subagent  
**Date:** July 8, 2026  
**Site inspected:** fleetvolt.network (live)  
**Source code reviewed:** `/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web/src/app/`  
**Research basis:** `fleetvolt-ux-research.md` (Laws of UX, NN/G, WorkOS patterns)

---

## Executive Summary

FleetVolt currently functions as a **public demo tool, not a product**. There is no auth boundary, no user identity, no role-gated navigation, no onboarding flow, and no welcome page. All routes are accessible to all visitors with no login required. The app scores **28/100** on navigation intuitiveness. The core problems are structural, not cosmetic — fixing them requires a navigation architecture overhaul, not just UI tweaks.

---

## Navigation Intuitiveness Score: 28/100

| Criterion | Points | Score | Reason |
|---|---|---|---|
| Persistent nav visible on all pages | 15 | 10 | Top bar exists but is top-bar-only (anti-pattern for 6+ section apps) |
| Role-filtered nav items | 15 | 0 | All 6 nav links shown to everyone; no role filtering whatsoever |
| User identity always visible | 15 | 0 | No avatar, name, role badge, or login state anywhere in the chrome |
| Auth boundary enforced | 10 | 0 | All app pages accessible without login; no redirect to auth |
| Clear landing/welcome page | 10 | 5 | Home page exists with content but no "what is this" message or sign-up CTA |
| One primary CTA per page | 10 | 5 | Home has competing CTAs; planner has no primary action (just a chat input) |
| Breadcrumbs / location indicator | 5 | 2 | Active nav link highlighted, but no breadcrumb or page title in context |
| Empty states with guidance | 5 | 2 | Fleet page has "No Fleet Created" but no CTA to create one (button disabled) |
| Error states actionable | 5 | 0 | AI chat errors mentioned in context; /pulse shows "couldn't load" with no explanation |
| Mobile-responsive nav | 5 | 2 | Top bar collapses but no bottom tab bar or mobile nav pattern |
| Routes all functional | 5 | 2 | /network, /unit, /load all return 404; /pulse fails to load |

**Total: 28/100**

---

## Problem Catalog (by Category)

### A. Navigation (8 problems)

**A1. Top-bar-only navigation — CRITICAL**  
- **Current:** A horizontal top bar with 6 links (Home, Planner, Driver, Fleet, CaaS, Network). No left sidebar anywhere.  
- **Desired:** Persistent left sidebar on desktop (260px, collapsible to 56px) with role-filtered items. Top bar reserved for logo, page title/breadcrumb, search, and user avatar.  
- **Fix:** Replace the top `<nav>` with a `<Sidebar>` component that renders role-appropriate links. Keep a slim top bar for identity + breadcrumbs.  
- **UX principle violated:** Jakob's Law — every major SaaS app (Linear, Stripe, Vercel, Notion) uses left sidebar nav. Top-bar-only fails past 5 items.

**A2. All nav items shown to all users — CRITICAL**  
- **Current:** Every visitor sees all 6 nav links regardless of role or auth status. A driver sees "Fleet" and "CaaS"; a CaaS operator sees "Driver."  
- **Desired:** Nav items computed from user's role. Driver sees: Dashboard, My Routes, Charging, Vehicle, Messages. Fleet Manager sees: Dashboard, Fleet, Routes, Drivers, Reports, Settings. CaaS sees: Dashboard, Network, Analytics, Billing, Settings.  
- **Fix:** Create a `useRoleNav(role)` hook that returns the nav item list per role. Sidebar maps over this list. Backend enforces access separately.  
- **UX principle violated:** Hick's Law — more choices = slower decisions. Also a security concern (frontend implies access that may not exist).

**A3. "Network" nav link goes to 404 — MAJOR**  
- **Current:** `/network` returns a Next.js 404 page. The link is visible in the top nav on every page.  
- **Desired:** Either the route works or the link is removed/hidden.  
- **Fix:** Either implement `/network` or remove it from nav until it's ready. If it's the CaaS network page, alias it or rename the CaaS link.

**A4. No breadcrumb or page title in context — MAJOR**  
- **Current:** The only location indicator is the highlighted active link in the top bar. Once you scroll down, you lose even that.  
- **Desired:** A page title in the top bar area (e.g., "Fleet > Drivers > Add Driver") that persists during scroll.  
- **Fix:** Add a `<PageHeader>` component to the top bar that shows the current route's title and optional breadcrumb trail.

**A5. Footer links duplicate nav links — MINOR**  
- **Current:** The home page has a bottom action bar with "Driver Preferences," "Fleet Management," "Charging-as-a-Service," and "Sign In" — these duplicate the top nav and add confusion.  
- **Desired:** Footer should contain legal/company links, not primary navigation.  
- **Fix:** Remove the bottom action bar from the home page. Move "Sign In" to the top-right user identity area.

**A6. No mobile navigation pattern — MAJOR**  
- **Current:** The top bar links simply squeeze together on smaller screens. No hamburger menu, no bottom tab bar, no responsive collapse.  
- **Desired:** Mobile (<768px): bottom tab bar with 4-5 role-specific items + hamburger for secondary. Tablet (768-1024px): collapsed icon-only sidebar.  
- **Fix:** Create responsive `<MobileTabBar role={role} />` and `<CollapsibleSidebar />` components. Driver persona is mobile-first — this is critical for that role.

**A7. Routes /hotspot, /unit, /load, /status exist but are not in nav — MINOR**  
- **Current:** These routes exist in the app directory but are not linked from any navigation. `/hotspot` and `/unit` are linked from the home page action buttons but not from the main nav. `/load` and `/status` are orphaned.  
- **Desired:** All accessible routes should be discoverable through navigation or clear CTAs. Orphaned routes should be removed or intentionally linked.  
- **Fix:** Audit all routes. Add legitimate ones to role-appropriate nav sections. Remove dead routes.

**A8. "Planner" and "Plan with AI" are ambiguous labels — MINOR**  
- **Current:** The nav says "Planner." The role-select page has a "Plan with AI" card. The home page says "Start New Route Simulation." These all point to the same thing but use different labels.  
- **Desired:** One consistent label. Research recommends concrete nouns: "Route Planner" or "AI Planner."  
- **Fix:** Standardize on "Route Planner" across all references.

---

### B. Auth (7 problems)

**B1. No user identity indicator anywhere — CRITICAL**  
- **Current:** No avatar, no name, no role badge, no "logged in as" indicator on any page. The top-right corner has nav links instead of user identity.  
- **Desired:** Top-right corner always shows: `[Avatar] [Name] [Role Badge]`. Clicking opens dropdown with role switcher, settings, sign out.  
- **Fix:** Create a `<UserMenu />` component that reads from `useWorkOSAuth()`. Render it in the top bar on every page. Avatar = initials fallback in colored circle. Role badge = color-coded (Driver=blue, FM=green, CaaS=purple).  
- **UX principle violated:** "This is non-negotiable. Every page must show user avatar, name, current role." (Research doc §4.3)

**B2. No login/logout buttons in the nav — CRITICAL**  
- **Current:** No "Sign In" or "Log Out" button in the top navigation. The only sign-in path is a "Sign In" link buried in the home page footer action bar, which links to `/role-select`.  
- **Desired:** When logged out: "Sign In" button (top-right, prominent). When logged in: "Sign Out" in user dropdown.  
- **Fix:** Add conditional auth button to top bar: `{user ? <UserMenu /> : <SignInButton />}`.

**B3. No auth boundary — all app pages accessible without login — CRITICAL**  
- **Current:** `/planner`, `/driver`, `/fleet`, `/caas` all load without authentication. No middleware redirects unauthenticated users.  
- **Desired:** Unauthenticated users see the home/welcome page with "Get Started" CTA. App pages redirect to `/role-select` → WorkOS auth.  
- **Fix:** Add Next.js middleware (`middleware.ts`) that checks session cookie on `/planner`, `/driver`, `/fleet`, `/caas`, `/network` routes. Redirect to `/role-select` if no session.  
- **UX principle violated:** "Logged-out users see marketing/landing page, never app UI." (Research doc §4.4)

**B4. Session stored in sessionStorage, not httpOnly cookie — MAJOR**  
- **Current:** `auth.ts` stores user data in `sessionStorage.getItem("fleetvolt_user")`. The callback page stores the auth code in `sessionStorage.setItem("fleetvolt_auth_code", code)`. This is insecure — vulnerable to XSS.  
- **Desired:** Session token in httpOnly, Secure, SameSite=Lax cookie. User data fetched from Convex/WorkOS server-side.  
- **Fix:** Move session management to server-side. Use WorkOS AuthKit's cookie-based session. Remove all `sessionStorage` auth code.

**B5. /role-select shows sign-in but no actual role selection before auth — MAJOR**  
- **Current:** The `/role-select` page heading says "Choose your role" but when unauthenticated, it only shows a "Sign in with WorkOS to continue" button. No role cards. The actual role selection only appears *after* authentication.  
- **Desired:** Role selection should happen *before* auth (Hick's Law — minimize choices at each step). Flow: select role → then auth → then land on role-specific page.  
- **Fix:** Show 3 role cards (Driver, Fleet Manager, CaaS) on the unauthenticated `/role-select` page. User clicks a card → store intended role in a query param or cookie → redirect to WorkOS → on callback, redirect to role-specific page.  
- **UX principle violated:** Research doc §2 — "Role-select screen: 3 large cards, each clickable, before auth."

**B6. Callback page doesn't complete the auth flow — MAJOR**  
- **Current:** `/callback` stores the auth code in sessionStorage and redirects to `/role-select`. It never exchanges the code for a session token. The comment says "the Convex WorkOS component will sync the real user data via webhook" but there's no evidence this is wired up.  
- **Desired:** Callback exchanges code for session via WorkOS API, sets httpOnly cookie, redirects to role-specific dashboard.  
- **Fix:** Implement server-side code exchange in the callback route (or a Convex action). Set session cookie. Redirect based on stored role preference.

**B7. No session expiration handling — MAJOR**  
- **Current:** If the session expires, the user hits API calls that return 401 and sees raw errors (like the AI chat errors mentioned in the screenshot description).  
- **Desired:** Session expiration → redirect to sign-in page with toast: "Your session has expired. Please sign in again."  
- **Fix:** Add API response interceptor that catches 401 and redirects to `/role-select` with a toast notification.

---

### C. Home / Onboarding (6 problems)

**C1. No welcome/home page that explains what FleetVolt is — CRITICAL**  
- **Current:** `/` shows a "FleetVolt Route" card with a route schematic, KPI strip, and action buttons. It's a data dashboard, not a welcome page. There's no "What is FleetVolt?" message, no value proposition, no "Get Started" CTA for new users.  
- **Desired:** `/` (for logged-out users) shows: hero with value proposition ("Plan EV freight routes with AI — find charger gaps, model energy, save 62% vs diesel"), 3 role cards, and a single "Get Started" CTA. Logged-in users see their role-specific dashboard.  
- **Fix:** Create a `<WelcomePage />` for unauthenticated users with: hero headline, 3 role cards (Driver/Fleet Manager/CaaS), "Get Started" button → `/role-select`. Move the current route schematic content to the planner or a "demo" view.  
- **UX principle violated:** "The gap between signup and value is where SaaS products die." (ProductLed, research doc §5)

**C2. No sign-up flow visible — CRITICAL**  
- **Current:** There is no "Sign Up" or "Create Account" button anywhere on the home page or navigation. The only auth entry point is a "Sign In" link in the home page footer.  
- **Desired:** Prominent "Get Started" or "Sign Up" CTA on the home page (Von Restorff — visually distinct, primary action).  
- **Fix:** Add a `<GetStartedButton />` to the home page hero and to the top-right nav area when unauthenticated.

**C3. No onboarding flow after first login — MAJOR**  
- **Current:** After WorkOS auth (if it worked), the user lands on `/role-select` which shows role cards. But there's no guided first-run experience, no empty state with a CTA, no onboarding checklist.  
- **Desired:** After auth + role selection, user lands on role-specific dashboard with: welcome message with their name, role-specific empty state with single CTA, optional dismissible onboarding checklist (3-4 items).  
- **Fix:** Create role-specific empty states (Driver: "No routes assigned yet" + refresh; Fleet: "Your fleet is empty" + "Add Vehicle"; CaaS: "No charging stations configured" + "Add Station"). Add optional onboarding checklist component.

**C4. Home page CTAs are confusing and competing — MAJOR**  
- **Current:** Home page has: "Start New Route Simulation" (primary), "Configure Truck Unit" (secondary), "Explore SoCal Network" (secondary), "Driver Preferences," "Fleet Management," "Charging-as-a-Service," "Sign In" — 7 actions, no clear hierarchy.  
- **Desired:** One primary CTA per page (Von Restorff). Home page for logged-out users: "Get Started" only. Home page for logged-in users: role-specific primary action.  
- **Fix:** Reduce to 1 primary + max 2 secondary CTAs. Remove the bottom action bar entirely.  
- **UX principle violated:** Von Restorff Effect — "Never have two equally-weighted CTAs competing for attention."

**C5. "Sign In" link in footer is buried — MAJOR**  
- **Current:** The only "Sign In" link is in the home page's bottom action bar, mixed in with "Driver Preferences," "Fleet Management," etc.  
- **Desired:** Sign In / Get Started should be in the top-right corner of the nav bar — the standard position users expect.  
- **Fix:** Move auth actions to top-right nav. Remove from footer action bar.

**C6. No progressive disclosure — first-time users see everything — MINOR**  
- **Current:** A first-time visitor sees the full planner with AI chat, KPIs, role selector, and corridor context — all at once.  
- **Desired:** First-time users see minimal nav items. Additional features appear as they add data (vehicles, routes, stations).  
- **Fix:** Implement progressive nav — start with 3-4 items per role, reveal more as the user engages. Defer to post-onboarding settings.

---

### D. Layout / Hierarchy (6 problems)

**D1. Planner uses 3-column layout but center column is just a chat box — MAJOR**  
- **Current:** Planner has left rail (role + context), center (AI chat), right rail (KPIs). The center has no map — just a grid placeholder with a chat interface. The map is supposed to be the primary visualization.  
- **Desired:** Center column = map visualization (primary). AI chat = a collapsible panel or floating widget. Right rail = results that update when the map/route changes.  
- **Fix:** Add a `<MapContainer />` to the center column. Move the chat to a collapsible bottom panel or a floating assistant widget. KPIs should update based on map interactions.  
- **UX principle violated:** Three-column pattern works "when the visualization is the primary output" — currently the viz is missing.

**D2. Role selector on planner is non-functional — MAJOR**  
- **Current:** The left rail has "Driver," "Fleet Manager," "CaaS" buttons with `data-role` attributes but no click handlers. They appear to be display-only. The `ChatPanel` receives `defaultRole="caas"` hardcoded.  
- **Desired:** Role selector changes the AI assistant's context and the KPIs shown. Or better: remove the role selector from the planner entirely — the user's role should already be set from login.  
- **Fix:** Remove the role selector from the planner. Use the authenticated user's role. If multi-role access is needed, use the user dropdown role switcher.

**D3. KPIs on planner are hardcoded/static — MAJOR**  
- **Current:** Right rail shows "312 kWh," "2 charge stops," "62% savings" — these are static values, not computed from any actual route simulation.  
- **Desired:** KPIs update when a route is planned or an AI query returns results. If no route is active, show empty state: "Plan a route to see energy, charging, and savings metrics."  
- **Fix:** Wire KPI cells to route simulation state. Show empty state when no simulation is active.

**D4. No consistent page header pattern — MINOR**  
- **Current:** Each page has its own header style. Home page: "FleetVolt Route" + version label. Planner: "Route Planner" + technical label. Fleet: "Fleet Manager" + "FLEET REGISTRATION & OPERATIONS." CaaS: "Charging-as-a-Service DEPLOYMENT ZONES & GAP ANALYSIS." No consistent structure.  
- **Desired:** Consistent `<PageHeader title="" breadcrumb="" actions="" />` component on every page.  
- **Fix:** Create a standardized PageHeader component. Apply it to all routes.

**D5. Home page route schematic is decorative, not interactive — MINOR**  
- **Current:** The home page shows a static SVG route schematic (POLB → Bakersfield). It looks nice but doesn't do anything — you can't click on it to explore.  
- **Desired:** Either make it interactive (click to open the planner with that route pre-loaded) or replace it with a value proposition hero.  
- **Fix:** For logged-out users, replace with a hero headline + CTA. For logged-in users, show their recent routes or a "resume" card.

**D6. /status page is nearly empty — MINOR**  
- **Current:** `/status` shows just "FleetVolt Route" as a heading with nothing else.  
- **Desired:** Either a proper status/health page (system status, API health, data freshness) or remove the route.  
- **Fix:** Implement a proper status page or remove the route.

---

### E. Role-Based UX (5 problems)

**E1. No role persistence — role is not stored after selection — CRITICAL**  
- **Current:** The planner has a role selector, but the selected role is not persisted anywhere. The `defaultRole="caas"` is hardcoded in the planner. There's no user → role mapping in the auth system.  
- **Desired:** User's role is stored in their profile (Convex/WorkOS metadata). Role persists across sessions. Nav and dashboard adapt to role.  
- **Fix:** Store role in user metadata during role-select flow. Read role from auth context in all pages. Create `useRole()` hook.

**E2. No role-specific home pages after login — CRITICAL**  
- **Current:** After login (if it worked), user lands on `/role-select` which shows all 4 role cards. No automatic redirect to role-specific dashboard.  
- **Desired:** Post-auth redirect: Driver → `/driver` (Today's Route), Fleet Manager → `/fleet` (Fleet Overview), CaaS → `/caas` (Network Status).  
- **Fix:** In callback page, after session establishment, read user's role and `router.replace(roleHomeUrl(role))`.

**E3. Driver page is a 6-step registration wizard, not a dashboard — MAJOR**  
- **Current:** `/driver` shows a 6-step wizard (Step 1: Identity, Step 2-6: unlabeled) for creating a "NEW DRIVER PROFILE." This is an admin tool, not a driver's home page.  
- **Desired:** Driver's home page = mobile-first dashboard with: Today's Route card (map + next stop + ETA), Vehicle Status card (battery %, range), Charging card (nearest station). Primary action: "Start Navigation."  
- **Fix:** Create a separate `/driver` dashboard page. Move the registration wizard to `/driver/register` or `/fleet/drivers/new`.

**E4. Fleet page is an empty registration form, not a dashboard — MAJOR**  
- **Current:** `/fleet` shows "No Fleet Created" with a 4-step wizard (Create Fleet, Parking Lots, Drivers, Routes). The "Create Fleet" button is disabled.  
- **Desired:** Fleet Manager's home page = dashboard with: KPI row (Active Vehicles, Routes In Progress, Charging Sessions, Fleet Utilization), fleet utilization trend, vehicle status table. Primary action: "Dispatch New Route."  
- **Fix:** Create a `/fleet` dashboard page. Move fleet registration to `/fleet/setup` or `/fleet/register`.

**E5. CaaS page has real content but no role-gated access — MINOR**  
- **Current:** `/caas` shows a populated dashboard with hotspots, county scores, and a CTA to open the AI Planner. This is the most complete page, but it's accessible to everyone.  
- **Desired:** CaaS dashboard should only be visible to CaaS-role users. The data is appropriate but should be behind the auth boundary.  
- **Fix:** Apply auth middleware to `/caas`. Verify role is CaaS before rendering.

---

### F. Error Handling (5 problems)

**F1. AI chat errors are not user-friendly — MAJOR**  
- **Current:** Per the screenshot description, the AI chat shows error messages about failed queries (`class8Gap` and `topCarriersNear` returned errors). These appear to be raw API/internal errors shown to the user.  
- **Desired:** Errors are human-readable: "I couldn't fetch charger gap data right now. Try rephrasing your question, or check back in a moment." With a retry button.  
- **Fix:** Wrap AI chat queries in error boundaries. Show user-friendly messages. Add retry button. Log technical errors to console/backend only.  
- **UX principle violated:** "Errors are human-readable and actionable." (Research doc §6, EMPTY-2)

**F2. /pulse page fails to load with no explanation — MAJOR**  
- **Current:** `/pulse` shows "This page couldn't load" with "Reload" and "Back" buttons. No explanation of what went wrong.  
- **Desired:** Either the page works, or it shows a proper error state with: what happened, why, and what to do next.  
- **Fix:** Debug the `/pulse` page loading error. If it's a data dependency issue, add a loading skeleton + error boundary with retry.

**F3. /network, /unit, /load return 404 with no guidance — MAJOR**  
- **Current:** Three routes linked from the nav or home page return generic Next.js 404 pages.  
- **Desired:** Either the routes work, or they show a "Coming Soon" page, or the links are removed.  
- **Fix:** Implement the routes or remove the links. For planned-but-unbuilt routes, show a "This feature is coming soon" page with a link back to the home page.

**F4. No loading skeleton states — MINOR**  
- **Current:** The callback page shows a spinner. No other page has loading states.  
- **Desired:** Skeleton screens (gray placeholder shapes) during data loading. Reduces perceived wait time by 30%+.  
- **Fix:** Create `<Skeleton />` components for KPI cards, tables, and chat messages. Use them while data loads.  
- **UX principle violated:** "Use skeleton screens instead of spinners." (Research doc, cross-cutting principles)

**F5. No empty state on planner when no route is active — MINOR**  
- **Current:** The planner shows static KPIs (312 kWh, 2 stops, 62% savings) even when no route has been planned. This is misleading — it looks like real data.  
- **Desired:** When no route is active, show empty state: "No route planned yet. Ask the AI assistant to plan a route, or enter your origin and destination."  
- **Fix:** Add empty state to the right rail KPI area. Show KPIs only after a simulation is run.

---

## Ideal User Journey

```
1. FIRST VISIT (unauthenticated)
   ↓
   User visits fleetvolt.network
   ↓
   Lands on / (Welcome Page)
   - Hero: "Plan EV freight routes with AI"
   - Value props: charger gaps, energy modeling, 62% savings
   - 3 role cards: Driver, Fleet Manager, CaaS
   - Single primary CTA: "Get Started" (Von Restorff)
   ↓

2. SIGN UP / GET STARTED
   ↓
   User clicks "Get Started"
   ↓
   Redirects to /role-select
   - 3 large clickable cards (Hick's Law — max 3 choices)
   - Each card: icon + role name + one-sentence description
   - "Driver — I drive vehicles and manage my routes"
   - "Fleet Manager — I manage fleets, dispatch, and drivers"
   - "CaaS — I operate charging infrastructure"
   ↓

3. ROLE SELECTION
   ↓
   User clicks a role card (entire card is clickable — Fitts's Law)
   ↓
   Role stored in cookie/query param
   ↓

4. WORKOS AUTH
   ↓
   Redirect to WorkOS AuthKit hosted login page
   - FleetVolt logo at top
   - Email/password + Google SSO
   - Standard, familiar auth flow (Jakob's Law)
   ↓
   User authenticates
   ↓

5. CALLBACK → SESSION
   ↓
   /callback receives auth code
   ↓
   Server-side code exchange → httpOnly session cookie set
   ↓
   User profile created/updated in Convex with selected role
   ↓

6. FIRST PAGE (role-specific dashboard)
   ↓
   Driver → /driver
   - Mobile-first dashboard
   - "Welcome, [Name]" + role badge (blue)
   - Today's Route card (empty state: "No routes assigned yet")
   - Vehicle Status card (empty state: "No vehicle assigned")
   - Primary CTA: "Refresh" (check for assignments)
   ↓
   Fleet Manager → /fleet
   - Desktop dashboard with left sidebar
   - "Welcome, [Name]" + role badge (green)
   - KPI row: Active Vehicles (0), Routes (0), Charging (0), Utilization (0%)
   - Empty state: "Your fleet is empty. Add your first vehicle to get started."
   - Primary CTA: "Add Vehicle"
   ↓
   CaaS → /caas
   - Desktop dashboard with left sidebar
   - "Welcome, [Name]" + role badge (purple)
   - KPI row: Active Stations, Sessions Today, Revenue, Utilization, Avg Price/kWh
   - Hotspot analysis + county scores (existing content)
   - Primary CTA: "Add Station" or "Open AI Planner"
   ↓

7. ONGOING USE
   ↓
   User sees left sidebar with role-filtered nav items
   User identity (avatar + name + role) always visible top-right
   User can switch roles via dropdown (if multi-role)
   User can sign out via dropdown
   Command palette (⌘K) for power users (Fleet Manager, CaaS)
   Bottom tab bar on mobile (4-5 items per role)
   Progressive disclosure: more nav items appear as user adds data
```

---

## Role → Home Page Mapping

| Role | Home Route | Home Page Content | Primary CTA | Nav Items |
|---|---|---|---|---|
| **Driver** | `/driver` | Today's Route card, Vehicle Status card, Charging card (mobile-first, single column) | "Start Navigation" | Dashboard, My Routes, Charging, Vehicle, Messages |
| **Fleet Manager** | `/fleet` | KPI row (Vehicles, Routes, Charging, Utilization), utilization trend, vehicle status table (F-pattern, desktop) | "Dispatch New Route" | Dashboard, Fleet, Routes, Drivers, Reports, Settings |
| **CaaS** | `/caas` | KPI row (Stations, Sessions, Revenue, Utilization), hotspot analysis, county scores, pricing heatmap | "Add Station" / "Open AI Planner" | Dashboard, Network, Analytics, Billing, Settings |
| **No role (logged out)** | `/` | Welcome page with value proposition + 3 role cards + "Get Started" CTA | "Get Started" | (no app nav — marketing page only) |

---

## Priority Summary

| Severity | Count | Problem IDs |
|---|---|---|
| **Critical** | 8 | A1, A2, B1, B2, B3, C1, C2, E1, E2 |
| **Major** | 14 | A3, A4, A6, B4, B5, B6, B7, C3, C4, C5, D1, D2, D3, E3, E4, F1, F2, F3 |
| **Minor** | 8 | A5, A7, A8, C6, D4, D5, D6, F4, F5 |

**Total problems identified: 37**

---

## Recommended Fix Order (for GSD Phase Planning)

1. **Auth boundary + user identity** (B1, B2, B3, B4, B6) — without this, nothing else matters
2. **Welcome page + onboarding flow** (C1, C2, C5, B5) — the entry point
3. **Role persistence + role-specific redirects** (E1, E2) — makes the app feel personal
4. **Navigation architecture** (A1, A2, A6) — sidebar + role-filtered nav
5. **Role-specific dashboards** (E3, E4, E5) — replace wizards with dashboards
6. **Planner fixes** (D1, D2, D3, F1, F5) — make the core tool actually work
7. **Error handling + loading states** (F2, F3, F4) — polish
8. **Dead route cleanup** (A3, A7, D6) — hygiene

---

## Summary

- **What I did:** Conducted a comprehensive UX/navigation audit of the live FleetVolt app at fleetvolt.network by visiting all 13 routes, taking screenshots, reading the source code for key pages (home, planner, role-select, callback, auth library), and cross-referencing against the UX research document and the existing fleetvolt-ux-audit skill.
- **What I found:** 37 UX problems across 6 categories. The app scores **28/100** on navigation intuitiveness. The core issues are structural: no auth boundary, no user identity, no role persistence, top-bar-only nav, no welcome page, role pages are registration wizards instead of dashboards, 3 routes return 404, and the AI chat shows raw errors.
- **Files referenced:** `/Volumes/M4 Application SSD/Projects/FleetVolt/apps/web/src/app/page.tsx`, `planner/page.tsx`, `role-select/page.tsx`, `callback/page.tsx`, `/lib/auth.ts`, `fleetvolt-ux-research.md`, `.hermes/skills/software-development/fleetvolt-ux-audit/SKILL.md`
- **No files modified** — this is an audit document only, intended as input to a GSD phase plan.