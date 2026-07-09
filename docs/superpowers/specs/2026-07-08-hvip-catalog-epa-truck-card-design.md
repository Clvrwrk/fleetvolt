# HVIP Catalog EPA Truck Card — Design Spec

**Date:** 2026-07-08  
**Status:** Draft for review  
**Visual companion:** [truck-id-card-concepts.canvas.tsx](/Users/chussey/.cursor/projects/Volumes-M4-Application-SSD-Projects-FleetVolt/canvases/truck-id-card-concepts.canvas.tsx)  
**Related:** Phase 17 map workbench (vehicle selection), Phase 5 emissions/TCO (lookup tables), existing `data/trucks/*.json` + Convex `truckConfigs`

---

## 1. Problem

FleetVolt needs a **catalog model** identity surface that feels as authoritative as an EPA Fuel Economy & Environment (Monroney-style) label, adapted for Class 8 battery-electric trucks. Analysts and fleet managers must see energy intensity, duty splits, HVIP incentive, and diesel-baseline emissions at a glance — before assigning a physical unit (VIN, insurance, etc.).

---

## 2. Locked decisions

| Decision | Choice |
|----------|--------|
| Card subject | **Catalog model** (HVIP-eligible vehicle), not fleet unit |
| Visual metaphor | EPA Fuel Economy & Environment label |
| Hero metric | **kWh/mi** (combined duty) |
| Consumption line | **kWh used every 100 miles** |
| Duty pair (EPA city/hwy slots) | **Fully laden** / **Drayage** |
| Top-right money cell | **Both stacked:** annual energy cost + HVIP base incentive (as drafted) |
| Environment section | **BEV vs Class 8 diesel** at **60,000 mi/yr** for **CO₂e, NOx, PM₂.₅** |
| Supporting surfaces | Keep concepts **A–E** as secondary cards under the primary EPA label |
| Out of primary card | VIN, insurance, plate, driver, yard (fleet-unit fields → later wizard / Concept B) |

---

## 3. Primary surface — EPA-style catalog efficiency card

### 3.1 Layout (top → bottom)

1. **Header band**
   - Left: product line (`FLEETVOLT · ENERGY & ENVIRONMENT`) + subtitle (`Catalog model card · planning estimates`)
   - Right: accent badge — technology (`Battery Electric`) + class (`Class 8`)
2. **Identity strip**
   - OEM + model name (e.g. Freightliner eCascadia)
   - Pack kWh, class/category, HVIP-eligible catalog note
3. **Top metrics row (2 columns)**
   - **Left — Combined energy use**
     - Large number: `kWh/mi`
     - Sub-label: `combined duty`
     - Pair: `fully laden` kWh/mi · `drayage` kWh/mi
     - Line: `{N} kWh used every 100 miles`
   - **Right — Money (stacked)**
     - Annual energy cost (est. @ 60k mi/yr · CA industrial rate assumption)
     - Divider
     - HVIP base incentive ($)
4. **Middle row (2 columns)**
   - **Left — How this vehicle compares**
     - Horizontal bar: Class 8 BET peer range (best ↔ worst kWh/mi)
     - Marker for this model
   - **Right — Environment vs diesel**
     - Caption: annual @ 60,000 mi · same duty for both
     - Table: Factor | Diesel | This BEV | Avoided
     - Factors: CO₂e (t/yr), NOx (kg/yr), PM₂.₅ (kg/yr)
     - Summary line: `% less CO₂e than Class 8 diesel`
5. **Spec strip (4 cells)**
   - Pack · Class · Category · Tech (BEV / FCEV as applicable)
6. **Fine print**
   - Physics assumptions, not EPA-certified disclaimer
   - Peer compare = FleetVolt catalog peers (not fueleconomy.gov)
   - Environment factors illustrative until Phase 5 WTW tables
   - HVIP base may vary by air district / DAC / drayage

### 3.2 EPA → FleetVolt field map

| EPA label | FleetVolt catalog field |
|-----------|-------------------------|
| Large MPG | Large **kWh/mi** |
| gal / 100 miles | **kWh / 100 miles** |
| City / Highway | **Fully laden / Drayage** |
| Annual fuel cost | **Annual energy cost** + **HVIP $** (stacked) |
| Compare bar | vs Class 8 BET peers (kWh/mi) |
| GHG / air scores | vs diesel @ 60k mi: CO₂e, NOx, PM₂.₅ |
| Fine print | Physics + HVIP + emissions assumptions |
| QR / deep link (optional later) | HVIP detail page / PDF |

### 3.3 Visual constraints

- Follow existing Technical Brand Geometry tokens when implemented in-app (light CAD surface, teal accent sparingly, JetBrains Mono for metrics).
- Heavy structural borders (Monroney grid), not soft marketing cards.
- No fabricated “EPA certified” language — always planning estimates.
- Hero number must dominate the first viewport of the card (same role as EPA’s large MPG).

---

## 4. Supporting surfaces (A–E)

These are **not** the primary catalog card. They reuse the same sample model data and appear below / in adjacent flows.

| ID | Name | Job |
|----|------|-----|
| **A** | Catalog Spec Card | Browse HVIP list — photo, class/tech pills, pack, HVIP $, kWh/mi |
| **B** | Fleet Unit Identity | Post-selection unit wallet — VIN, insurance, policy, voucher, pack |
| **C** | Ops Day Strip | Workbench chip — SoC, range, day target, thin energy/HVIP |
| **D** | Incentive + Compliance | Finance / CaaS — HVIP $ first, eligibility table |
| **E** | Build-a-Card Wizard | Flow: pick catalog vehicle → choose fleet fields to stamp |

**Recommended product stack:** A (browse) → E (build) → B (saved unit) → C (workbench). D for finance/CaaS. Primary EPA label is the catalog detail view after selecting from A (or equivalent list).

---

## 5. Data model

### 5.1 CatalogVehicle (primary card source)

Immutable-ish product record (one row per HVIP-eligible configuration / pack variant):

| Field | Type | Source |
|-------|------|--------|
| `oem` | string | HVIP catalog |
| `model` | string | HVIP catalog |
| `displayName` | string | Derived |
| `vehicleClass` | enum (e.g. Class 8) | HVIP |
| `category` | string (Tractor, etc.) | HVIP |
| `technology` | BEV \| FCEV \| … | HVIP |
| `packKwh` | number | HVIP + `data/trucks` / truckConfigs |
| `hvipIncentiveUsd` | number \| null | HVIP base amount |
| `hvipVehicleUrl` | string \| null | Detail page |
| `imageUrl` | string \| null | HVIP / OEM scrape |
| `kwhPerMiCombined` | number | FleetVolt physics profile |
| `kwhPerMiFullyLaden` | number | Physics / duty profile |
| `kwhPerMiDrayage` | number | Physics / duty profile |
| `peerKwhPerMiMin` / `Max` | number | Catalog peer stats |
| `annualEnergyCostUsd` | number | Derived @ 60k mi × rate assumption |
| `emissionsAnnual` | object | See §6 |
| `physicsTruckSlug` | string \| null | Link to existing truck JSON / Convex config |
| `assumptionsHash` | string | Provenance for audits |

### 5.2 FleetUnit (out of scope for v1 of this card)

Created after catalog selection (Concept E → B): VIN, unit number, insurance, plate/IFTA, driver, yard, voucher ID. References `catalogVehicleId`.

### 5.3 Relationship to existing trucks

- Prefer linking HVIP catalog rows to existing `data/trucks/*.json` / `truckConfigs` via slug or OEM+pack match.
- Physics-backed kWh/mi only when a linked profile exists; otherwise show “estimate pending” and do not invent precision.

---

## 6. Environment vs diesel (60k mi)

### 6.1 Scope of factors (locked)

| Factor | Unit (annual) | Diesel column | BEV column | Avoided |
|--------|---------------|---------------|------------|---------|
| CO₂e | t/yr | Baseline Class 8 diesel | This BEV (grid-inclusive planning estimate) | Diesel − BEV |
| NOx | kg/yr | Diesel | BEV (typically ~0 tailpipe; grid upstream deferred unless Phase 5 says otherwise) | Diesel − BEV |
| PM₂.₅ | kg/yr | Diesel | BEV (same rule as NOx) | Diesel − BEV |

**Mileage basis:** 60,000 mi/yr for **both** columns. Same duty assumption as annual energy cost.

### 6.2 Methodology (design intent)

- Align with roadmap **EMIS-01** / Phase 5: WTW ton-mile CO₂e comparing CA diesel, national diesel, and EV — **card v1 shows one diesel baseline** (label as Class 8 diesel; prefer CA factors when tables exist).
- Illustrative numbers on the visual companion are **placeholders** until Phase 5 lookup tables land.
- Card must label values as **modeled / planning**, never as certified EPA scores.
- Summary % CO₂e reduction = `(diesel − bev) / diesel`.

### 6.3 Explicitly deferred

- CH₄, N₂O, PM₁₀ as separate rows (not on v1 card unless product revisits).
- Dual diesel columns (CA vs national) on the card — keep in Phase 5 detail views.
- Real-time grid carbon intensity.

---

## 7. Data acquisition (HVIP + CA GEO)

### 7.1 HVIP eligible catalog (~209 vehicles)

- Source of truth for browse list: [californiahvip.org/vehicles](https://californiahvip.org/vehicles/) (prefer official CSV/PDF download + detail pages for images/specs).
- Enrich: OEM, model, class, technology, category, incentive, images.
- **Do not** treat `HVIP_VoucherData.xlsx` as the 209-vehicle catalog — that file is **redemption history** (voucher ID, funding amount, county, air district, drayage flags). Use it for analytics / Concept D enrichment, not as the catalog photo list.

### 7.2 CA GEO folder — priority for this feature

| Asset | Role | Priority |
|-------|------|----------|
| HVIP site CSV + detail scrape | CatalogVehicle rows + images | High |
| `HVIP_VoucherData.xlsx` | Incentive analytics, district/drayage context | High (secondary) |
| Existing `data/trucks` / truckConfigs | kWh/mi, pack, physics link | High |
| NMHD ZEIM / air districts / ZEV deployments | Later CaaS / map — not required for card v1 | Medium / out of card scope |

---

## 8. Product placement

| Context | Surface |
|---------|---------|
| Catalog browse / picker | Concept A list → open **EPA primary card** |
| Fleet onboarding | Concept E → FleetUnit → Concept B |
| Map workbench (Driver/Fleet) | Concept C chip; deep-link to EPA card or B |
| CaaS / finance | Concept D + EPA environment/HVIP cells |

Phase 17 workbench continues to use physics truck slugs for simulation; catalog card selection should resolve to a `physicsTruckSlug` before Calculate when possible.

---

## 9. Non-goals (this spec)

- Implementing fleet-unit CRUD or insurance workflows
- Full Phase 5 emissions engine (only the card contract + placeholder math)
- Scraping implementation details / Firecrawl runbooks (belongs in implementation plan)
- Replacing workbench truck profile picker without a migration path
- Claiming EPA certification or Monroney legal equivalence

---

## 10. Success criteria

1. User can open a catalog model and see **kWh/mi** as the dominant number, with **fully laden / drayage** and **kWh/100 mi**.
2. Top-right shows **annual energy cost** and **HVIP $** stacked as drafted.
3. Environment table compares **BEV vs diesel @ 60k mi** for **CO₂e, NOx, PM₂.₅** with avoided column and % CO₂e line.
4. Fine print states planning-only / not EPA-certified.
5. Supporting A–E remain available as secondary patterns; primary is the EPA label.
6. Catalog rows can link to existing physics truck configs without inventing kWh/mi when no profile exists.

---

## 11. Open items for implementation plan (not design blockers)

- Exact CA industrial $/kWh and diesel mpg / emission factors once Phase 5 tables are chosen
- Image CDN / storage for ~209 HVIP photos
- Matching rules OEM+model+pack → `physicsTruckSlug`
- Whether FCEV (e.g. Xcient) uses the same card with H₂ intensity instead of kWh/mi (recommend same shell, different hero unit — defer unless needed for demo)

---

## 12. Approval

Design locked via brainstorming + visual companion (2026-07-08). Spec awaits user review before implementation planning.
