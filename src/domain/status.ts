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

export type StartDecision =
  | { allowed: true; autoCloseSafeTrialId: string | null }
  | { allowed: false; reason: 'trial_in_progress' };

// Invariant: an active trial (outcome null) never has reactions —
// logging a reaction immediately sets outcome='reacted'.
export function decideStartTrial(activeTrial: TrialLike | undefined, now: Date): StartDecision {
  if (!activeTrial) return { allowed: true, autoCloseSafeTrialId: null };
  if (isWindowElapsed(activeTrial, now)) {
    return { allowed: true, autoCloseSafeTrialId: activeTrial.id };
  }
  return { allowed: false, reason: 'trial_in_progress' };
}

// The autoclose is a silent write, so the two screens that disclose it used to
// restate the rule — the picker predicting it, Home reconstructing it. Both ask
// here now, so the copy cannot drift from what startTrial actually does.

type WithLatest = { status: FoodStatus; latest: TrialLike | undefined };

// Which food starting anything right now would close as 안전.
export function pendingAutoclose<T extends WithLatest>(foods: T[], now: Date): T | undefined {
  const active = foods.find((f) => f.status === 'testing');
  if (!active?.latest) return undefined;
  return decideStartTrial(active.latest, now).allowed ? active : undefined;
}

// Which food this trial's start already closed. The autoclose stamps endedAt at
// the same instant as the new trial's startedAt, so it stays derivable.
export function autoclosedBy<T extends { latest: TrialLike | undefined }>(
  foods: T[], trial: TrialLike,
): T | undefined {
  return foods.find(
    (f) =>
      f.latest !== undefined &&
      f.latest.id !== trial.id &&
      f.latest.outcome === 'safe' &&
      f.latest.endedAt?.getTime() === trial.startedAt.getTime(),
  );
}
