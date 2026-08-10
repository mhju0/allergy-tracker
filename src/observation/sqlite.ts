import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { checkin, trial } from '../db/schema';
import { newId } from '../data/ids';
import {
  createObservationModule,
  type ObservationLike,
  type ObservationPersistence,
  type ObservationTransaction,
  type ObservationTrial,
} from '.';

const persistence: ObservationPersistence = {
  transaction: (work) => db.transaction((tx) => {
    const adapter: ObservationTransaction = {
      activeTrialForFood: (foodId) => {
        const active = tx.select().from(trial)
          .where(and(eq(trial.foodId, foodId), isNull(trial.outcome)))
          .all()[0];
        if (!active) return undefined;
        return { ...active, observations: [], reactions: [] } satisfies ObservationTrial;
      },
      observationsForTrial: (trialId) => tx.select().from(checkin)
        .where(eq(checkin.trialId, trialId))
        .all(),
      insertObservation: (observation: ObservationLike) => {
        tx.insert(checkin).values({ ...observation, note: null }).run();
        return observation;
      },
    };
    return work(adapter);
  }),
};

const observationModule = createObservationModule({
  persistence,
  now: () => new Date(),
  newId,
});

export const recordObservation = observationModule.record;
