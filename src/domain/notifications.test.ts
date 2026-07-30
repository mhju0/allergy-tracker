import { computeTrialNotifications } from './notifications';

const local = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi, 0, 0);

describe('computeTrialNotifications', () => {
  test('3-day trial started mid-morning → the feed evening, then each morning, then the close', () => {
    const start = local(2026, 7, 1, 10); // Jul 1 10:00 local
    const out = computeTrialNotifications(start, 3, start);
    expect(out).toEqual([
      { kind: 'checkin', day: 1, fireAt: local(2026, 7, 1, 19) },
      { kind: 'checkin', day: 2, fireAt: local(2026, 7, 2, 9) },
      { kind: 'checkin', day: 3, fireAt: local(2026, 7, 3, 9) },
      { kind: 'windowEnd', attempt: 0, fireAt: local(2026, 7, 4, 10) },
      { kind: 'windowEnd', attempt: 1, fireAt: local(2026, 7, 5, 9) },
      { kind: 'windowEnd', attempt: 2, fireAt: local(2026, 7, 7, 9) },
    ]);
  });

  // isWindowElapsed gates the 안전으로 표시 button, so a prompt that beat the
  // close would offer an action the screen isn't showing yet.
  test('the close prompt never lands before the window has actually elapsed', () => {
    for (const hour of [3, 7, 10, 14, 21, 23]) {
      const start = local(2026, 7, 1, hour);
      const close = computeTrialNotifications(start, 3, start)
        .find((p) => p.kind === 'windowEnd' && p.attempt === 0)!;
      expect(close.fireAt.getTime()).toBeGreaterThanOrEqual(local(2026, 7, 4, hour).getTime());
    }
  });

  test('a window closing in the small hours waits for 09:00, not the whole next day', () => {
    const start = local(2026, 7, 1, 3);
    const out = computeTrialNotifications(start, 3, start);
    expect(out.filter((p) => p.kind === 'windowEnd').map((p) => p.fireAt)).toEqual([
      local(2026, 7, 4, 9), local(2026, 7, 5, 9), local(2026, 7, 7, 9),
    ]);
  });

  test('a late-night start has no feed-evening prompt left to give', () => {
    const start = local(2026, 7, 1, 23, 30);
    const out = computeTrialNotifications(start, 2, start);
    expect(out.filter((p) => p.kind === 'checkin')).toEqual([
      { kind: 'checkin', day: 2, fireAt: local(2026, 7, 2, 9) },
    ]);
  });

  test('1-day window → the feed evening and the close prompts', () => {
    const start = local(2026, 7, 1, 10);
    expect(computeTrialNotifications(start, 1, start)).toEqual([
      { kind: 'checkin', day: 1, fireAt: local(2026, 7, 1, 19) },
      { kind: 'windowEnd', attempt: 0, fireAt: local(2026, 7, 2, 10) },
      { kind: 'windowEnd', attempt: 1, fireAt: local(2026, 7, 3, 9) },
      { kind: 'windowEnd', attempt: 2, fireAt: local(2026, 7, 5, 9) },
    ]);
  });

  // "never schedule the past" used to live in services/notify.ts, where no test
  // could see it. It is the same policy as "fire at 09:00", so it belongs here.
  test('prompts already due are dropped', () => {
    const start = local(2026, 7, 1, 10);
    const now = local(2026, 7, 3, 12); // every check-in is behind us
    expect(computeTrialNotifications(start, 3, now)).toEqual([
      { kind: 'windowEnd', attempt: 0, fireAt: local(2026, 7, 4, 10) },
      { kind: 'windowEnd', attempt: 1, fireAt: local(2026, 7, 5, 9) },
      { kind: 'windowEnd', attempt: 2, fireAt: local(2026, 7, 7, 9) },
    ]);
  });

  test('the retries run out — a window nobody answers goes quiet, it does not nag on', () => {
    const start = local(2026, 7, 1, 10);
    expect(computeTrialNotifications(start, 3, local(2026, 7, 7, 10))).toEqual([]);
  });

  test('a prompt due exactly now is past, not future', () => {
    const start = local(2026, 7, 1, 10);
    const out = computeTrialNotifications(start, 2, local(2026, 7, 2, 9));
    expect(out.some((p) => p.kind === 'checkin')).toBe(false);
  });
});
