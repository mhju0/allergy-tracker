import { and, eq, notInArray, sql } from 'drizzle-orm';
import { db } from './client';
import { baby, checkin, food, reaction, trial } from './schema';
import { CATALOG } from './catalog';
import { buildDemoHistory } from './demoData';
import { randomUUID as newId } from 'expo-crypto';

export async function seedIfEmpty(): Promise<void> {
  // The single settings row (window days; optional name/birthdate for the
  // doctor report) is created here — there is no setup screen.
  const babyRow = await db.select({ id: baby.id }).from(baby).limit(1);
  if (babyRow.length === 0) {
    await db.insert(baby).values({ id: newId(), name: null, birthdate: null, defaultWindowDays: 3 });
  }
  // Reconcile additions and risk-group corrections on every launch. Update
  // only catalogue metadata; stable ids, history and legacy custom rows stay.
  await db
    .insert(food)
    .values(
      CATALOG.map((c) => ({
        id: c.id,
        name: `foodName.${c.id}`,
        isCustom: false,
        allergenGroup: c.group,
      })),
    )
    .onConflictDoUpdate({
      target: food.id,
      set: { allergenGroup: sql`excluded.allergen_group` },
      setWhere: and(
        eq(food.isCustom, false),
        sql`${food.allergenGroup} is not excluded.allergen_group`,
      ),
    });
  // ...and drop seeded foods REMOVED from the catalog since (they'd render as
  // raw i18n keys), but never ones the user has trial history for — those keep
  // a legacy name in ko.json.
  //
  // The is_custom guard outlives the feature it was written for. User-added
  // foods were removed in 2026-08, but an install from an older build can still
  // hold one, and its name is literal Korean rather than an i18n key — so it
  // must not be swept up here just for being absent from CATALOG.
  await db.delete(food).where(
    and(
      eq(food.isCustom, false),
      notInArray(food.id, CATALOG.map((c) => c.id)),
      notInArray(food.id, db.select({ id: trial.foodId }).from(trial)),
    ),
  );
}

// EXPO_PUBLIC_DEMO=1 only: fill an untouched install with ~45 days of
// history for demos. No-ops as soon as a baby row exists.
export async function seedDemoIfEmpty(now: Date): Promise<void> {
  const existing = await db.select({ id: baby.id }).from(baby).limit(1);
  if (existing.length > 0) return;
  const demo = buildDemoHistory(now);
  await db.insert(baby).values(demo.babyRow);
  await db.insert(trial).values(demo.trials);
  await db.insert(reaction).values(demo.reactions);
  await db.insert(checkin).values(demo.checkins);
}
