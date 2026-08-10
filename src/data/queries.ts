import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { db } from '../db/client';
import { baby, checkin, food, reaction, trial, type Baby, type Checkin, type Food, type Reaction, type Trial } from '../db/schema';
import { deriveStatus, latestTrial, type FoodStatus } from '../domain/status';

export function useBaby(): Baby | undefined {
  const { data } = useLiveQuery(db.select().from(baby));
  return data?.[0];
}

// A trial with everything that was ever recorded against it. Four flat tables
// went out of here once, and every screen rebuilt the trial→reaction and
// Trial→Observation joins for itself — the report's did it at O(n·m). The join
// happens here now, once.
export type TrialWithRecords = Trial & { reactions: Reaction[]; observations: Checkin[] };
export type FoodWithStatus = {
  food: Food;
  trials: TrialWithRecords[];
  status: FoodStatus;
  latest: TrialWithRecords | undefined;
};

export function useFoodsWithStatus(): FoodWithStatus[] {
  const { data: foods } = useLiveQuery(db.select().from(food));
  const { data: trials } = useLiveQuery(db.select().from(trial));
  const { data: reactions } = useLiveQuery(db.select().from(reaction));
  const { data: checkins } = useLiveQuery(db.select().from(checkin));
  return useMemo(
    () => connectFoods(foods ?? [], trials ?? [], reactions ?? [], checkins ?? []),
    [foods, trials, reactions, checkins],
  );
}

// Pure, so the shape the whole app reads has a test that doesn't need a device.
export function connectFoods(
  foods: Food[], trials: Trial[], reactions: Reaction[], checkins: Checkin[],
): FoodWithStatus[] {
  const byTrial = new Map<string, TrialWithRecords>();
  const byFood = new Map<string, TrialWithRecords[]>();
  for (const t of trials) {
    const withRecords: TrialWithRecords = { ...t, reactions: [], observations: [] };
    byTrial.set(t.id, withRecords);
    const list = byFood.get(t.foodId) ?? [];
    list.push(withRecords);
    byFood.set(t.foodId, list);
  }
  // Chronological, never insertion order — the row order sqlite hands back is
  // not a promise anything should read.
  for (const r of [...reactions].sort(byTime)) byTrial.get(r.trialId)?.reactions.push(r);
  for (const c of [...checkins].sort(byTime)) byTrial.get(c.trialId)?.observations.push(c);

  return foods.map((f) => {
    const ts = byFood.get(f.id) ?? [];
    return { food: f, trials: ts, status: deriveStatus(ts), latest: latestTrial(ts) };
  });
}

const byTime = (a: { occurredAt: Date }, b: { occurredAt: Date }) =>
  a.occurredAt.getTime() - b.occurredAt.getTime();

// Every row, for the JSON backup. Not a hook — the settings screen used to run
// these five selects itself, which was the only Drizzle call left in app/.
export async function readAllTables() {
  const [b, f, tr, re, ch] = await Promise.all([
    db.select().from(baby), db.select().from(food),
    db.select().from(trial), db.select().from(reaction), db.select().from(checkin),
  ]);
  return { baby: b, foods: f, trials: tr, reactions: re, checkins: ch };
}
