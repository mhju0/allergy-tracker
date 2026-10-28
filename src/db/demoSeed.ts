import { db } from './client';
import { baby, checkin, reaction, trial } from './schema';
import { buildDemoHistory } from './demoData';

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
