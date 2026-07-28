import { computeTrialNotifications } from './notifications';

const local = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0, 0);

describe('computeTrialNotifications', () => {
  test('3-day trial started mid-morning → check-ins day 2 & 3 at 09:00, windowEnd at boundary', () => {
    const start = local(2026, 7, 1, 10); // Jul 1 10:00 local
    const out = computeTrialNotifications(start, 3, start);
    expect(out).toEqual([
      { kind: 'checkin', day: 2, fireAt: local(2026, 7, 2, 9) },
      { kind: 'checkin', day: 3, fireAt: local(2026, 7, 3, 9) },
      { kind: 'windowEnd', fireAt: local(2026, 7, 4, 10) },
    ]);
  });
  test('late-night start still lands check-in next morning 09:00', () => {
    const start = local(2026, 7, 1, 23, 30);
    const out = computeTrialNotifications(start, 2, start);
    expect(out).toEqual([
      { kind: 'checkin', day: 2, fireAt: local(2026, 7, 2, 9) },
      { kind: 'windowEnd', fireAt: local(2026, 7, 3, 23, 30) },
    ]);
  });
  test('1-day window → only the windowEnd prompt', () => {
    const start = local(2026, 7, 1, 10);
    expect(computeTrialNotifications(start, 1, start)).toEqual([
      { kind: 'windowEnd', fireAt: local(2026, 7, 2, 10) },
    ]);
  });

  // "never schedule the past" used to live in services/notify.ts, where no test
  // could see it. It is the same policy as "fire at 09:00", so it belongs here.
  test('prompts already due are dropped', () => {
    const start = local(2026, 7, 1, 10);
    const now = local(2026, 7, 3, 12); // day 2's 09:00 and day 3's 09:00 are behind us
    expect(computeTrialNotifications(start, 3, now)).toEqual([
      { kind: 'windowEnd', fireAt: local(2026, 7, 4, 10) },
    ]);
  });
  test('a window that already closed schedules nothing', () => {
    const start = local(2026, 7, 1, 10);
    expect(computeTrialNotifications(start, 3, local(2026, 7, 5, 8))).toEqual([]);
  });
  test('a prompt due exactly now is past, not future', () => {
    const start = local(2026, 7, 1, 10);
    const out = computeTrialNotifications(start, 2, local(2026, 7, 2, 9));
    expect(out).toEqual([{ kind: 'windowEnd', fireAt: local(2026, 7, 3, 10) }]);
  });
});
