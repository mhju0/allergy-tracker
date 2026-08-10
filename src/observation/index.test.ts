import {
  coverage, createObservationModule, isEligibleObservationDay, projectObservationDays,
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

  test('coverage counts observed Trial days, not Observation rows', () => {
    const observed = trial({ observations: [
      { id: 'o1', trialId: 't1', occurredAt: D('2026-07-17T09:00:00') },
      { id: 'o2', trialId: 't1', occurredAt: D('2026-07-17T20:00:00') },
      { id: 'o3', trialId: 't1', occurredAt: D('2026-07-18T09:00:00') },
    ] });
    expect(coverage(observed)).toEqual({ observed: 2, of: 3 });
  });

  test('rejects the fourth calendar day of a late-starting three-day Trial', () => {
    const late = trial({ startedAt: D('2026-07-01T23:30:00'), windowDays: 3 });
    expect(isEligibleObservationDay(
      late,
      D('2026-07-04T14:00:00'),
      D('2026-07-04T15:00:00'),
    )).toBe(false);
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
