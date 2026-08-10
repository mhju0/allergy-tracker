import { familyOf, type FamilyId } from '../db/families';
import { trialDay } from '../domain/homeState';
import {
  pendingAutoclose,
  type FoodStatus,
  type Observed,
  type TrialLike,
} from '../domain/status';

export type CatalogueEntry = {
  food: {
    id: string;
    name: string;
    isCustom: boolean;
    allergenGroup: string | null;
  };
  status: FoodStatus;
  latest: (TrialLike & Observed & { foodId: string }) | undefined;
};

export type CatalogueDetail =
  | { kind: 'testing'; day: number; total: number }
  | { kind: 'untried' }
  | { kind: 'ended'; at: Date }
  | { kind: 'status'; status: FoodStatus };

export type CatalogueRow<T extends CatalogueEntry> =
  | { kind: 'header'; key: string; section: 'tried' | 'untried'; count: number }
  | { kind: 'family'; key: string; family: FamilyId; count: number; allHighRisk: boolean }
  | {
    kind: 'food';
    key: string;
    item: T;
    detail: CatalogueDetail;
    highRisk: boolean;
    hideHighRisk: boolean;
  };

const STATUS_ORDER: Record<FoodStatus, number> = {
  testing: 0,
  reacted: 1,
  safe: 2,
  untried: 3,
};

function detailOf(item: CatalogueEntry, now: Date): CatalogueDetail {
  if (item.status === 'testing' && item.latest) {
    return {
      kind: 'testing',
      day: trialDay(item.latest, now),
      total: item.latest.windowDays,
    };
  }
  if (item.status === 'untried') return { kind: 'untried' };
  if (item.latest?.endedAt) return { kind: 'ended', at: item.latest.endedAt };
  return { kind: 'status', status: item.status };
}

function foodRow<T extends CatalogueEntry>(item: T, now: Date, hideHighRisk = false): CatalogueRow<T> {
  return {
    kind: 'food',
    key: item.food.id,
    item,
    detail: detailOf(item, now),
    highRisk: Boolean(item.food.allergenGroup),
    hideHighRisk,
  };
}

export function projectFoodCatalogue<T extends CatalogueEntry>({
  foods,
  now,
  query,
  filter,
  foodLabel,
  familyLabel,
}: {
  foods: T[];
  now: Date;
  query: string;
  filter: FoodStatus | null;
  foodLabel: (item: T) => string;
  familyLabel: (family: FamilyId) => string;
}): {
  total: number;
  counts: Record<FoodStatus, number>;
  rows: CatalogueRow<T>[];
  pendingAutoClose: ReturnType<typeof pendingAutoclose<T>>;
} {
  const counts: Record<FoodStatus, number> = {
    testing: 0,
    reacted: 0,
    safe: 0,
    untried: 0,
  };
  for (const item of foods) counts[item.status]++;

  const normalizedQuery = query.trim().toLowerCase();
  const matched = foods
    .filter((item) => foodLabel(item).toLowerCase().includes(normalizedQuery))
    .filter((item) => (filter && !normalizedQuery ? item.status === filter : true))
    .sort((a, b) => (
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || foodLabel(a).localeCompare(foodLabel(b))
    ));

  if (filter || normalizedQuery) {
    return {
      total: foods.length,
      counts,
      rows: matched.map((item) => foodRow(item, now)),
      pendingAutoClose: pendingAutoclose(foods, now),
    };
  }

  const rows: CatalogueRow<T>[] = [];
  const tried = matched.filter((item) => item.status !== 'untried');
  const untried = matched.filter((item) => item.status === 'untried');
  if (tried.length > 0) {
    rows.push({ kind: 'header', key: 'h-tried', section: 'tried', count: tried.length });
    rows.push(...tried.map((item) => foodRow(item, now)));
  }
  if (untried.length > 0) {
    rows.push({ kind: 'header', key: 'h-untried', section: 'untried', count: untried.length });
    const byFamily = new Map<FamilyId, T[]>();
    const unfamiliar: T[] = [];
    for (const item of untried) {
      const family = familyOf(item.food.id);
      if (!family) {
        unfamiliar.push(item);
        continue;
      }
      const members = byFamily.get(family) ?? [];
      members.push(item);
      byFamily.set(family, members);
    }
    const families = [...byFamily.keys()]
      .sort((a, b) => familyLabel(a).localeCompare(familyLabel(b)));
    for (const family of families) {
      const members = byFamily.get(family)!;
      const allHighRisk = members.every((item) => Boolean(item.food.allergenGroup));
      rows.push({
        kind: 'family',
        key: `f-${family}`,
        family,
        count: members.length,
        allHighRisk,
      });
      rows.push(...members.map((item) => foodRow(item, now, allHighRisk)));
    }
    rows.push(...unfamiliar.map((item) => foodRow(item, now)));
  }

  return {
    total: foods.length,
    counts,
    rows,
    pendingAutoClose: pendingAutoclose(foods, now),
  };
}
