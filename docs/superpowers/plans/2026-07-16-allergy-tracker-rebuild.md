# Allergy Tracker — Ground-Up Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tear down MammaCare v1 and build **Allergy Tracker** — a native-iOS, on-device-only baby food-allergy tracker (Expo + React Native + TypeScript + expo-sqlite/Drizzle).

**Architecture:** Five stack-navigated screens (no tabs) over a local SQLite DB. All allergy status is **derived at read time** by pure functions (`deriveStatus`), never stored. Trials are the only state machine: start → (reaction | explicit safe | implicit safe on next start | cancel). Local notifications and PDF/JSON export are thin services over pure, unit-tested builders.

**Tech Stack:** Expo SDK (latest, managed workflow) · React Native · TypeScript · Expo Router · expo-sqlite + Drizzle ORM (+ drizzle-kit migrations) · expo-notifications · expo-print / expo-sharing / expo-file-system · i18next + react-i18next + expo-localization · @react-native-community/datetimepicker · expo-crypto · Jest (jest-expo).

**Spec:** `docs/superpowers/specs/2026-07-16-mammacare-v2-rebuild-design.md` (owner-approved).

**Plan deviations from spec (deliberate, small):**
1. `deriveStatus(trials)` takes only trials — logging a reaction sets `trial.outcome = 'reacted'` at write time, so reactions never need to be re-read for status. `now` is only needed by `isWindowElapsed`/`decideStartTrial`.
2. Settings (default window days, locale override) live as columns on the `baby` row instead of a separate table — single-baby v1, one less table.
3. Catalog is big-9 **groups** expanded to concrete foods (e.g. tree nuts → almond/walnut/cashew/pine nut) plus Korean staples; 56 seed foods total, 19 flagged high-risk.

## Global Constraints

- Product name **Allergy Tracker**; iOS home-screen label **"Allergies"**; slug `allergy-tracker`.
- **No tabs. No logo art. No mascot. Light mode only.** System font. Colors only from `src/ui/tokens.ts` — no inline hex in screens.
- Color never carries meaning alone — every status shows icon + label.
- **Every user-visible string goes through i18next** (EN default + KO). No hardcoded copy in components.
- Status is **derived, never stored**. One active trial at a time app-wide.
- On-device only: no network calls anywhere, no analytics, no accounts.
- TypeScript strict (template default). Verify gates: `npx tsc --noEmit` and `npx jest` must pass before every commit.
- Commit messages: professional English, conventional-commit style.
- Do not resurrect anything in spec §11 (server, auth, community, AI, Capacitor…).

---

### Task 1: Archive v1 and tear down to a clean root

**Files:**
- Delete (tracked): `backend/`, `frontend/`, `docs/screenshots/`, `.github/`, `requirements.txt`, `ROADMAP.md`, `SETUP.md`, `DESIGN_SYSTEM.md`, `README.md`
- Delete (untracked): `venv/`, `.serena/`, `.tokensave/`, `pre_uq_drop_backup.dump`, `.DS_Store`
- Keep: `LICENSE`, `docs/superpowers/`, `.claude/`
- Create: `README.md` (stub), rewrite `.gitignore`, rewrite `CLAUDE.md` (local, gitignored — NOT committed)

**Interfaces:**
- Consumes: nothing.
- Produces: an empty repo root ready for `create-expo-app` (Task 2). Tag `archive/v1-capacitor` preserves all of v1.

- [ ] **Step 1: Tag and push the archive point**

```bash
cd /Users/michaelju/Workspace/Projects/mammacare-ios
git tag archive/v1-capacitor
git push origin archive/v1-capacitor
```
Expected: tag visible via `git tag -l 'archive/*'` and on GitHub.

- [ ] **Step 2: Remove v1 from the index and working tree**

```bash
git rm -r -q backend frontend docs/screenshots .github requirements.txt ROADMAP.md SETUP.md DESIGN_SYSTEM.md README.md
rm -rf venv .serena .tokensave pre_uq_drop_backup.dump .DS_Store
```

- [ ] **Step 3: Write the new `.gitignore`** (full replacement)

```gitignore
# deps / build
node_modules/
.expo/
dist/
web-build/
ios/
android/
*.log

# env & secrets
.env
.env.*

# OS / editor
.DS_Store

# local-only docs & config
CLAUDE.md
docs/agents/
.claude/settings.local.json
```
Note: `drizzle/` (generated migrations) is **committed**, never ignored.

- [ ] **Step 4: Write the stub `README.md`**

```markdown
# Allergy Tracker

Baby food-allergy tracker — introduce one food at a time, watch the trial
window, and the food list becomes a traffic light. Native iOS (Expo/React
Native), 100% on-device.

**Rebuild in progress.** v1 (MammaCare) is archived at tag
`archive/v1-capacitor`. Design spec:
`docs/superpowers/specs/2026-07-16-mammacare-v2-rebuild-design.md`.
```

- [ ] **Step 5: Rewrite local `CLAUDE.md`** (on disk only — it is gitignored; do not `git add`)

```markdown
# CLAUDE.md — Allergy Tracker (local, not published)

## Project
Baby food-allergy tracker. Native iOS via **Expo + React Native + TypeScript**,
**on-device only** (expo-sqlite + Drizzle). No server, no accounts, no network.
v1 (MammaCare: Capacitor + FastAPI + Postgres) is dead — archived at tag
`archive/v1-capacitor`. Do not resurrect anything from it (see spec §11).
Spec: docs/superpowers/specs/2026-07-16-mammacare-v2-rebuild-design.md
Plan: docs/superpowers/plans/2026-07-16-allergy-tracker-rebuild.md

## Rules
- Status is derived (src/domain/status.ts), never stored. One active trial at
  a time. Trial ends only by explicit outcome (or implicit-safe on next start).
- Every user-visible string via i18next (EN + KO). Colors only from
  src/ui/tokens.ts. Icon + label always accompany status colors.
- Gates before any commit: `npx tsc --noEmit` && `npx jest`.
- DB changes = edit src/db/schema.ts + `npx drizzle-kit generate` + commit the
  new files under drizzle/. Never edit generated migration SQL by hand.
- Local Postgres `mammacare_db` is v1 leftover; safe to drop, not used.

## Run
npx expo start            # dev server (Expo Go has notification limits)
npx expo run:ios          # dev build on iOS simulator — use this for smoke
npx jest                  # unit tests
```

- [ ] **Step 6: Verify the root is clean, then commit and push**

```bash
git status -sb
ls -a
```
Expected: only `LICENSE`, `README.md`, `.gitignore`, `CLAUDE.md`, `docs/`, `.claude/`, `.git/` remain.

```bash
git add -A
git commit -m "chore!: tear down v1 app; archive preserved at tag archive/v1-capacitor"
git push origin main
```

---

### Task 2: Scaffold the Expo app + toolchain

**Files:**
- Create: entire Expo template at repo root (`app/`, `package.json`, `tsconfig.json`, `app.json`, `assets/`, …)
- Modify: `app.json`, `package.json` (scripts + jest config)
- Create: `src/sanity.test.ts`

**Interfaces:**
- Consumes: clean root from Task 1.
- Produces: running Expo Router app; `npx jest`, `npx tsc --noEmit` gates working; all dependencies installed for every later task.

- [ ] **Step 1: Scaffold via a scratch dir (create-expo-app refuses non-empty dirs)**

```bash
cd /Users/michaelju/Workspace/Projects/mammacare-ios
npx create-expo-app@latest _scaffold --template default
rsync -a --exclude '.git' --exclude 'README.md' _scaffold/ ./
rm -rf _scaffold
npm run reset-project   # moves example screens out; answer "n" to keeping app-example, or delete it after
rm -rf app-example
```

- [ ] **Step 2: Configure identity in `app.json`** (edit these keys inside `expo`)

```json
{
  "expo": {
    "name": "Allergies",
    "slug": "allergy-tracker",
    "scheme": "allergytracker",
    "ios": { "bundleIdentifier": "com.mhju.allergytracker", "supportsTablet": false },
    "userInterfaceStyle": "light"
  }
}
```
Note: Expo `name` becomes the home-screen label — "Allergies" avoids iOS truncation. The marketing name "Allergy Tracker" appears in-app/README only.

- [ ] **Step 3: Install dependencies**

```bash
npx expo install expo-sqlite expo-notifications expo-print expo-sharing expo-file-system expo-localization expo-crypto @react-native-community/datetimepicker
npm install drizzle-orm i18next react-i18next
npm install -D drizzle-kit babel-plugin-inline-import jest jest-expo @types/jest
```

- [ ] **Step 4: Wire jest + scripts in `package.json`**

```json
{
  "scripts": {
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "jest": {
    "preset": "jest-expo",
    "testMatch": ["**/*.test.ts", "**/*.test.tsx"]
  }
}
```

- [ ] **Step 5: Sanity test — `src/sanity.test.ts`**

```ts
test('jest runs TypeScript', () => {
  const n: number = 1 + 1;
  expect(n).toBe(2);
});
```

- [ ] **Step 6: Verify gates**

```bash
npx tsc --noEmit        # expected: no output, exit 0
npx jest                # expected: 1 passed
npx expo start --ios    # expected: app boots to the blank index screen; Ctrl+C after
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Expo Router app with toolchain (jest, drizzle deps, i18n deps)"
```

---

### Task 3: Drizzle schema, client, and migrations

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `metro.config.js`
- Modify: `babel.config.js` (create if the template has none)
- Generate: `drizzle/` (committed)

**Interfaces:**
- Consumes: Task 2 deps.
- Produces:
  - `db` — Drizzle instance (`src/db/client.ts`), change-listener enabled for `useLiveQuery`.
  - Tables `baby`, `food`, `trial`, `reaction` and row types `Baby`, `Food`, `Trial`, `Reaction` (`$inferSelect`).
  - `migrations` importable from `drizzle/migrations` for `useMigrations` (Task 8).

- [ ] **Step 1: `src/db/schema.ts`**

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const baby = sqliteTable('baby', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  birthdate: integer('birthdate', { mode: 'timestamp' }).notNull(),
  defaultWindowDays: integer('default_window_days').notNull().default(3),
  locale: text('locale'), // null = follow system; 'en' | 'ko'
});

export const food = sqliteTable('food', {
  id: text('id').primaryKey(), // catalog slug (e.g. 'egg') or uuid for custom
  name: text('name').notNull(), // i18n key ('foodName.egg') or raw custom text
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  allergenGroup: text('allergen_group'), // 'egg'|'milk'|...|null; non-null = high-risk badge
});

export const trial = sqliteTable('trial', {
  id: text('id').primaryKey(),
  foodId: text('food_id').notNull().references(() => food.id),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  windowDays: integer('window_days').notNull(),
  outcome: text('outcome', { enum: ['safe', 'reacted', 'cancelled'] }), // null = active
  endedAt: integer('ended_at', { mode: 'timestamp' }),
});

export const reaction = sqliteTable('reaction', {
  id: text('id').primaryKey(),
  trialId: text('trial_id').notNull().references(() => trial.id),
  symptoms: text('symptoms', { mode: 'json' }).$type<string[]>().notNull(),
  severity: text('severity', { enum: ['mild', 'moderate', 'severe'] }).notNull(),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
  note: text('note'),
});

export type Baby = typeof baby.$inferSelect;
export type Food = typeof food.$inferSelect;
export type Trial = typeof trial.$inferSelect;
export type Reaction = typeof reaction.$inferSelect;
```

- [ ] **Step 2: `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('allergy-tracker.db', { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
```

- [ ] **Step 3: `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
```

- [ ] **Step 4: Metro + Babel config for bundled `.sql` migrations**

`metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
```

`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
```

- [ ] **Step 5: Generate migrations and verify**

```bash
npx drizzle-kit generate
```
Expected: `drizzle/0000_*.sql` + `drizzle/migrations.js` + `drizzle/meta/` created, containing `CREATE TABLE` for baby/food/trial/reaction.

```bash
npx tsc --noEmit && npx jest
```
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): Drizzle schema (baby, food, trial, reaction) with generated SQLite migrations"
```

---

### Task 4: Domain core — status derivation + start-trial decision (TDD)

**Files:**
- Create: `src/domain/status.ts`
- Test: `src/domain/status.test.ts`

**Interfaces:**
- Consumes: nothing (pure; independent of DB — takes structural `TrialLike`).
- Produces (exact, used by Tasks 5–13):
  - `MS_PER_DAY: number`
  - `type TrialLike = { id: string; startedAt: Date; windowDays: number; outcome: 'safe' | 'reacted' | 'cancelled' | null }`
  - `type FoodStatus = 'untried' | 'testing' | 'reacted' | 'safe'`
  - `windowEnd(t: Pick<TrialLike, 'startedAt' | 'windowDays'>): Date`
  - `isWindowElapsed(t: TrialLike, now: Date): boolean`
  - `latestTrial<T extends TrialLike>(trials: T[]): T | undefined` (ignores cancelled; generic so DB `Trial` rows come back as `Trial`)
  - `deriveStatus(trials: TrialLike[]): FoodStatus`
  - `type StartDecision = { allowed: true; autoCloseSafeTrialId: string | null } | { allowed: false; reason: 'trial_in_progress' }`
  - `decideStartTrial(activeTrial: TrialLike | undefined, now: Date): StartDecision`

- [ ] **Step 1: Write the failing tests — `src/domain/status.test.ts`**

```ts
import {
  deriveStatus, decideStartTrial, isWindowElapsed, latestTrial, windowEnd,
  MS_PER_DAY, TrialLike,
} from './status';

const D = (s: string) => new Date(s);
let n = 0;
const mk = (over: Partial<TrialLike>): TrialLike => ({
  id: `t${n++}`, startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3, outcome: null, ...over,
});

describe('deriveStatus', () => {
  test('no trials → untried', () => {
    expect(deriveStatus([])).toBe('untried');
  });
  test('active trial → testing (even past window — no auto-flip)', () => {
    expect(deriveStatus([mk({})])).toBe('testing');
  });
  test('latest outcome safe → safe', () => {
    expect(deriveStatus([mk({ outcome: 'safe' })])).toBe('safe');
  });
  test('latest outcome reacted → reacted', () => {
    expect(deriveStatus([mk({ outcome: 'reacted' })])).toBe('reacted');
  });
  test('retest wins: reacted then later safe → safe', () => {
    expect(deriveStatus([
      mk({ startedAt: D('2026-07-01T10:00:00Z'), outcome: 'reacted' }),
      mk({ startedAt: D('2026-07-10T10:00:00Z'), outcome: 'safe' }),
    ])).toBe('safe');
  });
  test('cancelled trials are invisible: safe then cancelled → safe', () => {
    expect(deriveStatus([
      mk({ startedAt: D('2026-07-01T10:00:00Z'), outcome: 'safe' }),
      mk({ startedAt: D('2026-07-10T10:00:00Z'), outcome: 'cancelled' }),
    ])).toBe('safe');
  });
  test('only cancelled trials → untried', () => {
    expect(deriveStatus([mk({ outcome: 'cancelled' })])).toBe('untried');
  });
});

describe('window math', () => {
  const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
  test('windowEnd = startedAt + windowDays', () => {
    expect(windowEnd(t).getTime()).toBe(D('2026-07-01T10:00:00Z').getTime() + 3 * MS_PER_DAY);
  });
  test('not elapsed 1ms before boundary', () => {
    expect(isWindowElapsed(t, new Date(windowEnd(t).getTime() - 1))).toBe(false);
  });
  test('elapsed exactly at boundary', () => {
    expect(isWindowElapsed(t, windowEnd(t))).toBe(true);
  });
});

describe('latestTrial', () => {
  test('picks most recent non-cancelled by startedAt', () => {
    const a = mk({ startedAt: D('2026-07-01T00:00:00Z'), outcome: 'safe' });
    const b = mk({ startedAt: D('2026-07-05T00:00:00Z'), outcome: 'cancelled' });
    expect(latestTrial([a, b])?.id).toBe(a.id);
  });
});

describe('decideStartTrial', () => {
  test('no active trial → allowed, nothing to close', () => {
    expect(decideStartTrial(undefined, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoCloseSafeTrialId: null });
  });
  test('active trial, window elapsed → allowed with implicit-safe close', () => {
    const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(decideStartTrial(t, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoCloseSafeTrialId: t.id });
  });
  test('active trial inside window → blocked', () => {
    const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(decideStartTrial(t, D('2026-07-03T10:00:00Z')))
      .toEqual({ allowed: false, reason: 'trial_in_progress' });
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx jest src/domain/status.test.ts
```
Expected: FAIL — cannot find module './status'.

- [ ] **Step 3: Implement — `src/domain/status.ts`**

```ts
export const MS_PER_DAY = 86_400_000;

export type TrialLike = {
  id: string;
  startedAt: Date;
  windowDays: number;
  outcome: 'safe' | 'reacted' | 'cancelled' | null;
};

export type FoodStatus = 'untried' | 'testing' | 'reacted' | 'safe';

export function windowEnd(t: Pick<TrialLike, 'startedAt' | 'windowDays'>): Date {
  return new Date(t.startedAt.getTime() + t.windowDays * MS_PER_DAY);
}

export function isWindowElapsed(t: TrialLike, now: Date): boolean {
  return now.getTime() >= windowEnd(t).getTime();
}

export function latestTrial<T extends TrialLike>(trials: T[]): T | undefined {
  return [...trials]
    .filter((t) => t.outcome !== 'cancelled')
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
}

export function deriveStatus(trials: TrialLike[]): FoodStatus {
  const latest = latestTrial(trials);
  if (!latest) return 'untried';
  if (latest.outcome === null) return 'testing';
  return latest.outcome; // 'safe' | 'reacted'
}

export type StartDecision =
  | { allowed: true; autoCloseSafeTrialId: string | null }
  | { allowed: false; reason: 'trial_in_progress' };

// Invariant: an active trial (outcome null) never has reactions —
// logging a reaction immediately sets outcome='reacted' (Task 6).
export function decideStartTrial(activeTrial: TrialLike | undefined, now: Date): StartDecision {
  if (!activeTrial) return { allowed: true, autoCloseSafeTrialId: null };
  if (isWindowElapsed(activeTrial, now)) {
    return { allowed: true, autoCloseSafeTrialId: activeTrial.id };
  }
  return { allowed: false, reason: 'trial_in_progress' };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx jest src/domain/status.test.ts && npx tsc --noEmit
```
Expected: all tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/domain/status.ts src/domain/status.test.ts
git commit -m "feat(domain): pure status derivation and start-trial decision with full unit coverage"
```

---

### Task 5: Notification schedule computation (TDD) + notify service

**Files:**
- Create: `src/domain/notifications.ts`, `src/services/notify.ts`
- Test: `src/domain/notifications.test.ts`

**Interfaces:**
- Consumes: `MS_PER_DAY`, `windowEnd` from `src/domain/status`.
- Produces:
  - `type PlannedNotification = { kind: 'checkin'; day: number; fireAt: Date } | { kind: 'windowEnd'; fireAt: Date }`
  - `computeTrialNotifications(startedAt: Date, windowDays: number): PlannedNotification[]`
  - Service (`src/services/notify.ts`): `ensurePermission(): Promise<boolean>`, `scheduleTrialNotifications(trialId: string, foodLabel: string, planned: PlannedNotification[], now: Date): Promise<void>`, `cancelTrialNotifications(trialId: string): Promise<void>`, `initNotificationHandler(): void`.

- [ ] **Step 1: Write the failing tests — `src/domain/notifications.test.ts`**

Check-in rule: one per day at **09:00 local** for days 2..windowDays (day 1 is feeding day); window-end prompt at the exact window boundary.

```ts
import { computeTrialNotifications } from './notifications';

const local = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0, 0);

describe('computeTrialNotifications', () => {
  test('3-day trial started mid-morning → check-ins day 2 & 3 at 09:00, windowEnd at boundary', () => {
    const start = local(2026, 7, 1, 10); // Jul 1 10:00 local
    const out = computeTrialNotifications(start, 3);
    expect(out).toEqual([
      { kind: 'checkin', day: 2, fireAt: local(2026, 7, 2, 9) },
      { kind: 'checkin', day: 3, fireAt: local(2026, 7, 3, 9) },
      { kind: 'windowEnd', fireAt: local(2026, 7, 4, 10) },
    ]);
  });
  test('late-night start still lands check-in next morning 09:00', () => {
    const start = local(2026, 7, 1, 23, 30);
    const out = computeTrialNotifications(start, 2);
    expect(out).toEqual([
      { kind: 'checkin', day: 2, fireAt: local(2026, 7, 2, 9) },
      { kind: 'windowEnd', fireAt: local(2026, 7, 3, 23, 30) },
    ]);
  });
  test('1-day window → only the windowEnd prompt', () => {
    const start = local(2026, 7, 1, 10);
    expect(computeTrialNotifications(start, 1)).toEqual([
      { kind: 'windowEnd', fireAt: local(2026, 7, 2, 10) },
    ]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

```bash
npx jest src/domain/notifications.test.ts
```

- [ ] **Step 3: Implement — `src/domain/notifications.ts`**

```ts
import { MS_PER_DAY, windowEnd } from './status';

export type PlannedNotification =
  | { kind: 'checkin'; day: number; fireAt: Date }
  | { kind: 'windowEnd'; fireAt: Date };

export function computeTrialNotifications(startedAt: Date, windowDays: number): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  for (let day = 2; day <= windowDays; day++) {
    const fireAt = new Date(startedAt.getTime() + (day - 1) * MS_PER_DAY);
    fireAt.setHours(9, 0, 0, 0); // 09:00 local on that day
    out.push({ kind: 'checkin', day, fireAt });
  }
  out.push({ kind: 'windowEnd', fireAt: windowEnd({ startedAt, windowDays }) });
  return out;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx jest src/domain/notifications.test.ts && npx tsc --noEmit
```

- [ ] **Step 5: Implement the thin service — `src/services/notify.ts`** (not unit-tested; verified on simulator in Task 14)

```ts
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import type { PlannedNotification } from '../domain/notifications';

export function initNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function content(p: PlannedNotification, foodLabel: string) {
  if (p.kind === 'checkin') {
    return {
      title: i18n.t('notif.checkinTitle', { day: p.day, food: foodLabel }),
      body: i18n.t('notif.checkinBody', { food: foodLabel }),
    };
  }
  return {
    title: i18n.t('notif.windowEndTitle', { food: foodLabel }),
    body: i18n.t('notif.windowEndBody', { food: foodLabel }),
  };
}

export async function scheduleTrialNotifications(
  trialId: string, foodLabel: string, planned: PlannedNotification[], now: Date,
): Promise<void> {
  for (const p of planned) {
    if (p.fireAt.getTime() <= now.getTime()) continue; // never schedule the past
    await Notifications.scheduleNotificationAsync({
      identifier: `${trialId}:${p.kind}${p.kind === 'checkin' ? p.day : ''}`,
      content: content(p, foodLabel),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.fireAt },
    });
  }
}

export async function cancelTrialNotifications(trialId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(`${trialId}:`))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
```
Note: `src/i18n` lands in Task 7 — the import will not typecheck until then. Acceptable ONLY if Tasks 5–7 are executed in order before running the gate… it is not. **Instead:** commit `notify.ts` in Task 7 Step 6 (after i18n exists). In this task commit only the pure domain files.

- [ ] **Step 6: Commit (pure parts only)**

```bash
git add src/domain/notifications.ts src/domain/notifications.test.ts
git commit -m "feat(domain): pure trial notification schedule computation"
```

---

### Task 6: Data mutations (trial lifecycle + foods + baby)

**Files:**
- Create: `src/data/mutations.ts`, `src/data/ids.ts`

**Interfaces:**
- Consumes: `db` (Task 3), `decideStartTrial`/`latestTrial` (Task 4), `computeTrialNotifications` (Task 5), notify service (finalized Task 7).
- Produces (exact — every screen calls these; none take `db`, they import it):
  - `newId(): string`
  - `getActiveTrial(): Promise<Trial | undefined>`
  - `startTrial(foodId: string, foodLabel: string, windowDays: number, now: Date): Promise<{ ok: true } | { ok: false; reason: 'trial_in_progress' }>`
  - `logReaction(foodId: string, input: { symptoms: string[]; severity: 'mild' | 'moderate' | 'severe'; occurredAt: Date; note: string | null }, now: Date): Promise<{ ok: true } | { ok: false; reason: 'no_trial' }>`
  - `confirmSafe(trialId: string, now: Date): Promise<{ ok: true } | { ok: false; reason: 'window_not_elapsed' }>`
  - `cancelTrial(trialId: string, now: Date): Promise<void>`
  - `addCustomFood(name: string): Promise<string>` (returns new food id)
  - `saveBaby(data: { name: string; birthdate: Date }): Promise<void>` (insert-or-update the single row)
  - `updateBabySettings(patch: Partial<{ name: string; birthdate: Date; defaultWindowDays: number; locale: string | null }>): Promise<void>`

The decision logic inside is already unit-tested (Task 4/5); these are thin, sequential DB writes — no unit tests, exercised by the simulator smoke (Task 14).

- [ ] **Step 1: `src/data/ids.ts`**

```ts
import * as Crypto from 'expo-crypto';
export const newId = (): string => Crypto.randomUUID();
```

- [ ] **Step 2: `src/data/mutations.ts`**

```ts
import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { baby, food, reaction, trial, type Trial } from '../db/schema';
import { decideStartTrial, isWindowElapsed, latestTrial } from '../domain/status';
import { computeTrialNotifications } from '../domain/notifications';
import { cancelTrialNotifications, scheduleTrialNotifications } from '../services/notify';
import { newId } from './ids';

export { newId };

export async function getActiveTrial(): Promise<Trial | undefined> {
  const rows = await db.select().from(trial).where(isNull(trial.outcome));
  return rows[0];
}

export async function startTrial(
  foodId: string, foodLabel: string, windowDays: number, now: Date,
): Promise<{ ok: true } | { ok: false; reason: 'trial_in_progress' }> {
  const active = await getActiveTrial();
  const decision = decideStartTrial(active, now);
  if (!decision.allowed) return { ok: false, reason: decision.reason };
  if (decision.autoCloseSafeTrialId) {
    await db.update(trial)
      .set({ outcome: 'safe', endedAt: now })
      .where(eq(trial.id, decision.autoCloseSafeTrialId));
    await cancelTrialNotifications(decision.autoCloseSafeTrialId);
  }
  const t = { id: newId(), foodId, startedAt: now, windowDays, outcome: null, endedAt: null };
  await db.insert(trial).values(t);
  await scheduleTrialNotifications(t.id, foodLabel, computeTrialNotifications(now, windowDays), now);
  return { ok: true };
}

export async function logReaction(
  foodId: string,
  input: { symptoms: string[]; severity: 'mild' | 'moderate' | 'severe'; occurredAt: Date; note: string | null },
  now: Date,
): Promise<{ ok: true } | { ok: false; reason: 'no_trial' }> {
  const trials = await db.select().from(trial).where(eq(trial.foodId, foodId));
  const latest = latestTrial(trials);
  if (!latest) return { ok: false, reason: 'no_trial' };
  await db.insert(reaction).values({ id: newId(), trialId: latest.id, ...input });
  if (latest.outcome !== 'reacted') {
    // active trial → close it; closed-safe trial → delayed reaction flips it (spec §4)
    await db.update(trial).set({ outcome: 'reacted', endedAt: now }).where(eq(trial.id, latest.id));
  }
  if (latest.outcome === null) await cancelTrialNotifications(latest.id);
  return { ok: true };
}

export async function confirmSafe(
  trialId: string, now: Date,
): Promise<{ ok: true } | { ok: false; reason: 'window_not_elapsed' }> {
  const rows = await db.select().from(trial).where(eq(trial.id, trialId));
  const t = rows[0];
  if (!t || t.outcome !== null) return { ok: true }; // already closed — idempotent
  if (!isWindowElapsed(t, now)) return { ok: false, reason: 'window_not_elapsed' };
  await db.update(trial).set({ outcome: 'safe', endedAt: now }).where(eq(trial.id, trialId));
  await cancelTrialNotifications(trialId);
  return { ok: true };
}

export async function cancelTrial(trialId: string, now: Date): Promise<void> {
  await db.update(trial).set({ outcome: 'cancelled', endedAt: now }).where(eq(trial.id, trialId));
  await cancelTrialNotifications(trialId);
}

export async function addCustomFood(name: string): Promise<string> {
  const id = newId();
  await db.insert(food).values({ id, name: name.trim(), isCustom: true, allergenGroup: null });
  return id;
}

export async function saveBaby(data: { name: string; birthdate: Date }): Promise<void> {
  const rows = await db.select().from(baby);
  if (rows[0]) {
    await db.update(baby).set(data).where(eq(baby.id, rows[0].id));
  } else {
    await db.insert(baby).values({ id: newId(), ...data, defaultWindowDays: 3, locale: null });
  }
}

export async function updateBabySettings(
  patch: Partial<{ name: string; birthdate: Date; defaultWindowDays: number; locale: string | null }>,
): Promise<void> {
  const rows = await db.select().from(baby);
  if (rows[0]) await db.update(baby).set(patch).where(eq(baby.id, rows[0].id));
}
```

- [ ] **Step 3: Verify typecheck FAILS only on the missing `../services/notify` / `../i18n` pair** (they finalize in Task 7). If executing tasks strictly in order, defer the gate to Task 7 Step 7. Do not commit yet — Task 7 commits this file once the tree typechecks.

---

### Task 7: i18n (EN + KO), seed catalog, notify service commit

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/ko.json`, `src/db/catalog.ts`, `src/db/seed.ts`
- Commit together with: `src/services/notify.ts` (Task 5), `src/data/*` (Task 6)

**Interfaces:**
- Consumes: `db`, `food` table.
- Produces:
  - `i18n` default export (initialized); `foodLabel(f: Pick<Food, 'isCustom' | 'name'>): string`
  - `CATALOG: { id: string; group: string | null }[]`
  - `seedIfEmpty(): Promise<void>`
  - Symptom keys (fixed, used by reaction sheet + report): `hives, rash, vomiting, diarrhea, swelling, breathing, other`

- [ ] **Step 1: `src/i18n/en.json`**

```json
{
  "appName": "Allergy Tracker",
  "status": { "untried": "Not tried", "testing": "Testing", "safe": "Safe", "reacted": "Reacted" },
  "home": {
    "title": "Allergy Tracker",
    "tryNewFood": "Try a new food",
    "activeTrial": "Currently testing",
    "dayOf": "Day {{day}} of {{total}}",
    "readyToConfirm": "Watch window done — how did it go?",
    "markSafe": "Mark safe",
    "logReaction": "Log a reaction",
    "allFoods": "All foods",
    "empty": "No trials yet. Tap “Try a new food” to start."
  },
  "setup": {
    "title": "Welcome",
    "intro": "Introduce foods one at a time and catch reactions early.",
    "babyName": "Baby's name",
    "birthdate": "Birthdate",
    "start": "Get started",
    "disclaimer": "This app is a tracking aid, not medical advice. Always consult your pediatrician about allergies."
  },
  "foods": {
    "title": "Foods",
    "search": "Search foods…",
    "add": "Add",
    "addPlaceholder": "Add a custom food…",
    "highRisk": "High-risk"
  },
  "food": {
    "startTrial": "Start {{days}}-day trial",
    "retest": "Retest ({{days}}-day trial)",
    "cancelTrial": "Cancel trial",
    "history": "History",
    "noHistory": "Not tried yet.",
    "trialBlocked": "Another trial is still in its watch window. Finish it first — one food at a time.",
    "startedOn": "Started {{date}}",
    "outcome": { "safe": "Marked safe", "reacted": "Reaction", "cancelled": "Cancelled" }
  },
  "reaction": {
    "title": "Log reaction",
    "symptoms": "Symptoms",
    "severity": "Severity",
    "when": "When it happened",
    "note": "Notes (optional)",
    "save": "Save reaction",
    "emergency": "Trouble breathing or severe swelling? Call emergency services now.",
    "symptom": {
      "hives": "Hives", "rash": "Rash", "vomiting": "Vomiting", "diarrhea": "Diarrhea",
      "swelling": "Facial swelling", "breathing": "Breathing difficulty", "other": "Other"
    },
    "severityLevel": { "mild": "Mild", "moderate": "Moderate", "severe": "Severe" }
  },
  "settings": {
    "title": "Settings",
    "babySection": "Baby",
    "window": "Watch window (days)",
    "language": "Language",
    "languageSystem": "System",
    "exportSection": "Export",
    "exportPdf": "Doctor report (PDF)",
    "exportJson": "Backup data (JSON)",
    "privacy": "Your baby's data never leaves this phone.",
    "disclaimer": "This app is a tracking aid, not medical advice.",
    "save": "Save"
  },
  "notif": {
    "checkinTitle": "Day {{day}}: {{food}}",
    "checkinBody": "Any symptoms since trying {{food}}?",
    "windowEndTitle": "{{food}}: watch window done",
    "windowEndBody": "No reactions? Open the app to mark {{food}} safe."
  },
  "report": {
    "title": "Food & Allergy Log",
    "generated": "Generated {{date}}",
    "babyLine": "{{name}} · born {{birthdate}}",
    "foodsTried": "Foods tried",
    "reactionsSection": "Reactions",
    "none": "None",
    "colFood": "Food", "colStatus": "Status", "colLastTried": "Last tried"
  },
  "common": { "cancel": "Cancel", "ok": "OK", "notNow": "Not now" },
  "foodName": {
    "egg": "Egg", "milk": "Cow's milk", "wheat": "Wheat", "peanut": "Peanut", "soy": "Soy",
    "sesame": "Sesame", "shrimp": "Shrimp", "crab": "Crab", "whitefish": "White fish",
    "salmon": "Salmon", "mackerel": "Mackerel", "almond": "Almond", "walnut": "Walnut",
    "cashew": "Cashew", "pinenut": "Pine nut", "buckwheat": "Buckwheat", "tofu": "Tofu",
    "yogurt": "Yogurt", "cheese": "Cheese",
    "rice": "Rice", "oat": "Oats", "barley": "Barley", "corn": "Corn",
    "sweetpotato": "Sweet potato", "potato": "Potato", "pumpkin": "Pumpkin",
    "zucchini": "Zucchini", "carrot": "Carrot", "broccoli": "Broccoli",
    "cauliflower": "Cauliflower", "cabbage": "Cabbage", "spinach": "Spinach",
    "cucumber": "Cucumber", "pea": "Peas", "greenbean": "Green beans", "onion": "Onion",
    "tomato": "Tomato", "mushroom": "Mushroom", "seaweed": "Seaweed (miyeok)",
    "laver": "Laver (gim)",
    "apple": "Apple", "pear": "Pear", "banana": "Banana", "avocado": "Avocado",
    "blueberry": "Blueberry", "strawberry": "Strawberry", "peach": "Peach", "plum": "Plum",
    "mango": "Mango", "watermelon": "Watermelon", "melon": "Melon", "grape": "Grapes",
    "persimmon": "Persimmon", "beef": "Beef", "chicken": "Chicken", "pork": "Pork"
  }
}
```

- [ ] **Step 2: `src/i18n/ko.json`**

```json
{
  "appName": "알레르기 트래커",
  "status": { "untried": "안 먹어봄", "testing": "테스트 중", "safe": "안전", "reacted": "반응" },
  "home": {
    "title": "알레르기 트래커",
    "tryNewFood": "새 재료 시작하기",
    "activeTrial": "테스트 중인 재료",
    "dayOf": "{{total}}일 중 {{day}}일째",
    "readyToConfirm": "관찰 기간 종료 — 어땠나요?",
    "markSafe": "안전으로 표시",
    "logReaction": "반응 기록",
    "allFoods": "전체 재료",
    "empty": "아직 테스트 기록이 없어요. “새 재료 시작하기”를 눌러보세요."
  },
  "setup": {
    "title": "환영해요",
    "intro": "재료를 하나씩 시도하며 알레르기 반응을 빠르게 발견하세요.",
    "babyName": "아기 이름",
    "birthdate": "생년월일",
    "start": "시작하기",
    "disclaimer": "이 앱은 기록 보조 도구이며 의학적 조언이 아닙니다. 알레르기는 반드시 소아과 의사와 상의하세요."
  },
  "foods": {
    "title": "재료",
    "search": "재료 검색…",
    "add": "추가",
    "addPlaceholder": "직접 재료 추가…",
    "highRisk": "고위험"
  },
  "food": {
    "startTrial": "{{days}}일 테스트 시작",
    "retest": "재테스트 ({{days}}일)",
    "cancelTrial": "테스트 취소",
    "history": "기록",
    "noHistory": "아직 시도하지 않았어요.",
    "trialBlocked": "다른 재료가 아직 관찰 기간 중이에요. 한 번에 한 가지 재료만 테스트하세요.",
    "startedOn": "{{date}} 시작",
    "outcome": { "safe": "안전 확인", "reacted": "반응 발생", "cancelled": "취소됨" }
  },
  "reaction": {
    "title": "반응 기록",
    "symptoms": "증상",
    "severity": "심각도",
    "when": "발생 시각",
    "note": "메모 (선택)",
    "save": "반응 저장",
    "emergency": "호흡 곤란이나 심한 부종이 있다면 지금 바로 119에 연락하세요.",
    "symptom": {
      "hives": "두드러기", "rash": "발진", "vomiting": "구토", "diarrhea": "설사",
      "swelling": "얼굴 부종", "breathing": "호흡 곤란", "other": "기타"
    },
    "severityLevel": { "mild": "가벼움", "moderate": "중간", "severe": "심각" }
  },
  "settings": {
    "title": "설정",
    "babySection": "아기",
    "window": "관찰 기간 (일)",
    "language": "언어",
    "languageSystem": "시스템 설정",
    "exportSection": "내보내기",
    "exportPdf": "진료용 리포트 (PDF)",
    "exportJson": "데이터 백업 (JSON)",
    "privacy": "아기의 데이터는 이 기기 밖으로 나가지 않습니다.",
    "disclaimer": "이 앱은 기록 보조 도구이며 의학적 조언이 아닙니다.",
    "save": "저장"
  },
  "notif": {
    "checkinTitle": "{{day}}일째: {{food}}",
    "checkinBody": "{{food}} 먹인 후 증상은 없었나요?",
    "windowEndTitle": "{{food}}: 관찰 기간 종료",
    "windowEndBody": "반응이 없었다면 앱에서 {{food}}을(를) 안전으로 표시하세요."
  },
  "report": {
    "title": "이유식 알레르기 기록",
    "generated": "생성일 {{date}}",
    "babyLine": "{{name}} · {{birthdate}} 출생",
    "foodsTried": "시도한 재료",
    "reactionsSection": "반응 기록",
    "none": "없음",
    "colFood": "재료", "colStatus": "상태", "colLastTried": "마지막 시도"
  },
  "common": { "cancel": "취소", "ok": "확인", "notNow": "나중에" },
  "foodName": {
    "egg": "달걀", "milk": "우유", "wheat": "밀", "peanut": "땅콩", "soy": "대두",
    "sesame": "참깨", "shrimp": "새우", "crab": "게", "whitefish": "흰살 생선",
    "salmon": "연어", "mackerel": "고등어", "almond": "아몬드", "walnut": "호두",
    "cashew": "캐슈넛", "pinenut": "잣", "buckwheat": "메밀", "tofu": "두부",
    "yogurt": "요거트", "cheese": "치즈",
    "rice": "쌀", "oat": "귀리", "barley": "보리", "corn": "옥수수",
    "sweetpotato": "고구마", "potato": "감자", "pumpkin": "단호박",
    "zucchini": "애호박", "carrot": "당근", "broccoli": "브로콜리",
    "cauliflower": "콜리플라워", "cabbage": "양배추", "spinach": "시금치",
    "cucumber": "오이", "pea": "완두콩", "greenbean": "그린빈", "onion": "양파",
    "tomato": "토마토", "mushroom": "버섯", "seaweed": "미역", "laver": "김",
    "apple": "사과", "pear": "배", "banana": "바나나", "avocado": "아보카도",
    "blueberry": "블루베리", "strawberry": "딸기", "peach": "복숭아", "plum": "자두",
    "mango": "망고", "watermelon": "수박", "melon": "멜론", "grape": "포도",
    "persimmon": "감", "beef": "소고기", "chicken": "닭고기", "pork": "돼지고기"
  }
}
```

- [ ] **Step 3: `src/i18n/index.ts`**

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './en.json';
import ko from './ko.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ko: { translation: ko } },
  lng: getLocales()[0]?.languageCode === 'ko' ? 'ko' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export function foodLabel(f: { isCustom: boolean; name: string }): string {
  return f.isCustom ? f.name : i18n.t(f.name);
}
```

- [ ] **Step 4: `src/db/catalog.ts`** — 56 seed foods; `group !== null` ⇒ high-risk badge

```ts
export const CATALOG: { id: string; group: string | null }[] = [
  // high-risk (big-9 expansion + KR additions)
  { id: 'egg', group: 'egg' }, { id: 'milk', group: 'milk' }, { id: 'yogurt', group: 'milk' },
  { id: 'cheese', group: 'milk' }, { id: 'wheat', group: 'wheat' }, { id: 'peanut', group: 'peanut' },
  { id: 'soy', group: 'soy' }, { id: 'tofu', group: 'soy' }, { id: 'sesame', group: 'sesame' },
  { id: 'shrimp', group: 'shellfish' }, { id: 'crab', group: 'shellfish' },
  { id: 'whitefish', group: 'fish' }, { id: 'salmon', group: 'fish' }, { id: 'mackerel', group: 'fish' },
  { id: 'almond', group: 'tree_nut' }, { id: 'walnut', group: 'tree_nut' },
  { id: 'cashew', group: 'tree_nut' }, { id: 'pinenut', group: 'tree_nut' },
  { id: 'buckwheat', group: 'buckwheat' },
  // everyday first foods
  { id: 'rice', group: null }, { id: 'oat', group: null }, { id: 'barley', group: null },
  { id: 'corn', group: null }, { id: 'sweetpotato', group: null }, { id: 'potato', group: null },
  { id: 'pumpkin', group: null }, { id: 'zucchini', group: null }, { id: 'carrot', group: null },
  { id: 'broccoli', group: null }, { id: 'cauliflower', group: null }, { id: 'cabbage', group: null },
  { id: 'spinach', group: null }, { id: 'cucumber', group: null }, { id: 'pea', group: null },
  { id: 'greenbean', group: null }, { id: 'onion', group: null }, { id: 'tomato', group: null },
  { id: 'mushroom', group: null }, { id: 'seaweed', group: null }, { id: 'laver', group: null },
  { id: 'apple', group: null }, { id: 'pear', group: null }, { id: 'banana', group: null },
  { id: 'avocado', group: null }, { id: 'blueberry', group: null }, { id: 'strawberry', group: null },
  { id: 'peach', group: null }, { id: 'plum', group: null }, { id: 'mango', group: null },
  { id: 'watermelon', group: null }, { id: 'melon', group: null }, { id: 'grape', group: null },
  { id: 'persimmon', group: null }, { id: 'beef', group: null }, { id: 'chicken', group: null },
  { id: 'pork', group: null },
];
```

- [ ] **Step 5: `src/db/seed.ts`**

```ts
import { db } from './client';
import { food } from './schema';
import { CATALOG } from './catalog';

export async function seedIfEmpty(): Promise<void> {
  const existing = await db.select({ id: food.id }).from(food).limit(1);
  if (existing.length > 0) return;
  await db.insert(food).values(
    CATALOG.map((c) => ({
      id: c.id,
      name: `foodName.${c.id}`,
      isCustom: false,
      allergenGroup: c.group,
    })),
  );
}
```

- [ ] **Step 6: Sanity-check every `foodName.*` key exists in BOTH locales**

```bash
node -e "
const en=require('./src/i18n/en.json').foodName, ko=require('./src/i18n/ko.json').foodName;
const cat=require('fs').readFileSync('./src/db/catalog.ts','utf8');
const ids=[...cat.matchAll(/id: '([a-z]+)'/g)].map(m=>m[1]);
const missing=ids.filter(id=>!en[id]||!ko[id]);
if(missing.length){console.error('MISSING:',missing);process.exit(1)}
console.log('all', ids.length, 'catalog foods translated');
"
```
Expected: `all 56 catalog foods translated` (56 catalog entries; any `MISSING:` output is the failure signal).

- [ ] **Step 7: Full gate, then commit Tasks 5–7 leftovers together**

```bash
npx tsc --noEmit && npx jest
git add src/i18n src/db/catalog.ts src/db/seed.ts src/services/notify.ts src/data
git commit -m "feat: i18n (en/ko), 56-food seed catalog, notification service, data mutations"
```

---

### Task 8: UI foundation — tokens, StatusChip, root layout bootstrap

**Files:**
- Create: `src/ui/tokens.ts`, `src/ui/StatusChip.tsx`, `src/data/queries.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `db`, `migrations`, `seedIfEmpty`, `i18n`, `initNotificationHandler`, `deriveStatus`/`latestTrial`.
- Produces:
  - `colors`, `statusIcon` from `src/ui/tokens.ts`
  - `<StatusChip status={FoodStatus} />`
  - Hooks: `useBaby(): Baby | undefined`, `useFoodsWithStatus(): { food: Food; trials: Trial[]; status: FoodStatus; latest: Trial | undefined }[]`, `useReactions(): Reaction[]`
  - Root layout that blocks render until migrations + seed complete, then applies `baby.locale`.

- [ ] **Step 1: `src/ui/tokens.ts`** — the only color source in the app

```ts
export const colors = {
  bg: '#FFFFFF',
  surface: '#F7F7F5',
  text: '#1C1C1E',
  textMuted: '#6E6E73',
  border: '#E3E3E0',
  accent: '#1C1C1E',
  danger: '#B91C1C',
  status: {
    untried: { fg: '#55555A', bg: '#EFEFED' },
    testing: { fg: '#8A5A00', bg: '#FCF0D3' },
    safe:    { fg: '#166534', bg: '#DDF3E1' },
    reacted: { fg: '#991B1B', bg: '#FBE2E0' },
  },
} as const;

export const statusIcon = {
  untried: '○', testing: '◐', safe: '✓', reacted: '✕',
} as const;
```

- [ ] **Step 2: `src/ui/StatusChip.tsx`** — icon + label, never color alone

```tsx
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FoodStatus } from '../domain/status';
import { colors, statusIcon } from './tokens';

export function StatusChip({ status }: { status: FoodStatus }) {
  const { t } = useTranslation();
  const c = colors.status[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg,
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: c.fg, fontSize: 12 }}>{statusIcon[status]}</Text>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600' }}>{t(`status.${status}`)}</Text>
    </View>
  );
}
```

- [ ] **Step 3: `src/data/queries.ts`**

```ts
import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../db/client';
import { baby, food, reaction, trial, type Baby, type Food, type Reaction, type Trial } from '../db/schema';
import { deriveStatus, latestTrial, type FoodStatus } from '../domain/status';

export function useBaby(): Baby | undefined {
  const { data } = useLiveQuery(db.select().from(baby));
  return data?.[0];
}

export type FoodWithStatus = { food: Food; trials: Trial[]; status: FoodStatus; latest: Trial | undefined };

export function useFoodsWithStatus(): FoodWithStatus[] {
  const { data: foods } = useLiveQuery(db.select().from(food));
  const { data: trials } = useLiveQuery(db.select().from(trial));
  return useMemo(() => {
    const byFood = new Map<string, Trial[]>();
    for (const t of trials ?? []) {
      const list = byFood.get(t.foodId) ?? [];
      list.push(t);
      byFood.set(t.foodId, list);
    }
    return (foods ?? []).map((f) => {
      const ts = byFood.get(f.id) ?? [];
      return { food: f, trials: ts, status: deriveStatus(ts), latest: latestTrial(ts) };
    });
  }, [foods, trials]);
}

export function useReactions(): Reaction[] {
  const { data } = useLiveQuery(db.select().from(reaction));
  return data ?? [];
}
```

- [ ] **Step 4: `app/_layout.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import i18n from '../src/i18n';
import { db } from '../src/db/client';
import { seedIfEmpty } from '../src/db/seed';
import { useBaby } from '../src/data/queries';
import { initNotificationHandler } from '../src/services/notify';
import { colors } from '../src/ui/tokens';

initNotificationHandler();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (success) seedIfEmpty().then(() => setSeeded(true));
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.danger }}>DB migration failed: {error.message}</Text>
      </View>
    );
  }
  if (!success || !seeded) return null;
  return <LocalizedStack />;
}

function LocalizedStack() {
  const { t } = useTranslation(); // subscribes — titles relabel on language change
  const baby = useBaby();
  useEffect(() => {
    if (baby?.locale && i18n.language !== baby.locale) i18n.changeLanguage(baby.locale);
  }, [baby?.locale]);

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('home.title') }} />
      <Stack.Screen name="foods" options={{ title: t('foods.title') }} />
      <Stack.Screen name="food/[id]" options={{ title: '' }} />
      <Stack.Screen name="log-reaction" options={{ title: t('reaction.title'), presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title'), presentation: 'modal' }} />
    </Stack>
  );
}
```

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx jest
git add src/ui src/data/queries.ts app/_layout.tsx
git commit -m "feat(ui): design tokens, StatusChip, live-query hooks, bootstrapped root layout"
```

---

### Task 9: Home screen (setup card + traffic-light dashboard)

**Files:**
- Create: `app/index.tsx`, `src/ui/Button.tsx`

**Interfaces:**
- Consumes: `useBaby`, `useFoodsWithStatus`, `saveBaby`, `confirmSafe`, `foodLabel`, `StatusChip`, tokens, `isWindowElapsed`, `MS_PER_DAY`.
- Produces: `<Button label onPress variant?: 'primary' | 'secondary' | 'danger' disabled?>` reused by all later screens.

- [ ] **Step 1: `src/ui/Button.tsx`**

```tsx
import { Pressable, Text } from 'react-native';
import { colors } from './tokens';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean };

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const bg = variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger : colors.surface;
  const fg = variant === 'secondary' ? colors.text : colors.bg;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: bg, opacity: disabled ? 0.4 : 1, paddingVertical: 14,
        borderRadius: 12, alignItems: 'center' }}
    >
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: `app/index.tsx`**

```tsx
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useBaby, useFoodsWithStatus } from '../src/data/queries';
import { confirmSafe, saveBaby } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { isWindowElapsed, MS_PER_DAY, type FoodStatus } from '../src/domain/status';
import { Button } from '../src/ui/Button';
import { StatusChip } from '../src/ui/StatusChip';
import { colors } from '../src/ui/tokens';

export default function Home() {
  const baby = useBaby();
  if (!baby) return <SetupCard />;
  return <Dashboard />;
}

function SetupCard() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState(new Date());
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>{t('setup.title')}</Text>
      <Text style={{ fontSize: 15, color: colors.textMuted }}>{t('setup.intro')}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{t('setup.babyName')}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16 }}
      />
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{t('setup.birthdate')}</Text>
      <DateTimePicker
        value={birthdate}
        mode="date"
        maximumDate={new Date()}
        onChange={(_, d) => d && setBirthdate(d)}
      />
      <Button
        label={t('setup.start')}
        disabled={name.trim().length === 0}
        onPress={() => saveBaby({ name: name.trim(), birthdate })}
      />
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('setup.disclaimer')}</Text>
    </ScrollView>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const foods = useFoodsWithStatus();
  const now = new Date();

  const active = foods.find((f) => f.status === 'testing');
  const counts: Record<FoodStatus, number> = { safe: 0, testing: 0, reacted: 0, untried: 0 };
  for (const f of foods) counts[f.status]++;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      {active && active.latest ? (
        <View style={{ backgroundColor: colors.status.testing.bg, borderRadius: 16, padding: 16, gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.status.testing.fg }}>
            {t('home.activeTrial')}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text }}>
            {foodLabel(active.food)}
          </Text>
          {isWindowElapsed(active.latest, now) ? (
            <>
              <Text style={{ fontSize: 14, color: colors.text }}>{t('home.readyToConfirm')}</Text>
              <Button label={t('home.markSafe')} onPress={() => confirmSafe(active.latest!.id, new Date())} />
              <Button
                label={t('home.logReaction')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: active.food.id } })}
              />
            </>
          ) : (
            <Text style={{ fontSize: 14, color: colors.status.testing.fg }}>
              {t('home.dayOf', {
                day: Math.min(active.latest.windowDays,
                  Math.floor((now.getTime() - active.latest.startedAt.getTime()) / MS_PER_DAY) + 1),
                total: active.latest.windowDays,
              })}
            </Text>
          )}
        </View>
      ) : (
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{t('home.empty')}</Text>
      )}

      <Button label={t('home.tryNewFood')} onPress={() => router.push('/foods')} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['safe', 'testing', 'reacted', 'untried'] as const).map((s) => (
          <View key={s} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12,
            padding: 10, alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{counts[s]}</Text>
            <StatusChip status={s} />
          </View>
        ))}
      </View>

      <Link href="/settings" style={{ fontSize: 14, color: colors.textMuted }}>
        {t('settings.title')} →
      </Link>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Gate, simulator glance, commit**

```bash
npx tsc --noEmit && npx jest
npx expo run:ios   # first run builds the dev client; verify setup card → dashboard flow
git add app/index.tsx src/ui/Button.tsx
git commit -m "feat(home): first-launch setup card and traffic-light dashboard"
```

---

### Task 10: Foods list (search, add custom, status rows)

**Files:**
- Create: `app/foods.tsx`

**Interfaces:**
- Consumes: `useFoodsWithStatus`, `addCustomFood`, `foodLabel`, `StatusChip`, tokens.
- Produces: navigation to `/food/[id]`.

- [ ] **Step 1: `app/foods.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFoodsWithStatus, type FoodWithStatus } from '../src/data/queries';
import { addCustomFood } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import type { FoodStatus } from '../src/domain/status';
import { StatusChip } from '../src/ui/StatusChip';
import { colors } from '../src/ui/tokens';

const ORDER: Record<FoodStatus, number> = { testing: 0, untried: 1, safe: 2, reacted: 3 };

export default function Foods() {
  const { t } = useTranslation();
  const router = useRouter();
  const foods = useFoodsWithStatus();
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => foodLabel(f.food).toLowerCase().includes(q))
      .sort((a, b) =>
        ORDER[a.status] - ORDER[b.status] || foodLabel(a.food).localeCompare(foodLabel(b.food)));
  }, [foods, query]);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    const id = await addCustomFood(name);
    router.push({ pathname: '/food/[id]', params: { id } });
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <TextInput
        placeholder={t('foods.search')}
        value={query}
        onChangeText={setQuery}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 15 }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          placeholder={t('foods.addPlaceholder')}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={submitNew}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 15 }}
        />
        <Pressable onPress={submitNew} style={{ justifyContent: 'center', paddingHorizontal: 14,
          backgroundColor: colors.accent, borderRadius: 10 }}>
          <Text style={{ color: colors.bg, fontWeight: '600' }}>{t('foods.add')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(f) => f.food.id}
        renderItem={({ item }) => <FoodRow item={item} />}
      />
    </View>
  );
}

function FoodRow({ item }: { item: FoodWithStatus }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/food/[id]', params: { id: item.food.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}
    >
      <Text style={{ flex: 1, fontSize: 16, color: colors.text }}>{foodLabel(item.food)}</Text>
      {item.food.allergenGroup && (
        <Text style={{ fontSize: 11, color: colors.danger, fontWeight: '600' }}>
          ⚠ {t('foods.highRisk')}
        </Text>
      )}
      <StatusChip status={item.status} />
    </Pressable>
  );
}
```

- [ ] **Step 2: Gate + commit**

```bash
npx tsc --noEmit && npx jest
git add app/foods.tsx
git commit -m "feat(foods): searchable status list with custom food entry and high-risk badges"
```

---

### Task 11: Food detail (start trial, history, retest, cancel)

**Files:**
- Create: `app/food/[id].tsx`

**Interfaces:**
- Consumes: `useFoodsWithStatus`, `useBaby`, `useReactions`, `startTrial`, `confirmSafe`, `cancelTrial`, `ensurePermission`, `foodLabel`, `StatusChip`, `Button`, `isWindowElapsed`.
- Produces: navigation to `/log-reaction?foodId=`.

- [ ] **Step 1: `app/food/[id].tsx`**

```tsx
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBaby, useFoodsWithStatus, useReactions } from '../../src/data/queries';
import { cancelTrial, confirmSafe, startTrial } from '../../src/data/mutations';
import { ensurePermission } from '../../src/services/notify';
import { foodLabel } from '../../src/i18n';
import { isWindowElapsed } from '../../src/domain/status';
import { Button } from '../../src/ui/Button';
import { StatusChip } from '../../src/ui/StatusChip';
import { colors } from '../../src/ui/tokens';

export default function FoodDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const baby = useBaby();
  const foods = useFoodsWithStatus();
  const reactions = useReactions();

  const entry = foods.find((f) => f.food.id === id);
  if (!entry || !baby) return null;

  const { food, trials, status, latest } = entry;
  const now = new Date();
  const windowDays = baby.defaultWindowDays;
  const activeHere = latest && latest.outcome === null ? latest : undefined;

  const onStart = async () => {
    await ensurePermission(); // contextual ask; denial degrades gracefully
    const res = await startTrial(food.id, foodLabel(food), windowDays, new Date());
    if (!res.ok) Alert.alert(t('food.trialBlocked'));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Stack.Screen options={{ title: foodLabel(food) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StatusChip status={status} />
        {food.allergenGroup && (
          <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '600' }}>
            ⚠ {t('foods.highRisk')}
          </Text>
        )}
      </View>

      {activeHere ? (
        <View style={{ gap: 8 }}>
          {isWindowElapsed(activeHere, now) && (
            <Button label={t('home.markSafe')} onPress={() => confirmSafe(activeHere.id, new Date())} />
          )}
          <Button
            label={t('home.logReaction')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: food.id } })}
          />
          <Button label={t('food.cancelTrial')} variant="danger"
            onPress={() => cancelTrial(activeHere.id, new Date())} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Button
            label={status === 'untried'
              ? t('food.startTrial', { days: windowDays })
              : t('food.retest', { days: windowDays })}
            onPress={onStart}
          />
          {status !== 'untried' && (
            <Button
              label={t('home.logReaction')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: food.id } })}
            />
          )}
        </View>
      )}

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('food.history')}</Text>
      {trials.length === 0 && (
        <Text style={{ fontSize: 14, color: colors.textMuted }}>{t('food.noHistory')}</Text>
      )}
      {[...trials].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).map((tr) => (
        <View key={tr.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
            {tr.outcome ? t(`food.outcome.${tr.outcome}`) : t('status.testing')}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted }}>
            {t('food.startedOn', { date: tr.startedAt.toLocaleDateString() })}
          </Text>
          {reactions.filter((r) => r.trialId === tr.id).map((r) => (
            <Text key={r.id} style={{ fontSize: 12, color: colors.danger }}>
              {t(`reaction.severityLevel.${r.severity}`)} · {r.symptoms.map((s) => t(`reaction.symptom.${s}`)).join(', ')}
              {r.note ? ` — ${r.note}` : ''}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Gate + commit**

```bash
npx tsc --noEmit && npx jest
git add app/food
git commit -m "feat(food-detail): trial lifecycle actions and per-food history"
```

---

### Task 12: Log-reaction modal

**Files:**
- Create: `app/log-reaction.tsx`

**Interfaces:**
- Consumes: `logReaction`, `useFoodsWithStatus`, `foodLabel`, `Button`, tokens.
- Produces: nothing downstream (terminal sheet).

- [ ] **Step 1: `app/log-reaction.tsx`**

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFoodsWithStatus } from '../src/data/queries';
import { logReaction } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { Button } from '../src/ui/Button';
import { colors } from '../src/ui/tokens';

const SYMPTOMS = ['hives', 'rash', 'vomiting', 'diarrhea', 'swelling', 'breathing', 'other'] as const;
const SEVERITIES = ['mild', 'moderate', 'severe'] as const;

export default function LogReaction() {
  const { t } = useTranslation();
  const router = useRouter();
  const { foodId } = useLocalSearchParams<{ foodId: string }>();
  const entry = useFoodsWithStatus().find((f) => f.food.id === foodId);

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('mild');
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [note, setNote] = useState('');

  if (!entry) return null;
  const showEmergency = severity === 'severe' || symptoms.includes('breathing');

  const toggle = (s: string) =>
    setSymptoms((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const save = async () => {
    await logReaction(
      entry.food.id,
      { symptoms, severity, occurredAt, note: note.trim() || null },
      new Date(),
    );
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{foodLabel(entry.food)}</Text>

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('reaction.symptoms')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SYMPTOMS.map((s) => {
          const on = symptoms.includes(s);
          return (
            <Pressable key={s} onPress={() => toggle(s)}
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? colors.accent : colors.bg }}>
              <Text style={{ color: on ? colors.bg : colors.text, fontSize: 13 }}>
                {t(`reaction.symptom.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('reaction.severity')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SEVERITIES.map((s) => {
          const on = severity === s;
          return (
            <Pressable key={s} onPress={() => setSeverity(s)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? colors.accent : colors.bg }}>
              <Text style={{ color: on ? colors.bg : colors.text, fontSize: 14 }}>
                {t(`reaction.severityLevel.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showEmergency && (
        <View style={{ backgroundColor: colors.status.reacted.bg, borderRadius: 10, padding: 12 }}>
          <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>
            {t('reaction.emergency')}
          </Text>
        </View>
      )}

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('reaction.when')}</Text>
      <DateTimePicker
        value={occurredAt}
        mode="datetime"
        maximumDate={new Date()}
        onChange={(_, d) => d && setOccurredAt(d)}
      />

      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{t('reaction.note')}</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        multiline
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12,
          minHeight: 70, fontSize: 15 }}
      />

      <Button label={t('reaction.save')} disabled={symptoms.length === 0} onPress={save} />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Gate + commit**

```bash
npx tsc --noEmit && npx jest
git add app/log-reaction.tsx
git commit -m "feat(reaction): symptom/severity logging sheet with emergency advisory"
```

---

### Task 13: Export builders (TDD) + Settings screen

**Files:**
- Create: `src/services/export.ts`, `app/settings.tsx`
- Test: `src/services/export.test.ts`

**Interfaces:**
- Consumes: hooks + `updateBabySettings`, i18n, expo-print/sharing/file-system.
- Produces:
  - `escapeHtml(s: string): string`
  - `type ReportView = { title: string; babyLine: string; generatedLine: string; foodsHeading: string; reactionsHeading: string; noneLabel: string; cols: { food: string; status: string; lastTried: string }; rows: { food: string; status: string; lastTried: string }[]; reactionRows: { food: string; date: string; severity: string; symptoms: string; note: string }[] }`
  - `buildReportHtml(view: ReportView): string`
  - `buildBackup(data: { baby: unknown[]; foods: unknown[]; trials: unknown[]; reactions: unknown[] }, exportedAt: Date): string`

- [ ] **Step 1: Failing tests — `src/services/export.test.ts`**

```ts
import { buildBackup, buildReportHtml, escapeHtml, type ReportView } from './export';

const view: ReportView = {
  title: 'Food & Allergy Log',
  babyLine: 'Dana · born 2025-11-02',
  generatedLine: 'Generated 2026-07-16',
  foodsHeading: 'Foods tried',
  reactionsHeading: 'Reactions',
  noneLabel: 'None',
  cols: { food: 'Food', status: 'Status', lastTried: 'Last tried' },
  rows: [{ food: 'Egg', status: 'Reacted', lastTried: '2026-07-10' }],
  reactionRows: [{ food: 'Egg', date: '2026-07-10', severity: 'Moderate', symptoms: 'Hives, Rash', note: '' }],
};

describe('escapeHtml', () => {
  test('escapes the five specials', () => {
    expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('buildReportHtml', () => {
  test('contains all headings and row data', () => {
    const html = buildReportHtml(view);
    for (const s of ['Food & Allergy Log', 'Dana', 'Egg', 'Reacted', 'Hives, Rash']) {
      expect(html).toContain(s);
    }
  });
  test('escapes malicious custom food names', () => {
    const html = buildReportHtml({
      ...view,
      rows: [{ food: '<script>x</script>', status: 'Safe', lastTried: '2026-07-01' }],
      reactionRows: [],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
  test('empty reactions render the none label', () => {
    expect(buildReportHtml({ ...view, reactionRows: [] })).toContain('None');
  });
});

describe('buildBackup', () => {
  test('versioned envelope with ISO timestamp', () => {
    const out = JSON.parse(buildBackup({ baby: [], foods: [{ id: 'rice' }], trials: [], reactions: [] },
      new Date('2026-07-16T00:00:00Z')));
    expect(out.app).toBe('allergy-tracker');
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe('2026-07-16T00:00:00.000Z');
    expect(out.foods).toEqual([{ id: 'rice' }]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

```bash
npx jest src/services/export.test.ts
```

- [ ] **Step 3: Implement — `src/services/export.ts`**

```ts
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export type ReportView = {
  title: string; babyLine: string; generatedLine: string;
  foodsHeading: string; reactionsHeading: string; noneLabel: string;
  cols: { food: string; status: string; lastTried: string };
  rows: { food: string; status: string; lastTried: string }[];
  reactionRows: { food: string; date: string; severity: string; symptoms: string; note: string }[];
};

export function buildReportHtml(v: ReportView): string {
  const e = escapeHtml;
  const rows = v.rows.map((r) =>
    `<tr><td>${e(r.food)}</td><td>${e(r.status)}</td><td>${e(r.lastTried)}</td></tr>`).join('');
  const reactions = v.reactionRows.length === 0
    ? `<p>${e(v.noneLabel)}</p>`
    : `<ul>${v.reactionRows.map((r) =>
        `<li><strong>${e(r.food)}</strong> — ${e(r.date)} · ${e(r.severity)} · ${e(r.symptoms)}${r.note ? ` · ${e(r.note)}` : ''}</li>`,
      ).join('')}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, sans-serif; padding: 32px; color: #1c1c1e; }
    h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 24px; }
    p.meta { color: #6e6e73; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    ul { font-size: 13px; }
  </style></head><body>
    <h1>${e(v.title)}</h1>
    <p class="meta">${e(v.babyLine)}<br>${e(v.generatedLine)}</p>
    <h2>${e(v.foodsHeading)}</h2>
    <table><tr><th>${e(v.cols.food)}</th><th>${e(v.cols.status)}</th><th>${e(v.cols.lastTried)}</th></tr>${rows}</table>
    <h2>${e(v.reactionsHeading)}</h2>
    ${reactions}
  </body></html>`;
}

export function buildBackup(
  data: { baby: unknown[]; foods: unknown[]; trials: unknown[]; reactions: unknown[] },
  exportedAt: Date,
): string {
  return JSON.stringify(
    { app: 'allergy-tracker', version: 1, exportedAt: exportedAt.toISOString(), ...data },
    null, 2,
  );
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx jest src/services/export.test.ts && npx tsc --noEmit
```

- [ ] **Step 5: `app/settings.tsx`**

```tsx
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { db } from '../src/db/client';
import { baby as babyTable, food, reaction, trial } from '../src/db/schema';
import { useBaby, useFoodsWithStatus, useReactions } from '../src/data/queries';
import { updateBabySettings } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { Button } from '../src/ui/Button';
import { colors } from '../src/ui/tokens';
import { buildBackup, buildReportHtml } from '../src/services/export';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const baby = useBaby();
  const foods = useFoodsWithStatus();
  const reactions = useReactions();
  if (!baby) return null;

  const exportPdf = async () => {
    const tried = foods.filter((f) => f.trials.some((tr) => tr.outcome !== 'cancelled'));
    const html = buildReportHtml({
      title: t('report.title'),
      babyLine: t('report.babyLine', { name: baby.name, birthdate: baby.birthdate.toLocaleDateString() }),
      generatedLine: t('report.generated', { date: new Date().toLocaleDateString() }),
      foodsHeading: t('report.foodsTried'),
      reactionsHeading: t('report.reactionsSection'),
      noneLabel: t('report.none'),
      cols: { food: t('report.colFood'), status: t('report.colStatus'), lastTried: t('report.colLastTried') },
      rows: tried.map((f) => ({
        food: foodLabel(f.food),
        status: t(`status.${f.status}`),
        lastTried: f.latest?.startedAt.toLocaleDateString() ?? '',
      })),
      reactionRows: reactions.map((r) => {
        const tr = foods.flatMap((f) => f.trials.map((x) => ({ f, x }))).find((p) => p.x.id === r.trialId);
        return {
          food: tr ? foodLabel(tr.f.food) : '',
          date: r.occurredAt.toLocaleDateString(),
          severity: t(`reaction.severityLevel.${r.severity}`),
          symptoms: r.symptoms.map((s) => t(`reaction.symptom.${s}`)).join(', '),
          note: r.note ?? '',
        };
      }),
    });
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  };

  const exportJson = async () => {
    const [b, f, tr, re] = await Promise.all([
      db.select().from(babyTable), db.select().from(food),
      db.select().from(trial), db.select().from(reaction),
    ]);
    const json = buildBackup({ baby: b, foods: f, trials: tr, reactions: re }, new Date());
    const path = `${FileSystem.cacheDirectory}allergy-tracker-backup.json`;
    await FileSystem.writeAsStringAsync(path, json);
    await Sharing.shareAsync(path, { mimeType: 'application/json' });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.babySection')}</Text>
      <TextInput
        defaultValue={baby.name}
        onEndEditing={(e) => {
          const name = e.nativeEvent.text.trim();
          if (name) updateBabySettings({ name });
        }}
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 16 }}
      />

      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.window')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[2, 3, 4, 5, 6, 7].map((d) => {
          const on = baby.defaultWindowDays === d;
          return (
            <Pressable key={d} onPress={() => updateBabySettings({ defaultWindowDays: d })}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? colors.accent : colors.bg }}>
              <Text style={{ color: on ? colors.bg : colors.text }}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.language')}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([
          { key: null, label: t('settings.languageSystem') },
          { key: 'en', label: 'English' },
          { key: 'ko', label: '한국어' },
        ] as const).map((opt) => {
          const on = baby.locale === opt.key;
          return (
            <Pressable key={String(opt.key)}
              onPress={async () => {
                await updateBabySettings({ locale: opt.key });
                if (opt.key) i18n.changeLanguage(opt.key);
              }}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? colors.accent : colors.bg }}>
              <Text style={{ color: on ? colors.bg : colors.text, fontSize: 13 }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{t('settings.exportSection')}</Text>
      <Button label={t('settings.exportPdf')} onPress={exportPdf} />
      <Button label={t('settings.exportJson')} variant="secondary" onPress={exportJson} />

      <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('settings.privacy')}</Text>
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{t('settings.disclaimer')}</Text>
    </ScrollView>
  );
}
```
Note: selecting "System" locale updates the row but takes effect on next launch (acceptable v1 behavior; `LocalizedStack` applies stored locale on boot).

- [ ] **Step 6: Gate + commit**

```bash
npx tsc --noEmit && npx jest
git add src/services/export.ts src/services/export.test.ts app/settings.tsx
git commit -m "feat(export): tested PDF/JSON report builders and settings screen"
```

---

### Task 14: Docs, simulator smoke, ship

**Files:**
- Rewrite: `README.md`
- Verify: whole app on iOS simulator

**Interfaces:**
- Consumes: everything.
- Produces: pushed `main`, tag `v2.0.0-alpha`.

- [ ] **Step 1: Rewrite `README.md`**

```markdown
# Allergy Tracker

Introduce your baby's foods one at a time, watch the trial window, and the
food list becomes a traffic light you can trust.

**Native iOS · 100% on-device · no account, no server — your baby's data
never leaves the phone.**

## How it works
1. Pick a food (56 built-in — big-9 allergens flagged high-risk — or add your own).
2. Start a trial. The app schedules gentle check-in reminders through the
   watch window (default 3 days). One food at a time — that's the point.
3. Log a reaction (symptoms, severity, notes) → food turns **red**.
   Window passes clean → **green**. The Foods list is the answer to
   "can my baby eat this?"
4. One tap exports a doctor-ready PDF report or a JSON backup.

## Stack
Expo (React Native, TypeScript) · Expo Router · expo-sqlite + Drizzle ORM
(on-device relational DB, statuses derived at read time, never stored) ·
expo-notifications (all local) · i18next (EN/KO) · Jest.

## Run
```bash
npm install
npx expo run:ios   # dev build on the iOS simulator
npx jest           # unit tests (status derivation, scheduling, export)
```

## History
v1 (MammaCare — Capacitor + FastAPI/Postgres) is archived at tag
`archive/v1-capacitor`. v2 is a ground-up rebuild; design spec in
`docs/superpowers/specs/`.

*Tracking aid, not medical advice. Always consult your pediatrician.*
```

- [ ] **Step 2: Full simulator smoke** (`npx expo run:ios`), checking in order:

1. First launch → setup card → enter name + birthdate → dashboard appears.
2. Foods list shows 56 seeded foods; search filters; high-risk badges on egg/peanut/etc.
3. Add custom food "Dragon fruit" → lands on its detail page, status Not tried.
4. Start trial on Egg → permission prompt appears (first trial only) → Home shows "Day 1 of 3"; starting another food's trial is blocked with the one-at-a-time alert.
5. Log reaction on Egg (hives + severe) → emergency advisory visible → save → Egg shows Reacted; Home active card gone.
6. Retest Egg → new trial starts (retest allowed).
7. Cancel that trial → Egg back to Reacted (cancelled invisible).
8. Settings: window days changes; language switch EN↔KO relabels the app; PDF share sheet opens with populated report; JSON share sheet opens.
9. Device Settings → Notifications shows pending trial notifications while a trial is active (or use `Notifications.getAllScheduledNotificationsAsync` via a temporary log).
10. i18n: set simulator to Korean → app boots in Korean.

- [ ] **Step 3: Final gates + ship**

```bash
npx tsc --noEmit && npx jest
git add README.md
git commit -m "docs: README for Allergy Tracker v2"
git push origin main
git tag v2.0.0-alpha && git push origin v2.0.0-alpha
```

---

## Post-v1 backlog (documented, NOT planned)
Multi-baby · reaction photos · JSON import/restore · dark mode · Android pass · App Store build (EAS). Each needs its own spec/plan cycle.
