import {
  createTrialLifecycle,
  type LifecycleFood,
  type LifecycleNotifier,
  type LifecyclePersistence,
  type LifecycleReaction,
  type LifecycleTransaction,
  type LifecycleTrial,
} from '.';

const D = (value: string) => new Date(value);
const NOW = D('2026-07-20T12:00:00Z');

const food = (id: string): LifecycleFood => ({ id, name: `foodName.${id}`, isCustom: false });
const trial = (over: Partial<LifecycleTrial> = {}): LifecycleTrial => ({
  id: 't1',
  foodId: 'egg',
  startedAt: D('2026-07-19T12:00:00Z'),
  windowDays: 3,
  outcome: null,
  endedAt: null,
  observations: [],
  ...over,
});

function harness(initialTrials: LifecycleTrial[] = []) {
  const foods = [food('egg'), food('milk')];
  const trials = initialTrials;
  const reactions: LifecycleReaction[] = [];
  let transactions = 0;
  const tx: LifecycleTransaction = {
    activeTrial: () => trials.find((item) => item.outcome === null),
    trialsForFood: (foodId) => trials.filter((item) => item.foodId === foodId),
    trialById: (trialId) => trials.find((item) => item.id === trialId),
    foodById: (foodId) => foods.find((item) => item.id === foodId),
    insertTrial: (item) => { trials.push(item); },
    insertReaction: (item) => { reactions.push(item); },
    closeOpenTrial: (trialId, outcome, endedAt) => {
      const item = trials.find((candidate) => candidate.id === trialId && candidate.outcome === null);
      if (!item) return false;
      item.outcome = outcome;
      item.endedAt = endedAt;
      return true;
    },
    markReacted: (trialId, endedAt) => {
      const item = trials.find((candidate) => candidate.id === trialId);
      if (!item) return;
      item.outcome = 'reacted';
      item.endedAt = endedAt;
    },
  };
  const persistence: LifecyclePersistence = {
    transaction: (work) => {
      transactions++;
      return work(tx);
    },
  };
  const notifier: jest.Mocked<LifecycleNotifier> = {
    ensurePermission: jest.fn(async () => true),
    permissionGranted: jest.fn(async () => true),
    replace: jest.fn(async (_active) => undefined),
  };
  let id = 0;
  const lifecycle = createTrialLifecycle({
    persistence,
    notifier,
    now: () => NOW,
    newId: () => `new-${++id}`,
  });
  return { lifecycle, notifier, trials, reactions, transactions: () => transactions };
}

describe('Trial lifecycle', () => {
  test('serializes concurrent starts so only one active Trial is created', async () => {
    const h = harness();

    const [first, second] = await Promise.all([
      h.lifecycle.start({ food: food('egg'), windowDays: 3 }),
      h.lifecycle.start({ food: food('milk'), windowDays: 3 }),
    ]);

    expect(first).toMatchObject({ ok: true, notifications: 'ready' });
    expect(second).toEqual({ ok: false, reason: 'trial_in_progress' });
    expect(h.trials).toHaveLength(1);
    expect(h.notifier.ensurePermission).toHaveBeenCalledTimes(1);
  });

  test('auto-closes an elapsed observed Trial and starts the next one atomically', async () => {
    const previous = trial({
      startedAt: D('2026-07-16T12:00:00Z'),
      observations: [{ id: 'o1', trialId: 't1', occurredAt: D('2026-07-17T09:00:00Z') }],
    });
    const h = harness([previous]);

    const result = await h.lifecycle.start({ food: food('milk'), windowDays: 5 });

    expect(result).toMatchObject({ ok: true, autoClosed: { trialId: 't1', outcome: 'safe' } });
    expect(previous).toMatchObject({ outcome: 'safe', endedAt: NOW });
    expect(h.trials[1]).toMatchObject({ foodId: 'milk', windowDays: 5, outcome: null, startedAt: NOW });
    expect(h.transactions()).toBe(1);
  });

  test('keeps a started Trial authoritative when notification delivery fails', async () => {
    const h = harness();
    h.notifier.replace.mockRejectedValueOnce(new Error('notifications unavailable'));

    const result = await h.lifecycle.start({ food: food('egg'), windowDays: 3 });

    expect(result).toMatchObject({ ok: true, notifications: 'degraded' });
    expect(h.trials).toHaveLength(1);
  });

  test('starts after notification denial and reports notifications as unavailable', async () => {
    const h = harness();
    h.notifier.ensurePermission.mockResolvedValueOnce(false);

    const result = await h.lifecycle.start({ food: food('egg'), windowDays: 3 });

    expect(result).toMatchObject({ ok: true, notifications: 'unavailable' });
    expect(h.notifier.replace).toHaveBeenCalledWith(undefined);
    expect(h.trials).toHaveLength(1);
  });

  test('records a reaction and closes its latest Trial in one transaction', async () => {
    const active = trial();
    const h = harness([active]);

    const result = await h.lifecycle.react({
      foodId: 'egg',
      symptoms: ['hives'],
      severity: 'moderate',
      occurredAt: D('2026-07-20T11:30:00Z'),
      note: null,
    });

    expect(result).toMatchObject({ ok: true, notifications: 'ready' });
    expect(h.reactions).toHaveLength(1);
    expect(active).toMatchObject({ outcome: 'reacted', endedAt: NOW });
    expect(h.transactions()).toBe(1);
    expect(h.notifier.replace).toHaveBeenCalledWith(undefined);
  });

  test('rejects an early safe confirmation and idempotently accepts a closed Trial', async () => {
    const active = trial();
    const h = harness([active]);
    await expect(h.lifecycle.confirmSafe({ trialId: active.id }))
      .resolves.toEqual({ ok: false, reason: 'window_not_elapsed' });

    active.outcome = 'safe';
    active.endedAt = D('2026-07-20T11:00:00Z');
    await expect(h.lifecycle.confirmSafe({ trialId: active.id }))
      .resolves.toMatchObject({ ok: true, status: 'existing' });
  });

  test('cancel never overwrites a finished Trial', async () => {
    const finished = trial({ outcome: 'safe', endedAt: D('2026-07-20T11:00:00Z') });
    const h = harness([finished]);

    const result = await h.lifecycle.cancel({ trialId: finished.id });

    expect(result).toMatchObject({ ok: true, status: 'existing' });
    expect(finished.outcome).toBe('safe');
    expect(h.notifier.replace).not.toHaveBeenCalled();
  });

  test('foreground reconciliation derives the future schedule from the active Trial', async () => {
    const active = trial();
    const h = harness([active]);

    const result = await h.lifecycle.reconcile();

    expect(result).toEqual({ ok: true, notifications: 'ready' });
    expect(h.notifier.ensurePermission).not.toHaveBeenCalled();
    expect(h.notifier.permissionGranted).toHaveBeenCalledTimes(1);
    expect(h.notifier.replace).toHaveBeenCalledWith(expect.objectContaining({
      trial: active,
      food: expect.objectContaining({ id: 'egg' }),
      planned: expect.any(Array),
    }));
  });
});
