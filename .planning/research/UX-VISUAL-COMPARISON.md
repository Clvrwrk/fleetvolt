# FleetVolt UX Audit: Visual Comparison — Good vs Bad Examples

**Date:** July 8, 2026  
**Method:** ScreenshotOne API captures of 5 best-in-class SaaS apps + 6 FleetVolt pages  
**Analysis:** Vision AI comparison against UX Navigation Bible research  

---

## GOOD EXAMPLES (What FleetVolt Should Look Like)

### 1. Linear — ✅ Best-in-Class SaaS Navigation

**Screenshot:** `screenshots/good-linear-home.png`

**What they do right:**
- **Dual navigation strategy:** Marketing site uses sparse horizontal nav (Product, Pricing, Contact). Inside the app: persistent **left sidebar** with workspace-scoped items.
- **User identity:** Avatar + name visible in the activity feed. In-app, user identity is shown via avatars on every comment/action.
- **Primary CTA:** On marketing page: "Sign up" (white button, high contrast against dark theme). In-app: "+ New Issue" button in sidebar.
- **Visual hierarchy:** Hero H1 is massive and white → sub-head is smaller and gray → CTA is high-contrast. Information density in the app is managed with padding and borders.
- **AI integration:** "Linear Opus" box in bottom-right shows AI working in background ("Thinking...") without blocking the user's view.
- **Status indicators:** Colored dots (yellow=In Progress, red=High Priority) allow instant scanning.

**FleetVolt should learn:**
- ✅ Left sidebar for app navigation (not top bar)
- ✅ AI assistant as a floating overlay, not the center of the page
- ✅ Colored status dots for charger/vehicle/route status
- ✅ Sparse marketing nav on welcome page, dense sidebar in app

---

### 2. Stripe — ✅ Best-in-Class Auth + Dashboard

**Screenshot:** `screenshots/good-stripe-dashboard.png`

**What they do right:**
- **Auth options:** Email, Google, Passkey, SSO — all clearly presented with visual hierarchy (primary = email, secondary = SSO buttons).
- **Left sidebar navigation:** Collapsible, organized by high-level sections (Payments, Billing, Connect) with specific pages underneath.
- **User identity:** Avatar + account name in top-right corner with dropdown for account/role switching.
- **Progressive complexity:** Login page is dead simple. Dashboard handles complex financial data with cards + tables + generous padding.
- **Contextual switching:** Account switcher and Live/Test mode toggle in top-right dropdown.

**FleetVolt should learn:**
- ✅ Multiple auth options (WorkOS SSO + Google + Passkey)
- ✅ Account/role switcher in top-right dropdown (not in the main nav)
- ✅ Progressive complexity: simple welcome → complex dashboard
- ✅ Contextual action button in top-right (e.g., "Schedule Charging" or "New Route")

---

### 3. Vercel — ✅ Best-in-Class Auth Flow

**Screenshot:** `screenshots/good-vercel-dashboard.png`

**What they do right:**
- **Minimalist auth:** Single centered card, one primary action (Continue with Email), SSO options grouped below a divider.
- **Visual de-prioritization:** Primary button is solid black (high contrast). SSO buttons are white with gray borders (secondary).
- **Sign Up paths:** Top-right "Sign Up" button + bottom "Don't have an account?" link — captures users who landed on the wrong page.
- **Whitespace:** Ample whitespace reduces cognitive load and feels premium.

**FleetVolt should learn:**
- ✅ Auth page should be minimal — one card, one primary action, secondary options below
- ✅ "Create Account" link visible in two places (top-right + bottom)
- ✅ Don't overwhelm the auth page with nav links to app pages

---

### 4. Notion — ✅ Best-in-Class Onboarding

**Screenshot:** `screenshots/good-notion-home.png`

**What they do right:**
- **Role/persona selection during signup:** "How will you use Notion?" with clear role cards.
- **Left sidebar:** Workspace-based, collapsible sections. Page-tree navigation.
- **Empty states:** First-time users get guided templates and setup checklists.

**FleetVolt should learn:**
- ✅ Role selection should happen DURING onboarding (not as a separate page after auth)
- ✅ First-time users should see a guided setup, not a blank planner

---

### 5. Retool — ✅ Best-in-Class Data-Heavy UI

**Screenshot:** `screenshots/good-retool-home.png`

**What they do right:**
- **Left sidebar:** Apps grouped by folder. Role-based: admins see all apps, users see assigned apps.
- **Data density:** High information density managed with consistent spacing and card components.
- **Avatar + name:** Top-right corner with dropdown.

**FleetVolt should learn:**
- ✅ Group nav items by category (Planning, Vehicles, Charging, Reports)
- ✅ Role-based nav filtering — show only what the role can access

---

## BAD EXAMPLES (FleetVolt Current State)

### 1. FleetVolt Home (`/`) — ❌ Identity Crisis

**Screenshot:** `screenshots/bad-fleetvolt-home.png`

**What's wrong:**
- ❌ **Dashboard-as-landing-page:** Shows specific user data ("POLB Focus", "Last Simulation 2h ago") to first-time visitors who have no context
- ❌ **No welcome message:** No "What is FleetVolt?" explanation, no value proposition
- ❌ **No Sign Up button:** Only a "Sign In" button tucked in the bottom row
- ❌ **Jargon overload:** POLB, Cajon Pass, Regen Credit, Drayage Leg — meaningless to newcomers
- ❌ **Dual navigation:** Top nav (Home, Planner, Driver, Fleet, CaaS, Network) + bottom nav (Driver Preferences, Fleet Management, CaaS, Sign In) — redundant and confusing
- ❌ **No user identity:** No avatar, no name, no "logged in as" indicator
- ❌ **Chart dominates without explanation:** A complex route elevation chart with no legend or context

**Score: 25/100** — This page has an identity crisis. It's a logged-in user's dashboard presented as a public home page.

---

### 2. FleetVolt Planner (`/planner`) — ❌ Core Problems

**Screenshot:** `screenshots/bad-fleetvolt-planner.png`

**What's wrong:**
- ❌ **No user identity:** No avatar, no name, no role indicator anywhere
- ❌ **No login/logout:** No auth buttons visible
- ❌ **Top-bar-only navigation:** No left sidebar. 6+ items crammed into top bar.
- ❌ **Empty map area:** Gray checkerboard pattern (looks like a transparency grid from design software) — not a proper empty state
- ❌ **AI chat error not human-readable:** Shows raw API paths (`chargers/queries:class8Gap`) instead of plain language
- ❌ **Role selector in wrong place:** Role selection is inside the planner's left column, not a proper onboarding step
- ❌ **Confusing chat UI:** Unclear if the chat bubble is a suggested prompt, user message, or AI response
- ❌ **Redundant navigation:** "CaaS" is both a top nav item AND a role selector in the left column
- ❌ **Static inputs:** Corridor context fields look like labels, not editable inputs

**Score: 30/100** — The core tool is functional but the UX shell around it is broken.

---

### 3. FleetVolt Role-Select (`/role-select`) — ❌ Misleading

**Screenshot:** `screenshots/bad-fleetvolt-role-select.png`

**What's wrong:**
- ❌ **Misleading headline:** Says "Choose your role" but shows no role options — just a generic "Sign in with WorkOS" button
- ❌ **No Sign Up path:** Button says "Sign in" — new users have no way to create an account
- ❌ **Dead-end navigation:** Top nav links (Planner, Driver, Fleet) are visible to logged-out users but would redirect back to this page
- ❌ **No context:** Text focuses entirely on security (encryption, SOC 2) but doesn't explain what FleetVolt does
- ❌ **Role selection happens after auth:** The title promises role selection, but the UI forces auth first. Roles should be presented as selectable cards BEFORE auth.

**Score: 35/100** — Good visual hierarchy and security messaging, but the flow is backwards.

---

### 4. FleetVolt Driver (`/driver`), Fleet (`/fleet`), CaaS (`/caas`)

**Screenshots:** `screenshots/bad-fleetvolt-driver.png`, `bad-fleetvolt-fleet.png`, `bad-fleetvolt-caas.png`

**Common problems across all three:**
- ❌ No user identity indicator
- ❌ No login/logout buttons
- ❌ Top-bar-only navigation (no sidebar)
- ❌ All nav items shown to all roles (no filtering)
- ❌ No breadcrumbs or page hierarchy
- ❌ No empty states for first-time users

**Scores:** Driver: 35/100, Fleet: 35/100, CaaS: 35/100

---

## SUMMARY SCOREBOARD

| Page | Score | Status |
|------|-------|--------|
| **GOOD: Linear** | 95/100 | ✅ Reference |
| **GOOD: Stripe** | 95/100 | ✅ Reference |
| **GOOD: Vercel** | 90/100 | ✅ Reference |
| **GOOD: Notion** | 90/100 | ✅ Reference |
| **GOOD: Retool** | 88/100 | ✅ Reference |
| **BAD: FleetVolt Home** | 25/100 | ❌ Identity crisis |
| **BAD: FleetVolt Planner** | 30/100 | ❌ No auth, no sidebar |
| **BAD: FleetVolt Role-Select** | 35/100 | ❌ Misleading flow |
| **BAD: FleetVolt Driver** | 35/100 | ❌ No identity |
| **BAD: FleetVolt Fleet** | 35/100 | ❌ No identity |
| **BAD: FleetVolt CaaS** | 35/100 | ❌ No identity |

**FleetVolt average: 32/100** — Fundamental navigation + auth + hierarchy overhaul needed.

---

## TOP 10 FIXES (Priority Order)

1. **Build a left sidebar** (260px, collapsible) replacing the top-bar nav — follow Linear/Stripe/Vercel pattern
2. **Add user avatar + name + role** to top-right corner of every page — non-negotiable
3. **Implement auth boundary** — logged-out users see welcome page, not app pages
4. **Build a proper welcome page** at `/` — "What is FleetVolt" + "Create my account" CTA
5. **Fix role-select flow** — show role cards FIRST, then auth, then role-specific home page
6. **Filter nav by role** — Driver sees Driver items, Fleet sees Fleet items, CaaS sees CaaS items
7. **Add login/logout** to user dropdown (click avatar → Settings + Sign Out)
8. **Fix empty states** — map area needs "No route selected" + guidance + CTA
9. **Fix AI error messages** — human-readable, not raw API paths
10. **One primary action per page** — each page has exactly ONE dominant CTA
