import { buildLedger } from './DayLedger';
import type { CheckinLike, RecordedTrial } from '../domain/records';

const D = (s: string) => new Date(s);
// Stand-in for i18next: returns the key so assertions read as states, and
// interpolates {{n}} so day labels stay distinguishable.
const t = (key: string, opts?: Record<string, unknown>) =>
  opts && 'n' in opts ? `${key}:${opts.n}` : key;

const trial = (over: Partial<RecordedTrial>): RecordedTrial => ({
  id: 't1', startedAt: D('2026-07-16T09:00:00'), windowDays: 3, outcome: null, endedAt: null,
  reactions: [], checkins: [], ...over,
});
// buildLedger reads check-in rows off the trial; only the instant matters here.
let c = 0;
const at = (d: Date): CheckinLike => ({ id: `c${c++}`, trialId: 't1', occurredAt: d });
const on = (...dates: Date[]) => dates.map(at);
const react = (d: Date) => [{ id: 'r1', trialId: 't1', occurredAt: d, severity: 'mild', symptoms: ['hives'] }];

const states = (days: ReturnType<typeof buildLedger>) => days.map((d) => d.state);

describe('buildLedger', () => {
  const DURING = D('2026-07-17T12:00:00'); // day 2 of a 16th-start window
  const AFTER = D('2026-07-25T12:00:00');

  it('renders one cell per windowDays — never assumes 3', () => {
    for (const windowDays of [1, 2, 3, 5, 7]) {
      expect(buildLedger(trial({ windowDays }), AFTER, t)).toHaveLength(windowDays);
    }
  });

  it('labels days from 1, in order', () => {
    const days = buildLedger(trial({ windowDays: 3 }), AFTER, t);
    expect(days.map((d) => d.label)).toEqual(['ledger.day:1', 'ledger.day:2', 'ledger.day:3']);
  });

  it('a check-in clears its day and stamps the time', () => {
    const days = buildLedger(trial({ checkins: on(D('2026-07-17T19:04:00')) }), DURING, t);
    expect(states(days)).toEqual(['unobserved', 'cleared', 'pending']);
    expect(days[1].stamp).toMatch(/7:04|19:04|오후/);
  });

  it("marks the active trial's current day as today, and later days as pending", () => {
    const days = buildLedger(trial({}), DURING, t);
    expect(states(days)).toEqual(['unobserved', 'today', 'pending']);
    expect(days[1].stamp).toBe('ledger.notYet');
  });

  it('a reaction takes its day, over any check-in on it', () => {
    const days = buildLedger(trial({
      outcome: 'reacted', endedAt: D('2026-07-17T14:30:00'),
      checkins: on(D('2026-07-17T08:00:00')), reactions: react(D('2026-07-17T14:30:00')),
    }), AFTER, t);
    expect(days[1].state).toBe('reacted');
  });

  it('days after an early end read as stopped, not merely unrecorded', () => {
    const days = buildLedger(trial({
      outcome: 'reacted', endedAt: D('2026-07-17T14:30:00'), reactions: react(D('2026-07-17T14:30:00')),
    }), AFTER, t);
    expect(states(days)).toEqual(['unobserved', 'reacted', 'stopped']);
  });

  it('a completed-safe window still shows which days nobody actually watched', () => {
    const days = buildLedger(trial({
      outcome: 'safe', endedAt: D('2026-07-19T09:00:00'), checkins: on(D('2026-07-17T19:00:00')),
    }), AFTER, t);
    // was ['cleared','cleared','cleared'] — a safe outcome used to repaint every
    // unlogged day 이상 없음, which is an observation the app invented
    expect(states(days)).toEqual(['unobserved', 'cleared', 'unobserved']);
    expect(days[1].stamp).not.toBe('');
  });

  it('a safe window with no check-ins at all clears nothing', () => {
    const days = buildLedger(trial({ outcome: 'safe', endedAt: D('2026-07-19T09:00:00') }), AFTER, t);
    expect(states(days)).toEqual(['unobserved', 'unobserved', 'unobserved']);
  });

  it('an active trial never marks a day as today once the window has elapsed', () => {
    const days = buildLedger(trial({}), AFTER, t);
    expect(states(days)).not.toContain('today');
  });

  it('a 1-day window is a single cell, and it is today while the trial runs', () => {
    const days = buildLedger(trial({ windowDays: 1 }), D('2026-07-16T12:00:00'), t);
    expect(states(days)).toEqual(['today']);
  });
});
