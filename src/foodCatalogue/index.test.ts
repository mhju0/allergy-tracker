import { projectFoodCatalogue, type CatalogueEntry } from '.';
import type { FoodStatus } from '../domain/status';
import type { FamilyId } from '../db/families';

const D = (value: string) => new Date(value);
const NOW = D('2026-07-20T12:00:00Z');

const LABELS: Record<string, string> = {
  egg: '계란', milk: '우유', rice: '쌀', wheat: '밀', salmon: '연어', cod: '대구',
  greenbean: '그린빈',
};
const FAMILY_LABELS: Partial<Record<FamilyId, string>> = {
  dairy: '유제품', egg: '알', grain: '곡물', fish: '생선',
};

function entry(
  id: string,
  status: FoodStatus,
  options: { highRisk?: boolean; startedAt?: Date; endedAt?: Date | null; observed?: boolean } = {},
): CatalogueEntry {
  const startedAt = options.startedAt ?? D('2026-07-19T12:00:00Z');
  const latest = status === 'untried' ? undefined : {
    id: `t-${id}`,
    foodId: id,
    startedAt,
    windowDays: 3,
    outcome: status === 'testing' ? null : status,
    endedAt: options.endedAt ?? null,
    observations: options.observed
      ? [{ id: `o-${id}`, trialId: `t-${id}`, occurredAt: new Date(startedAt.getTime() + 6 * 60 * 60 * 1000) }]
      : [],
  } as const;
  return {
    food: {
      id,
      name: id,
      isCustom: false,
      allergenGroup: options.highRisk ? id : null,
    },
    status,
    latest,
  };
}

const project = (
  foods: CatalogueEntry[],
  options: { query?: string; filter?: FoodStatus | null } = {},
) => projectFoodCatalogue({
  foods,
  now: NOW,
  query: options.query ?? '',
  filter: options.filter ?? null,
  foodLabel: (item) => LABELS[item.food.id] ?? item.food.name,
  familyLabel: (family) => FAMILY_LABELS[family] ?? family,
});

describe('Food catalogue projection', () => {
  test('owns status counts and semantic row details', () => {
    const result = project([
      entry('egg', 'testing'),
      entry('milk', 'reacted', { endedAt: D('2026-07-18T09:00:00Z') }),
      entry('rice', 'safe'),
      entry('wheat', 'untried'),
    ]);

    expect(result.total).toBe(4);
    expect(result.counts).toEqual({ testing: 1, reacted: 1, safe: 1, untried: 1 });
    const foodRows = result.rows.filter((row) => row.kind === 'food');
    expect(foodRows.map((row) => row.detail)).toEqual([
      { kind: 'testing', day: 2, total: 3 },
      { kind: 'ended', at: D('2026-07-18T09:00:00Z') },
      { kind: 'status', status: 'safe' },
      { kind: 'untried' },
    ]);
  });

  test('search overrides a selected filter and sorts by status then localized food label', () => {
    const result = project([
      entry('milk', 'safe'),
      entry('egg', 'testing'),
      entry('cod', 'testing'),
      entry('rice', 'reacted'),
    ], { query: '계', filter: 'safe' });

    expect(result.rows.map((row) => row.kind === 'food' ? row.item.food.id : row.key))
      .toEqual(['egg']);
    expect(result.rows.every((row) => row.kind === 'food')).toBe(true);
  });

  test('a status filter returns food rows without section or family rows', () => {
    const result = project([
      entry('egg', 'testing'), entry('milk', 'safe'), entry('rice', 'untried'),
    ], { filter: 'untried' });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ kind: 'food', item: { food: { id: 'rice' } } });
  });

  test('default rows group untried foods by localized family and never drop unfamiliar foods', () => {
    const foods = [
      entry('rice', 'untried'),
      entry('salmon', 'untried', { highRisk: true }),
      entry('greenbean', 'untried'),
      entry('egg', 'testing'),
      entry('cod', 'untried', { highRisk: true }),
    ];
    const result = project(foods);

    expect(result.rows.map((row) => row.kind === 'food' ? row.item.food.id : row.key)).toEqual([
      'h-tried', 'egg', 'h-untried', 'f-grain', 'rice', 'f-fish', 'cod', 'salmon', 'greenbean',
    ]);
    expect(result.rows.find((row) => row.kind === 'family' && row.family === 'fish'))
      .toMatchObject({ count: 2, allHighRisk: true });
    expect(result.rows.filter((row) => row.kind === 'food').map((row) => row.item.food.id).sort())
      .toEqual(foods.map((item) => item.food.id).sort());
  });

  test('a mixed-risk family keeps risk metadata on its high-risk food row', () => {
    const result = project([
      entry('wheat', 'untried', { highRisk: true }),
      entry('rice', 'untried'),
    ]);

    expect(result.rows.find((row) => row.kind === 'family'))
      .toMatchObject({ allHighRisk: false });
    expect(result.rows.find((row) => row.kind === 'food' && row.item.food.id === 'wheat'))
      .toMatchObject({ highRisk: true, hideHighRisk: false });
  });

  test('discloses the outcome an elapsed active Trial will receive on the next start', () => {
    const active = entry('egg', 'testing', {
      startedAt: D('2026-07-16T12:00:00Z'),
      observed: true,
    });

    expect(project([active, entry('rice', 'untried')]).pendingAutoClose)
      .toEqual({ food: active, outcome: 'safe' });
  });
});
