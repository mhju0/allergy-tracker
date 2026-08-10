// The persistence adapter must carry the still-open predicate in the UPDATE,
// so a stale cancel or safe command cannot overwrite a finished outcome.
const captured: { sql: string; params: unknown[] }[] = [];

jest.mock('../db/client', () => {
  const { drizzle } = jest.requireActual('drizzle-orm/sqlite-proxy');
  const proxy = drizzle(async (sql: string, params: unknown[]) => {
    captured.push({ sql, params });
    return { rows: [] };
  });
  return { db: { transaction: (work: (tx: unknown) => unknown) => work(proxy) } };
});
jest.mock('../services/notify', () => ({
  ensurePermission: jest.fn(),
  isPermissionGranted: jest.fn(),
  replaceTrialNotifications: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));

import { sqliteLifecyclePersistence } from './sqlite';

test('closeOpenTrial SQL only targets a still-open Trial', () => {
  sqliteLifecyclePersistence.transaction((transaction) => {
    transaction.closeOpenTrial('t1', 'cancelled', new Date('2026-07-18T03:00:00Z'));
  });

  const update = captured.find((call) => call.sql.toLowerCase().startsWith('update'));
  expect(update).toBeDefined();
  expect(update!.sql.toLowerCase()).toContain('("trial"."id" = ? and "trial"."outcome" is null)');
  expect(update!.params).toContain('t1');
});
