export const MS_PER_DAY = 86_400_000;

export type TrialLike = {
  id: string;
  startedAt: Date;
  windowDays: number;
  outcome: 'safe' | 'reacted' | 'cancelled' | null;
  endedAt?: Date | null; // present on real Trial rows; calendar tinting clamps to it
};

export type FoodStatus = 'untried' | 'testing' | 'reacted' | 'safe';

export function windowEnd(t: Pick<TrialLike, 'startedAt' | 'windowDays'>): Date {
  return new Date(t.startedAt.getTime() + t.windowDays * MS_PER_DAY);
}

export function isWindowElapsed(t: TrialLike, now: Date): boolean {
  return now.getTime() >= windowEnd(t).getTime();
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function latestTrial<T extends TrialLike>(trials: T[]): T | undefined {
  return [...trials]
    .filter((t) => t.outcome !== 'cancelled')
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
}

export function deriveStatus(trials: TrialLike[]): FoodStatus {
  const latest = latestTrial(trials);
  if (!latest) return 'untried';
  switch (latest.outcome) {
    case null:
      return 'testing';
    case 'safe':
      return 'safe';
    case 'reacted':
      return 'reacted';
    case 'cancelled':
      // unreachable: latestTrial filters cancelled trials
      throw new Error('deriveStatus: cancelled trial escaped latestTrial filter');
  }
}

// Which days a check-in may be dated to. The ledger offers missed days, so the
// date became an input — and an observation can only belong to a day the window
// actually covered, and only to one that has happened.
export function isObservableDay(
  t: Pick<TrialLike, 'startedAt' | 'windowDays'>, occurredAt: Date, now: Date,
): boolean {
  return occurredAt.getTime() <= now.getTime()
    && occurredAt.getTime() >= t.startedAt.getTime()
    && occurredAt.getTime() < windowEnd(t).getTime();
}

// How much of a window was actually observed. Derived, never stored — same
// discipline as deriveStatus.
//
// A trial that ends without check-ins is not the same record as one watched
// every day, and until now nothing anywhere could tell them apart: the ledger
// painted a closed-safe window green regardless, and the doctor's report
// printed a bare 안전. Everything that claims safety asks this first.
export type Observed = Pick<TrialLike, 'startedAt' | 'windowDays'> & {
  checkins: { occurredAt: Date }[];
};

export function coverage(t: Observed): { observed: number; of: number } {
  let observed = 0;
  for (let i = 0; i < t.windowDays; i++) {
    const day = new Date(t.startedAt.getTime() + i * MS_PER_DAY);
    // Days, not rows: two check-ins on one day are one observed day, and a
    // check-in outside the window counts for nothing.
    if (t.checkins.some((c) => isSameLocalDay(c.occurredAt, day))) observed++;
  }
  return { observed, of: t.windowDays };
}

export type AutoClose = { trialId: string; outcome: 'safe' | 'cancelled' };

export type StartDecision =
  | { allowed: true; autoClose: AutoClose | null }
  | { allowed: false; reason: 'trial_in_progress' };

// Which outcome an elapsed window has earned. A window that ran its course with
// at least one observation behind it closes 안전; one with none closes 미완료.
//
// The second case used to close 안전 too, which meant starting the next food
// could silently print 안전 for a food nobody ever watched — in the food list,
// in the status counts, and in the doctor's report. Elapsed time is not
// evidence. 미완료 sends the food back to 안 먹어봄, and the feed itself stays
// on the food's own history page, which shows cancelled trials.
export function autoCloseOutcome(t: Observed): AutoClose['outcome'] {
  return coverage(t).observed === 0 ? 'cancelled' : 'safe';
}

// Invariant: an active trial (outcome null) never has reactions —
// logging a reaction immediately sets outcome='reacted'.
export function decideStartTrial(
  activeTrial: (TrialLike & Observed) | undefined, now: Date,
): StartDecision {
  if (!activeTrial) return { allowed: true, autoClose: null };
  if (isWindowElapsed(activeTrial, now)) {
    return {
      allowed: true,
      autoClose: { trialId: activeTrial.id, outcome: autoCloseOutcome(activeTrial) },
    };
  }
  return { allowed: false, reason: 'trial_in_progress' };
}

// The autoclose is a silent write, so the two screens that disclose it used to
// restate the rule — the picker predicting it, Home reconstructing it. Both ask
// here now, so the copy cannot drift from what startTrial actually does.

type WithLatest = { status: FoodStatus; latest: (TrialLike & Observed) | undefined };

// Which food starting anything right now would close, and how — the picker
// discloses the outcome, so it has to be told which one.
export function pendingAutoclose<T extends WithLatest>(
  foods: T[], now: Date,
): { food: T; outcome: AutoClose['outcome'] } | undefined {
  const active = foods.find((f) => f.status === 'testing');
  if (!active?.latest) return undefined;
  const decision = decideStartTrial(active.latest, now);
  return decision.allowed && decision.autoClose
    ? { food: active, outcome: decision.autoClose.outcome }
    : undefined;
}

// Which food this trial's start already closed, and how. The autoclose stamps
// endedAt at the same instant as the new trial's startedAt, so it stays
// derivable.
//
// Searches every trial rather than each food's `latest`: latestTrial skips
// cancelled trials, so a window auto-closed 미완료 would be invisible here and
// the silent write would go undisclosed — the exact thing this exists to stop.
export function autoclosedBy<T extends { trials: TrialLike[] }>(
  foods: T[], trial: TrialLike,
): { food: T; outcome: AutoClose['outcome'] } | undefined {
  for (const f of foods) {
    for (const tr of f.trials) {
      if (tr.id === trial.id || tr.endedAt?.getTime() !== trial.startedAt.getTime()) continue;
      if (tr.outcome === 'safe' || tr.outcome === 'cancelled') return { food: f, outcome: tr.outcome };
    }
  }
  return undefined;
}
