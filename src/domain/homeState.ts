import {
  isWindowElapsed, latestTrial, windowEnd, MS_PER_DAY, type FoodStatus, type TrialLike,
} from './status';
import { coverage } from '../observation';
import type { RecordedTrial } from './records';

// What Home shows. Derived, never stored — same discipline as deriveStatus.
//
// Home used to have two branches: an active trial, or "everything else". That
// second branch is why logging a reaction ended the trial and dropped Home onto
// a green "N가지 안전" screen. The states below split that branch by what
// actually last happened, so a reaction can render as a reaction.
//
// Generic over the food shape so this module never imports a db type; app/
// passes the Drizzle `Food` row and gets it back on the state.

// Trials arrive from the connected read model with their own records attached.
export type HomeTrial = RecordedTrial;

export type HomeState<F> =
  | { kind: 'empty' }
  | { kind: 'observing'; food: F; trial: HomeTrial; day: number }
  | { kind: 'confirm'; food: F; trial: HomeTrial }
  | { kind: 'safe'; food: F; trial: HomeTrial; safeCount: number }
  | { kind: 'reacted'; food: F; trial: HomeTrial };

export type HomeFood<F> = { food: F; trials: HomeTrial[]; status: FoodStatus; latest: HomeTrial | undefined };

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

// ── what Home renders ────────────────────────────────────────────────────────
// The two derivations below used to sit at the bottom of app/index.tsx: pure,
// module-scope, and not exported, so nothing could test them. They switch over
// the state machine above, which makes them the same module's business.

type ReactionLike = { occurredAt: Date; severity: string; symptoms: string[] };
type Translate = (key: string, opts?: Record<string, unknown>) => string;

export type HomeView<F> = {
  state: HomeState<F>;
  subline: string; // the field's secondary line
  filled: number; // window segments lit
};

// One call for the whole field: state, its line, and how much of the window it
// has run. Home finds nothing out for itself.
export function describeHome<F>(foods: HomeFood<F>[], now: Date, t: Translate): HomeView<F> {
  const state = deriveHomeState(foods, now);
  if (state.kind === 'empty') return { state, subline: t('home.empty'), filled: 0 };
  const reaction = state.kind === 'reacted' ? state.trial.reactions[0] : undefined;
  return { state, subline: subline(state, reaction, t), filled: segmentsFilled(state) };
}

type WithTrial<F> = Extract<HomeState<F>, { trial: unknown }>;

// Each state says something different enough that a single interpolated string
// would be dishonest for three of the four.
function subline<F>(state: WithTrial<F>, reaction: ReactionLike | undefined, t: Translate): string {
  switch (state.kind) {
    case 'observing':
      return t('home.sub.observing', {
        day: state.day,
        total: state.trial.windowDays,
        date: windowEnd(state.trial).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
      });
    // Both of these are the app talking about a window it is calling safe, so
    // both say how much of it was actually watched — and confirm dates the end
    // of the window, because this state persists indefinitely and "관찰이
    // 끝났어요" reads the same on day 4 as it does three weeks later.
    case 'confirm':
      return t('home.sub.confirm', {
        total: state.trial.windowDays,
        date: windowEnd(state.trial).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
        observed: coverage(state.trial).observed,
      });
    case 'safe':
      return t('home.sub.safe', {
        total: state.trial.windowDays,
        observed: coverage(state.trial).observed,
        count: state.safeCount,
      });
    case 'reacted':
      return reaction
        ? t('home.sub.reacted', {
            day: trialDay(state.trial, reaction.occurredAt),
            severity: t(`reaction.severityLevel.${reaction.severity}`),
            symptoms: reaction.symptoms.map((s) => t(`reaction.symptom.${s}`)).join(', '),
          })
        : t('status.reacted');
  }
}

// A closed trial lights every day it actually ran — a reaction on day 2 of 3
// lights two, not three.
function segmentsFilled<F>(state: WithTrial<F>): number {
  switch (state.kind) {
    case 'observing':
      return state.day;
    case 'confirm':
    case 'safe':
      return state.trial.windowDays;
    case 'reacted':
      return state.trial.endedAt ? trialDay(state.trial, state.trial.endedAt) : state.trial.windowDays;
  }
}

// The non-cancelled trial that ended most recently, across every food.
// Ordered by endedAt, not startedAt — a trial started earlier can end later.
function latestClosed<F>(foods: HomeFood<F>[]): { food: F; trial: HomeTrial } | undefined {
  let best: { food: F; trial: HomeTrial } | undefined;
  for (const f of foods) {
    const t = latestTrial(f.trials);
    if (!t?.endedAt || t.outcome === null) continue;
    if (!best || t.endedAt.getTime() > best.trial.endedAt!.getTime()) best = { food: f.food, trial: t };
  }
  return best;
}
