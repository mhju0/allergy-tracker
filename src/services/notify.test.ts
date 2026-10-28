import type { TrialNotificationDriver } from './notify';

const notificationWarning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
const { checkinActionCommand, replaceTrialNotificationsWith } = require('./notify') as typeof import('./notify');

afterAll(() => notificationWarning.mockRestore());

const driverWith = (
  scheduled: string[],
  presented: string[] = [],
): jest.Mocked<TrialNotificationDriver> => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => scheduled.map((identifier) => ({ identifier }))),
  cancelScheduledNotificationAsync: jest.fn(async (_identifier) => undefined),
  scheduleNotificationAsync: jest.fn(async (_request) => 'new-notification'),
  getPresentedNotificationsAsync: jest.fn(async () => presented.map((identifier) => ({ request: { identifier } }))),
  dismissNotificationAsync: jest.fn(async (_identifier) => undefined),
});

test('reconciliation replaces only Trial lifecycle notifications', async () => {
  const driver = driverWith(['old:checkin1', 'old:windowEnd0', 'another-feature']);
  const fireAt = new Date('2026-07-21T09:00:00Z');

  await replaceTrialNotificationsWith(driver, {
    trialId: 't2',
    food: { id: 'egg', name: 'foodName.egg', isCustom: false },
    planned: [{ kind: 'checkin', day: 2, fireAt }],
  });

  expect(driver.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(driver.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old:checkin1');
  expect(driver.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old:windowEnd0');
  expect(driver.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('another-feature');
  expect(driver.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    identifier: 't2:checkin2',
    content: expect.objectContaining({
      data: { foodId: 'egg', trialId: 't2', trialLifecycle: true, targetDay: fireAt.toISOString() },
    }),
  }));
});

test('reconciliation dismisses delivered prompts of every Trial but the active one', async () => {
  const driver = driverWith([], ['old:checkin2', 'old:windowEnd1', 't2:checkin1', 'another-feature']);

  await replaceTrialNotificationsWith(driver, {
    trialId: 't2',
    food: { id: 'egg', name: 'foodName.egg', isCustom: false },
    planned: [],
  });

  expect(driver.dismissNotificationAsync).toHaveBeenCalledTimes(2);
  expect(driver.dismissNotificationAsync).toHaveBeenCalledWith('old:checkin2');
  expect(driver.dismissNotificationAsync).toHaveBeenCalledWith('old:windowEnd1');
});

test('clearing with no active Trial dismisses every delivered Trial prompt', async () => {
  const driver = driverWith([], ['t2:checkin1', 'another-feature']);

  await replaceTrialNotificationsWith(driver, undefined);

  expect(driver.dismissNotificationAsync).toHaveBeenCalledTimes(1);
  expect(driver.dismissNotificationAsync).toHaveBeenCalledWith('t2:checkin1');
});

test('a failed dismissal never costs the active Trial its schedule', async () => {
  const driver = driverWith([], ['old:checkin2']);
  driver.dismissNotificationAsync.mockRejectedValue(new Error('denied'));
  const fireAt = new Date('2026-07-21T09:00:00Z');

  await expect(replaceTrialNotificationsWith(driver, {
    trialId: 't2',
    food: { id: 'egg', name: 'foodName.egg', isCustom: false },
    planned: [{ kind: 'checkin', day: 2, fireAt }],
  })).resolves.toBeUndefined();

  expect(driver.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: 't2:checkin2' }));
});

describe('checkinActionCommand', () => {
  const now = new Date('2026-07-23T14:00:00');

  test('a late tap targets the day the prompt asked about', () => {
    const targetDay = new Date('2026-07-21T09:00:00');
    expect(checkinActionCommand({ foodId: 'egg', trialId: 't2', targetDay: targetDay.toISOString() }, now))
      .toEqual({ foodId: 'egg', trialId: 't2', targetDay });
  });

  test('a same-day tap records now rather than the prompt time', () => {
    expect(checkinActionCommand({
      foodId: 'egg', trialId: 't2', targetDay: new Date('2026-07-23T09:00:00').toISOString(),
    }, now)).toEqual({ foodId: 'egg', trialId: 't2' });
  });

  test('a prompt from an older version (foodId only) still records today', () => {
    expect(checkinActionCommand({ foodId: 'egg', trialLifecycle: true }, now)).toEqual({ foodId: 'egg' });
  });

  test('an unreadable target day falls back to today', () => {
    expect(checkinActionCommand({ foodId: 'egg', targetDay: 'garbage' }, now)).toEqual({ foodId: 'egg' });
  });

  test('no foodId → no command', () => {
    expect(checkinActionCommand({}, now)).toBeUndefined();
    expect(checkinActionCommand(undefined, now)).toBeUndefined();
  });
});
