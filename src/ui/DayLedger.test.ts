import { buildLedger } from './DayLedger';
import type { TrialLike } from '../domain/status';

const D = (s: string) => new Date(s);
// Stand-in for i18next: returns the key so assertions read as states, and
// interpolates {{n}} so day labels stay distinguishable.
const t = (key: string, opts?: Record<string, unknown>) =>
  opts && 'n' in opts ? `${key}:${opts.n}` : key;

const trial = (over: Partial<TrialLike>): TrialLike => ({
  id: 't1', startedAt: D('2026-07-16T09:00:00'), windowDays: 3, outcome: null, endedAt: null, ...over,
});

const states = (days: ReturnType<typeof buildLedger>) => days.map((d) => d.state);

describe('buildLedger', () => {
  const DURING = D('2026-07-17T12:00:00'); // day 2 of a 16th-start window
  const AFTER = D('2026-07-25T12:00:00');

  it('renders one cell per windowDays — never assumes 3', () => {
    for (const windowDays of [1, 2, 3, 5, 7]) {
      expect(buildLedger(trial({ windowDays }), [], null, AFTER, t)).toHaveLength(windowDays);
    }
  });

  it('labels days from 1, in order', () => {
    const days = buildLedger(trial({ windowDays: 3 }), [], null, AFTER, t);
    expect(days.map((d) => d.label)).toEqual(['ledger.day:1', 'ledger.day:2', 'ledger.day:3']);
  });

  it('a check-in clears its day and stamps the time', () => {
    const days = buildLedger(trial({}), [D('2026-07-17T19:04:00')], null, DURING, t);
    expect(states(days)).toEqual(['pending', 'cleared', 'pending']);
    expect(days[1].stamp).toMatch(/7:04|19:04|오후/);
  });

  it("marks the active trial's current day as today, and later days as pending", () => {
    const days = buildLedger(trial({}), [], null, DURING, t);
    expect(states(days)).toEqual(['pending', 'today', 'pending']);
    expect(days[1].stamp).toBe('ledger.notYet');
  });

  it('a reaction takes its day, over any check-in on it', () => {
    const days = buildLedger(
      trial({ outcome: 'reacted', endedAt: D('2026-07-17T14:30:00') }),
      [D('2026-07-17T08:00:00')],
      D('2026-07-17T14:30:00'),
      AFTER,
      t,
    );
    expect(days[1].state).toBe('reacted');
  });

  it('days after an early end read as stopped, not merely unrecorded', () => {
    const days = buildLedger(
      trial({ outcome: 'reacted', endedAt: D('2026-07-17T14:30:00') }),
      [],
      D('2026-07-17T14:30:00'),
      AFTER,
      t,
    );
    expect(states(days)).toEqual(['pending', 'reacted', 'stopped']);
  });

  it('a completed-safe window reads cleared throughout, even on days with no check-in', () => {
    const days = buildLedger(
      trial({ outcome: 'safe', endedAt: D('2026-07-19T09:00:00') }),
      [D('2026-07-17T19:00:00')],
      null,
      AFTER,
      t,
    );
    expect(states(days)).toEqual(['cleared', 'cleared', 'cleared']);
    // the outcome is recorded; the individual observation simply was not
    expect(days[0].stamp).toBe('');
    expect(days[1].stamp).not.toBe('');
  });

  it('an active trial never marks a day as today once the window has elapsed', () => {
    const days = buildLedger(trial({}), [], null, AFTER, t);
    expect(states(days)).not.toContain('today');
  });

  it('a 1-day window is a single cell, and it is today while the trial runs', () => {
    const days = buildLedger(
      trial({ windowDays: 1 }),
      [],
      null,
      D('2026-07-16T12:00:00'),
      t,
    );
    expect(states(days)).toEqual(['today']);
  });
});
