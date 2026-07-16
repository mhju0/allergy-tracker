import { MS_PER_DAY, windowEnd } from './status';

export type PlannedNotification =
  | { kind: 'checkin'; day: number; fireAt: Date }
  | { kind: 'windowEnd'; fireAt: Date };

export function computeTrialNotifications(startedAt: Date, windowDays: number): PlannedNotification[] {
  const out: PlannedNotification[] = [];
  for (let day = 2; day <= windowDays; day++) {
    const fireAt = new Date(startedAt.getTime() + (day - 1) * MS_PER_DAY);
    fireAt.setHours(9, 0, 0, 0); // 09:00 local on that day
    out.push({ kind: 'checkin', day, fireAt });
  }
  out.push({ kind: 'windowEnd', fireAt: windowEnd({ startedAt, windowDays }) });
  return out;
}
