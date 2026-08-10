import {
  autoclosedBy, deriveStatus, decideStartTrial, isWindowElapsed,
  latestTrial, pendingAutoclose, windowEnd, TrialLike,
} from './status';
import { coverage, isEligibleObservationDay, MS_PER_DAY } from '../observation';

const D = (s: string) => new Date(s);
let n = 0;
const mk = (over: Partial<TrialLike>): TrialLike => ({
  id: `t${n++}`, startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3, outcome: null, ...over,
});

describe('deriveStatus', () => {
  test('no trials → untried', () => {
    expect(deriveStatus([])).toBe('untried');
  });
  test('active trial → testing (even past window — no auto-flip)', () => {
    expect(deriveStatus([mk({})])).toBe('testing');
  });
  test('latest outcome safe → safe', () => {
    expect(deriveStatus([mk({ outcome: 'safe' })])).toBe('safe');
  });
  test('latest outcome reacted → reacted', () => {
    expect(deriveStatus([mk({ outcome: 'reacted' })])).toBe('reacted');
  });
  test('retest wins: reacted then later safe → safe', () => {
    expect(deriveStatus([
      mk({ startedAt: D('2026-07-01T10:00:00Z'), outcome: 'reacted' }),
      mk({ startedAt: D('2026-07-10T10:00:00Z'), outcome: 'safe' }),
    ])).toBe('safe');
  });
  test('cancelled trials are invisible: safe then cancelled → safe', () => {
    expect(deriveStatus([
      mk({ startedAt: D('2026-07-01T10:00:00Z'), outcome: 'safe' }),
      mk({ startedAt: D('2026-07-10T10:00:00Z'), outcome: 'cancelled' }),
    ])).toBe('safe');
  });
  test('only cancelled trials → untried', () => {
    expect(deriveStatus([mk({ outcome: 'cancelled' })])).toBe('untried');
  });
});

describe('window math', () => {
  const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
  test('windowEnd = startedAt + windowDays', () => {
    expect(windowEnd(t).getTime()).toBe(D('2026-07-01T10:00:00Z').getTime() + 3 * MS_PER_DAY);
  });
  test('not elapsed 1ms before boundary', () => {
    expect(isWindowElapsed(t, new Date(windowEnd(t).getTime() - 1))).toBe(false);
  });
  test('elapsed exactly at boundary', () => {
    expect(isWindowElapsed(t, windowEnd(t))).toBe(true);
  });
});

// The ledger lets a parent fill in a day they missed, so the date reaching
// A backfilled Observation day is user input. This is the bound on it.
describe('isEligibleObservationDay', () => {
  const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
  const NOW = D('2026-07-04T12:00:00Z'); // window elapsed

  test('a day inside the window that has already happened', () => {
    expect(isEligibleObservationDay(t, D('2026-07-02T10:00:00Z'), NOW)).toBe(true);
  });
  test('the start instant itself is day 1', () => {
    expect(isEligibleObservationDay(t, D('2026-07-01T10:00:00Z'), NOW)).toBe(true);
  });
  test('a moment before the trial started belongs to no day of it', () => {
    expect(isEligibleObservationDay(t, D('2026-07-01T09:59:59Z'), NOW)).toBe(false);
  });
  test('the last day of the window is the third one, not the closing instant', () => {
    expect(isEligibleObservationDay(t, D('2026-07-03T13:00:00Z'), NOW)).toBe(true); // 22:00 on day 3
    expect(isEligibleObservationDay(t, windowEnd(t), NOW)).toBe(false);
  });
  test('a day that has not happened yet cannot have been observed', () => {
    expect(isEligibleObservationDay(t, D('2026-07-03T10:00:00Z'), D('2026-07-02T12:00:00Z'))).toBe(false);
  });

  // The window is 72 hours but observation is by calendar day, so a late start
  // spills into a fourth one. It has no ledger cell and no place in coverage,
  // so an Observation there was stored and then counted by nothing.
  test('the fourth calendar day a late-evening start spills into is not a day of the window', () => {
    const late = mk({ startedAt: D('2026-07-01T14:30:00Z'), windowDays: 3 }); // 23:30 KST
    const fourth = D('2026-07-04T05:00:00Z'); // 14:00 KST on day four, still inside the 72h
    expect(fourth.getTime()).toBeLessThan(windowEnd(late).getTime());
    expect(isEligibleObservationDay(late, fourth, D('2026-07-04T06:00:00Z'))).toBe(false);
  });
});

// Local dates on purpose: coverage counts calendar days, not 24h blocks.
describe('coverage', () => {
  const obs = (windowDays: number, ...days: string[]) => ({
    startedAt: new Date('2026-07-16T18:00:00'),
    windowDays,
    observations: days.map((d) => ({ occurredAt: new Date(d) })),
  });

  test('a window nobody watched → 0 of 3', () => {
    expect(coverage(obs(3))).toEqual({ observed: 0, of: 3 });
  });
  test('one Observation per day → 3 of 3', () => {
    expect(coverage(obs(3, '2026-07-16T20:00:00', '2026-07-17T09:00:00', '2026-07-18T09:00:00')))
      .toEqual({ observed: 3, of: 3 });
  });
  test('two Observation rows on one day are one observed day', () => {
    expect(coverage(obs(3, '2026-07-17T09:00:00', '2026-07-17T21:00:00')))
      .toEqual({ observed: 1, of: 3 });
  });
  test('an Observation after the window counts for nothing', () => {
    expect(coverage(obs(3, '2026-07-19T09:00:00'))).toEqual({ observed: 0, of: 3 });
  });
  test('the denominator is the trial’s own window, not 3', () => {
    expect(coverage(obs(1, '2026-07-16T20:00:00'))).toEqual({ observed: 1, of: 1 });
  });
});

describe('latestTrial', () => {
  test('picks most recent non-cancelled by startedAt', () => {
    const a = mk({ startedAt: D('2026-07-01T00:00:00Z'), outcome: 'safe' });
    const b = mk({ startedAt: D('2026-07-05T00:00:00Z'), outcome: 'cancelled' });
    expect(latestTrial([a, b])?.id).toBe(a.id);
  });
});

describe('decideStartTrial', () => {
  // Trials reaching this decision carry their Observations: whether the window was
  // ever observed is what decides which outcome an autoclose writes.
  const obs = (over: Partial<TrialLike>, ...days: string[]) => ({
    ...mk(over), observations: days.map((d) => ({ occurredAt: D(d) })),
  });

  test('no active trial → allowed, nothing to close', () => {
    expect(decideStartTrial(undefined, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoClose: null });
  });
  test('an elapsed window that was observed closes 안전', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 }, '2026-07-02T10:00:00Z');
    expect(decideStartTrial(t, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoClose: { trialId: t.id, outcome: 'safe' } });
  });
  // Elapsed time is not evidence. This used to write 'safe', so starting the
  // next food could print 안전 for a food nobody ever watched.
  test('an elapsed window nobody observed closes 미완료, not 안전', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(decideStartTrial(t, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoClose: { trialId: t.id, outcome: 'cancelled' } });
  });
  test('a single backfilled day is still an observation', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 }, '2026-07-03T10:00:00Z');
    const d = decideStartTrial(t, D('2026-07-04T10:00:00Z'));
    expect(d.allowed && d.autoClose?.outcome).toBe('safe');
  });
  test('active trial inside window → blocked', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(decideStartTrial(t, D('2026-07-03T10:00:00Z')))
      .toEqual({ allowed: false, reason: 'trial_in_progress' });
  });
});

// Both screens that disclose the silent autoclose used to restate the rule
// themselves — the picker predicting it, Home reconstructing it from
// timestamps. These are those two questions, asked of the rule.
describe('pendingAutoclose', () => {
  const obs = (over: Partial<TrialLike>, ...days: string[]) => ({
    ...mk(over), observations: days.map((d) => ({ occurredAt: D(d) })),
  });
  const entry = (status: 'testing' | 'safe' | 'untried', latest?: ReturnType<typeof obs>) =>
    ({ status, latest });

  test('elapsed observed trial → that food would be closed 안전', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 }, '2026-07-02T10:00:00Z');
    const foods = [entry('safe', obs({ outcome: 'safe' })), entry('testing', t)];
    expect(pendingAutoclose(foods, D('2026-07-04T10:00:00Z')))
      .toEqual({ food: foods[1], outcome: 'safe' });
  });
  test('elapsed unobserved trial → the picker is told it would be 미완료', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    const foods = [entry('testing', t)];
    expect(pendingAutoclose(foods, D('2026-07-04T10:00:00Z'))?.outcome).toBe('cancelled');
  });
  test('window still running → nothing would be closed', () => {
    const t = obs({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(pendingAutoclose([entry('testing', t)], D('2026-07-03T09:00:00Z'))).toBeUndefined();
  });
  test('no active trial → nothing would be closed', () => {
    expect(pendingAutoclose([entry('safe', obs({ outcome: 'safe' }))], D('2026-07-04T10:00:00Z')))
      .toBeUndefined();
  });
});

describe('autoclosedBy', () => {
  const started = D('2026-07-04T10:00:00Z');
  const newTrial = mk({ id: 'new', startedAt: started });

  test('the trial closed at the new trial’s start instant', () => {
    const closed = mk({ id: 'old', outcome: 'safe', endedAt: started });
    const foods = [{ trials: [closed] }, { trials: [newTrial] }];
    expect(autoclosedBy(foods, newTrial)).toEqual({ food: foods[0], outcome: 'safe' });
  });
  // latestTrial hides cancelled trials, so reading each food's `latest` would
  // have made the 미완료 autoclose invisible — a silent write, undisclosed.
  test('an unobserved window closed 미완료 is still reported', () => {
    const closed = mk({ id: 'old', outcome: 'cancelled', endedAt: started });
    expect(autoclosedBy([{ trials: [closed] }], newTrial)?.outcome).toBe('cancelled');
  });
  test('a trial closed a moment earlier was not this start’s doing', () => {
    const closed = mk({ id: 'old', outcome: 'safe', endedAt: D('2026-07-04T09:59:59Z') });
    expect(autoclosedBy([{ trials: [closed] }], newTrial)).toBeUndefined();
  });
  test('a reacted trial is never an autoclose', () => {
    const closed = mk({ id: 'old', outcome: 'reacted', endedAt: started });
    expect(autoclosedBy([{ trials: [closed] }], newTrial)).toBeUndefined();
  });
  test('the starting trial never reports itself', () => {
    expect(autoclosedBy([{ trials: [newTrial] }], newTrial)).toBeUndefined();
  });
});
