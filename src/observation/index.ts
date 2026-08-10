export const MS_PER_DAY = 86_400_000;

export type ObservationLike = {
  id: string;
  trialId: string;
  occurredAt: Date;
  backfilledAt?: Date | null;
};

export type ObservationTrial = {
  id: string;
  startedAt: Date;
  windowDays: number;
  outcome: 'safe' | 'reacted' | 'cancelled' | null;
  endedAt?: Date | null;
  observations: ObservationLike[];
  reactions: { occurredAt: Date }[];
};

export type ObservationDay = {
  day: number;
  date: Date;
  state: 'cleared' | 'today' | 'reacted' | 'unobserved' | 'pending' | 'stopped';
  observation?: ObservationLike;
  reactionAt?: Date;
};

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function trialDays(trial: Pick<ObservationTrial, 'startedAt' | 'windowDays'>): Date[] {
  return Array.from(
    { length: trial.windowDays },
    (_, index) => new Date(trial.startedAt.getTime() + index * MS_PER_DAY),
  );
}

export function coverage(
  trial: Pick<ObservationTrial, 'startedAt' | 'windowDays'> & { observations: { occurredAt: Date }[] },
): { observed: number; of: number } {
  const observed = trialDays(trial)
    .filter((day) => trial.observations.some((item) => isSameLocalDay(item.occurredAt, day)))
    .length;
  return { observed, of: trial.windowDays };
}

export function isEligibleObservationDay(
  trial: Pick<ObservationTrial, 'startedAt' | 'windowDays'>,
  occurredAt: Date,
  now: Date,
): boolean {
  if (occurredAt.getTime() > now.getTime()) return false;
  if (occurredAt.getTime() < trial.startedAt.getTime()) return false;
  return trialDays(trial).some((day) => isSameLocalDay(occurredAt, day));
}

export type ObservationTransaction = {
  activeTrialForFood: (foodId: string) => ObservationTrial | undefined;
  observationsForTrial: (trialId: string) => ObservationLike[];
  insertObservation: (observation: ObservationLike) => ObservationLike;
};

export type ObservationPersistence = {
  transaction: <T>(work: (transaction: ObservationTransaction) => T) => T;
};

export type RecordObservationResult =
  | { ok: true; status: 'recorded' | 'existing'; observation: ObservationLike }
  | { ok: false; reason: 'no_active_trial' | 'outside_window' | 'persistence_failed' };

export function createObservationModule({ persistence, now, newId }: {
  persistence: ObservationPersistence;
  now: () => Date;
  newId: () => string;
}) {
  let pending: Promise<unknown> = Promise.resolve();

  const record = (command: { foodId: string; targetDay?: Date }): Promise<RecordObservationResult> => {
    const run = async (): Promise<RecordObservationResult> => {
      const recordedAt = now();
      try {
        return persistence.transaction((transaction) => {
          const active = transaction.activeTrialForFood(command.foodId);
          if (!active || active.outcome !== null) return { ok: false, reason: 'no_active_trial' };
          const occurredAt = command.targetDay ?? recordedAt;
          if (!isEligibleObservationDay(active, occurredAt, recordedAt)) {
            return { ok: false, reason: 'outside_window' };
          }
          const existing = transaction.observationsForTrial(active.id)
            .find((item) => isSameLocalDay(item.occurredAt, occurredAt));
          if (existing) return { ok: true, status: 'existing', observation: existing };
          const observation: ObservationLike = {
            id: newId(),
            trialId: active.id,
            occurredAt,
            backfilledAt: isSameLocalDay(occurredAt, recordedAt) ? null : recordedAt,
          };
          return {
            ok: true,
            status: 'recorded',
            observation: transaction.insertObservation(observation),
          };
        });
      } catch {
        return { ok: false, reason: 'persistence_failed' };
      }
    };

    const result = pending.then(run, run);
    pending = result.then(() => undefined);
    return result;
  };

  return { record };
}

export function projectObservationDays(trial: ObservationTrial, now: Date): ObservationDay[] {
  const reactionAt = trial.reactions[0]?.occurredAt;
  const endedAt = trial.endedAt ?? undefined;
  return trialDays(trial).map((date, index) => {
    if (reactionAt && isSameLocalDay(reactionAt, date)) {
      return { day: index + 1, date, state: 'reacted', reactionAt };
    }
    if (endedAt && date.getTime() > endedAt.getTime() && !isSameLocalDay(endedAt, date)) {
      return { day: index + 1, date, state: 'stopped' };
    }
    const observation = trial.observations.find((item) => isSameLocalDay(item.occurredAt, date));
    if (observation) return { day: index + 1, date, state: 'cleared', observation };
    if (trial.outcome === null && isSameLocalDay(date, now)) {
      return { day: index + 1, date, state: 'today' };
    }
    return {
      day: index + 1,
      date,
      state: date.getTime() <= now.getTime() ? 'unobserved' : 'pending',
    };
  });
}
