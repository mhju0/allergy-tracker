import {
  autoclosedBy, deriveStatus, decideStartTrial, isWindowElapsed, latestTrial,
  pendingAutoclose, windowEnd, MS_PER_DAY, TrialLike,
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
