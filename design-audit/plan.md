# Implementation plan — Allergy Tracker

**Status:** Historical implementation plan. The Warm Care work described here
has shipped; current architecture and behavior live in `README.md`,
`docs/design-spec.md`, and `CONTEXT.md`. File names, line references, and
unchecked boxes below are retained as the original decision record.

Companion to the original local `report.html`.

**Constraints honoured throughout:** no new dependencies, no schema change, no
generated-migration change, nothing in `src/domain/`, `src/db/`, `src/data/`,
`src/services/` or `drizzle/` except the single calendar-bounds change, which is
called out explicitly and carries a test requirement.

**Gates before every commit** (project rule, `CLAUDE.md`):
`npx tsc --noEmit && npx jest`

---

## 1 · Quick wins

High impact, low risk, no architecture change. Each is independently shippable.

### QW1 — Raise text and control contrast to WCAG AA

| | |
|---|---|
| **What changes** | Three hex values in `src/ui/tokens.ts`, plus a role split so the failing colours stop carrying text. `accent` `#D96C3D` → `#BE4F26` (3.41:1 → **4.84:1** with white). Add `inkSecondary #6E675A` (**5.23:1**) and swap it in wherever `muted` currently renders *text*; `muted #8B8578` stays, demoted to dots, rules and disabled glyphs. Add `amberText #96631A` (**4.79:1**) for the active-trial subline and calendar event rows; `amber #B0761F` stays for fills, dots and tint. Calendar day numbers on `amberTint` (3.09:1) move to `amberText`. |
| **Files** | `src/ui/tokens.ts` · `src/ui/Button.tsx` · `src/ui/StatusChip.tsx` · `src/ui/CheckinPill.tsx` · `app/index.tsx` · `app/foods.tsx` · `app/calendar.tsx` · `app/food/[id].tsx` · `app/settings.tsx` · `app/log-reaction.tsx` |
| **Why** | The most-tapped control in the app and every non-headline word in it are below the legibility floor. Report issue 02. |
| **Decided** | 2026-07-25 — **darken the accent, keep white labels.** The alternative (hold `#D96C3D` and switch the label to ink `#26241F`, which also passes at 4.55:1) was rejected: it preserves the exact approved hex but visibly changes the control, reading flatter and less like a filled iOS CTA. |
| **Risk** | **Low.** Colour only — no layout, no logic. Hues are preserved (accent 18° → 16°, amber 36° → 35°), so the identity is unchanged. |
| **Manual QA** | Side-by-side against the current build on a real device in daylight. Confirm the persimmon still reads as persimmon and not brick. Check the primary button in all four labels (`새 재료 시작하기`, `안전으로 표시`, `반응 저장`, `재테스트`). |

### QW2 — Give every control pressed-state feedback

| | |
|---|---|
| **What changes** | One helper, `src/ui/pressable.ts`, exporting `pressStyle = (base) => ({pressed}) => [base, pressed && {opacity: 0.55}]`. Applied at the 22 `Pressable` call sites and inside `Button` / `CheckinPill`. |
| **Files** | new `src/ui/pressable.ts` · `src/ui/Button.tsx` · `src/ui/CheckinPill.tsx` · all six screens |
| **Why** | Zero of 22 interactive elements respond to touch today. On a UI built from 1.25:1 hairlines this is the main signal that a row is a control. Report issue 06. |
| **Risk** | **Low.** Purely additive; no layout change. Only trap: `Pressable`'s `style` must become a function, so any call site currently spreading a style array needs checking. |
| **Manual QA** | Press and hold each control on every screen — including the four status count rows, the Home hero name, the calendar month title and every calendar day cell. Confirm nothing flickers during `FlatList` recycling on the foods list. |

### QW3 — Make Settings show what is stored

| | |
|---|---|
| **What changes** | The 아기 이름 value renders in `ink`, not `muted` — today the saved value and the 미입력 placeholder are the same colour. Add `onSubmitEditing` alongside `onEndEditing` and set `blurOnSubmit`. Add a `→` to the 알림 row so it matches the row below it. Re-read notification permission on focus, not once on mount. |
| **Files** | `app/settings.tsx` |
| **Why** | This is the one screen whose job is "show me what is stored", and it gives no way to tell stored from unstored. The permission row's whole purpose is to be fixed and then re-checked. Report issue 09. |
| **Risk** | **Low.** No change to the commit model itself (see M2). |
| **Manual QA** | Type a name → tap ✕ → reopen. Type a name → return key → reopen. Type a name → swipe the sheet down → reopen (**this is the case expected to fail**; see M2). Deny notifications, open Settings, grant in iOS Settings, come back — the row must now read 허용됨. |

### QW4 — One vocabulary, honest labels

| | |
|---|---|
| **Decided** | 2026-07-25 — **관찰 wins everywhere.** Warmer, and truer to what a parent actually does; you watch a baby, you don't run a lab test on one. |
| **What changes** | Strings only.<br><br>**Vocabulary — the exact map:**<br>`status.testing` 테스트 중 → **관찰 중**<br>`food.startTrial` {{days}}일 테스트 시작 → **{{days}}일 관찰 시작**<br>`food.retest` 재테스트 ({{days}}일) → **다시 관찰 ({{days}}일)**<br>`food.cancelTrial` 테스트 취소 → **관찰 중단**<br>`food.blockedTitle` {{food}} 테스트 중 → **{{food}} 관찰 중**<br>`food.blockedBody` / `food.trialBlocked` — drop 테스트하세요, use 관찰<br>`calendar.trialStart` 테스트 시작 → **관찰 시작**<br>`calendar.legendWindow` 테스트 기간 → **관찰 기간** (now matches `notif.windowEndTitle`)<br>`foods.pickHint` → **{{days}}일 관찰이 시작돼요**<br>`home.readyToConfirm` and `notif.*` already say 관찰 — leave them.<br><br>**Also in this commit:** interpolate the window in `home.readyToConfirm`, `welcome.step2` and `foods.pickHint` instead of hardcoding 3일. Rename `settings.exportJson` 데이터 백업 → **데이터 내보내기** — there is no import path anywhere in the codebase, so 백업 promises a restore the app cannot deliver. Make `reaction.savedBody` accurate on the delayed-reaction path and name the 안전 → 반응 flip. Relabel both destructive-alert buttons so 취소 is not the destroying option (`관찰 중단하고 시작` / `닫기`). Add a one-line definition of 고위험. Give the foods list separate empty strings for "no foods" and "no search results".<br><br>**Issue 04 disclosure** (decided 2026-07-25: **copy only, no logic change** — a confirm dialog was rejected for putting a second tap on the app's most common action): when the active window has elapsed, the picker hint gains a second line naming the food about to be closed (`{{food}}는 안전으로 기록돼요`), and Home's post-start state gains `✓ {{food}} 안전으로 기록됨` under the new hero. |
| **Files** | `src/i18n/ko.json` · `app/food/[id].tsx` (alert labels) · `src/data/useStartTrialFlow.ts` (alert labels) · `app/log-reaction.tsx` (pass the outcome to the alert) · `app/foods.tsx` (picker hint) · `app/index.tsx` (post-start line) |
| **Why** | The Korean is good; the vocabulary is unmanaged. Report issues 04 and F, plus the P2 list. |
| **Risk** | **Low.** Strings and two alert-button labels; no logic changes. The one thing to watch is that `status.testing` is read by `StatusChip`, the Home tally, the food-detail subline **and the exported PDF's status column** — 관찰 중 must fit all four without wrapping. |
| **Manual QA** | Read every screen end to end in Korean and confirm 테스트 appears nowhere. Trigger both destructive alerts and check that 취소 is not the destroying button. Log a delayed reaction on an already-safe food and read the confirmation. Let a window elapse, open the picker, and confirm the autoclose is named **before** the tap; then tap and confirm Home names it after. Export the PDF and check the status column. |

### QW5 — Fix the four cheap dead ends

| | |
|---|---|
| **What changes** | (a) Empty search offers to add the typed term as a custom food, carrying `query` into `newName` instead of making the user retype. (b) Zero-count status rows on Home render dimmed and non-interactive. (c) The Home hero food name gains the same `→` affordance every other navigating row on that screen already has. (d) Food detail's back label reads the actual previous screen instead of always 재료. |
| **Files** | `app/foods.tsx` · `app/index.tsx` · `app/food/[id].tsx` |
| **Why** | Four separate Phase-1 dead ends, each a handful of lines. |
| **Risk** | **Low.** (d) needs `navigation.getState()` or a `from` param — prefer the param; it is explicit and typed. |
| **Manual QA** | Search for a food not in the catalogue. Tap a zero count. Reach food detail from Home *and* from the list; check the label both ways. |

### QW6 — Safe areas on the two modals and the welcome card

| | |
|---|---|
| **What changes** | Apply `insets.bottom` to `app/log-reaction.tsx` (반응 저장 currently sits inside the ~34 pt home-indicator zone) and `app/settings.tsx`. Fix `app/index.tsx:29`, where the welcome card's `paddingBottom` uses `insets.top`. |
| **Files** | `app/log-reaction.tsx` · `app/settings.tsx` · `app/index.tsx` |
| **Why** | The primary action of the reaction sheet is partly under the system gesture area. |
| **Risk** | **Low.** |
| **Manual QA** | Both modals on a device with a home indicator and on one with a physical home button. |

### QW7 — Make the calendar legible without colour

| | |
|---|---|
| **What changes** | Ring today's cell (nothing marks it today, and one month-nav tap moves the selection to the 1st). Add an icon to each legend entry — this is the one screen that breaks the project's own "icon + label always accompany status colours" rule. Extend each day cell's `accessibilityLabel` with its tint and dot, which VoiceOver currently never hears. Give safe outcomes the already-defined, entirely unused `colors.greenTint`. |
| **Files** | `app/calendar.tsx` · `src/domain/calendar.ts` (add a `safe` case to `DayMark`) |
| **Why** | Report issue 08. `greenTint` is exported with zero consumers; a confirmed-safe outcome leaves no mark on the grid at all. |
| **Risk** | **Low–medium.** The `DayMark` change touches a unit-tested pure module — add cases to `src/domain/calendar.test.ts` in the same commit. |
| **Manual QA** | `EXPO_PUBLIC_DEMO=1` build. VoiceOver over the grid. Navigate to last month and back. |

---

## 2 · Medium-risk improvements — deferred

Real value, but each needs its own commit and its own verification pass. Ship
after the quick wins land.

### M1 — Primacy follows trial state *(Direction A, core)*

`Button`'s `variant` becomes a function of whether a trial is active. Running →
the check-in is filled, `새 재료 시작하기` is a nav row. Elapsed → `안전으로 표시`
is filled. Closed → `새 재료 시작하기` reclaims the fill. **Risk:** changes what
the most-visited screen looks like in three states; every state needs a device
check. **Blocked on:** nothing.

### M2 — Stale-time correctness

One `AppState` `'change' → 'active'` listener bumping the same `tick` the focus
effect already bumps. This is what makes the window-end notification actually
deliver its action, and it also fixes `CheckinPill` showing yesterday's check-in
after midnight. **Risk:** touches render timing on the app's hottest path; verify
there is no re-render loop with `useLiveQuery`. **Also fixes:** the Settings
name-field commit case in QW3 becomes moot only if a Save affordance is added —
decide that separately.

### M3 — The three-day ledger

New `src/ui/DayLedger.tsx`, consumed by Home and food detail. **Never assume
`windowDays === 3`** — read it from the trial row. **Risk:** new component, new
layout maths, and it is the direction's signature so it has to be right.

### M4 — Foods: sort tested first, drop the untried chip, filter instead of scroll

Deletes `focusApplied`, `scrollToIndex` and `getItemLayout` and replaces them
with a filter. **Risk:** changes the meaning of the `?focus=` deep link from
"scroll" to "filter"; search must clear the filter or results silently vanish.
Net deletion of code.

### M5 — Tint only observed days

`isInTrialWindow` currently bounds on `windowEnd`, so an active trial paints
tomorrow and the day after in the same amber as today, and a 3-day trial paints
4 cells. Clamp to `min(today, endedAt, windowEnd)`. **Risk:** `src/domain/calendar.ts`
is pure and unit-tested — `src/domain/calendar.test.ts:68-71` asserts the current
inclusive-end behaviour, so that test changes with it. Prove the new test fails
against the old bounds before applying the fix.

### M6 — Dynamic Type

`ROW_H = 44` → `minHeight: 44`, drop `getItemLayout` (M4 removes the only reason
it exists), drop `numberOfLines={1}` or raise it to 2. **Risk:** `FlatList`
performance on 55 rows without `getItemLayout` — measure before assuming it is
fine.

### M7 — The status ribbon *(Direction B, absorbed)*

Deferred, not discarded. Worth revisiting once M4 has landed, since M4 does most
of the groundwork.

---

## 3 · Do not do

| | Why |
|---|---|
| **Dark mode** | Explicitly out of scope, `docs/design-spec.md` §11. `app.json` pins `userInterfaceStyle: "light"`. |
| **Any new dependency** | No icon library, no chart library, no animation library. Everything above is achievable with what is installed; `react-native-reanimated` is already present if the ledger animation needs it. |
| **Change the palette** | Owner-approved 2026-07-17. QW1 is a contrast repair at constant hue, not a redesign. |
| **A settings control for `defaultWindowDays`** | The fixed 3-day window is a grilled won't-do. Fix the *strings* that hardcode 3일 (QW4) and read the column where it exists; do not add UI. |
| **Tabs or a bottom nav** | Six screens, stack-only, no orphan routes. The IA is correct; the affordances are not. |
| **Edit / delete of records** | Nothing in the app can amend a record today, and a mis-tapped reaction is permanent and reaches the exported PDF. That is a real product question with data-model consequences — raise it with the owner; do not fold it into a design pass. |
| **JSON restore / import** | `docs/design-spec.md` §6 defers it to v2. QW4 fixes the *label* so it stops promising one. |
| **Touch `src/domain/status.ts`, `src/data/mutations.ts`, `src/services/notify.ts`, `src/db/**`, `drizzle/**`** | The one-active-trial invariant and implicit-safe autoclose live there and are the product's correctness guarantee. QW7 and M5 are the only domain edits proposed, both in `calendar.ts`, both with test requirements. |
| **Decorative motion** | Three behaviours, all informational (press, ledger fill, safe confirmation). Nothing else moves. |
| **Change the implicit-safe autoclose rule** | The rule is sound and specified. Issue 04 is a *disclosure* problem — fix it with copy. |

---

## 4 · Commit sequence

Six commits, each coherent, independently shippable, and gate-clean.

```
1  fix(a11y): raise text and control contrast to WCAG AA        ← QW1
2  fix(ui): add pressed-state feedback to every control         ← QW2
3  fix(copy): unify on 관찰, disclose the implicit-safe autoclose ← QW4 + issue 04
4  fix(ux): close four dead ends and fix modal safe areas       ← QW5 + QW6 + QW3
5  fix(calendar): mark today, label the legend, tint only
   observed days                                                ← QW7 + M5
6  feat(home): three-day ledger, primacy follows trial state     ← M1 + M2 + M3
```

Commits 1–4 are colour, strings and additive props — shippable in any order and
each safe to revert alone. Commit 5 carries the only unit-test changes. Commit 6
is the design direction proper and should not be bundled with anything else.

M4, M6 and M7 come after, as their own commits.

---

## 5 · Manual QA checklist

The report's Phase 4 brief asks for desktop and mobile. This is a native iOS app
with `supportsTablet: false` and no web target in practice, so "desktop" is
substituted with **large-device layout** and **web preview** is skipped.

**Devices**
- [ ] iPhone 12 mini (375 × 812) — the dogfood device. Home must fit 캘린더 and 설정 above the fold with an active trial.
- [ ] iPhone 16 Pro Max or similar — confirm the 52 px hero and the tally band do not look stranded.
- [ ] Both with and without a home indicator (modal bottom insets, QW6).

**Accessibility**
- [ ] VoiceOver over every screen. Every calendar day cell must announce its tint and dot (QW7).
- [ ] Dynamic Type at the largest non-accessibility size, then at the largest accessibility size. Foods rows must reflow, not overrun (M6).
- [ ] Every status must be identifiable without colour — icon plus label, on the calendar too.
- [ ] Re-measure the changed tokens with a contrast checker on a screenshot, not just from the hex.

**States**
- [ ] Cold start on a wiped install — no blank frame, and no "검색 결과가 없어요" before data lands.
- [ ] Cold start with `EXPO_PUBLIC_DEMO=1`.
- [ ] Force a migration failure (rename a file under `drizzle/` on a scratch build) — the error screen must have a retry and an inset.
- [ ] Deep link to `/food/[id]` with a bad id — must not be a blank screen.
- [ ] Deep link to `/log-reaction` with a bad `foodId` — already handled; confirm it still is.
- [ ] Every empty state: no foods, no history, no calendar events, zero counts.
- [ ] Disabled 반응 저장 — the reason must be visible at the button.

**Core flows**
- [ ] Start a trial from the picker. Start one from food detail. Confirm both land where the copy says.
- [ ] Start a trial while another is running → the blocked alert. Read both button labels aloud and check that 취소 is not the destructive one (QW4).
- [ ] Start a trial while the previous window has **elapsed** → confirm the implicit-safe autoclose is now disclosed *before* the tap (issue 04).
- [ ] Check in. Check in twice the same day. Leave the app open across midnight and check in again (M2).
- [ ] Let a window elapse, tap the 09:00 window-end notification from a **backgrounded but already-focused** Home → 안전으로 표시 must be present (issue 03, M2).
- [ ] Confirm safe → Home must acknowledge it (issue 05).
- [ ] Log a reaction on an active trial. Log one on an already-safe food (delayed reaction) → the confirmation must be accurate (QW4).
- [ ] Cancel a trial → confirm the food reverts and the calendar shows nothing for it.
- [ ] Add a custom food from the search empty state (QW5), in both browse and pick mode.

**App-specific critical**
- [ ] Export the PDF and read it — it is the artefact a parent hands to an allergist. Confirm no record in it was created by an unchosen severity default or an undisclosed autoclose.
- [ ] Export the JSON and confirm the label no longer says 백업.
- [ ] 사용 안내 다시 보기 while a trial is running — confirm there is now a way back that does not require re-committing `welcomedAt`.
- [ ] Notification permission denied → the whole app must still work, unchanged.

---

## Open question before implementation

`design-audit/` is currently untracked. Say whether it should be committed as a
design record, added to `.gitignore`, or kept local like
`.superpowers/rebuild-plan-2026-07-16.md`.
