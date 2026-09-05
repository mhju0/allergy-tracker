# Roadmap — Allergy Tracker

**As of 2026-09-05.** The owner approved the clean-slate Codex takeover and delegated
the catalogue decisions below. Current source/tests and Git take precedence over historical
handoff claims (DECISIONS D-42).

Evidence: `[Verified]` read this session · `[Inferred]` reasoned · `[Conversation]` only source is
prior conversation history / local agent notes.

---

## NOW — in flight

The three catalogue questions are **completed**: `달걀 (전란)`,
`셀러리`, and removal of 밤's automatic 고위험 badge. Existing installs receive the badge
correction without changing personal history or custom rows. See DECISIONS D-43. `[Verified]`

No other NOW item is selected. Follow-up candidates are prioritized below.

---

## NEXT — prioritized follow-ups

Prioritized follow-up work after the catalogue corrections:

1. **Surface Trial persistence failures correctly.** `MarkSafeButton` and detail cancellation
   ignore structured failures; `useStartTrialFlow` treats any failed start as an active-Trial
   conflict. Handle `persistence_failed` explicitly and preserve the current record on failure.
   Confirm-safe and start failure handling were reproduced during takeover. `[Verified]`
2. **Resolve the 7 open Dependabot alerts** — `js-yaml` ×2 (high), `image-size` ×2 (high),
   `xmldom` ×2 (moderate), `decode-uri-component` (moderate). The blanket claim that these are
   outside runtime was incorrect: `decode-uri-component` is reachable through Expo Router's
   `query-string` dependency; exploitability remains unverified. [PR #2](https://github.com/mhju0/allergy-tracker/pull/2)
   updates both affected xmldom versions and has green CI. `[Verified]`
3. **Tag a release.** The last tag is `v2.2.4` (2026-07-19), 86 commits behind main at takeover.
   Release scope/version and a fresh native smoke check remain to be determined. `[Verified]`
4. **Delete the merged `feat/warm-care-ui` branch, local and remote.** It has zero unique commits
   and `main` is 10 ahead. A separate Dependabot branch also exists. `[Verified]`
5. **Decide the fate of the Firebase project `mammacare-ce9a5`.** Both secret-scanning alerts are
   closed as `false_positive` (v1 Firebase *client* config — no private key), but the project is
   still live, so an unrestricted API key can still be abused for quota/billing. Restrict the key
   or delete the project. Complication: v1 was a **shared** project (`github.com/kehdgus96`), so
   deletion is not unilaterally ours. `[Verified] gh api` + `[Conversation]`
6. **Drop the `food.is_custom` column.** The feature was removed 2026-08-07; the column, the
   `foodLabel` branch and the `seed.ts` reconcile guard were kept on purpose so an install from an
   older build does not lose a typed row. Safe to drop only after confirming the owner's device DB
   has no custom rows. `[Verified] src/db/seed.ts:33-44`

---

## LATER — real features, deliberately deferred

Sourced from `docs/design-spec.md` §11 and the deferral notes. Each is a genuine product idea that
was scoped out of v1 rather than rejected.

| Item | Note |
| --- | --- |
| **JSON import / restore** | The export half ships; restore is spec'd as a later version (§6). This is the honest gap in the backup story: on-device-only means the phone is the single copy. |
| **Multi-baby** | `baby` was deliberately built as a table rather than a singleton so this is a migration, not a rewrite. `[Verified] src/db/schema.ts` |
| **Dark mode** | `app.json` pins `userInterfaceStyle: "light"`. Would require a second full pass through `src/ui/tokens.ts` and the WCAG test. `[Verified]` |
| **Reaction photos** | §11, v1-deferred. |
| **Android polish** | "A free byproduct, not a polish target" (§2). It builds; nobody has looked at it. |
| **Edit / delete of existing records** | Flagged during the design audit as *"a real product question with data-model consequences — raise with the owner, do not fold into a design pass."* Today a mistaken reaction or check-in cannot be corrected in-app. `[Conversation]` |

---

## BLOCKED

### iOS Debug failure — needs fresh reproduction
`ld: cannot link directly with 'SwiftUICore' because product being built is not an allowed client
of it` was reported after `react-native-svg` was added; Release was reported to work.
`[Conversation]` However, the local 2026-08-10 `.expo/xcodebuild.log` records a successful
Debug device build. The handoff's categorical current-blocker claim is **contradictory**;
current native build status remains **unknown** until a fresh build. `[Verified]` log

### Anything needing a physical device
Dogfooding runs on the owner's **iPhone 12 mini** ("mj iphone 12 mini"), which must be passed to
`expo run:ios`. Notification behaviour, the cold-launch check-in action and provisioning cannot be
verified in CI or by an agent. `[Conversation]`

### Deleting the local Postgres `mammacare_db`
Not blocked so much as **forbidden until extracted**: it holds the richest surviving copy of the v1
ingredient master (145 rows with `emoji`, `recommended_month`, six nutrient levels) — data that is
*not* in the git archive. `23cf63d` (the most recent commit on main) exists purely to delete the
earlier claim that it was safe to drop. `[Verified]`

---

## CONSIDERED BUT NOT COMMITTED

Ideas that were genuinely discussed and left in the air. **These are not queued work.**

- **v1 cross-reactivity data.** v1 derived cross-reactivity from an SDAP 2.0 / WHO-IUIS map and
  surfaced it in the doctor report. The map survives at
  `archive/v1-capacitor:backend/app/services/allergy/cross_reactivity_map.json`, keyed by Korean
  food name. Never proposed for v2; noted here only because the asset exists and is non-trivial. `[Conversation]`
- **v1 nutrient data** (six levels per ingredient, in `mammacare_db`). No schema column, no
  surface, no decision. Same status: an asset, not a plan.
- **Exercising the issue-tracker / triage-label conventions that are committed to the repo.**
  `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` describe a workflow; the repo
  has **zero issues, open or closed**. Either adopt it or delete the docs. `[Verified]`
- **Re-uploading `docs/screenshots/social-preview.png` to the live GitHub social card.** The PNG is
  committed; whether the card was ever actually set is unverified — it is a manual upload. `[Verified] file exists` / `[Unknown] whether uploaded`

---

## EXPLICITLY REJECTED — do not propose these

Each was decided, not merely skipped. Sources: `docs/design-spec.md` §11, `design-audit/plan.md`
§3, and grilled owner decisions of 2026-07-17 / 07-18. See `docs/DECISIONS.md` Part III.

| Rejected | Why |
| --- | --- |
| **권장 개월** (per-food recommended introduction month) | Owner, 2026-07-17: keep the app simple — *and do not propose it again*. The v1 CSV has the data; that is not an argument for shipping it. It is also why the 안 먹어봄 family list is 가나다순 and **not** weaning-stage ordered. |
| **A settings control for the watch window** | The 3-day window is fixed after a seven-document health-KB audit. Configurability is a false choice for a medical window. The `baby.default_window_days` column surviving is not an invitation. |
| **Early-safe exit** | Cancelling is the only early exit. `안전으로 표시` does not exist until the window has elapsed — enforced, not just styled (`confirmSafe` → `window_not_elapsed`). |
| **A cancel button on Home** | Grilled 2026-07-18. |
| **Multiple check-ins per day** | Once per local day, idempotent. The done-state copy teaches the cadence instead. |
| **A DB-level unique index for one-active-trial** | Single-writer app; the lifecycle guard suffices. Revisit only if sync or multi-process ever exists. |
| **Bilingual / any locale switching** | Korean-only, owner decision 2026-07-17. `en.json` was deleted, the `baby.locale` column dropped, `expo-localization` uninstalled. |
| **User-added (free-text) foods** | Removed 2026-08-07: the catalog is the whole list. |
| **Changing the current autoclose rule without a new product decision** | Current rule: an elapsed Trial closes safe with at least one eligible Observation, otherwise cancelled. The earlier copy-only rationale was superseded by the 2026-07-30 zero-coverage change (`681a71e`, D-35). |
| **A confirm dialog before autoclose** | Rejected — it puts a second tap on the app's most common action. |
| **Renaming the Korean UI vocabulary to fit a visual direction** | 표본 was adopted as a *visual language only*; 재료 / 캘린더 / 설정 / 기록 보기 must not become 표본판 / 채집 일지 / 수집함. |
| **Decorative motion** | Three motion behaviours only, all informational: press feedback, ledger fill, safe confirmation. |
| **New dependencies without explicit justification** | No icon library, no chart library, no animation library. |
| **Rewriting git history to scrub the v1 Firebase config** | Reachable from `main` and all 10 tags including the deliberate `archive/v1-capacitor`; scrubbing a non-secret would mean force-pushing main and rewriting every tag. |
| **Everything in `docs/design-spec.md` §11** | AI features of any kind, community, admin console, hospital finder, recommendations, inquiries/CS, accounts/auth/JWT, any server or cloud component, Capacitor, FastAPI, Postgres. |
| **Adding a LICENSE** | Removed 2026-07-31; `package.json` says `UNLICENSED`, the README reserves all rights, the repo is public for portfolio review only. |

---

## COMPLETED RECENTLY

Newest first. The 2026-09-05 changes are included in the takeover PR; earlier entries cite commits.
Current validation: typecheck passes; **210 tests pass in 18 suites**. `[Verified]`

| When | What | Evidence |
| --- | --- | --- |
| 2026-09-05 | Catalogue vocabulary resolved; 밤 badge corrected on fresh and existing installs, preserving history and custom rows | D-43; SQLite seed regression tests |
| 2026-09-05 | Clean-slate Codex takeover approved; minimal AGENTS.md and explicit evidence hierarchy | Owner instruction; D-42 |
| 2026-09-02 | Removed the incorrect `CLAUDE.md` claim that `mammacare_db` was droppable | `23cf63d` |
| 2026-08-22 | Excluded `design-audit/` from GitHub language stats (`.gitattributes` → `linguist-documentation`) | `3bbfb60` |
| 2026-08-10 | Merged `postcss` 8.5.19 → 8.5.26 (Dependabot; authored 2026-08-08) | `5d8d845` |
| 2026-08-10 | Synchronized architecture documentation | `24890e1` |
| 2026-08-10 | **Deep-module refactor** — shared time-aware clock, `src/observation`, `src/trialLifecycle`, `src/foodCatalogue`. `src/domain/foodGroups.ts` folded away in the process | `555ad5c`, `ed583d0`, `f151320`, `c428e8b` |
| 2026-08-10 | Agent skills + issue-tracker/triage conventions + `CONTEXT.md` glossary committed | `aa4883c` |
| 2026-08-09 | **Warm Care UI** — the current design system, applied to all six screens; 3-tab bottom bar; `StateField` deleted | `ca544f8`, `b602fe2`, `29bf918`, `df8f480`, `5ee2e89`, `eeb335a`, `b77ca73` |
| 2026-08-08 | **표본 (herbarium) direction** shipped — superseded the next day. Survivors: `src/db/families.ts` (19 families covering all 120 foods) and `src/ui/FoodGlyph.tsx` | `3f2e7d6`, `4842d48`, `b9970cb` |
| 2026-08-07 | User-added foods removed; `is_custom` kept as a legacy guard | `2921f8a` |
| 2026-07-31 | MIT license removed; all rights reserved | `bb42ecd` |
| 2026-07-30 | **Observation coverage** — zero-coverage windows close 미완료, not 안전; ledger backfill (`0005`); day-1 evening prompt; window-end floor + 2 retries; cold-launch notification-action fix | `2954a06` → `f03c5ed` |
| 2026-07-28 | Home state field (5 states) — killed the bug that showed a green "N가지 안전" screen right after a reaction. Red test committed first | `baa6c44`, `dd473ae` |
| 2026-07-28 | **Catalog: 55 → 148 → 120** by importing the v1 master then auditing. Also fixed the seed early-return that made catalog additions invisible to existing installs | `b489ca9`, `4b3a02a`, `7cebecf` |
| 2026-07-25 | **Design audit** — five P0s, all fixed; WCAG contrast test and i18n key-existence test added; suite 50 → 87 | `a388ef3`, `f10cbea` → `01d3351` |
| 2026-07-23 | Setup screen deleted → optional Settings fields + one-time welcome card | `0c96340`, `bbbb6be` |
| 2026-07-17 | Korean-only; fixed 3-day window; 캘린더 screen; Observations; demo fixture | `ca89cda`, `e1468cd`, `44f5ab4`, `cc03c18` |
| 2026-07-16 | v1 torn down; v2 rebuilt ground-up in 14 tasks; repo renamed | `662ab72` → `39e3b97`, `f442bfc` |
