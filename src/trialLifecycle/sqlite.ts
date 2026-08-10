import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { checkin, food, reaction, trial, type Trial } from '../db/schema';
import { newId } from '../data/ids';
import {
  ensurePermission,
  isPermissionGranted,
  replaceTrialNotifications,
} from '../services/notify';
import {
  createTrialLifecycle,
  type LifecyclePersistence,
  type LifecycleTransaction,
  type LifecycleTrial,
} from '.';

export const sqliteLifecyclePersistence: LifecyclePersistence = {
  transaction: (work) => db.transaction((tx) => {
    const withObservations = (row: Trial | undefined): LifecycleTrial | undefined => {
      if (!row) return undefined;
      const observations = tx.select().from(checkin)
        .where(eq(checkin.trialId, row.id))
        .all();
      return { ...row, observations };
    };
    const adapter: LifecycleTransaction = {
      activeTrial: () => withObservations(
        tx.select().from(trial).where(isNull(trial.outcome)).all()[0],
      ),
      trialsForFood: (foodId) => tx.select().from(trial)
        .where(eq(trial.foodId, foodId))
        .all()
        .map((row) => withObservations(row)!),
      trialById: (trialId) => withObservations(
        tx.select().from(trial).where(eq(trial.id, trialId)).all()[0],
      ),
      foodById: (foodId) => tx.select().from(food)
        .where(eq(food.id, foodId))
        .all()[0],
      insertTrial: ({ observations: _observations, ...created }) => {
        tx.insert(trial).values(created).run();
      },
      insertReaction: (recorded) => {
        tx.insert(reaction).values(recorded).run();
      },
      closeOpenTrial: (trialId, outcome, endedAt) => {
        const result = tx.update(trial)
          .set({ outcome, endedAt })
          .where(and(eq(trial.id, trialId), isNull(trial.outcome)))
          .run();
        return result.changes > 0;
      },
      markReacted: (trialId, endedAt) => {
        tx.update(trial)
          .set({ outcome: 'reacted', endedAt })
          .where(eq(trial.id, trialId))
          .run();
      },
    };
    return work(adapter);
  }),
};

const lifecycle = createTrialLifecycle({
  persistence: sqliteLifecyclePersistence,
  notifier: {
    ensurePermission,
    permissionGranted: isPermissionGranted,
    replace: (active) => replaceTrialNotifications(active && {
      trialId: active.trial.id,
      food: active.food,
      planned: active.planned,
    }),
  },
  now: () => new Date(),
  newId,
});

export const startTrial = lifecycle.start;
export const recordReaction = lifecycle.react;
export const confirmSafe = lifecycle.confirmSafe;
export const cancelTrial = lifecycle.cancel;
export const reconcileTrialLifecycle = lifecycle.reconcile;
