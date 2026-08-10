import type { TrialNotificationDriver } from './notify';

const notificationWarning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
const { replaceTrialNotificationsWith } = require('./notify') as typeof import('./notify');

afterAll(() => notificationWarning.mockRestore());

test('reconciliation replaces only Trial lifecycle notifications', async () => {
  const driver: jest.Mocked<TrialNotificationDriver> = {
    getAllScheduledNotificationsAsync: jest.fn(async () => [
      { identifier: 'old:checkin1' },
      { identifier: 'old:windowEnd0' },
      { identifier: 'another-feature' },
    ]),
    cancelScheduledNotificationAsync: jest.fn(async (_identifier) => undefined),
    scheduleNotificationAsync: jest.fn(async (_request) => 'new-notification'),
  };

  await replaceTrialNotificationsWith(driver, {
    trialId: 't2',
    food: { id: 'egg', name: 'foodName.egg', isCustom: false },
    planned: [{ kind: 'checkin', day: 2, fireAt: new Date('2026-07-21T09:00:00Z') }],
  });

  expect(driver.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(driver.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old:checkin1');
  expect(driver.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old:windowEnd0');
  expect(driver.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('another-feature');
  expect(driver.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    identifier: 't2:checkin2',
    content: expect.objectContaining({ data: { foodId: 'egg', trialLifecycle: true } }),
  }));
});
