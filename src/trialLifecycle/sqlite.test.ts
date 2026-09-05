import { createTestDatabase } from '../../tests/sqlite';
import { sqliteLifecyclePersistence, startTrial, recordReaction, cancelTrial, confirmSafe } from './sqlite';
import { checkin, food, trial, reaction } from '../db/schema';

let mockDatabase: ReturnType<typeof createTestDatabase>;
jest.mock('../db/client', () => ({ get db() { return mockDatabase.db; } }));
jest.mock('../services/notify', () => ({
  ensurePermission: async () => false,
  isPermissionGranted: async () => false,
  replaceTrialNotifications: async () => undefined,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));

const egg = { id: 'egg', name: 'foodName.egg', isCustom: false };
const milk = { id: 'milk', name: 'foodName.milk', isCustom: false };
const NOW = new Date('2026-07-20T12:00:00Z');

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockDatabase = createTestDatabase();
  mockDatabase.db.insert(food).values([egg, milk]).run();
});
afterEach(() => {
  mockDatabase.sqlite.close();
  jest.useRealTimers();
});

function addTrial(id = 't1', startedAt = new Date('2026-07-19T12:00:00Z')) {
  mockDatabase.db.insert(trial).values({ id, foodId: 'egg', startedAt, windowDays: 3 }).run();
}

test('stale cancellation cannot overwrite a finished Trial', async () => {
  addTrial();
  mockDatabase.db.update(trial).set({ outcome: 'safe', endedAt: NOW }).run();
  expect(sqliteLifecyclePersistence.transaction((tx) => tx.closeOpenTrial('t1', 'cancelled', NOW))).toBe(false);
  expect(mockDatabase.db.select().from(trial).get()?.outcome).toBe('safe');
});

test('cancel-and-start replaces only the confirmed Trial in one transaction', async () => {
  addTrial();
  const result = await startTrial({ food: milk, windowDays: 3, replaceActiveTrialId: 't1' });
  expect(result).toMatchObject({ ok: true, autoClosed: null });
  expect(mockDatabase.db.select().from(trial).all()).toEqual([
    expect.objectContaining({ id: 't1', outcome: 'cancelled', endedAt: NOW }),
    expect.objectContaining({ foodId: 'milk', outcome: null, startedAt: NOW }),
  ]);
});

test('failed replacement rolls back cancellation and retains Observations', async () => {
  addTrial();
  mockDatabase.db.insert(checkin).values({ id: 'o1', trialId: 't1', occurredAt: NOW }).run();
  const before = mockDatabase.db.select().from(trial).all();
  // SQLite itself rejects this insert, after the cancellation UPDATE ran.
  const result = await startTrial({ food: { ...milk, id: 'missing-food' }, windowDays: 3, replaceActiveTrialId: 't1' });
  expect(result).toEqual({ ok: false, reason: 'persistence_failed' });
  expect(mockDatabase.db.select().from(trial).all()).toEqual(before);
  expect(mockDatabase.db.select().from(checkin).all()).toHaveLength(1);
});

test('a stale confirmation cannot cancel a different active Trial', async () => {
  addTrial('different-trial');
  await expect(startTrial({ food: milk, windowDays: 3, replaceActiveTrialId: 'old-trial' }))
    .resolves.toEqual({ ok: false, reason: 'trial_in_progress' });
  expect(mockDatabase.db.select().from(trial).all()).toHaveLength(1);
  expect(mockDatabase.db.select().from(trial).get()?.outcome).toBeNull();
});

test('a window that elapsed while the confirmation was open follows coverage rules', async () => {
  addTrial('t1', new Date('2026-07-16T12:00:00Z'));
  mockDatabase.db.insert(checkin).values({ id: 'o1', trialId: 't1', occurredAt: new Date('2026-07-17T12:00:00Z') }).run();
  await expect(startTrial({ food: milk, windowDays: 3, replaceActiveTrialId: 't1' }))
    .resolves.toMatchObject({ ok: true, autoClosed: { trialId: 't1', outcome: 'safe' } });
});

test('reaction logging reads Trials once and never loads unused Observations', async () => {
  for (let i = 0; i < 100; i++) {
    mockDatabase.db.insert(trial).values({
      id: `t${i}`, foodId: 'egg', startedAt: new Date(NOW.getTime() - (100 - i) * 86400000),
      windowDays: 3, outcome: 'safe', endedAt: NOW,
    }).run();
  }
  mockDatabase.queries.length = 0;
  await expect(recordReaction({ foodId: 'egg', symptoms: ['hives'], severity: 'mild', occurredAt: NOW, note: null }))
    .resolves.toMatchObject({ ok: true });
  expect(mockDatabase.queries.filter((sql) => sql.startsWith('select'))).toHaveLength(1);
  expect(mockDatabase.queries.some((sql) => sql.includes('"checkin"'))).toBe(false);
  expect(mockDatabase.db.select().from(reaction).get()?.trialId).toBe('t99');
});

test.each([cancelTrial, confirmSafe])('closing a Trial never loads unused Observations', async (close) => {
  addTrial('t1', new Date('2026-07-16T12:00:00Z'));
  mockDatabase.queries.length = 0;
  await expect(close({ trialId: 't1' })).resolves.toMatchObject({ ok: true });
  expect(mockDatabase.queries.filter((sql) => sql.startsWith('select'))).toHaveLength(1);
  expect(mockDatabase.queries.some((sql) => sql.includes('"checkin"'))).toBe(false);
});
