import { coverage, MS_PER_DAY } from '../observation';

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

export function latestTrial<T extends TrialLike>(trials: T[]): T | undefined {
  let latest: T | undefined;
  for (const trial of trials) {
    if (trial.outcome !== 'cancelled' && (!latest || trial.startedAt.getTime() > latest.startedAt.getTime())) {
      latest = trial;
    }
  }
  return latest;
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

// Safety disclosures use recorded coverage, never elapsed time alone.
export type Observed = Pick<TrialLike, 'startedAt' | 'windowDays'> & {
  observations: { occurredAt: Date }[];
};

export type AutoClose = { trialId: string; outcome: 'safe' | 'cancelled' };

export type StartDecision =
  | { allowed: true; autoClose: AutoClose | null }
  | { allowed: false; reason: 'trial_in_progress' };

// An elapsed window closes safe with evidence, otherwise incomplete.
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
      if (!isWindowElapsed(tr, trial.startedAt)) continue;
      if (tr.outcome === 'safe' || tr.outcome === 'cancelled') return { food: f, outcome: tr.outcome };
    }
  }
  return undefined;
}
