// cancelTrial must never overwrite a finished outcome (safe/reacted) if handed
// a stale trial id — the UPDATE itself has to carry the outcome IS NULL guard.
// Asserted on the generated SQL via a capturing sqlite-proxy driver.
const mockCaptured: { sql: string; params: unknown[] }[] = [];

jest.mock('../db/client', () => {
  const { drizzle } = jest.requireActual('drizzle-orm/sqlite-proxy');
  return {
    db: drizzle(async (sql: string, params: unknown[]) => {
      mockCaptured.push({ sql, params });
      return { rows: [] };
    }),
  };
});
jest.mock('../services/notify', () => ({
  cancelTrialNotifications: jest.fn(),
  scheduleTrialNotifications: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));

import { cancelTrial } from './mutations';

test('cancelTrial SQL only targets a still-open trial', async () => {
  await cancelTrial('t1', new Date('2026-07-18T03:00:00Z'));
  const update = mockCaptured.find((c) => c.sql.toLowerCase().startsWith('update'));
  expect(update).toBeDefined();
  expect(update!.sql.toLowerCase()).toContain('"outcome" is null');
  expect(update!.params).toContain('t1');
});
