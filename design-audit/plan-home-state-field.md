# Implementation plan — Home state field (Direction B′)

**Date:** 2026-07-28
**Status:** design approved by owner (mockup round 2, `mockup-directions-2.html` rack 1)
**Companion:** `mockup-directions.html` (round 1) · `mockup-directions-2.html` (round 2, the approved rack)
**Supersedes nothing.** This is additive to `plan.md`; M6 (Dynamic Type) and M7
(status ribbon) from that document remain open and untouched.

**Constraints honoured throughout:** no new dependencies, no schema change, no
generated-migration change, nothing in `src/db/`, `src/services/` or `drizzle/`.
One new pure module in `src/domain/` with its own test file. `deriveStatus` is
**not** modified.

**Gates before every commit** (project rule, `CLAUDE.md`):
`npx tsc --noEmit && npx jest`

---

## 0 · What this is

Home's hero becomes a **state field** — a tinted region occupying the top ~404pt
of the screen whose colour is the app's current state, with the food name at
76pt sitting on it.

The design question that produced this ("would it be yellow the whole time?")
exposed a defect, and the defect is the reason the direction is worth building:

> **Home has only two branches today.** `app/index.tsx:131` renders the
> active-trial hero, and `app/index.tsx:181-195` renders everything else.
> Red never appears. Logging a reaction ends the trial immediately
> (`outcome='reacted'`), so Home falls to the second branch and prints
> `home.idleTitle` — **"{{count}}가지 안전" in `colors.green`**
> (`app/index.tsx:183`). A parent who has just recorded that their baby
> reacted to 달걀 is shown a green screen counting safe foods.

So the field is not a decoration bolted onto a working screen. It is the
visible form of a state machine the app never finished.

---

## 1 · The four states

Derived, never stored — same discipline as `deriveStatus`.

| State | Field | When | Primary control |
|---|---|---|---|
| `observing` | amber | a trial is active and its window has **not** elapsed | 오늘 이상 없음 (filled) |
| `confirm` | amber | a trial is active and its window **has** elapsed | 안전으로 표시 (filled) |
| `safe` | green | no active trial; latest closed trial outcome is `safe` | 새 재료 시작하기 (filled) |
| `reacted` | red | no active trial; latest closed trial outcome is `reacted` | **none filled** — see §1.1 |
| `empty` | paper | no non-cancelled trial exists at all | 새 재료 시작하기 (filled) |

`observing` and `confirm` share the amber field and differ only in copy and
which control is filled — this preserves exactly the primacy rule M1 shipped
(`app/index.tsx:164-179`). They are separate states in the type because the
copy differs; they are one colour because the situation is one situation.

"Latest closed trial" means: across all foods, the non-cancelled trial with the
greatest `endedAt`. Cancelled trials are skipped, consistent with
`latestTrial()` in `src/domain/status.ts:25`.

### 1.1 The reacted state has no filled button

Deliberate. After a reaction is recorded the two controls are 기록 보기 and
새 재료 시작하기, both outlined. Pushing a parent toward the next food seconds
after they logged facial swelling is the wrong instinct, and a filled persimmon
button is a push. The state is reachable and exit-able; it just does not urge.

---

## 2 · Two corrections to the mockup

The approved mock makes two promises the platform will not keep. Both are
fixed here, and the mock is wrong where it disagrees with this section.

### C1 — The progress bar cannot ride the top edge

`mockup-directions-2.html` draws the window segments at `top:0`, full width,
`z-index:6` — i.e. **over the notch**. On an iPhone 12 mini the notch reaches
y=0, so the middle third of that bar would be behind hardware.

**Fix:** the segments move to the **bottom edge of the field**, full width,
where tint meets paper. This is strictly better: that seam is only 1.34:1
against paper (§3) and would otherwise be nearly invisible, so the segments
become both the progress indicator and the boundary that makes the field read
as a field.

### C2 — Coloured text on tint fails AA

The mock puts `amberText` on the amber field and `green` on the green field.
Measured against the approved tints those are **4.12:1** and **4.19:1** — under
the 4.5 floor that commit `f10cbea` raised the whole app to. Against the
*deeper* fields chosen in §3 they are worse still.

**Fix:** **the field carries the colour; `ink` carries the text.** No coloured
string is ever set on a field. This satisfies AA with enormous margin (§3) and
is the better design regardless — the tint has already said "amber", and
repeating it in the type is redundant. The rule
"colour is never the sole carrier of meaning" (`docs/design-spec.md` §3) still
holds, because the state word (관찰 중 / 안전 확인됨 / 반응 기록됨) is literal
text.

---

## 3 · New tokens

Three field colours, one step deeper than the existing tints (owner-selected
2026-07-28). The **existing tints are not modified** — they keep their jobs on
chips, dots and calendar cells. These are additive.

| Token | Value | `ink` on it | vs `paper` |
|---|---|---|---|
| `fieldAmber` | `#EBD5A8` | **10.79:1** | 1.34 |
| `fieldGreen` | `#CBE3CB` | **11.36:1** | 1.28 |
| `fieldRed` | `#EDCBC0` | **10.26:1** | 1.41 |
| `inkOnField` | `#585245` | — | ≥5.13:1 on all three fields |

`inkOnField` is the secondary line (day count, symptom summary). Verified:
5.40 on amber, 5.68 on green, 5.13 on red. `inkSecondary` (`#6E675A`) must not
be used on a field — it measures **3.99 on `fieldRed`**.

> **Corrected 2026-07-28.** This table first specified `inkOnField` as
> `#655F52`, measured against the *original tints* rather than the deeper
> fields actually chosen. On the fields it is 4.41 / 4.65 / 4.20 — failing on
> two of three. The assertions added in step 3 caught it before any UI
> consumed the token, which is the entire reason `tokens.test.ts` exists.

Marks on the field (the progress segments) use the existing `amber`/`green`/
`red` mark values, which need only 3:1 as non-text UI and clear it.

---

## 4 · Files

| File | Change |
|---|---|
| **new** `src/domain/homeState.ts` | `deriveHomeState(foods, now)` — pure, returns the discriminated union of §1 |
| **new** `src/domain/homeState.test.ts` | every state, every boundary (§6) |
| **new** `src/ui/StateField.tsx` | the tinted region: eyebrow, name, state word, sub-line, segments |
| `src/ui/tokens.ts` | the four tokens of §3 |
| `src/ui/tokens.test.ts` | assert the four new ratios |
| `app/index.tsx` | `Dashboard` renders `StateField` off `deriveHomeState`; the two-branch hero (`:131-195`) is replaced |
| `src/i18n/ko.json` | new state strings (§5) |

`app/_layout.tsx` is **not** touched — `contentStyle` sets `paper` at the Stack
level and Home overrides its own container, so no other screen is affected.

---

## 5 · Strings

New keys under `home.`:

```
state.observing   관찰 중
state.confirm     관찰 완료
state.safe        안전 확인됨
state.reacted     반응 기록됨
sub.observing     {{total}}일 중 {{day}}일째 · {{date}} 확인
sub.confirm       {{total}}일 관찰이 끝났어요 — 반응이 없었다면 안전으로 표시하세요
sub.safe          {{total}}일 관찰 · 반응 없음 · 이제 {{count}}가지 안전
sub.reacted       {{day}}일째 · {{severity}} · {{symptoms}}
```

`home.idleTitle` and `home.lastConfirmed` become unused once the `safe` state
lands and are deleted in the same commit — they are the strings that produce
the green-after-reaction defect.

---

## 6 · Tests

`src/domain/homeState.test.ts`, unit, no DB:

- each of the five states from a representative fixture
- `observing` → `confirm` at exactly `startedAt + windowDays` (boundary, both sides)
- a cancelled trial never selects a state
- latest-closed picks by `endedAt`, not `startedAt` — a trial started earlier
  but ended later wins
- **the defect test:** foods whose latest closed trial is `reacted` derive
  `reacted`, never `safe`. This test **must be proven to fail** against the
  current two-branch logic before the fix is applied (project rule, `CLAUDE.md`
  — regression tests must genuinely discriminate).

`src/ui/tokens.test.ts` gains the four contrast assertions of §3, matching the
existing style in that file.

---

## 7 · Commit sequence

One step at a time, each verified and committed before the next begins
(project rule, `CLAUDE.md` — never bundle steps).

1. **`test(home): prove Home reports 안전 after a reaction`**
   `homeState.test.ts` + `homeState.ts` returning the *current* two-branch
   behaviour. The defect test fails. Commit red, deliberately — this is the
   discriminating evidence.
   → verify: `npx jest` shows exactly that one failure.
2. **`fix(home): derive four states, so a reaction stops reading as safe`**
   `deriveHomeState` gains the `reacted` and `safe` branches. No visual change
   yet; `app/index.tsx` consumes it and renders the existing hero.
   → verify: full suite green; the defect test now passes.
3. **`feat(ui): field tokens, verified to AA on ink`**
   `tokens.ts` + `tokens.test.ts`. Nothing consumes them yet.
   → verify: `npx jest src/ui/tokens.test.ts`.
4. **`feat(home): the state field`**
   `StateField.tsx` + `app/index.tsx` render. The visual change lands here,
   on top of logic that is already tested and shipped.
   → verify: suite green, then §8 on device.
5. **`feat(home): cross-fade the field on state change`**
   `react-native-reanimated` (already installed), `interpolateColor` +
   `withTiming` 320ms. Separate commit so step 4 can be assessed static.
   → verify: suite green, then the transition cases in §8.

Steps 1–2 are shippable on their own and fix a real defect. If the visual
direction is abandoned after step 2, nothing is wasted.

---

## 8 · Manual QA checklist

On the dogfood device (iPhone 12 mini, `EXPO_PUBLIC_DEMO=1`):

- [ ] All four fields render edge-to-edge under the status bar, with no paper
      gap at the top and no colour bleeding into the notch.
- [ ] Segments sit exactly on the tint/paper seam and do not touch the notch.
- [ ] Day-2-of-3 shows two segments filled, three total.
- [ ] Log a reaction → Home is **red**, names the food, and shows no filled
      button. This is the defect; confirm it is gone.
- [ ] Mark safe → Home is **green** and names the food that just passed.
- [ ] Start the next food from green → Home returns to amber.
- [ ] Let a window elapse → amber holds, copy switches to 관찰 완료, 안전으로
      표시 takes the fill.
- [ ] Fresh install (no trials) → paper, no field.
- [ ] Every string on a field is `ink` or `inkOnField` — no amber/green/red text
      on any field. Check in daylight.
- [ ] The 09:00 window-end notification still delivers its action (the
      `AppState` listener at `app/index.tsx:80` must survive the rewrite).
- [ ] VoiceOver reads the state word; the field is not announced as a control.

---

## 9 · Open question — staleness

`safe` and `reacted` persist until the next trial starts. A parent who stops
using the app for a month and reopens it lands on a red field from a month ago.

**Decision: ship it as specified, do not build a decay rule.** The state is
accurate — that *is* the last thing that happened — and a time-based fallback
is speculative until someone actually reports it. Flagged here rather than
solved. If it does become a problem the fix is one clause in
`deriveHomeState`, which is why the function is pure and tested.

---

## 10 · Explicitly out of scope

| | Why |
|---|---|
| **Dark mode** | `docs/design-spec.md` §11; `app.json` pins `userInterfaceStyle: "light"`. |
| **Any new dependency** | `reanimated` and `expo-font` are already installed; nothing else is needed. |
| **A custom typeface** | Round 1 direction A. Owner declined the serif; system sans throughout. |
| **Changing `deriveStatus`** | Food status is unrelated to Home's state. It is not touched. |
| **Changing the existing tints** | They keep their jobs on chips, dots and calendar cells. §3 is additive. |
| **M6 / M7 from `plan.md`** | Still open, still deferred. Nothing here depends on them. |
