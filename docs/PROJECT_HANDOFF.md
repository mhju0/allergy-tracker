# Project Handoff — Allergy Tracker

**Written:** 2026-09-04 · **Audited from:** `main` @ `23cf63d` (clean tree)
**Purpose:** everything a new engineer or agent needs to work on this repo without prior conversation history.

Evidence convention used throughout:
`[Verified]` — read this session · `[Inferred]` — reasoned from verified facts · `[Conversation]` — only source is prior Claude conversation history / local agent notes, not reconstructible from git.

---

## 1. What this is

A **baby food-allergy tracker** for Korean parents. A parent introduces one new food at a time,
watches for a reaction across a fixed **3-day window**, and the food list becomes a traffic light
they can trust. A doctor-ready PDF is the artefact they bring to a paediatrician.

- Native iOS, Korean-only UI, **100% on-device**. No accounts, no server, no network code at all. `[Verified]` — the only `process.env` read in the entire app is `EXPO_PUBLIC_DEMO` (`app/_layout.tsx:26`); no fetch/XHR/WebSocket anywhere.
- Positioning: **portfolio-first, but genuinely usable.** When the two conflict, portfolio wins — stated in `docs/design-spec.md` §1.
- Public repo: `github.com/mhju0/allergy-tracker` (topics: ios, expo, react-native, sqlite, drizzle-orm, offline-first, food-allergy, portfolio). `[Verified]` via `gh repo view`.
- Owner dogfoods it on a personal iPhone 12 mini. `[Conversation]`

### The one product rule everything else hangs off

While a food is inside its window, **starting another food is blocked**. Isolating the variable is
the medical point of a food trial, so it is a guard in the mutation, not a convention
(`src/trialLifecycle/index.ts:104-145`). `[Verified]`

---

## 2. Architecture

```
app/                  Expo Router screens (typed routes)
  _layout.tsx         migrations → seed → notification wiring → Stack
  index.tsx           Today (welcome card | dashboard)
  foods.tsx           the catalogue (search, filter, family bands, pick mode)
  food/[id].tsx       one food's full record
  calendar.tsx        month history
  log-reaction.tsx    modal
  settings.tsx        modal

src/observation/      Observation rules + SQLite adapter  ← deep module
src/trialLifecycle/   atomic Trial commands + SQLite/notification adapters  ← deep module
src/foodCatalogue/    complete Foods-list semantic projection  ← deep module
src/domain/           pure policy — status, notifications schedule, calendar, homeState, records
src/data/             live queries (read model), settings writes, shared start-trial UI flow
src/db/               schema, catalog, seed, families, demo fixture, client
src/services/         local notifications, PDF/JSON export builders
src/ui/               shared clock, design tokens, components
drizzle/              generated migrations (0000–0005) + journal, committed
plugins/              one Expo config plugin
```

**Layering rule:** the UI is a thin layer over tested interfaces. Screens must not re-derive domain
rules — they call into the deep modules. Enforced socially (`CLAUDE.md`) and structurally (the deep
modules own the only correct implementation). `[Verified]`

### The four modules that matter

| Module | Owns |
| --- | --- |
| `src/domain/status.ts` | `deriveStatus`, `latestTrial`, `windowEnd`/`isWindowElapsed`, `decideStartTrial`, `autoCloseOutcome`, `pendingAutoclose`, `autoclosedBy` |
| `src/observation/index.ts` | Observation eligibility, once-per-day idempotency, `coverage`, `projectObservationDays` (the ledger), backfill semantics |
| `src/trialLifecycle/index.ts` | `start` / `react` / `confirmSafe` / `cancel` / `reconcile` — serialized, transactional, and the sole owner of notification rebuilds |
| `src/foodCatalogue/index.ts` | Foods-list filtering, ordering, family bands, counts, row semantics |

---

## 3. Data & state architecture

**One SQLite file on the phone** (`allergy-tracker.db`), opened via `expo-sqlite` with
`enableChangeListener: true`, wrapped in Drizzle (`src/db/client.ts`). `[Verified]`

Five tables (`src/db/schema.ts`): `baby`, `food`, `trial`, `reaction`, `checkin`.

```
baby     id · name? · birthdate? · default_window_days(3) · welcomed_at?
food     id (catalog slug) · name (i18n key OR literal) · is_custom · allergen_group?
trial    id · food_id → food · started_at · window_days · outcome(safe|reacted|cancelled|NULL) · ended_at?
reaction id · trial_id → trial · symptoms(json) · severity · occurred_at · note?
checkin  id · trial_id → trial · occurred_at · backfilled_at? · note?      ← storage name for an Observation
```

Notes that are easy to get wrong:
- **`checkin` is the legacy storage name for an *Observation*.** `CONTEXT.md` is the glossary: Trial / Observation / Check-in / Coverage. Use the glossary vocabulary in new code. `[Verified]`
- **`baby` holds settings, not just a profile.** Single row, created by `seedIfEmpty`. `name`/`birthdate` are optional and used *only* to decorate the exported report. `[Verified] src/db/schema.ts:3-12`
- **`food.is_custom` is a dead-feature column kept on purpose.** User-added foods were removed 2026-08-07, but an install from an older build can still hold a row whose `name` is literal Korean rather than an i18n key. The seed reconcile guards on it so it is not swept up. Dropping the column is a separate migration, safe only once the owner's device DB is confirmed to hold no custom rows. `[Verified] src/db/seed.ts:33-44` + `[Conversation]`
- **There is no status column.** Every food's status is computed from its trial history on every read.
- **Coverage is derived too.** `coverage(trial)` counts eligible calendar days carrying ≥1 Observation. Every surface that claims safety discloses it.

### Migrations

`drizzle/0000`…`0005`, journal at `drizzle/meta/_journal.json`. `[Verified]`

| # | Change | Why |
| --- | --- | --- |
| 0000 | initial (`baby`/`food`/`trial`/`reaction`, `baby.locale`) | v2 scaffold |
| 0001 | drop `baby.locale` | Korean-only decision |
| 0002 | create `checkin` | Observations |
| 0003 | `baby.name`/`birthdate` → nullable (table rebuild) | setup screen deleted |
| 0004 | add `baby.welcomed_at` | one-time welcome card |
| 0005 | add `checkin.backfilled_at` | fill in a missed day |

Migrations run at boot via `useMigrations` in `app/_layout.tsx:18`. **Never hand-edit generated SQL** — edit `src/db/schema.ts` and run `npx drizzle-kit generate`.

---

## 4. Data flow

**Read path**
```
sqlite ──useLiveQuery──▶ src/data/queries.ts (connectFoods: one join, one place)
        ──▶ FoodWithStatus[] { food, trials[{reactions[], observations[]}], status, latest }
        ──▶ src/domain/homeState · src/foodCatalogue · src/observation · src/domain/records
        ──▶ screens
```
`connectFoods` is pure and unit-tested so the shape the whole app reads has a test that needs no device (`src/data/queries.ts:36-57`). `[Verified]`

**Write path** — all mutations go through the two deep modules, never straight to Drizzle from a screen:
```
screen ──▶ src/trialLifecycle/sqlite.ts  (startTrial · recordReaction · confirmSafe · cancelTrial · reconcile)
screen ──▶ src/observation/sqlite.ts     (recordObservation)
screen ──▶ src/data/mutations.ts         (updateBabySettings — the ONLY direct write left, 10 lines)
```

**Time** — time-sensitive screens share one focus-aware clock, `src/ui/useFreshNow`, which re-reads
`new Date()` on focus, on `AppState → active`, and on a timer that fires at the earlier of local
midnight or the next exact Trial-day boundary. Screens must not take render-time `new Date()`
snapshots. `[Verified] src/ui/useFreshNow.ts`

**Notifications** — `src/domain/notifications.ts` is pure policy (which prompts a trial earns and
which are still in the future); `src/services/notify.ts` only delivers. `trialLifecycle` rebuilds
the whole notification set from persisted state after every transition, and `_layout` re-reconciles
on every foreground. `[Verified]`

---

## 5. External services

**None.** No server, no analytics, no crash reporting, no push service, no cloud sync.
Notifications are all local (`expo-notifications`, `DATE` triggers). Export leaves the device only
when the parent hands a file to the iOS share sheet themselves. `[Verified]`

The only external dependencies at build time are npm and CocoaPods.

---

## 6. Environment & setup

- **Node 22** in CI (`.github/workflows/ci.yml`); npm only (never pnpm/yarn).
- **Expo SDK 57 · React Native 0.86 · React 19.2.3 · TypeScript ~6.0 (strict)**.
- Experiments on: `reactCompiler`, `typedRoutes` (`app.json`).
- `ios/` and `android/` are **gitignored** — Expo CNG, regenerated with `npx expo prebuild`. `[Verified]` (`git ls-files ios` is empty.)
- **CocoaPods on the owner's machine needs a UTF-8 locale:** `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx pod-install ios`, otherwise Ruby/CocoaPods throws a Unicode env error. `[Conversation]`
- Only environment variable: `EXPO_PUBLIC_DEMO=1` (demo fixture). It is inlined by Metro at bundle time — restart Metro *with* the flag; reusing a running flagless Metro silently no-ops the seed. `[Conversation]`
- No `.env` file exists and none is expected. `[Verified]`

### Commands

```bash
npm install
npx expo start                 # dev server (Expo Go has notification limits)
npx expo run:ios               # simulator dev build   ← see §10, Debug is currently broken
npx jest                       # 209 tests / 18 suites
npx tsc --noEmit               # typecheck
npx drizzle-kit generate       # after ANY change to src/db/schema.ts
EXPO_PUBLIC_DEMO=1 npx expo start   # ~30 days of history on a fresh install
```

**There is no linter.** `package.json` has `test` and `typecheck` only; a broken `lint` script was
deleted in `ddf3725`. The two gates are `npx tsc --noEmit` and `npx jest`. `[Verified]`

---

## 7. Deployment

There is none, in the app-store sense. The app has **never been published**. Distribution is:

1. **The public GitHub repo + Releases** — this is the actual deliverable (portfolio). 9 releases, latest `v2.2.4` (2026-07-19). `[Verified]`
2. **Owner's own device**, sideloaded with a free personal Apple developer team.
   - Team `XGY8UN2NYW`; bundle id `com.mhju.allergytracker`; home-screen label 알레르기.
   - `plugins/with-no-push-entitlement.js` strips the unused `aps-environment` entitlement, because free teams cannot provision remote push and all notifications here are local. `[Verified]`
   - Device install recipe and its traps are in §10.

**Releases have lagged main.** `v2.2.4` is from 2026-07-19; ~30 commits have landed since, including
the entire design-audit round, the 표본 round, the Warm Care redesign and the deep-module refactors.
No tag exists for the current state. `[Verified]`

---

## 8. What currently works

Verified this session: `npx tsc --noEmit` exits 0; `npx jest` reports **209 passed / 18 suites**.

- **Trial lifecycle**, complete: start → observe → (reaction | explicit safe | implicit safe on next start | cancel), serialized and transactional, with the one-active-trial guard.
- **Implicit-safe autoclose with coverage:** starting a new food closes an elapsed window `safe` only if ≥1 day was actually observed; with zero Observations it closes `cancelled` (미완료) and the food returns to 안 먹어봄. Elapsed time is not evidence.
- **Autoclose disclosure:** the picker predicts it, Home reports it, both by asking `src/domain/status.ts` rather than restating the rule.
- **Delayed reactions:** a reaction logged against an already-safe food attaches to the latest trial and flips it to 반응.
- **Observations:** one-tap 이상 없음, once per eligible calendar day, idempotent, with backfill of a missed day recorded as a recollection (`backfilledAt`) rather than a live observation.
- **Notifications:** day-1 on the feed evening (19:00), days 2..n at 09:00, a window-end prompt floored to 09:00 with two warmer retries (+1d, +3d) then silence. The banner carries an 이상 없음 action button. The action works on a **cold launch** (`useLastNotificationResponse`, not the listener). Foreground reconciliation repairs failures.
- **Calendar:** month grid, tint = day status (amber observing / green safe / red reaction), dot = a record exists, today ringed, future days never shaded, same-instant events ordered close-then-open.
- **Foods list:** search, five filters, tried-first ordering, 안 먹어봄 grouped into 19 family bands with glyphs, 고위험 badge hoisted to the band for wholly-high-risk families.
- **Exports:** paediatrician PDF (with coverage disclosed in the status column) and JSON backup, both to the share sheet.
- **Accessibility:** `src/ui/tokens.test.ts` computes WCAG contrast from the palette and fails the build below 4.5:1 for anything carrying text; a status colour never travels without icon + label; `src/i18n/keys.test.ts` scans source for static `t()` literals so a renamed key cannot ship as raw text.
- **Demo fixture:** deterministic (FNV hash, never `Math.random`), invariant-tested, rebuilds byte-identically for screenshots.
- **CI:** green on `main` (`npx tsc --noEmit` + `npx jest --ci` on push/PR).

---

## 9. Partially implemented

| Thing | State |
| --- | --- |
| **JSON export** | Export works; **there is no import/restore path**. `docs/design-spec.md` §6 defers it. The label was changed from 데이터 백업 to 데이터 내보내기 so the string stops promising a restore the app cannot deliver. `[Verified] design-audit/plan.md` QW4 |
| **Android** | It builds (adaptive icons exist in `app.json`) but is explicitly not a polish target. Never smoke-tested. `[Inferred]` |
| **`food.is_custom`** | Column and its render branch survive a removed feature; see §3. |
| **`docs/agents/` + `.agents/skills/`** | 35 agent skills and an issue-tracker/triage-label convention are committed, but **the GitHub issue tracker has zero issues, open or closed**. The convention was installed and never used. `[Verified]` |
| **Releases** | Tagging stopped at `v2.2.4`; ~30 commits of shipped work are untagged. |

---

## 10. What is broken

### `npx expo run:ios` fails in Debug — the documented one-liner does not work `[Conversation]`

```
ld: cannot link directly with 'SwiftUICore' because product being built is not an allowed client of it
```

Since `react-native-svg` was added, Xcode 26 builds a SwiftUI-Previews `__preview.dylib` in **Debug
only**, and that is what pulls `SwiftUICore`. `-configuration Release` links clean, which is why
device and simulator **Release** builds both succeed. Not a version problem —
`react-native-svg@15.15.4` is exactly what `npx expo install --check` wants for SDK 57.
**Left unfixed by owner scope choice** (the fix is a Podfile edit).

Workaround for screenshots and dogfooding — build Release directly:

```bash
xcodebuild -workspace ios/AllergyTracker.xcworkspace -scheme AllergyTracker \
  -configuration Release -destination "id=<device-udid>" \
  -allowProvisioningUpdates -derivedDataPath <dd> build
xcrun devicectl device install app --device <devicectl-id> \
  <dd>/Build/Products/Release-iphoneos/AllergyTracker.app
```

Use **Release, not Debug**, for dogfooding: Debug has no embedded bundle and dies the moment it
cannot reach Metro on the Mac.

### Signing: Expo does not pass `-allowProvisioningUpdates` `[Conversation]`

`expo run:ios --device "mj iphone 12 mini"` dies with **xcodebuild error 65 / "No profiles for
'com.mhju.allergytracker' were found"** when the provisioning profile has expired and been pruned.
Mint it once by running `xcodebuild … -allowProvisioningUpdates` directly (above), then Expo finds it.
Related traps:
- Xcode 16+ stores profiles in `~/Library/Developer/Xcode/UserData/Provisioning Profiles`, **not** `~/Library/MobileDevice/Provisioning Profiles` (which is empty).
- `xcrun xctrace list devices` reports a Wi-Fi-paired device under "Devices Offline" (false negative); `xcrun devicectl list devices` is correct — trust devicectl, it is what Expo uses.
- The two device identifiers are **different**: xcodebuild wants the xctrace UDID, devicectl wants its own identifier.
- **Never pipe `xcodebuild`/`expo run:ios` through `grep`/`tail`** — the pipeline exit code becomes grep's, so a failed build reports success, and the `** BUILD FAILED **` verdict gets filtered away.

### Open dependency advisories

7 open Dependabot alerts, all transitive dev-toolchain packages, none reachable from shipped app code. `[Verified]` via `gh api …/dependabot/alerts`:

| Severity | Package | Note |
| --- | --- | --- |
| high | `js-yaml` (×2) | quadratic CPU in `!!omap`; fix not backported to 3.x/4.x |
| high | `image-size` (×2) | DoS via infinite loop in ICNS / JXL / HEIF parsers |
| medium | `@xmldom/xmldom` (×2) | XML fragment injection — **open PR #2** bumps it |
| medium | `decode-uri-component` | DoS on malformed percent-encoding |

Two were dismissed earlier (`uuid`, `esbuild` — dev-only) and `postcss` was fixed via merged PR #1.
Several "Dependabot Updates" CI jobs fail (js-yaml, nanoid, decode-uri-component) because no
in-range fix exists. `npm audit` did not complete locally this session (likely sandbox network) —
the GitHub alert list above is the current source of truth.

### Pre-existing runtime warning

`DateTimePicker`'s `onChange` deprecation warning fires at runtime in `settings.tsx` and
`log-reaction.tsx`. Known, deliberately left alone. `[Conversation]`

---

## 11. Current Git state

- Branch **`main`**, clean tree, up to date with `origin/main`. `[Verified]`
- **277 commits** total across v1 + v2. 218 tracked files.
- **`feat/warm-care-ui` is fully merged and stale** — 0 commits unique to it, `main` is 10 ahead. It still exists locally *and* on origin. Safe to delete both. `[Verified]`
- **10 tags.** `archive/v1-capacitor` (the dead v1 app, preserved deliberately), `v0.9-demo`, `v2.0.0-alpha`, `v2.1.0`…`v2.2.4`.
- 1 open PR (**#2**, dependabot `@xmldom/xmldom`), 1 merged (#1, postcss). **Zero issues, ever.**
- 2 secret-scanning alerts, both **resolved as `false_positive`** — v1 Firebase *client* config from commit `a7a9088`, reachable from `main` and all 10 tags. History rewriting was rejected (force-pushing main and rewriting every tag to scrub a non-secret). See §14. `[Conversation]` + `[Verified]` via `gh api`.
- Untracked-but-present locally and gitignored: `ios/`, `.expo/`, `.claude/`, `.superpowers/`, `expo-env.d.ts`.

### Recent major development (newest first)

| Commit | Date | What |
| --- | --- | --- |
| `23cf63d` | 09-02 | docs: removed a **wrong** claim from `CLAUDE.md` that local Postgres `mammacare_db` is safe to drop — it holds the richest surviving copy of the v1 ingredient master |
| `3bbfb60` | 08-22 | `design-audit/**` marked `linguist-documentation` so mock HTML stops skewing repo language stats |
| `24890e1` | 08-10 | documentation synchronised across `README`, `CONTEXT.md`, `docs/design-spec.md`, `design-audit/*` |
| `aa4883c` | 08-10 | 35 mattpocock agent skills committed to `.agents/` + `skills-lock.json` |
| `c428e8b` `f151320` `ed583d0` `555ad5c` | 08-10 | **the deep-module round** — food catalogue projection, trial lifecycle, observation module, and one shared time-aware clock |
| `ca544f8`…`b77ca73` | 08-09 | **Warm Care redesign** — new design system, bottom nav, full rewrite of all six screens |
| `3f2e7d6` `4842d48` `b9970cb` | 08-08 | **표본 (herbarium)** palette + 19 family glyphs + grouped 안 먹어봄 list |
| `b489ca9` `7cebecf` `4b3a02a` | 07-28 | v1 ingredient import (55→148), owner audit (148→**120**), and the seed-reconcile root-cause fix |
| `2954a06`…`f03c5ed` | 07-30 | **observation coverage** — 미완료 autoclose, ledger backfill, reminder-schedule rework |
| `a388ef3`…`01d3351` | 07-25 | **design audit** — 5 P0s found and all fixed (WCAG, pressed states, 관찰 vocabulary, dead ends, the 3-day ledger) |

---

## 12. Technical debt

Ordered by how likely it is to bite.

1. **Two design systems were shipped one day apart.** 표본 (2026-08-08) was replaced by Warm Care (2026-08-09). What survived from 표본 is `src/db/families.ts` + `src/ui/FoodGlyph.tsx` (the 19 category glyphs); the palette and the "mounting corners" motif did not. `design-audit/` still contains both mock decks. Anyone reading the design docs must check the date. `[Verified]`
2. **`src/domain/foodGroups.ts` no longer exists.** It was folded into `src/foodCatalogue/index.ts` by `c428e8b`. Older notes and memory files still reference it. `[Verified]`
3. **Mutations are not transactional at the top level, and `PRAGMA foreign_keys` is off.** Accepted at archive time: single-writer, on-device app. Revisit only if sync or multi-process ever arrives. `[Conversation]`
4. **No DB-level one-active-trial constraint** — deliberately a guard in the lifecycle command only. Same rationale. `[Conversation]`
5. **`food.is_custom`** — a column, a render branch and a seed guard kept alive for a removed feature (§3).
6. **Removed catalog foods keep their `foodName.*` keys in `ko.json` forever** so an old install with trial history still renders Korean. `ko.json` has **149** `foodName` keys against a **120**-food catalog — the 29-key gap is intentional legacy, not rot. `[Verified]`
7. **No E2E suite.** By design (`docs/design-spec.md` §9): manual simulator smoke before tagging. Every screen-level regression is caught by eye or not at all.
8. **`reanimated` / `worklets` / `gesture-handler` may be unused** — unverifiable without a native build, so they were left in. `[Conversation]`
9. **`docs/screenshots/social-preview.png` shows a pre-audit UI**, and the *live* GitHub social card is a manual web upload anyway — committing the PNG does not update it. `[Conversation]`
10. **`.agents/` + `docs/agents/` + `skills-lock.json` are committed agent-harness config for a workflow that produced zero issues.** ~100 of the 218 tracked files. Dead weight for a human reader.

---

## 13. Temporary hacks

- **`opensAppToForeground: true` on the check-in notification action** (`src/services/notify.ts:37-40`) — background delivery of notification actions is unreliable in expo-notifications, so the action foregrounds the app instead of writing from the background. The comment says to flip it once that is dependable. `[Verified]`
- **`Notifications.clearLastNotificationResponse()`** in `app/_layout.tsx:59` — the hook keeps returning the same response until cleared, and an uncleared one would re-fire on a later render, dating a check-in to whatever day the app happened to re-render on. `[Verified]`
- **`expo-file-system/legacy`** import in `app/settings.tsx:9` — the only legacy-API import in the app. `[Verified]`
- **`plugins/with-no-push-entitlement.js`** — strips a real entitlement to make free-team signing work. Correct, but a build-environment workaround rather than a product decision. `[Verified]`
- **Screenshot/GIF production is a pile of undocumented-in-repo recipes.** Deep links drive the screens (`allergytracker://foods?focus=reacted`, `allergytracker://food/egg`, `allergytracker://calendar`), `simctl status_bar override --time 9:41` gives marketing chrome, `demo.gif` is composited in PIL from stills with hardcoded slide/crossfade constants. All of it lives only in the local agent memory file. `[Conversation]`

### Environment gotchas that have each cost a work cycle `[Conversation]`

- `expo run:ios` **reinstall changes the app's data-container UUID** — a path resolved before the build silently points at the old container, so `rm` deletes nothing and a stale fixture survives. Always re-resolve `simctl get_app_container` *after* the build.
- `expo run:ios` installs **over** the existing app without wiping data, and `seedDemoIfEmpty` no-ops on a non-empty `baby` table — a rebuilt fixture silently does not appear. Verify by querying the DB, not by trusting the install.
- `simctl get_app_container` reports "not installed" when the simulator is powered off (false negative) — boot first.
- `expo run:ios` **silently reuses any Metro already on :8081** — a stale Metro from another directory serves the wrong code.
- A stale in-tree `node_modules/expo-modules-jsi/apple/.DerivedData` ModuleCache from the old `mammacare-ios` path throws xcodebuild error 65. Fix: `find node_modules -type d -name .DerivedData -exec rm -rf {} +`.
- **Never place a git worktree inside the repo it belongs to** — jest's `testMatch: ["**/*.test.ts"]` walks into the nested `node_modules` and reports a failure on a clean tree.
- Seeding with `strftime('%s','now','localtime')` produces a **corrupted epoch**; use `strftime('%s','now')` with no modifier.

---

## 14. Important unresolved questions

1. **Three Korean catalog labels are still open, owner's call.** `[Conversation]`, current state `[Verified]`:
   - `달걀` — should it become `달걀 (전란)` now that `달걀 노른자` and `달걀 흰자` exist as separate rows? Currently plain `달걀`.
   - `샐러리` → `셀러리` (the correct 외래어 spelling). Currently `샐러리`.
   - Should `밤` (chestnut) keep its 고위험 badge? The FDA counts chestnut as a tree nut; it is currently `group: 'tree_nut'` (`src/db/catalog.ts:31`).
2. **When can `food.is_custom` be dropped?** Only once the owner's device DB is confirmed to hold no custom rows.
3. **Firebase project `mammacare-ce9a5` is still live** and only the owner can act. v1 was a *shared* project (`github.com/kehdgus96`), so deleting it is not a unilateral call. The exposed keys are Firebase *client* identifiers — public by design, not credentials — and both alerts are closed as false positives. The residual risk is quota/billing abuse if the API key carries no restriction. `[Conversation]`
4. **Edit / delete of records.** Nothing in the app can amend a record today, and a mis-tapped reaction is permanent and reaches the exported PDF. `design-audit/plan.md` §3 flags this as a real product question with data-model consequences, explicitly not to be folded into a design pass.
5. **Home's `safe`/`reacted` state persists indefinitely** until the next trial starts. A parent who stops for a month reopens on a month-old red field. Decision was to ship it — the state *is* accurate — and not build a time-decay rule until someone reports it. The fix would be one clause in `deriveHomeState`. `[Verified] design-audit/plan-home-state-field.md` §9
6. **Should `.agents/`, `docs/agents/` and `skills-lock.json` stay in a repo that is moving off Claude Code?** They are ~100 of 218 tracked files and encode an agent workflow with zero issues to show for it. Flagged, not acted on.

---

## 15. Current development focus

**Maintenance mode.** The README says so in as many words: *"Feature-complete and in maintenance mode."*
The last four months of commits are documentation synchronisation, a dependency bump and one
factual correction. `[Verified]`

The project has been declared closed **twice** and reopened twice (2026-07-18 "PROJECT CLOSED at
v2.1.1", then a design audit; 2026-07-23 resumed for on-device dogfooding, then two more redesign
rounds). Treat "done" as provisional. `[Conversation]`

If work resumes, the honest shortlist is in `docs/ROADMAP.md`. The decision history — including
everything that was built and then removed — is in `docs/DECISIONS.md`.

---

## 16. Rules a new contributor must not violate

These are load-bearing, not style preferences. Sources: `CLAUDE.md`, `docs/design-spec.md`, and
owner decisions recorded in conversation.

1. **Status is derived, never stored** (`src/domain/status.ts`). The exhaustive switch is the whole state machine — adding an outcome to the schema fails the typecheck there until it is handled.
2. **One active trial at a time.** All transitions go through `src/trialLifecycle`.
3. **An elapsed Trial auto-closes `safe` only with Observation coverage**, otherwise `cancelled` (미완료).
4. **Observation rules live in `src/observation`**; screens must not re-derive eligibility, idempotency, coverage or day projection.
5. **Every user-visible string via i18next, Korean only.** No locale switching, dates pinned `ko-KR`.
6. **Colours only from `src/ui/tokens.ts`**, and a status colour never appears without its icon and label.
7. **Gates before any commit:** `npx tsc --noEmit && npx jest`.
8. **Schema changes** = edit `src/db/schema.ts` + `npx drizzle-kit generate` + commit the generated files. Never hand-edit migration SQL.
9. **Nothing from v1 comes back** — see `docs/design-spec.md` §11 and the ABANDONED entries in `docs/DECISIONS.md`.
