# CLAUDE.md — Allergy Tracker

## Project
Baby food-allergy tracker. Native iOS via **Expo + React Native + TypeScript**,
**on-device only** (expo-sqlite + Drizzle). No server, no accounts, no network.
v1 (MammaCare: Capacitor + FastAPI + Postgres) is dead — archived at tag
`archive/v1-capacitor`. Do not resurrect anything from it (see spec §11).
Spec: docs/design-spec.md (public). Build plan: .superpowers/rebuild-plan-2026-07-16.md (local only — do not commit).

## Rules
- Status is derived (src/domain/status.ts), never stored. One active trial at
  a time. Trial transitions go through src/trialLifecycle; an elapsed Trial
  auto-closes safe on the next start only with Observation coverage, otherwise
  it closes cancelled.
- Observation eligibility, idempotency, coverage, and day projection live in
  src/observation. Screens use src/ui/useFreshNow for time-aware state and
  src/foodCatalogue for catalogue filtering/grouping rather than rebuilding
  those rules.
- Every user-visible string via i18next (KO ONLY — Korean-only app, owner decision 2026-07-17; no locale switching, dates pinned ko-KR). Colors only from
  src/ui/tokens.ts. Icon + label always accompany status colors.
- Gates before any commit: `npx tsc --noEmit` && `npx jest`.
- DB changes = edit src/db/schema.ts + `npx drizzle-kit generate` + commit the
  new files under drizzle/. Never edit generated migration SQL by hand.
- Local Postgres `mammacare_db` is v1 leftover; safe to drop, not used.

## Run
npx expo start            # dev server (Expo Go has notification limits)
npx expo run:ios          # dev build on iOS simulator — use this for smoke
npx jest                  # unit tests

## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default canonical labels. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses the single-context domain documentation layout. See `docs/agents/domain.md`.
