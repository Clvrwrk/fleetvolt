# Phase 23 Worktree Ownership Receipt

Recorded: 2026-07-12 America/Los_Angeles
Branch: `cw-codex/phase-23-statewide-route-intelligence`
Baseline HEAD: `a32d8d580801ae0b5ebb8afc22241801270e7dea`
Private tracked-byte bundle SHA-256: `1832dbf8690f026995b73576658f76a50dec8b7dfff36e6488f2b9d1b4fe6cfe`
Private tracked-byte bundle mode: `0600`

## Ownership rules

- The private tracked-byte bundle is outside the repository and is never staged, committed, logged, or attached to delivery receipts.
- Every untracked file listed below is immutable pre-existing work. Phase 23 must fail closed before changing one.
- The five proprietary template ZIPs are reference-only and must never be modified, copied into a delivery artifact, or staged.
- Existing tracked changes remain user-owned. Phase 23 may add only separable hunks; overlap requires an ownership stop.
- Delivery must compare every Phase 23 hunk to this receipt and prove that no private bundle or proprietary template byte is in the cached diff.

## Existing tracked paths Phase 23 will touch

| Path | Mode | Bytes | SHA-256 | Ownership |
|---|---:|---:|---|---|
| `.planning/ROADMAP.md` | 0644 | 37,925 | `21e52574838e834b4cb5b2948ada1df434c3ea2f640d046f1b958a8316d8bb4e` | Existing user changes; Phase 23 block only |
| `apps/web/convex/schema.ts` | 0644 | 37,497 | `641b0c1285022789021a327afcedba7151fb60dab9dc35e679e26f7a1b3777d9` | Existing user changes; separable schema additions only |

## New Plan 23 implementation paths absent at baseline

| Path | Baseline state |
|---|---|
| `apps/web/convex/routes/adminSignedEnvelopePolicy.ts` | absent |
| `apps/web/convex/routes/adminSignedEnvelopePolicy.test.ts` | absent |
| `apps/web/convex/routes/statewideRunnerPolicy.ts` | absent |
| `apps/web/convex/routes/statewideRunnerPolicy.test.ts` | absent |
| `apps/web/convex/routes/statewideRunner.ts` | absent |
| `apps/web/convex/routes/statewideRunner.test.ts` | absent |

## Immutable untracked inventory

| Path | Mode | Bytes | SHA-256 |
|---|---:|---:|---|
| `.planning/debug/caas-control-data-recovery.md` | 0644 | 19,961 | `6745561726428bb4fdfab24ed8ddab258de8608893a6e0b28be8a70e69122651` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/.gitkeep` | 0644 | 1 | `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-01-PLAN.md` | 0644 | 11,656 | `96a82c11b1ad3eb8e2a2ef31801eb4a9a46499245199fb7f653dfa5271ef8d42` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-02-PLAN.md` | 0644 | 6,636 | `da704e0aa6e96777c06699404602cec5be79fd282ed8c01d8c098b77295c4edd` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-03-PLAN.md` | 0644 | 5,265 | `3a1cc81fdcb030b5747f0e290d3748e349c73010311917a8a4818d37befe87ce` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-04-PLAN.md` | 0644 | 6,538 | `eca2b0a886610c456da0acfbe96cc945db1c3f66132c21f31392aefef6dbcf43` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-05-PLAN.md` | 0644 | 5,907 | `a02b65011c8ca0f0a619b2b9a413bad13edad2ea3a77f8fda1a8c59c1001ab3b` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-06-PLAN.md` | 0644 | 9,187 | `8c659df16c72d2b0bfad0e92dc44ff75f58abeb28bcddeb3935cb08e3e67d5c9` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-07-PLAN.md` | 0644 | 6,206 | `ef178ab8c0ba6070dfb9166a47e57328bfcae799e447e4fbde17eae81b3f3eb2` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-08-PLAN.md` | 0644 | 6,131 | `e2d8ba28fef71781ea498e02052cffb921737f16327494d15b3f51b133e0b5c2` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-09-PLAN.md` | 0644 | 6,112 | `3eaec798d026339fde9e4f69821c4df7b49617d0e56473625f5f6b1a036c40eb` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-10-PLAN.md` | 0644 | 8,469 | `2f5c3fe8cf43a759306bf3b56a68af426459dfe23f7732eaf3a580c2c39df3e7` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-11-PLAN.md` | 0644 | 8,247 | `88f867dee8bd53e5c42666491faf1845fd9080c29e177ae40fc7405234d6a27c` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-CONTEXT.md` | 0644 | 5,111 | `aaa0ae76a82738122a110b77f3a3491dfdfc962a8cd06bb934bc11215861eb63` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-PLAN-AUDIT.md` | 0644 | 4,581 | `b634dd6fb58cef3436a7331c56d9f0ff5eb1436f1d4533356a461ef7b049c098` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-SPEC.md` | 0644 | 15,605 | `55eaae0df4ccf6e18c508dce871a123b3ac545502b833a56c3c9d211aa6021df` |
| `.planning/phases/23-statewide-route-intelligence-prime-charging-sites-and-execut/23-UI-SPEC.md` | 0644 | 20,426 | `fe432fcc8bca5ad92cf0f17eab69b5d849776feb48412f739981b6c7f0307181` |
| `.planning/quick/260712-codex-mvp-recovery/PLAN.md` | 0644 | 799 | `3a71df79d8487d0ce716ebc21a8ec299979938d6a541c8af53303f0b04f2e793` |
| `.planning/quick/260712-codex-mvp-recovery/SUMMARY.md` | 0644 | 2,707 | `cbf7249aa72d786623aacc1ff8069d45d0371e440e4f84edf221a5c0b25aec13` |
| `apps/web/convex/geo/ingestAirDistrictGeometry.ts` | 0644 | 2,744 | `cd8b6664bfb18b900e338c9492a6b19b00a71e1d3507ba6729467486c24a8aa8` |
| `apps/web/convex/geo/ingestCountyGeometry.ts` | 0644 | 2,977 | `61cbc0d7a78bcfc3abf124e2e6102b1edc3efc9d25b3ac75ed84c889f457389d` |
| `apps/web/src/app/api/auth/sign-in/route.ts` | 0644 | 1,230 | `1e988d3bb271740e43fa097a9a4e96bf49b16ec5138c28591dcc3915c5f9440b` |
| `apps/web/src/components/workbench/map-workbench/layers/caas-zone-heat-layer.tsx` | 0644 | 2,017 | `04f19ecc494700d2dd04646479f936baaec548dc59dfc6c372f251ff2edd15c8` |
| `apps/web/src/lib/alpha-auth.ts` | 0644 | 259 | `2b4c065bdf64377218d3f6f8a93f7ccc9bf352a6c09f7300184f4cff797aabe6` |
| `apps/web/src/lib/workbench/asset-presentation.test.ts` | 0644 | 3,701 | `4c4cc2dd36f2e1bd95e77b449611ac5e6d01ea263b687c1f0590af554eb964a8` |
| `apps/web/src/lib/workbench/asset-presentation.ts` | 0644 | 12,006 | `a6eacab8908b4fd154283f018ffaecf6dc670d66702e6e5100b3787ace8fee82` |
| `apps/web/src/lib/workbench/caas-visible-assets.test.ts` | 0644 | 1,459 | `430a3c7cdf33d6e5bb9232db13fbef4c3b9e2b9a4d9125bc8d39f913ea877f7d` |
| `apps/web/src/lib/workbench/caas-visible-assets.ts` | 0644 | 1,401 | `99af1d22d40e0471af7fbd8e49b098cadcd859ef6dbe95368b8894a5651341aa` |
| `apps/web/src/lib/workbench/traffic-generator-selection.test.ts` | 0644 | 951 | `054ef83822bf20480ce33fdc2db2d0ca22ee7c16b47d37793d3d64259a6fe597` |
| `apps/web/src/lib/workbench/traffic-generator-selection.ts` | 0644 | 1,633 | `01ad9fed0560b1ff213e973de6de894ed0f4f767ccb5cefc99f31c8b99d351a2` |
| `data/ingest/census/prep_ca_air_districts.py` | 0644 | 3,312 | `b9b0b9ab69389ad962aab4f00506dc8dd5dbbed6d1438d0f04f94f8214991491` |
| `data/ingest/census/prep_ca_counties.py` | 0644 | 3,359 | `423999d710918adcc83e79abc237c7c9da94ab7c6e9d33d2bf2bbc7cfc6712fd` |
| `docs/design/Report Template Examples/report-template-2025-07-11-19-47-31-utc.zip` | 0644 | 17,659,205 | `f4b984540e8c60d7d4a6c9bca6d7f5b8a7bf9702723a074d7298baf42d83185f` |
| `docs/design/Report Template Examples/report-template-2025-07-11-19-48-32-utc.zip` | 0644 | 81,060,683 | `bf8baa8538899865f1447a71ccbce00b5f551837e8b9ccae2670bc4035f7d645` |
| `docs/design/Report Template Examples/sustainability-esg-annual-report-brochure-2025-07-22-16-55-38-utc.zip` | 0644 | 67,070,666 | `76d84131cb2a232846eadedd4d43dad49b56eff03f6391a1edd79316fbbe75b2` |
| `docs/design/Report Template Examples/sustainability-report-template-2025-07-15-21-02-37-utc.zip` | 0644 | 12,988,263 | `f5e1d4660d85a34def9cf8791180a76bf74496cd52b8e9cbb4c08eabbc2e9970` |
| `docs/design/Report Template Examples/technical-data-sheet-template-2024-03-07-22-05-54-utc.zip` | 0644 | 7,858,445 | `6605f4cc7fe1309b00b272fde34975289d71cc8dbb52b230ffadb9c40a1f9563` |
| `scripts/air_district_geometry_load.mjs` | 0644 | 905 | `2b86d1a9d7836e80fd6ad5d18281aca953930f52d0ca640e34806049c3cf82e7` |
| `scripts/county_geometry_load.mjs` | 0644 | 738 | `641d4ce2e7c75d488ea60e7b668f526845ac226d1d3a347e94bfb05a6eadd838` |

## Task checks

- [x] Exact dedicated branch active.
- [x] Private tracked baseline captured with directory mode `0700` and file mode `0600`.
- [x] Receipt contains metadata only.
- [x] Phase 23 ROADMAP block registered as 11 plans across Waves 1–7.
- [x] Signed admin envelope and statewide runner policy tests pass.
- [x] Schema/wrapper implementation passes focused verification.
