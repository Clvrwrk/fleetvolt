# Plan 13-05 Summary: CSV/JSON/PDF Exports via Convex/Vercel

**Status:** ✅ Complete
**Commits:** 2
**Tests:** 49/49 passing (9 new)
**tsc:** Clean (no errors from new files; pre-existing errors in simulate.ts, port-anchors.tsx, pulse-surface.tsx unchanged)

## What was done

Moved the export pipeline (CSV, JSON, PDF) from the Fastify API to the Convex/Vercel path. No Puppeteer, no Fastify `/v1/exports/pdf` dependency. Exports read simulation results from the Convex simulations table (persisted in 13-02).

## Files created

| File | Description |
|---|---|
| `convex/exports/exportTemplate.ts` | Verbatim port of `renderExportHtml` from `services/api/src/export-template.ts`. Pure HTML string builder — KPI summary, map snapshot, charging plan, physics params, assumptions, disclaimer. |
| `convex/exports/exportCsv.ts` | CSV serialization with 5 sections (segments, KPIs, charging stops, feasibility, assumptions). Formula-injection escaping. Includes `simulationRowToExportRow` adapter. |
| `convex/exports/exportJson.ts` | Trivial `JSON.stringify` helper. |
| `convex/exports/exports.ts` | Convex query `getSimulationForExport({inputsHash})` — reads simulations table by `inputsHash` index. |
| `convex/exports/exports.test.ts` | 9 tests covering all helpers (HTML structure, CSV sections, formula escaping, JSON roundtrip, row adapter). |
| `convex/exports/exportPdf.ts` | Client-side PDF via browser print — opens HTML in new window, calls `window.print()`. No server-side dependency. |
| `src/lib/export-client.ts` | Client-side export functions (`exportCsv`, `exportJson`, `exportPdf`) — fetch from Convex, generate exports client-side. |

## Files modified

| File | Change |
|---|---|
| `src/components/export/export-menu.tsx` | Removed `postPdfExport` (Fastify) import. CSV/JSON/PDF buttons now call Convex-backed `export-client.ts`. PDF triggers browser print dialog. |

## Commits

1. `525caf9` — `feat(13-05): port export template + CSV/JSON helpers + Convex export query`
2. `6670352` — `feat(13-05): PDF export (client-side print) + Convex-backed export UI`

## Verification

- **exportTemplate.ts**: Produces valid HTML with KPI Summary, Charging Plan, Physics Parameter Snapshot, Assumptions, disclaimer sections. ✅
- **exportCsv.ts**: Produces valid CSV with segment headers, KPI section, charging stops, feasibility, assumptions. Formula injection escaped. ✅
- **exportJson.ts**: Serializes to pretty JSON. ✅
- **exportPdf.ts**: Client-side browser print — no Puppeteer. ✅
- **exports.ts**: Convex query reads simulations by `inputsHash`. ✅ (Convex codegen confirmed — `api.exports.exports.getSimulationForExport` registered)
- **Export UI**: Calls Convex + client-side generation. No Fastify dependency. ✅
- **tsc**: No errors from new/modified files. Pre-existing errors in `simulate.ts`, `port-anchors.tsx`, `pulse-surface.tsx` unchanged. ✅
- **Convex dev**: `npx convex dev --once` succeeds — all functions deploy. ✅

## Key decisions

- **PDF approach**: Browser print (open HTML in new window, `window.print()`). The plan allowed (a) client-side print, (b) jsPDF, or (c) Vercel API route. Browser print is the simplest, zero-dependency, and produces the same visual output as the Phase 4 Puppeteer PDF. The user selects "Save as PDF" from the print dialog.
- **CSV/JSON in export menu**: The `secondary` variant (used in the planner) now calls the Convex-backed functions which fetch fresh data from the simulations table. The `default` variant retains the in-memory `buildCsvExport` for backward compatibility.
- **No `.js` extensions** on imports within `convex/` — consistent with existing Convex physics modules.

## Phase 13 success criterion #4

✅ Fulfilled — CSV/JSON/PDF exports produced via Convex/Vercel path (no Fastify, no Puppeteer). Export template mirrors the shipped Phase 4 PDF structure. Exports read from the Convex simulations table.
