import { computeTrialNotifications, type PlannedNotification } from '../domain/notifications';
import { decideStartTrial, isWindowElapsed, latestTrial, type AutoClose, type TrialLike } from '../domain/status';
import type { ObservationLike } from '../observation';

export type LifecycleFood = {
  id: string;
  name: string;
  isCustom: boolean;
};

export type LifecycleTrial = TrialLike & {
  foodId: string;
  endedAt: Date | null;
  observations: ObservationLike[];
};

export type LifecycleReaction = {
  id: string;
  trialId: string;
  symptoms: string[];
  severity: 'mild' | 'moderate' | 'severe';
  occurredAt: Date;
  note: string | null;
};

export type LifecycleTransaction = {
  activeTrial: () => LifecycleTrial | undefined;
  trialsForFood: (foodId: string) => LifecycleTrial[];
  trialById: (trialId: string) => LifecycleTrial | undefined;
  foodById: (foodId: string) => LifecycleFood | undefined;
  insertTrial: (trial: LifecycleTrial) => void;
  insertReaction: (reaction: LifecycleReaction) => void;
  closeOpenTrial: (
    trialId: string,
    outcome: 'safe' | 'cancelled',
    endedAt: Date,
  ) => boolean;
  markReacted: (trialId: string, endedAt: Date) => void;
};

export type LifecyclePersistence = {
  transaction: <T>(work: (transaction: LifecycleTransaction) => T) => T;
};

export type ActiveNotificationSchedule = {
  trial: LifecycleTrial;
  food: LifecycleFood;
  planned: PlannedNotification[];
};

export type LifecycleNotifier = {
  ensurePermission: () => Promise<boolean>;
  permissionGranted: () => Promise<boolean>;
  replace: (active: ActiveNotificationSchedule | undefined) => Promise<void>;
};

export type NotificationState = 'ready' | 'unavailable' | 'degraded';

type PersistenceFailure = { ok: false; reason: 'persistence_failed' };

export function createTrialLifecycle({ persistence, notifier, now, newId }: {
  persistence: LifecyclePersistence;
  notifier: LifecycleNotifier;
  now: () => Date;
  newId: () => string;
}) {
  let pending: Promise<unknown> = Promise.resolve();

  const serialized = <T>(work: () => Promise<T>): Promise<T> => {
    const result = pending.then(work, work);
    pending = result.then(() => undefined, () => undefined);
    return result;
  };

  const replaceActiveNotifications = async (
    active: ActiveNotificationSchedule,
    requestPermission: boolean,
  ): Promise<NotificationState> => {
    let granted: boolean;
    try {
      granted = requestPermission
        ? await notifier.ensurePermission()
        : await notifier.permissionGranted();
    } catch {
      return 'degraded';
    }
    try {
      await notifier.replace(granted ? active : undefined);
      return granted ? 'ready' : 'unavailable';
    } catch {
      return 'degraded';
    }
  };

  const clearNotifications = async (): Promise<NotificationState> => {
    try {
      await notifier.replace(undefined);
      return 'ready';
    } catch {
      return 'degraded';
    }
  };

  const start = (command: { food: LifecycleFood; windowDays: number }) => serialized(async () => {
    const at = now();
    let transition:
      | { ok: true; trial: LifecycleTrial; autoClosed: AutoClose | null }
      | { ok: false; reason: 'trial_in_progress' }
      | PersistenceFailure;
    try {
      transition = persistence.transaction((transaction) => {
        const decision = decideStartTrial(transaction.activeTrial(), at);
        if (!decision.allowed) return { ok: false, reason: decision.reason };
        if (decision.autoClose) {
          const closed = transaction.closeOpenTrial(
            decision.autoClose.trialId,
            decision.autoClose.outcome,
            at,
          );
          if (!closed) throw new Error('active Trial changed during start');
        }
        const created: LifecycleTrial = {
          id: newId(),
          foodId: command.food.id,
          startedAt: at,
          windowDays: command.windowDays,
          outcome: null,
          endedAt: null,
          observations: [],
        };
        transaction.insertTrial(created);
        return { ok: true, trial: created, autoClosed: decision.autoClose };
      });
    } catch {
      transition = { ok: false, reason: 'persistence_failed' };
    }
    if (!transition.ok) return transition;
    const active = {
      trial: transition.trial,
      food: command.food,
      planned: computeTrialNotifications(at, command.windowDays, at),
    };
    const notifications = await replaceActiveNotifications(active, true);
    return { ...transition, notifications };
  });

  const react = (command: {
    foodId: string;
    symptoms: string[];
    severity: 'mild' | 'moderate' | 'severe';
    occurredAt: Date;
    note: string | null;
  }) => serialized(async () => {
    const at = now();
    let transition:
      | { ok: true; reaction: LifecycleReaction; closedActive: boolean }
      | { ok: false; reason: 'no_trial' }
      | PersistenceFailure;
    try {
      transition = persistence.transaction((transaction) => {
        const latest = latestTrial(transaction.trialsForFood(command.foodId));
        if (!latest) return { ok: false, reason: 'no_trial' };
        const recorded: LifecycleReaction = {
          id: newId(),
          trialId: latest.id,
          symptoms: command.symptoms,
          severity: command.severity,
          occurredAt: command.occurredAt,
          note: command.note,
        };
        transaction.insertReaction(recorded);
        const closedActive = latest.outcome === null;
        if (latest.outcome !== 'reacted') transaction.markReacted(latest.id, at);
        return { ok: true, reaction: recorded, closedActive };
      });
    } catch {
      transition = { ok: false, reason: 'persistence_failed' };
    }
    if (!transition.ok) return transition;
    const notifications = transition.closedActive ? await clearNotifications() : 'ready';
    return { ...transition, notifications };
  });

  const confirmSafe = (command: { trialId: string }) => serialized(async () => {
    const at = now();
    let transition:
      | { ok: true; status: 'recorded' | 'existing' }
      | { ok: false; reason: 'window_not_elapsed' }
      | PersistenceFailure;
    try {
      transition = persistence.transaction((transaction) => {
        const current = transaction.trialById(command.trialId);
        if (!current || current.outcome !== null) return { ok: true, status: 'existing' };
        if (!isWindowElapsed(current, at)) {
          return { ok: false, reason: 'window_not_elapsed' };
        }
        return transaction.closeOpenTrial(current.id, 'safe', at)
          ? { ok: true, status: 'recorded' }
          : { ok: true, status: 'existing' };
      });
    } catch {
      transition = { ok: false, reason: 'persistence_failed' };
    }
    if (!transition.ok || transition.status === 'existing') return transition;
    const notifications = await clearNotifications();
    return { ...transition, notifications };
  });

  const cancel = (command: { trialId: string }) => serialized(async () => {
    const at = now();
    let transition:
      | { ok: true; status: 'recorded' | 'existing' }
      | PersistenceFailure;
    try {
      transition = persistence.transaction((transaction) => {
        const current = transaction.trialById(command.trialId);
        if (!current || current.outcome !== null) return { ok: true, status: 'existing' };
        return transaction.closeOpenTrial(current.id, 'cancelled', at)
          ? { ok: true, status: 'recorded' }
          : { ok: true, status: 'existing' };
      });
    } catch {
      transition = { ok: false, reason: 'persistence_failed' };
    }
    if (!transition.ok || transition.status === 'existing') return transition;
    const notifications = await clearNotifications();
    return { ...transition, notifications };
  });

  const reconcile = () => serialized(async () => {
    const at = now();
    let active: ActiveNotificationSchedule | undefined;
    try {
      active = persistence.transaction((transaction) => {
        const current = transaction.activeTrial();
        if (!current) return undefined;
        const currentFood = transaction.foodById(current.foodId);
        if (!currentFood) throw new Error('active Trial has no Food');
        return {
          trial: current,
          food: currentFood,
          planned: computeTrialNotifications(current.startedAt, current.windowDays, at),
        };
      });
    } catch {
      return { ok: false, reason: 'persistence_failed' } as const;
    }
    const notifications = active
      ? await replaceActiveNotifications(active, false)
      : await clearNotifications();
    return { ok: true, notifications } as const;
  });

  return { start, react, confirmSafe, cancel, reconcile };
}
