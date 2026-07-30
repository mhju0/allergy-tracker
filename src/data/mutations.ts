import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { baby, checkin, food, reaction, trial, type Checkin, type Trial } from '../db/schema';
import { decideStartTrial, isObservableDay, isSameLocalDay, isWindowElapsed, latestTrial } from '../domain/status';
import { computeTrialNotifications } from '../domain/notifications';
import { cancelTrialNotifications, scheduleTrialNotifications } from '../services/notify';
import { newId } from './ids';

// Carries its check-ins: the autoclose outcome depends on whether the window
// was ever observed, so the decision cannot be made from the trial row alone.
async function getActiveTrial(): Promise<(Trial & { checkins: Checkin[] }) | undefined> {
  const rows = await db.select().from(trial).where(isNull(trial.outcome));
  const active = rows[0];
  if (!active) return undefined;
  const checkins = await db.select().from(checkin).where(eq(checkin.trialId, active.id));
  return { ...active, checkins };
}

export async function startTrial(
  f: { id: string; isCustom: boolean; name: string }, windowDays: number, now: Date,
): Promise<{ ok: true } | { ok: false; reason: 'trial_in_progress' }> {
  const active = await getActiveTrial();
  const decision = decideStartTrial(active, now);
  if (!decision.allowed) return { ok: false, reason: decision.reason };
  if (decision.autoClose) {
    await db.update(trial)
      .set({ outcome: decision.autoClose.outcome, endedAt: now })
      .where(eq(trial.id, decision.autoClose.trialId));
    await cancelTrialNotifications(decision.autoClose.trialId);
  }
  const t = { id: newId(), foodId: f.id, startedAt: now, windowDays, outcome: null, endedAt: null };
  await db.insert(trial).values(t);
  await scheduleTrialNotifications(t.id, f, computeTrialNotifications(now, windowDays, now));
  return { ok: true };
}

export async function logReaction(
  foodId: string,
  input: { symptoms: string[]; severity: 'mild' | 'moderate' | 'severe'; occurredAt: Date; note: string | null },
  now: Date,
): Promise<{ ok: true } | { ok: false; reason: 'no_trial' }> {
  const trials = await db.select().from(trial).where(eq(trial.foodId, foodId));
  const latest = latestTrial(trials);
  if (!latest) return { ok: false, reason: 'no_trial' };
  await db.insert(reaction).values({ id: newId(), trialId: latest.id, ...input });
  if (latest.outcome !== 'reacted') {
    // active trial → close it; closed-safe trial → delayed reaction flips it (spec §4)
    await db.update(trial).set({ outcome: 'reacted', endedAt: now }).where(eq(trial.id, latest.id));
  }
  if (latest.outcome === null) await cancelTrialNotifications(latest.id);
  return { ok: true };
}

export type CheckinFailure = 'no_active_trial' | 'outside_window' | 'already_logged';

// `occurredAt` used to be implicit — always the moment of the tap. The ledger
// now offers missed days, so the day is an input, and an input at a trust
// boundary gets bounded here rather than in the two screens that pass it.
export async function logCheckin(
  foodId: string, occurredAt: Date, now: Date,
): Promise<{ ok: true } | { ok: false; reason: CheckinFailure }> {
  const trials = await db.select().from(trial).where(eq(trial.foodId, foodId));
  const latest = latestTrial(trials);
  if (!latest || latest.outcome !== null) return { ok: false, reason: 'no_active_trial' };
  if (!isObservableDay(latest, occurredAt, now)) return { ok: false, reason: 'outside_window' };
  const logged = await db.select().from(checkin).where(eq(checkin.trialId, latest.id));
  if (logged.some((c) => isSameLocalDay(c.occurredAt, occurredAt))) {
    return { ok: false, reason: 'already_logged' };
  }
  await db.insert(checkin).values({
    id: newId(), trialId: latest.id, occurredAt, note: null,
    backfilledAt: isSameLocalDay(occurredAt, now) ? null : now,
  });
  return { ok: true };
}

export async function confirmSafe(
  trialId: string, now: Date,
): Promise<{ ok: true } | { ok: false; reason: 'window_not_elapsed' }> {
  const rows = await db.select().from(trial).where(eq(trial.id, trialId));
  const t = rows[0];
  if (!t || t.outcome !== null) return { ok: true }; // already closed — idempotent
  if (!isWindowElapsed(t, now)) return { ok: false, reason: 'window_not_elapsed' };
  await db.update(trial).set({ outcome: 'safe', endedAt: now }).where(eq(trial.id, trialId));
  await cancelTrialNotifications(trialId);
  return { ok: true };
}

export async function cancelTrial(trialId: string, now: Date): Promise<void> {
  // never overwrite a finished outcome (safe/reacted) via a stale id
  await db.update(trial)
    .set({ outcome: 'cancelled', endedAt: now })
    .where(and(eq(trial.id, trialId), isNull(trial.outcome)));
  await cancelTrialNotifications(trialId);
}

export async function addCustomFood(name: string): Promise<string> {
  const id = newId();
  await db.insert(food).values({ id, name: name.trim(), isCustom: true, allergenGroup: null });
  return id;
}

export async function updateBabySettings(
  patch: Partial<{ name: string | null; birthdate: Date | null; welcomedAt: Date | null }>,
): Promise<void> {
  const rows = await db.select().from(baby);
  if (rows[0]) await db.update(baby).set(patch).where(eq(baby.id, rows[0].id));
}
