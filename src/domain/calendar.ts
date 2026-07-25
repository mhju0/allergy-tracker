import { MS_PER_DAY, isSameLocalDay, type TrialLike } from './status';

export type DayCell = { date: Date; inMonth: boolean };

export function monthMatrix(year: number, month0: number): DayCell[] {
  const startWeekday = new Date(year, month0, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const dayOfMonth = i - startWeekday + 1;
    return { date: new Date(year, month0, dayOfMonth), inMonth: dayOfMonth >= 1 && dayOfMonth <= daysInMonth };
  });
}

export const sameLocalDay = isSameLocalDay;

function localDayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// The last calendar day a window covers. A 3-day window covers the start day
// and the two after it. `windowEnd` is the INSTANT the window closes — i.e. the
// start of the 4th day — so using it as an inclusive day bound painted one cell
// too many, which is how a month of 3-day trials came to tint almost every day.
function lastScheduledDay(t: TrialLike): number {
  return localDayStart(new Date(t.startedAt.getTime() + (t.windowDays - 1) * MS_PER_DAY));
}

// The last day this trial has actually been observed through.
function coveredThrough(t: TrialLike, today: Date): number {
  const scheduled = lastScheduledDay(t);
  // An active trial has observed up to today and no further — tinting tomorrow
  // the same as today claims observations that have not happened.
  if (t.outcome === null) return Math.min(scheduled, localDayStart(today));
  // A reaction ends the window early; a late safe-confirm never extends it.
  return t.endedAt ? Math.min(scheduled, localDayStart(t.endedAt)) : scheduled;
}

function isInTrialWindow(date: Date, t: TrialLike, today: Date): boolean {
  const day = localDayStart(date);
  return day >= localDayStart(t.startedAt) && day <= coveredThrough(t, today);
}

// Order a single day's calendar events chronologically. At the same instant a
// trial's start must list AFTER every other event, so the autoclose→next-start
// handoff reads close-then-open (e.g. 소고기 안전 확인 before 달걀 테스트 시작 at
// 09:00) instead of interleaving the two foods. Event keys are kind-prefixed.
export function sortDayEvents<T extends { at: Date; key: string }>(rows: T[]): T[] {
  const startsLast = (key: string) => (key.startsWith('start-') ? 1 : 0);
  return [...rows].sort((a, b) => a.at.getTime() - b.at.getTime() || startsLast(a.key) - startsLast(b.key));
}

export type DayMark = { tint: 'amber' | 'green' | 'red' | null; dot: 'red' | 'green' | null };

// Tint states the day's status, the dot states that a record exists on it.
// Precedence: a reaction outranks everything; an observation still running
// outranks one already cleared (on an autoclose handoff day both cover it, and
// "watching now" is the more urgent fact).
export function dayMark(
  date: Date, trials: TrialLike[], reactionDays: Date[], checkinDays: Date[], today: Date,
): DayMark {
  if (reactionDays.some((d) => sameLocalDay(d, date))) return { tint: 'red', dot: 'red' };

  const dot = checkinDays.some((d) => sameLocalDay(d, date)) ? ('green' as const) : null;
  const covering = trials.filter((t) => t.outcome !== 'cancelled' && isInTrialWindow(date, t, today));
  if (covering.some((t) => t.outcome === null || t.outcome === 'reacted')) return { tint: 'amber', dot };
  // greenTint was defined in the token file with zero consumers, so a confirmed
  // safe outcome — the thing a parent is actually working toward — left no mark
  // on the calendar at all.
  if (covering.some((t) => t.outcome === 'safe')) return { tint: 'green', dot };
  return { tint: null, dot };
}
