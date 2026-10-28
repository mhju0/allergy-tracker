import { readMigrationFiles } from 'drizzle-orm/migrator';

type Row = Record<string, unknown>;
type Database = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    all(...params: unknown[]): Row[];
    get(...params: unknown[]): Row | undefined;
  };
  close(): void;
};

// Bridge only Expo's statement transport. Drizzle still generates the SQL,
// converts timestamps/booleans, and executes BEGIN/COMMIT/ROLLBACK itself.
// Node's built-in SQLite supplies the database; no native app or extra package.
export function createTestDatabase() {
  const { DatabaseSync } = jest.requireActual<{ DatabaseSync: new (path: string) => Database }>('node:sqlite');
  const { drizzle } = jest.requireActual('drizzle-orm/expo-sqlite');
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of readMigrationFiles({ migrationsFolder: 'drizzle' })) {
    for (const sql of migration.sql) sqlite.exec(sql);
  }
  const queries: string[] = [];
  const db: typeof import('../src/db/client').db = drizzle({
    prepareSync(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        executeSync(params: unknown[]) {
          queries.push(sql);
          let written: ReturnType<typeof statement.run> | undefined;
          const run = () => written ??= statement.run(...params);
          return {
            get changes() { return run().changes; },
            get lastInsertRowId() { return run().lastInsertRowid; },
            getAllSync: () => statement.all(...params),
            getFirstSync: () => statement.get(...params),
          };
        },
        executeForRawResultSync(params: unknown[]) {
          queries.push(sql);
          return { getAllSync: () => statement.all(...params).map(Object.values) };
        },
      };
    },
  });
  return { db, sqlite, queries };
}
