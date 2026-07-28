// seedIfEmpty reconciles the food table against CATALOG on every launch:
// foods ADDED to the catalog must reach installs seeded by an older build,
// foods REMOVED must go (they'd render as raw i18n keys) — but never ones with
// trial history, and never custom foods. Asserted on the generated SQL via a
// capturing sqlite-proxy driver, per the no-incidental-behavior test rule.
const mockCaptured: { sql: string; params: unknown[] }[] = [];
// false = demo-seeded fresh install (custom 아마씨 only, no catalog rows);
// true = catalog already seeded by an older build (the upgrade path).
let mockCatalogSeeded = false;

jest.mock('./client', () => {
  const { drizzle } = jest.requireActual('drizzle-orm/sqlite-proxy');
  return {
    db: drizzle(async (sql: string, params: unknown[]) => {
      mockCaptured.push({ sql, params });
      const q = sql.trim().toLowerCase();
      if (!q.startsWith('select')) return { rows: [] };
      // A food query filtering on is_custom sees catalog rows only when
      // mockCatalogSeeded; an unfiltered one always sees the custom 아마씨 row.
      if (q.includes('from "food"')) {
        return q.includes('"is_custom"') ? { rows: mockCatalogSeeded ? [['egg']] : [] } : { rows: [['demo-food-flaxseed']] };
      }
      return { rows: [['b1']] }; // baby row always exists
    }),
  };
});

import { seedIfEmpty } from './seed';
import { CATALOG } from './catalog';

test.each([
  ['fresh install (only the demo custom 아마씨 exists)', false],
  ['install already seeded by an older, smaller catalog', true],
])('seedIfEmpty inserts the whole catalog on a %s', async (_label, seeded) => {
  mockCaptured.length = 0;
  mockCatalogSeeded = seeded;
  await seedIfEmpty();
  const ins = mockCaptured.find((c) => c.sql.toLowerCase().startsWith('insert into "food"'));
  // regression: an early return here stranded existing installs on the old
  // catalog — the 93 foods of the v1 import would never have appeared.
  expect(ins).toBeDefined();
  expect(ins!.sql.toLowerCase()).toContain('on conflict do nothing'); // rows already there are left alone
  for (const c of CATALOG) expect(ins!.params).toContain(c.id);
});

test('seedIfEmpty deletes catalog-removed seeded foods without trial history', async () => {
  mockCaptured.length = 0;
  mockCatalogSeeded = true;
  await seedIfEmpty();
  const del = mockCaptured.find((c) => c.sql.toLowerCase().startsWith('delete'));
  expect(del).toBeDefined();
  const sql = del!.sql.toLowerCase();
  expect(sql).toContain('delete from "food"');
  expect(sql).toContain('"is_custom" = ?'); // custom foods are never touched
  expect(sql).toContain('not in'); // id not in catalog
  expect(sql).toContain('from "trial"'); // ...and not referenced by any trial
  for (const c of CATALOG) expect(del!.params).toContain(c.id); // full catalog is the keep-list
});
