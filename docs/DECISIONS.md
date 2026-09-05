# Decision Ledger — Allergy Tracker

Chronological. Every entry records what was decided, what it replaced, why, what changed
afterwards, and where the evidence is.

**Statuses:** `ACTIVE` · `REVERSED` · `SUPERSEDED` · `DEFERRED` · `EXPERIMENTAL` · `ABANDONED` · `UNKNOWN`

Evidence: `[Verified]` read this session · `[Inferred]` reasoned · `[Conversation]` only source is
prior Claude conversation history / local agent notes (`.superpowers/sdd/progress.md`, the local
memory files) — **not reconstructible from git**.

> **Read this first.** The two decisions most likely to trip up a newcomer are
> **D-30 (표본 shipped and was replaced one day later)** and **D-14 (bilingual → Korean-only)**.
> Both left artefacts in the repo that look current and are not.

---

## Part I — v1 "MammaCare" (2026-06-24 → 2026-07-16)

The v1 app was a React/Vite/Capacitor frontend on a FastAPI/Postgres backend. Everything here is
history; it survives only at tag `archive/v1-capacitor`. It is listed because several of these
decisions are the *reason* v2 has the shape it has, and because `docs/design-spec.md` §11 forbids
resurrecting any of it.

### D-01 · Build MammaCare as Capacitor + FastAPI + Postgres — `SUPERSEDED`
- **Decided:** initial commit `a7a9088`, 2026-06-24.
- **Superseded by:** D-10, 2026-07-16.
- **Why it went:** the product had accreted a community feed, an admin console, a hospital finder, recommendations, accounts and a server — around one good idea. See D-10.
- **Current state:** archived at tag `archive/v1-capacitor` and at commit `662ab72` ("chore!: tear down v1 app"). `[Verified]`

### D-02 · Remove Azure AI features; localize image storage — `ABANDONED`
- `8ff6a9f`, 2026-06-25. AI of any kind is now permanently out of scope (`docs/design-spec.md` §11). `[Verified]`

### D-03 · Purge the feature islands: recipes, schedules, nutrition, community, admin stubs — `ABANDONED`
- `77c4f48`, `164005b`, `047e12d`, `828c0c2`, `b9f0829`, 2026-07-13 – 07-14.
- **Why:** they were dead or near-dead code carrying dependency and review cost. 48 unused npm deps and 43 unused shadcn/ui components went with them (`99da708`, `929ee24`). `[Verified]`

### D-04 · Remove Google / Kakao / Naver social login — `ABANDONED`
- `66b3196`, `0277f9c`, 2026-07-15. v2 has no accounts at all. `[Verified]`

### D-05 · Cross-reactivity derivation (SDAP 2.0 / WHO-IUIS) — `ABANDONED`
- Built server-side and surfaced in the doctor report (`7df2221`, `9050519`, `2470120`, 2026-07-14).
- **Not carried into v2.** The map still exists at `archive/v1-capacitor:backend/app/services/allergy/cross_reactivity_map.json` and `frontend/src/data/crossReactivity.ts`, keyed by Korean food name. `[Conversation]`
- **Why not:** v2 kept exactly one idea from v1 — the traffic light. Everything else was cut on purpose.

### D-06 · Design palette pivot: warm-kr rose/terracotta → cream/sage — `SUPERSEDED`
- `79cd731`, `7530c6a`, `3e698f5`, 2026-07-14/15. Superseded twice over by v2's editorial → 표본 → Warm Care sequence. `[Verified]`

### D-07 · Bottom nav: 5 tabs → 4 tabs (홈/재료/리포트/설정) — `SUPERSEDED`
- `45001f0`, 2026-07-14. v2 shipped stack-only, then later a 3-tab bar (D-15). `[Verified]`

### D-08 · Add MIT license — `REVERSED`
- **Added:** `9bac60d`, 2026-07-11. **Reversed:** `bb42ecd` "Remove MIT license, reserve all rights", 2026-07-31.
- **Current state:** no `LICENSE` file; `package.json` declares `UNLICENSED`; the README states *"Copyright (c) 2026 Michael Ju. All rights reserved. No license is granted… This repository is public for portfolio review purposes only."* `[Verified]`

---

## Part II — the v2 rebuild (2026-07-16 →)

### D-10 · Tear down v1 and rebuild ground-up as Expo + React Native + TypeScript, on-device only — `ACTIVE`
- **Decided:** 2026-07-16, owner-approved in a brainstorming session. Spec `b08001b` → `docs/design-spec.md`.
- **Previous approach:** D-01.
- **Why:** *"The one idea kept from v1: allergy status as a traffic light. Everything else (community, admin console, hospital finder, recommendations, accounts, server) is gone and does not come back."* (`docs/design-spec.md` §1) On-device-only removes accounts, sync, a backend and an entire class of privacy claims — and makes the privacy line honestly earned.
- **Executed as:** 14 tasks, subagent-driven, TDD domain core. `662ab72` tears down; `fccf484`…`39e3b97` build it; `v2.0.0-alpha` tagged 2026-07-16. `[Verified]` + `[Conversation]`
- **Current state:** the app. 209 tests green.

### D-11 · Rename product and repo: MammaCare → Allergy Tracker — `ACTIVE`
- `f442bfc`, 2026-07-16. Repo `mhju0/mammacare-ios` → `mhju0/allergy-tracker` (GitHub redirects). iOS home-screen label stayed **알레르기** because 15-char names truncate under the icon. Local working folder renamed `~/Workspace/Projects/allergy-tracker` on 2026-07-17. `[Verified]` + `[Conversation]`

### D-12 · Status is derived, never stored — `ACTIVE`
- `065944f`, 2026-07-16. `deriveStatus(trials)` in `src/domain/status.ts`.
- **Why:** nothing stores it, so nothing can disagree with the record; a delayed reaction flips a food back to 반응 for free because there was never a cached answer to invalidate. The exhaustive switch fails the typecheck if an outcome is added to the schema and not handled.
- **Subsequently changed:** the spec's signature was `deriveStatus(trials, reactions, now)`; the implementation takes **only trials**, because logging a reaction sets `trial.outcome = 'reacted'` at write time. `[Verified]`

### D-13 · One active trial at a time, enforced in the lifecycle command — not a DB constraint — `ACTIVE`
- Spec §4 Rule 2; implemented in `src/trialLifecycle/index.ts`.
- **A DB-level unique index was explicitly rejected** in a grilling session, 2026-07-18: single-writer app, the guard is sufficient; revisit only if sync or multi-process ever arrives. `[Conversation]`

### D-14 · Korean-only — drop the bilingual feature — `ACTIVE` (reverses the spec's own decision)
- **Decided:** 2026-07-17, owner. **Commit:** `ca89cda` (`feat!:`).
- **Previous approach:** `docs/design-spec.md` §2 specified *"i18n from day one (i18next + expo-localization): English default, Korean locale"* and §3.5 a settings language picker.
- **What changed:** `src/i18n/en.json` deleted, the language picker removed, the `baby.locale` column dropped (migration `0001`), `expo-localization` uninstalled, dates pinned `ko-KR`.
- **Current state:** `src/i18n/index.ts:5` — *"Korean-only by owner decision (2026-07-17) — no locale detection, no fallback chain."* **Do not re-add bilingual support unprompted.** `[Verified]`

### D-15 · Navigation: stack-only with Home as hub → a persistent 3-tab bottom bar — `SUPERSEDED`
- **Original:** `docs/design-spec.md` §3, *"no tabs, Home is the hub"*; `design-audit/plan.md` §3 even lists **"Tabs or a bottom nav"** under *Do not do* — *"Six screens, stack-only, no orphan routes. The IA is correct; the affordances are not."*
- **Superseded by:** the Warm Care redesign (D-31), `29bf918` + `df8f480`, 2026-08-09. `src/ui/BottomNav.tsx` now renders 오늘 / 재료 / 기록 as a persistent labeled bar; Settings moved to a header control.
- **Note the contradiction:** `design-audit/plan.md` still says not to do this. That document is marked *Historical implementation plan* and pre-dates Warm Care. `[Verified]`

### D-16 · Add a sixth surface: 캘린더 (read-only month history) — `ACTIVE`
- `44f5ab4`, 2026-07-17. Not in the original five-screen spec. Read-only, zero new persisted state, TDD'd pure domain (`src/domain/calendar.ts`, 12 tests at the time). `[Verified]`

### D-17 · Observations ("이상 없음" check-ins) — `ACTIVE`
- `cc03c18`, 2026-07-17. New `checkin` table (migration `0002`).
- **Why:** affirmative evidence, not just the absence of an alarm. An Observation **never** changes trial outcome or derived status.
- **Vocabulary:** `CONTEXT.md` defines *Observation* (the persisted evidence) vs *Check-in* (the interaction). `checkin` is the legacy storage name. `[Verified]`

### D-18 · Check-ins are excluded from the paediatrician PDF — `ACTIVE`
- **Decided:** 2026-07-17, owner. Recorded in `.superpowers/sdd/progress.md` D1 as *"[DECIDED 2026-07-17] check-ins deliberately EXCLUDED from PDF report (owner decision — do not add)"*. `[Conversation]`
- **Subsequently refined:** the **JSON backup** *does* include them — it was silently dropping the `checkin` table, fixed in `6ecab3e` (2026-07-24). PDF exclusion still stands. `[Verified]`
- **Later nuance:** the PDF's *status* column now discloses **coverage** (`3일 중 2일 관찰`) without listing individual check-ins (`src/services/export.ts:67-71`). `[Verified]`

### D-19 · The observation window is FIXED at 3 days — `ACTIVE` (reverses the spec)
- **Decided:** 2026-07-17, owner, after auditing seven health knowledge-base documents (질병관리청, 대한소아청소년과학회, NHS, CDC).
- **Previous approach:** `docs/design-spec.md` §3.5 specified a settings control for "default watch window (3 days)"; migration `0000` still carries `baby.default_window_days`.
- **What changed:** the settings picker was removed (`e1468cd`). The column survives and is read (`windowDays` is per-trial, never hardcoded to 3 in components — `DayLedger` reads `trial.windowDays`).
- **Why:** an NHS-sourced delayed-reaction basis, corroborated by the KB CSV row *"지연 최대 2~3일"*. Configurability was judged a false choice for a medical window.
- **Locked:** `design-audit/plan.md` §3 lists *"A settings control for `defaultWindowDays`"* under **Do not do** — *"The fixed 3-day window is a grilled won't-do."* `[Verified]` + `[Conversation]`

### D-20 · 얼굴 부종 triggers the emergency (119) advisory at any severity — `ACTIVE`
- `e1468cd`, 2026-07-17, from the same KB audit. `[Conversation]`

### D-21 · Add a 기침·쌕쌕거림 symptom chip (non-emergency) — `ACTIVE`
- `cd09601`, 2026-07-17. The KB audit had flagged it as "noted-not-done, 기타 covers it"; the owner left the call to the agent, which added it. `[Conversation]`

### D-22 · NO 권장 개월 (per-food recommended introduction month) — `ABANDONED` / permanently rejected
- **Considered:** the v1 ingredient CSV carries `recommended_month` per food; surfacing it on food detail was parked as a feature idea during the KB audit.
- **Decided 2026-07-17, owner:** *"NO 권장 개월 feature — keep the app simple, do not add"*, and *do not propose it again*.
- **Second-order effect:** it is why the 안 먹어봄 family list is ordered **가나다순** and deliberately **not** by weaning stage — *"sequencing families is 권장 개월 in disguise"* (`src/db/families.ts:9-13`). `[Verified] comment` + `[Conversation] decision`

### D-23 · `EXPO_PUBLIC_DEMO=1` demo fixture — `ACTIVE`
- `e132586`, 2026-07-17; rewritten `670c692`, 2026-07-25.
- **Why the rewrite:** the original hand-listed check-in days, so a third of "observed" days rendered 기록이 없어요 on the calendar. Check-ins are now **derived** from the window, and times varied by a deterministic FNV hash — **never `Math.random`** — because the screenshot workflow and the invariant tests both need byte-identical rebuilds.
- **Two days stay bare by design, with tests for both:** the reaction day (the reaction *is* that day's record), and today on the active trial (so Home opens on the live 이상 없음 button rather than the collapsed done-state). `[Verified] src/db/demoData.ts` + `[Conversation]`

### D-24 · Editorial design system (paper / ink / persimmon) — `SUPERSEDED`
- `fbf32da` + `003ee43`, 2026-07-17. Superseded by 표본 (D-30), then Warm Care (D-31). `[Verified]`

### D-25 · typed routes: disabled → re-enabled — `REVERSED` (back to the original intent)
- Disabled during Task 9 (template default, forward-route conflict); re-enabled in `97fc91f`, 2026-07-17, with no screen changes needed. `[Conversation]` + `[Verified] app.json`

### D-26 · Project closed at v2.1.1 — `SUPERSEDED` (reopened twice)
- 2026-07-18: *"PROJECT CLOSED at v2.1.1 — paused for designer consult."* Then a designer round (v2.2.0), a vocabulary round (v2.2.1–2.2.4), a resume for device dogfooding (2026-07-23), a design audit (07-25), a catalog import (07-28), a coverage round (07-30), 표본 (08-08) and Warm Care (08-09).
- **Treat "done" as provisional.** `[Conversation]`

### D-27 · Grilled won't-dos, locked 2026-07-18 — `ACTIVE` (as prohibitions)
All four came out of a grilling session and are recorded in `.superpowers/sdd/progress.md`: `[Conversation]`
- **NO early-safe, ever.** Cancelling is the only early exit from a trial. `안전으로 표시` does not exist until the window has elapsed (enforced: `confirmSafe` returns `window_not_elapsed`, `src/trialLifecycle/index.ts:194`). `[Verified]`
- **No cancel button on Home.**
- **Check-ins stay once per day.** Multi-tap was rejected; the done-state copy teaches the cadence.
- **No DB-level one-active-trial index** (see D-13).

### D-28 · Korean ingredient-vocabulary audit — `ACTIVE`, follow-ups resolved in D-43
- 2026-07-18, owner-driven. `13e80c8`.
- **그린빈 removed entirely** — a literal transliteration of "green bean" with no unambiguous native equivalent; dropping beat guessing 강낭콩/깍지콩. Catalog 56 → 55.
- **Loanwords are correct Korean and were left alone** (바나나/토마토/치즈/아몬드/브로콜리). Two spellings standardised to 외래어 표기법: 요거트 → 요구르트, 캐슈넛 → 캐슈너트.
- **Follow-ups resolved 2026-09-05:** `달걀 (전란)`, `셀러리`, and removal of 밤's automatic 고위험 badge; see D-43. The earlier claim that FDA still lists chestnut as a major tree-nut allergen was stale.
- **Mechanism note:** names use i18n keys (`foodName.<id>`), so vocabulary edits are render-only. Risk badges depend on persisted `food.allergen_group` and require catalogue reconciliation on existing installs. `[Verified]`

### D-29 · Setup screen deleted; baby name/birthdate become optional report-only fields — `REVERSED` (removes a spec'd feature)
- **Decided:** 2026-07-23, owner, during device dogfooding. `0c96340`, migration `0003`.
- **Previous approach:** `docs/design-spec.md` §3.1 — *"On first launch, Home shows a single inline setup card (baby name + birthdate) instead of the dashboard."*
- **Why:** the app never uses those fields for logic — they only decorate the exported report. First launch should not block on a form.
- **Replaced by:** a **one-time welcome card** (Apple welcome-sheet idiom, 3 numbered rows), persisted via `baby.welcomedAt` (migration `0004`, `bbbb6be`).
- **Consequence to remember:** the demo seed must run **before** `seedIfEmpty`, because `seedDemoIfEmpty` triggers on an empty `baby` table and `seedIfEmpty` creates that row (`app/_layout.tsx:24-27`). `[Verified]`

### D-30 · 표본 (herbarium) visual direction — `SUPERSEDED` after **one day**
- **Chosen:** 2026-08-07, owner, from a five-direction deck (`design-audit/mockup-directions-3.html`). The four not chosen, for the record: 01 차트 (clinical chart), 03 신호 (Bauhaus status-as-shape), 04 하루 (Korean consumer card stack + bottom tabs), 05 야간 (dark-first).
- **Owner constraint, stated explicitly:** *"표본 is a visual language, not a vocabulary."* The Korean strings 재료 · 캘린더 · 설정 · 기록 보기 · 새 재료 시작하기 · 기록 있음 · 안 먹어봄 must not be renamed to 표본판 / 채집 일지 / 수집함. The first mock draft did rename them and was corrected.
- **Owner's blocker was icon coverage** — *"I don't want the icon grid look if a lot of ingredients are gonna have no icons."* Resolved with **category** glyphs rather than per-food art: 19 family glyphs cover all 120 foods with zero blanks.
- **Shipped:** `3f2e7d6` (palette + glyphs + family map), `4842d48` (grouped list + mounting corners), `b9970cb` (corner inset fix), 2026-08-08.
- **Superseded:** 2026-08-09 by Warm Care (D-31) — roughly 24 hours later.
- **What survived:** `src/db/families.ts` (the 19-family map, coverage asserted in both directions) and `src/ui/FoodGlyph.tsx` (glyph paths, still consumed at `app/foods.tsx:130`), plus the five grouping rules.
- **What did not:** the 표본 palette (`paper #EDE8DC`, `amber #A4761D`) and the "mounting corners" motif. `[Verified]` (diffed `3f2e7d6:src/ui/tokens.ts` against today) + `[Conversation]`
- **Lesson recorded at the time:** *"measure the mock's hexes BEFORE promising them — a mock is designed by eye, `tokens.test.ts` measures."* The mock's amber measured 3.31:1 and had to be split into a marks-only value plus a darker text sibling.

### D-31 · Warm Care UI — the current design system — `ACTIVE`
- **Shipped:** 2026-08-09, `ca544f8` (direction doc) → `b602fe2` (mocks) → `29bf918` (design system) → `df8f480` (all six screens) → `5ee2e89`, `eeb335a`, `b77ca73` (alignment fixes).
- **Previous approach:** 표본 (D-30), one day old.
- **What it is:** cream ground `#FFF8F2`, white card surfaces, terracotta primary `#B64F37`, honey/sage/berry status tints, rounded cards, 48pt controls, a persistent labeled 3-tab bottom bar. Reference philosophy documented in `design-audit/warm-care-design.md` (Huckleberry / Nara / Solid Starts, explicitly *without copying a branded screen*).
- **Structural casualty:** `src/ui/StateField.tsx` (the Direction-B′ tinted state field, D-33) was **deleted** in `df8f480`. Its *logic* survives — `src/domain/homeState.ts` still derives the five states — only the tinted-field rendering went.
- **Current state:** `src/ui/tokens.ts:1` — *"Warm Care palette (owner-approved 2026-08-09)."* `[Verified]`

### D-32 · The design audit (five P0s) — `ACTIVE`
- Read-only audit written to `design-audit/` (`a388ef3`), then fully implemented over six commits, 2026-07-25 (`f10cbea` → `01d3351`). Test suite 50 → 87.
- **The five P0s, all confirmed by adversarial review:** `[Conversation]`
  1. Home's only filled button was 새 재료 시작하기 — the one action the one-active-trial rule blocks. Visual dominance pointed at a destructive path.
  2. Four of nine palette entries failed WCAG AA as text, including the primary button at **3.41:1**.
  3. `elapsed` was computed from a render-time `new Date()` and **there was no AppState listener, interval or timer anywhere in the repo** — so tapping the 09:00 window-end notification onto an already-focused Home never re-rendered. The app's own prompt could not deliver its own action.
  4. The implicit-safe autoclose silently recorded a food 안전 with **no i18n string describing it**.
  5. After 안전으로 표시 the hero unmounted to `null` — no success state, and that same empty branch was Home's steady state between trials.
- **Owner decisions inside it:**
  - Accent darkened `#D96C3D` → `#BE4F26`, **keeping white labels**. The alternative (hold the hex, switch the label to ink at 4.55:1) was **rejected** — it visibly flattens the control.
  - **관찰 wins over 테스트 everywhere.** The two collided in shipped strings; `ko.json` used both in one sentence.
  - Autoclose disclosure is **copy-only, no logic change**. A confirm dialog was **rejected** — a second tap on the app's most common action.
- **Enduring artefacts:** `src/ui/tokens.test.ts` (WCAG floor, *proven to fail on the old palette before applying*), `src/i18n/keys.test.ts` (scans source for static `t()` literals), `src/ui/pressable.ts`, `src/ui/DayLedger.tsx`.
- **Behaviour changes worth knowing:** a 3-day window now paints **3** calendar cells, not 4 (`windowEnd` is the closing *instant*, not an inclusive day bound); active trials no longer tint future days; `colors.greenTint` gained its first consumer (safe days now leave a calendar mark). `[Verified] src/domain/calendar.ts:22-37,68-70`

### D-33 · Home state field (Direction B′) — `SUPERSEDED` visually, `ACTIVE` in logic
- **Decided:** 2026-07-28. Plan at `design-audit/plan-home-state-field.md`.
- **The defect it existed to fix:** Home had only two branches. Logging a reaction ended the trial, so Home fell through to the second branch and printed **"{{count}}가지 안전" in green** — a parent who had just recorded that their baby reacted to 달걀 was shown a green screen counting safe foods.
- **Method:** the discriminating test was committed **red first** (`baa6c44` "test(home): prove Home reports 안전 right after a reaction"), then the fix (`dd473ae`). This is the house pattern for regression tests.
- **Two corrections to the approved mock, both recorded:** the progress bar could not ride the top edge (it would sit behind the notch on a 12 mini), and coloured text on tint measured 4.12:1 / 4.19:1 — below the floor. Resolution: **the field carries the colour, `ink` carries the text.**
- **Current state:** `src/ui/StateField.tsx` deleted by Warm Care; `src/domain/homeState.ts` (five states + `describeHome`) is alive and is what Home renders from. `[Verified]`

### D-34 · Import the v1 ingredient master, then audit it down — 55 → 148 → **120** — `ACTIVE`
- 2026-07-28. `b489ca9` (import), `7cebecf` (audit), `05c1342` (docs).
- **Import:** 93 of v1's 145 rows. All 55 original ids left untouched so device trial history survives. v1's `emoji` and `recommended_month` were dropped — no schema column, and 권장 개월 is a locked won't-do (D-22).
- **Root-cause fix found while shipping it (`4b3a02a`):** `seedIfEmpty` early-returned once any non-custom food existed, so catalog **additions could never reach an install seeded by an older build** — the 93 new foods would have been invisible on the owner's phone. It now upserts the whole catalog on every launch, then reconciles removals. The two-case test was proven to fail on the old logic.
- **The audit cut 28 in three tiers:** `[Conversation]`
  - **duplicates that would split one food's record** — 동태/명태, 홍시/감, 오트밀/귀리, 아기치즈/치즈, 조개, and the now-ambiguous category rows 흰살 생선 + 버섯 (superseded by 5 named whitefish and 5 named mushrooms);
  - **misleading in a trial context** — 매실 (only ever eaten as 매실청), 톳 (inorganic arsenic; UK FSA says avoid), 참치 (식약처 mercury limit for young children, and the app has no "safe but limit" state), 분유 (not a trial food, and 일반/산양/HA/콩분유 are different allergens), 두유, 김치, 크림, 날치알, 시래기, 죽순;
  - **too uncommon in Korea** — 선비콩, 울타리콩, 율무, 호밀, 오리알, 가재, 바닷가재, 양고기, 숙주나물, 참나물, 파.
- **Removed foods keep their `foodName.*` key in `ko.json`** (the 그린빈 precedent) so a row with trial history still renders Korean. That is why `ko.json` has 149 `foodName` keys for a 120-food catalog. `[Verified]`
- **Current catalogue:** **120 foods, 43 high-risk** after D-43; `src/db/families.ts` covers all 120 with no extras in either direction. `[Verified]`

### D-35 · Observation coverage — safety must disclose how much was watched — `ACTIVE`
- 2026-07-30, seven commits (`2954a06` → `f03c5ed`).
- **Previous approach:** an elapsed window auto-closed `safe` regardless of whether anyone had ever looked, so starting the next food could silently print 안전 for a food nobody watched — in the food list, in the status counts and in the doctor's report.
- **Decided:** `autoCloseOutcome` returns `cancelled` (미완료) at zero coverage. *"Elapsed time is not evidence."* Every surface claiming safety discloses coverage: the Home subline, the day ledger (an unrecorded day reads 기록 없음, never 이상 없음), and the report's status column.
- **Marking a 0-coverage window safe by hand is still allowed**, but confirmed first — the parent's memory is evidence; the passage of time is not.
- **Also in this round:** ledger backfill (migration `0005`, `backfilledAt` distinguishes a recollection from a live observation), the day-1 evening prompt (a late-evening start used to spill into a day nothing could count), the window-end prompt floored to 09:00 with two retries, and the cold-launch fix for the notification action. `[Verified] src/domain/status.ts:62-72`, `src/observation/index.ts`

### D-36 · Remove user-added foods — the catalog is the whole list — `REVERSED` (removes a spec'd feature)
- **Decided:** 2026-08-07, owner: *"We're not doing custom added foods."* `2921f8a`.
- **Previous approach:** `docs/design-spec.md` §2/§7 specified *"Curated seed + free-text: … parents can add any custom food."*
- **Deleted:** the ＋ 직접 추가 pill, the inline add row, the empty-search recovery path, `addCustomFood()`, the demo fixture's 아마씨, and four `ko.json` keys.
- **Kept deliberately:** the `food.is_custom` column, `foodLabel`'s `isCustom ? name : t(name)` branch, and `seed.ts`'s `eq(food.isCustom, false)` reconcile guard — an install from an older build can still hold a typed row whose `name` is literal Korean, and without the guard the catalog reconcile would silently delete it.
- **Open:** dropping the column is a separate migration, safe only once the owner's device DB is confirmed to have no custom rows. `[Verified] src/db/seed.ts:33-44` + `[Conversation]`

### D-37 · Deep-module refactor round — `ACTIVE`
- 2026-08-10, four commits: `555ad5c` (one shared time-aware clock), `ed583d0` (observation module), `f151320` (trial lifecycle), `c428e8b` (food-catalogue projection).
- **Previous approach:** screens rebuilt joins and re-derived rules; the report assembled its own view-model at O(n·m); `now` was captured per render.
- **Why:** *"The UI is a thin layer over tested interfaces."* Each module got a pure core and a thin SQLite/Expo adapter, so behaviour is testable without a device.
- **Casualty to know about:** **`src/domain/foodGroups.ts` no longer exists** — it was folded into `src/foodCatalogue/index.ts`. Older notes still reference it. `[Verified]`
- **`src/data/mutations.ts` is now 10 lines** — one function, `updateBabySettings`. Everything else routes through the deep modules.

### D-38 · Adopt GitHub Issues + the mattpocock agent-skill set as the working convention — `SUPERSEDED` for Codex by D-42
- `aa4883c`, 2026-08-10. 35 skills committed under `.agents/skills/`, `skills-lock.json` pinned, conventions in `docs/agents/{domain,issue-tracker,triage-labels}.md`, and `CONTEXT.md` created as the domain glossary.
- **Reality check:** the repo has **zero issues, open or closed**, and `.claude/skill-stats.json` records exactly one skill invocation. The convention was installed and never exercised. `[Verified]`
- **Genuinely valuable output of this decision:** `CONTEXT.md`, which is a real domain glossary and not agent config.

### D-39 · Repository stays public, portfolio-framed, unlicensed — `ACTIVE`
- Flipped public 2026-07-17 (D9 audit round: secrets scan of all public tags clean, wiki/projects disabled, Releases created, spec promoted to `docs/design-spec.md`, the internal build plan removed from the repo and kept local at `.superpowers/rebuild-plan-2026-07-16.md`). License removed 2026-07-31 (D-08). `[Conversation]` + `[Verified]`

### D-40 · Firebase secret-scanning alerts: resolve as false positive; do NOT rewrite history — `ACTIVE`
- 2026-07-30. Two alerts on commit `a7a9088` (v1 era): `google-services.json` and `firebase-messaging-sw.js`.
- **Assessment:** Firebase *client* config, not credentials — no `private_key`, no `client_email`; Google documents web/mobile API keys as safe to expose. Residual risk is quota/billing abuse if the key carries no API restriction.
- **History rewriting was rejected:** the commit is reachable from `main` and all 10 tags including the deliberate `archive/v1-capacitor`; scrubbing a non-secret would mean force-pushing main and rewriting every tag.
- **Resolved as `false_positive`, not `revoked`** — the project still answers on `mammacare-ce9a5.firebaseapp.com`, so claiming revocation would have been false.
- **Still open, owner-only:** restrict or delete the API key, or delete the Firebase project. v1 was a **shared** project (`github.com/kehdgus96`), so it is not ours to delete unilaterally. `[Verified] gh api` (both alerts closed) + `[Conversation]` (reasoning)

### D-41 · The local Postgres `mammacare_db` is NOT safe to drop — `ACTIVE` (corrects an earlier claim)
- `23cf63d`, 2026-09-02 — the most recent commit on `main`. It deletes the line *"Local Postgres `mammacare_db` is v1 leftover; safe to drop, not used"* from `CLAUDE.md`.
- **Why:** that database holds the **richest surviving copy** of the v1 ingredient master — 145 rows with `name` / `emoji` / `recommended_month` / six nutrient levels. The git archive has the cross-reactivity map but not this. `[Verified] git show 23cf63d` + `[Conversation]`

### D-42 · Clean-slate Codex takeover — `ACTIVE`
- **Owner decision, 2026-09-05:** takeover approved. Evidence order is source/tests → Git state/history → this ledger → ROADMAP → PROJECT_HANDOFF → historical Claude material.
- Keep `AGENTS.md` minimal and rely on native agent judgment. Claude instructions, skills, MCP servers, hooks, subagents and preferences are not inherited; migrating any requires an explicit request. Existing archived files remain in place.
- Propose persistent configuration only for a repeatedly observed limitation, using the smallest suitable mechanism: project instruction, specialized skill, external connection or client/runtime setting.
- Maintain this ledger for significant technical/product decisions and reversals; ROADMAP for material roadmap changes; PROJECT_HANDOFF only for material high-level state or architecture changes. Omit routine implementation detail.

### D-43 · Resolve catalogue vocabulary and chestnut classification — `ACTIVE`
- **2026-09-05, owner delegated judgment:** use `달걀 (전란)` to distinguish the whole egg from the existing yolk/white entries, and `셀러리`, the [National Institute of Korean Language's spelling](https://krdict.korean.go.kr/kor/dicSearch/SearchView?ParaWordNo=74831).
- Remove 밤's automatic 고위험 badge (`allergenGroup: null`). The [FDA's revised 2025 guidance](https://www.fda.gov/food/food-allergensgluten-free-guidance-documents-regulatory-information/frequently-asked-questions-food-allergen-labeling-guidance-industry) excludes chestnut from its major-allergen tree-nut list, invalidating the earlier rationale for the badge. This is a catalogue classification decision, not a claim that chestnut cannot cause an allergy; personal reaction status remains derived from Trial history.
- Apply risk-group corrections to existing catalogue rows on launch. Preserve IDs, Trial/Reaction/Observation history, settings and legacy custom rows; no schema migration is needed.

### D-44 · Replacing an active Trial is one atomic command — `ACTIVE`
- **2026-09-05 cleanup audit:** the existing cancel-then-start UI could leave the old Trial cancelled when inserting its replacement failed. Cancellation and insertion now share the lifecycle transaction; SQLite rollback preserves the original record and Observations on failure.
- Replacement carries the Trial ID shown in the confirmation. A stale confirmation cannot cancel a different active Trial. If the window elapsed meanwhile, the existing coverage-based autoclose rule applies. Explicit early replacement is not disclosed as an automatic zero-coverage close.
- Structured persistence failures are displayed for start, confirm-safe and cancellation. This changes failure handling, not the one-active-Trial or safety policy.

### D-45 · Remove unadopted agent workflows; verify through project commands — `ACTIVE`
- **2026-09-05 cleanup mandate, supersedes D-38:** delete the vendored `.agents/skills/`, `skills-lock.json` and unused `docs/agents/` workflow wiring. They were never adopted and conflict with the approved clean-slate direction. Retain the domain glossary, historical evidence and environment inventory archive; install no replacements.
- Keep `AGENTS.md` minimal. `npm run verify` and `npm run verify:bundle` provide the same checks locally and in CI, including PRs targeting another branch. Database regressions use Node 22.13+ built-in SQLite with the production Drizzle driver; no additional dependency or agent harness is required.

---

## Part III — standing prohibitions

Not dated decisions so much as fences. Sources: `docs/design-spec.md` §11, `design-audit/plan.md` §3, and grilled owner decisions.

| Do not | Status | Why |
| --- | --- | --- |
| Resurrect anything from v1 — AI features, community, admin console, hospital finder, recommendations, inquiries/CS, accounts/auth/JWT, any server or cloud component, Capacitor, FastAPI, Postgres | `ABANDONED` | `docs/design-spec.md` §11 |
| Dark mode | `DEFERRED` | §11; `app.json` pins `userInterfaceStyle: "light"` |
| Multi-baby | `DEFERRED` | §11. `baby` is a table, not a singleton, so it is a migration and not a rewrite |
| Reaction photos | `DEFERRED` | §11 |
| Cloud sync | `ABANDONED` | On-device-only is the product |
| JSON import / restore | `DEFERRED` | §6 defers it to a later version; the export label was fixed so it stops promising one |
| Android polish | `DEFERRED` | §11 — "a free byproduct, not a polish target" |
| Add a settings control for `defaultWindowDays` | `ABANDONED` | D-19 |
| Add 권장 개월 | `ABANDONED` | D-22 — and do not propose it again |
| Early-safe exit / cancel button on Home / multi-tap check-ins / DB-level trial index | `ABANDONED` | D-27 |
| Change the current autoclose rule without a new product decision | `ACTIVE` prohibition | D-35 superseded the earlier copy-only rationale: an elapsed Trial closes safe with eligible Observation coverage, otherwise cancelled |
| Edit / delete of records | `DEFERRED` | A real product question with data-model consequences — raise with the owner, do not fold into a design pass |
| Decorative motion | `ACTIVE` prohibition | Three behaviours only, all informational: press, ledger fill, safe confirmation |
| Re-add bilingual support | `ABANDONED` | D-14 |
| Add a dependency without explicit justification | `ACTIVE` prohibition | `design-audit/plan.md` §3; no icon, chart or animation library |
| Rename the Korean UI vocabulary for a visual direction | `ACTIVE` prohibition | D-30 |
| Hand-edit generated migration SQL | `ACTIVE` prohibition | `CLAUDE.md` |
| Nested worktrees | `PARTIALLY SUPERSEDED` by D-45 | TypeScript/Jest now scope their roots; Metro/native sharing remains unverified, so sibling checkouts remain the proven option |

---

## Part IV — decisions I could not resolve

| Question | Status |
| --- | --- |
| Whether the 표본 → Warm Care switch one day later was an owner reversal or a planned two-stage design process | `UNKNOWN` — no conversation record survives explaining the trigger; git shows only the commits |
| Whether the `.agents/` skill set was meant to be permanent repo content or a temporary experiment | `UNKNOWN` historical intent; D-45 resolves removal under the approved cleanup |
| Whether `v2.2.4` was the last intended release or tagging simply stopped | `UNKNOWN` — 86 commits on main since the tag at takeover |
| Whether `docs/screenshots/social-preview.png` was ever re-uploaded to the live GitHub social card | `UNKNOWN` — the repo PNG is a manual upload target; committing it does not update the card |
