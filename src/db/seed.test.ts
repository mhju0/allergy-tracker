import { readMigrationFiles } from 'drizzle-orm/migrator';
import { CATALOG } from './catalog';
import { seedIfEmpty } from './seed';

// Node's built-in SQLite keeps these tests dependency-free (CI uses Node 22).
type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
};
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => SqliteDatabase;
}>('node:sqlite');
let mockSqlite: SqliteDatabase;

jest.mock('../data/ids', () => ({ newId: () => 'test-baby' }));

// Run Drizzle's seed queries against real SQLite, without the native Expo
// driver. This exercises conflicts, foreign keys and history preservation.
jest.mock('./client', () => {
  const { drizzle } = jest.requireActual('drizzle-orm/sqlite-proxy');
  return {
    db: drizzle(async (sql: string, params: unknown[], method: string) => {
      const statement = mockSqlite.prepare(sql);
      if (method === 'run') {
        statement.run(...params);
        return { rows: [] };
      }
      return { rows: statement.all(...params).map(Object.values) };
    }),
  };
});

beforeEach(() => {
  mockSqlite = new DatabaseSync(':memory:');
  for (const migration of readMigrationFiles({ migrationsFolder: 'drizzle' })) {
    for (const sql of migration.sql) mockSqlite.exec(sql);
  }
});

afterEach(() => mockSqlite.close());

function rows(table: 'baby' | 'food' | 'trial' | 'reaction' | 'checkin') {
  return mockSqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
}

test('a fresh install receives the whole catalogue and default settings', async () => {
  await seedIfEmpty();

  expect(rows('food')).toEqual(
    CATALOG.map((c) => ({
      id: c.id,
      name: `foodName.${c.id}`,
      is_custom: 0,
      allergen_group: c.group,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  );
  expect(rows('baby')).toEqual([expect.objectContaining({
    name: null, birthdate: null, default_window_days: 3, welcomed_at: null,
  })]);
});

test('an upgrade corrects risk groups and adds foods without altering history or settings', async () => {
  mockSqlite.exec(`
    INSERT INTO baby (id, name, birthdate, default_window_days, welcomed_at)
      VALUES ('b1', '아기', 1700000000, 5, 1750000000);
    INSERT INTO food (id, name, allergen_group) VALUES
      ('chestnut', 'foodName.chestnut', 'tree_nut'),
      ('egg', 'foodName.egg', NULL);
    INSERT INTO trial (id, food_id, started_at, window_days, outcome, ended_at)
      VALUES ('t1', 'chestnut', 1750000000, 5, 'reacted', 1750200000);
    INSERT INTO reaction (id, trial_id, symptoms, severity, occurred_at, note)
      VALUES ('r1', 't1', '["rash"]', 'mild', 1750200000, '기존 반응');
    INSERT INTO checkin (id, trial_id, occurred_at, backfilled_at, note)
      VALUES ('c1', 't1', 1750000000, 1750100000, '기존 관찰');
  `);
  const history = {
    baby: rows('baby'), trial: rows('trial'), reaction: rows('reaction'), checkin: rows('checkin'),
  };

  // Repeated launches must preserve the same personal records as the upgrade.
  for (let launch = 0; launch < 2; launch++) {
    await seedIfEmpty();
    const foods = rows('food');
    expect(foods).toHaveLength(CATALOG.length);
    expect(foods.find((f) => f.id === 'chestnut')).toEqual({
      id: 'chestnut', name: 'foodName.chestnut', is_custom: 0, allergen_group: null,
    });
    expect(foods.find((f) => f.id === 'egg')?.allergen_group).toBe('egg');
    expect({
      baby: rows('baby'), trial: rows('trial'), reaction: rows('reaction'), checkin: rows('checkin'),
    }).toEqual(history);
    expect(mockSqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  }
});

test('a legacy custom row is preserved even when its id matches a catalogue entry', async () => {
  mockSqlite.exec(`
    INSERT INTO food (id, name, is_custom, allergen_group)
      VALUES ('chestnut', '직접 입력한 밤', 1, 'tree_nut');
  `);
  const custom = rows('food')[0];

  await seedIfEmpty();

  expect(rows('food').find((f) => f.id === 'chestnut')).toEqual(custom);
});

test('only removed catalogue foods without history are deleted', async () => {
  mockSqlite.exec(`
    INSERT INTO food (id, name, is_custom) VALUES
      ('greenbean', 'foodName.greenbean', 0),
      ('tuna', 'foodName.tuna', 0),
      ('custom-flaxseed', '아마씨', 1);
    INSERT INTO trial (id, food_id, started_at, window_days, outcome, ended_at)
      VALUES ('old-trial', 'tuna', 1750000000, 3, 'safe', 1750300000);
  `);
  const retained = rows('food').filter((f) => f.id !== 'greenbean');
  const trials = rows('trial');

  await seedIfEmpty();

  expect(rows('food').find((f) => f.id === 'greenbean')).toBeUndefined();
  expect(rows('food')).toEqual(expect.arrayContaining(retained));
  expect(rows('trial')).toEqual(trials);
});
