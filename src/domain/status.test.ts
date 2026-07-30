import {
  autoclosedBy, coverage, deriveStatus, decideStartTrial, isObservableDay, isWindowElapsed,
  latestTrial, pendingAutoclose, windowEnd, MS_PER_DAY, TrialLike,
} from './status';

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
// logCheckin is user input. This is the bound on it.
describe('isObservableDay', () => {
  const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
  const NOW = D('2026-07-04T12:00:00Z'); // window elapsed

  test('a day inside the window that has already happened', () => {
    expect(isObservableDay(t, D('2026-07-02T10:00:00Z'), NOW)).toBe(true);
  });
  test('the start instant itself is day 1', () => {
    expect(isObservableDay(t, D('2026-07-01T10:00:00Z'), NOW)).toBe(true);
  });
  test('a moment before the trial started belongs to no day of it', () => {
    expect(isObservableDay(t, D('2026-07-01T09:59:59Z'), NOW)).toBe(false);
  });
  test('the window end is past the last day, not on it', () => {
    expect(isObservableDay(t, windowEnd(t), NOW)).toBe(false);
    expect(isObservableDay(t, new Date(windowEnd(t).getTime() - 1), NOW)).toBe(true);
  });
  test('a day that has not happened yet cannot have been observed', () => {
    expect(isObservableDay(t, D('2026-07-03T10:00:00Z'), D('2026-07-02T12:00:00Z'))).toBe(false);
  });
});

// Local dates on purpose: coverage counts calendar days, not 24h blocks.
describe('coverage', () => {
  const obs = (windowDays: number, ...days: string[]) => ({
    startedAt: new Date('2026-07-16T18:00:00'),
    windowDays,
    checkins: days.map((d) => ({ occurredAt: new Date(d) })),
  });

  test('a window nobody watched → 0 of 3', () => {
    expect(coverage(obs(3))).toEqual({ observed: 0, of: 3 });
  });
  test('one check-in per day → 3 of 3', () => {
    expect(coverage(obs(3, '2026-07-16T20:00:00', '2026-07-17T09:00:00', '2026-07-18T09:00:00')))
      .toEqual({ observed: 3, of: 3 });
  });
  test('two check-ins on one day are one observed day', () => {
    expect(coverage(obs(3, '2026-07-17T09:00:00', '2026-07-17T21:00:00')))
      .toEqual({ observed: 1, of: 3 });
  });
  test('a check-in after the window counts for nothing', () => {
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
  test('no active trial → allowed, nothing to close', () => {
    expect(decideStartTrial(undefined, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoCloseSafeTrialId: null });
  });
  test('active trial, window elapsed → allowed with implicit-safe close', () => {
    const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(decideStartTrial(t, D('2026-07-04T10:00:00Z')))
      .toEqual({ allowed: true, autoCloseSafeTrialId: t.id });
  });
  test('active trial inside window → blocked', () => {
    const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(decideStartTrial(t, D('2026-07-03T10:00:00Z')))
      .toEqual({ allowed: false, reason: 'trial_in_progress' });
  });
});

// Both screens that disclose the silent autoclose used to restate the rule
// themselves — the picker predicting it, Home reconstructing it from
// timestamps. These are those two questions, asked of the rule.
describe('pendingAutoclose', () => {
  const entry = (status: 'testing' | 'safe' | 'untried', latest?: TrialLike) => ({ status, latest });

  test('elapsed active trial → that food would be closed', () => {
    const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    const foods = [entry('safe', mk({ outcome: 'safe' })), entry('testing', t)];
    expect(pendingAutoclose(foods, D('2026-07-04T10:00:00Z'))).toBe(foods[1]);
  });
  test('window still running → nothing would be closed', () => {
    const t = mk({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
    expect(pendingAutoclose([entry('testing', t)], D('2026-07-03T09:00:00Z'))).toBeUndefined();
  });
  test('no active trial → nothing would be closed', () => {
    expect(pendingAutoclose([entry('safe', mk({ outcome: 'safe' }))], D('2026-07-04T10:00:00Z')))
      .toBeUndefined();
  });
});

describe('autoclosedBy', () => {
  const started = D('2026-07-04T10:00:00Z');
  const newTrial = mk({ id: 'new', startedAt: started });

  test('the trial closed at the new trial’s start instant', () => {
    const closed = mk({ id: 'old', outcome: 'safe', endedAt: started });
    const foods = [{ latest: closed }, { latest: newTrial }];
    expect(autoclosedBy(foods, newTrial)).toBe(foods[0]);
  });
  test('a trial closed a moment earlier was not this start’s doing', () => {
    const closed = mk({ id: 'old', outcome: 'safe', endedAt: D('2026-07-04T09:59:59Z') });
    expect(autoclosedBy([{ latest: closed }], newTrial)).toBeUndefined();
  });
  test('a reacted trial is never an autoclose', () => {
    const closed = mk({ id: 'old', outcome: 'reacted', endedAt: started });
    expect(autoclosedBy([{ latest: closed }], newTrial)).toBeUndefined();
  });
  test('the starting trial never reports itself', () => {
    expect(autoclosedBy([{ latest: newTrial }], newTrial)).toBeUndefined();
  });
});
