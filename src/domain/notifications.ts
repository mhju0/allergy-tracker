import { MS_PER_DAY, windowEnd } from './status';

export type PlannedNotification =
  | { kind: 'checkin'; day: number; fireAt: Date }
  | { kind: 'windowEnd'; attempt: number; fireAt: Date };

const MORNING = 9;
// Day 1 is asked in the evening, not the next morning. It is the day the food
// was actually eaten — the one immediate reactions happen on — and it was the
// only day of the window the app never asked about, so a parent who answered
// every prompt still ended with a window that read 2/3 observed.
const FEED_EVENING = 19;
// One prompt, then two chances to come back — and then silence. An unanswered
// window used to go quiet forever after a single ask, which left the trial
// sitting in 'confirm' indefinitely; nagging past this doesn't help either.
const RETRY_DAYS = [1, 3];

function at(d: Date, hour: number): Date {
  const out = new Date(d);
  out.setHours(hour, 0, 0, 0);
  return out;
}

// The whole schedule: which prompts a trial earns, and which of them are still
// in the future. Both halves are policy, so both live here — the notify service
// only delivers what this returns.
export function computeTrialNotifications(
  startedAt: Date, windowDays: number, now: Date,
): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  out.push({ kind: 'checkin', day: 1, fireAt: at(startedAt, FEED_EVENING) });
  for (let day = 2; day <= windowDays; day++) {
    const fireAt = at(new Date(startedAt.getTime() + (day - 1) * MS_PER_DAY), MORNING);
    out.push({ kind: 'checkin', day, fireAt });
  }

  // The close prompt fires when the window closes, but never before 09:00 —
  // a trial started at 03:00 used to be asked to mark it safe at 03:00. It is
  // never moved earlier than the close: isWindowElapsed gates the 안전으로 표시
  // button, so an earlier prompt would offer an action that isn't there yet.
  const end = windowEnd({ startedAt, windowDays });
  const first = new Date(Math.max(end.getTime(), at(end, MORNING).getTime()));

  out.push({ kind: 'windowEnd', attempt: 0, fireAt: first });
  RETRY_DAYS.forEach((offset, i) => {
    out.push({ kind: 'windowEnd', attempt: i + 1, fireAt: at(new Date(first.getTime() + offset * MS_PER_DAY), MORNING) });
  });

  return out.filter((p) => p.fireAt.getTime() > now.getTime()); // never schedule the past
}
