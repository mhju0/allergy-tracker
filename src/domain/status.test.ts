import {
  deriveStatus, decideStartTrial, isWindowElapsed, latestTrial, windowEnd,
  MS_PER_DAY, TrialLike,
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
