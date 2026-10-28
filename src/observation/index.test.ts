import { windowEnd } from '../domain/status';
import {
  coverage, createObservationModule, isEligibleObservationDay, isSameLocalDay, projectObservationDays,
  type ObservationLike, type ObservationTransaction, type ObservationTrial,
} from '.';

const D = (value: string) => new Date(value);

const trial = (over: Partial<ObservationTrial> = {}): ObservationTrial => ({
  id: 't1',
  startedAt: D('2026-07-16T09:00:00'),
  windowDays: 3,
  outcome: null,
  endedAt: null,
  observations: [],
  reactions: [],
  ...over,
});

describe('Observation module', () => {
  test('projects an active Trial into past, current, and future Observation days', () => {
    const days = projectObservationDays(trial(), D('2026-07-17T12:00:00'));
    expect(days.map((day) => day.state)).toEqual(['unobserved', 'today', 'pending']);
  });

  test('a reaction owns its day and stops the remaining Observation days', () => {
    const reactedAt = D('2026-07-17T14:30:00');
    const days = projectObservationDays(trial({
      outcome: 'reacted',
      endedAt: reactedAt,
      reactions: [{ occurredAt: reactedAt }],
    }), D('2026-07-25T12:00:00'));
    expect(days.map((day) => day.state)).toEqual(['unobserved', 'reacted', 'stopped']);
  });

  test('a safe Trial never repaints unobserved days as clear', () => {
    const days = projectObservationDays(trial({
      outcome: 'safe',
      endedAt: D('2026-07-19T09:00:00'),
      observations: [{ id: 'o1', trialId: 't1', occurredAt: D('2026-07-17T19:00:00') }],
    }), D('2026-07-25T12:00:00'));
    expect(days.map((day) => day.state)).toEqual(['unobserved', 'cleared', 'unobserved']);
  });

  test('preserves whether an Observation was recalled later', () => {
    const recalledAt = D('2026-07-18T20:11:00');
    const days = projectObservationDays(trial({ observations: [{
      id: 'o1', trialId: 't1', occurredAt: D('2026-07-16T09:00:00'), backfilledAt: recalledAt,
    }] }), D('2026-07-17T12:00:00'));
    expect(days[0].observation?.backfilledAt).toEqual(recalledAt);
  });

  test('uses the Trial window length and never marks today after it elapses', () => {
    for (const windowDays of [1, 2, 3, 5, 7]) {
      const days = projectObservationDays(trial({ windowDays }), D('2026-07-25T12:00:00'));
      expect(days).toHaveLength(windowDays);
      expect(days.map((day) => day.state)).not.toContain('today');
    }
  });

  test('concurrent recording of the same Trial day is idempotent success', async () => {
    const observations: ObservationLike[] = [];
    const active = trial();
    const transaction: ObservationTransaction = {
      activeTrialForFood: () => active,
      observationsForTrial: () => observations,
      insertObservation: (input) => {
        const observation = { ...input };
        observations.push(observation);
        return observation;
      },
    };
    const module = createObservationModule({
      persistence: { transaction: (work) => work(transaction) },
      now: () => D('2026-07-17T12:00:00'),
      newId: () => 'o1',
    });

    const [first, second] = await Promise.all([
      module.record({ foodId: 'egg' }),
      module.record({ foodId: 'egg' }),
    ]);

    expect(first).toMatchObject({ ok: true, status: 'recorded' });
    expect(second).toMatchObject({ ok: true, status: 'existing' });
    expect(observations).toHaveLength(1);
  });

  test('records a past eligible day as a recalled Observation', async () => {
    const observations: ObservationLike[] = [];
    const active = trial();
    const module = createObservationModule({
      persistence: { transaction: (work) => work({
        activeTrialForFood: () => active,
        observationsForTrial: () => observations,
        insertObservation: (input) => { observations.push(input); return input; },
      }) },
      now: () => D('2026-07-18T20:00:00'),
      newId: () => 'o1',
    });

    const result = await module.record({ foodId: 'egg', targetDay: D('2026-07-16T09:00:00') });

    expect(result).toMatchObject({ ok: true, status: 'recorded' });
    expect(observations[0].backfilledAt).toEqual(D('2026-07-18T20:00:00'));
  });

  test('returns explicit failures for missing Trials, ineligible days, and persistence errors', async () => {
    const missing = createObservationModule({
      persistence: { transaction: (work) => work({
        activeTrialForFood: () => undefined,
        observationsForTrial: () => [],
        insertObservation: (input) => input,
      }) },
      now: () => D('2026-07-17T12:00:00'),
      newId: () => 'o1',
    });
    await expect(missing.record({ foodId: 'egg' }))
      .resolves.toEqual({ ok: false, reason: 'no_active_trial' });

    const outside = createObservationModule({
      persistence: { transaction: (work) => work({
        activeTrialForFood: () => trial(),
        observationsForTrial: () => [],
        insertObservation: (input) => input,
      }) },
      now: () => D('2026-07-20T12:00:00'),
      newId: () => 'o1',
    });
    await expect(outside.record({ foodId: 'egg' }))
      .resolves.toEqual({ ok: false, reason: 'outside_window' });

    const broken = createObservationModule({
      persistence: { transaction: () => { throw new Error('disk full'); } },
      now: () => D('2026-07-17T12:00:00'),
      newId: () => 'o1',
    });
    await expect(broken.record({ foodId: 'egg' }))
      .resolves.toEqual({ ok: false, reason: 'persistence_failed' });
  });
});

// Backfilled Observation dates are user input and must respect the window.
describe('isEligibleObservationDay', () => {
  const t = trial({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 });
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
    const late = trial({ startedAt: D('2026-07-01T23:30:00'), windowDays: 3 });
    const fourth = D('2026-07-04T14:00:00'); // day four, still inside the 72h
    expect(fourth.getTime()).toBeLessThan(windowEnd(late).getTime());
    expect(isEligibleObservationDay(late, fourth, D('2026-07-04T15:00:00'))).toBe(false);
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

describe('isSameLocalDay', () => {
  test('23:59 vs 00:01 the next day → false', () => {
    expect(isSameLocalDay(D('2026-07-16T23:59:00'), D('2026-07-17T00:01:00'))).toBe(false);
  });
  test('same calendar day, different times → true', () => {
    expect(isSameLocalDay(D('2026-07-16T00:01:00'), D('2026-07-16T23:59:00'))).toBe(true);
  });
});
