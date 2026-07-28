import { isWindowElapsed, latestTrial, MS_PER_DAY, type FoodStatus, type TrialLike } from './status';

// What Home shows. Derived, never stored — same discipline as deriveStatus.
//
// Home used to have two branches: an active trial, or "everything else". That
// second branch is why logging a reaction ended the trial and dropped Home onto
// a green "N가지 안전" screen. The states below split that branch by what
// actually last happened, so a reaction can render as a reaction.
//
// Generic over the food shape so this module never imports a db type; app/
// passes the Drizzle `Food` row and gets it back on the state.

export type HomeState<F> =
  | { kind: 'empty' }
  | { kind: 'observing'; food: F; trial: TrialLike; day: number }
  | { kind: 'confirm'; food: F; trial: TrialLike }
  | { kind: 'safe'; food: F; trial: TrialLike; safeCount: number }
  | { kind: 'reacted'; food: F; trial: TrialLike };

export type HomeFood<F> = { food: F; trials: TrialLike[]; status: FoodStatus; latest: TrialLike | undefined };

// Day n of the window, 1-based, clamped to the window length.
export function trialDay(t: Pick<TrialLike, 'startedAt' | 'windowDays'>, now: Date): number {
  return Math.min(t.windowDays, Math.floor((now.getTime() - t.startedAt.getTime()) / MS_PER_DAY) + 1);
}

export function deriveHomeState<F>(foods: HomeFood<F>[], now: Date): HomeState<F> {
  const active = foods.find((f) => f.status === 'testing');
  if (active?.latest) {
    const trial = active.latest;
    return isWindowElapsed(trial, now)
      ? { kind: 'confirm', food: active.food, trial }
      : { kind: 'observing', food: active.food, trial, day: trialDay(trial, now) };
  }

  const closed = latestClosed(foods);
  if (!closed) return { kind: 'empty' };

  // The branch Home never had. Both states persist until the next trial starts
  // — that genuinely is the last thing that happened. See §9 of the plan for
  // why there is no time-based decay.
  return closed.trial.outcome === 'reacted'
    ? { kind: 'reacted', food: closed.food, trial: closed.trial }
    : {
        kind: 'safe',
        food: closed.food,
        trial: closed.trial,
        safeCount: foods.filter((f) => f.status === 'safe').length,
      };
}

// The non-cancelled trial that ended most recently, across every food.
// Ordered by endedAt, not startedAt — a trial started earlier can end later.
function latestClosed<F>(foods: HomeFood<F>[]): { food: F; trial: TrialLike } | undefined {
  let best: { food: F; trial: TrialLike } | undefined;
  for (const f of foods) {
    const t = latestTrial(f.trials);
    if (!t?.endedAt || t.outcome === null) continue;
    if (!best || t.endedAt.getTime() > best.trial.endedAt!.getTime()) best = { food: f.food, trial: t };
  }
  return best;
}
