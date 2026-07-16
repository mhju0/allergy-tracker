export const MS_PER_DAY = 86_400_000;

export type TrialLike = {
  id: string;
  startedAt: Date;
  windowDays: number;
  outcome: 'safe' | 'reacted' | 'cancelled' | null;
};

export type FoodStatus = 'untried' | 'testing' | 'reacted' | 'safe';

export function windowEnd(t: Pick<TrialLike, 'startedAt' | 'windowDays'>): Date {
  return new Date(t.startedAt.getTime() + t.windowDays * MS_PER_DAY);
}

export function isWindowElapsed(t: TrialLike, now: Date): boolean {
  return now.getTime() >= windowEnd(t).getTime();
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
// logging a reaction immediately sets outcome='reacted' (Task 6).
export function decideStartTrial(activeTrial: TrialLike | undefined, now: Date): StartDecision {
  if (!activeTrial) return { allowed: true, autoCloseSafeTrialId: null };
  if (isWindowElapsed(activeTrial, now)) {
    return { allowed: true, autoCloseSafeTrialId: activeTrial.id };
  }
  return { allowed: false, reason: 'trial_in_progress' };
}
