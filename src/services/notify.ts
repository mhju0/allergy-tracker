import * as Notifications from 'expo-notifications';
import i18n, { foodLabel } from '../i18n';
import type { PlannedNotification } from '../domain/notifications';

export function initNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function isPermissionGranted(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export const CHECKIN_CATEGORY = 'checkin';
// No ':' or '-': expo-notifications reserves those in category and action ids.
export const CHECKIN_ACTION = 'checkinClear';

// Puts 이상 없음 on the banner itself. Opening the app first is the single
// biggest thing standing between a prompt and a recorded observation.
export async function registerCheckinAction(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY, [{
    identifier: CHECKIN_ACTION,
    buttonTitle: i18n.t('food.checkinClear'),
    // ponytail: foregrounds the app instead of writing from the background —
    // background delivery of notification actions is unreliable in
    // expo-notifications. Flip to false once that is dependable.
    options: { opensAppToForeground: true },
  }]);
}

function content(p: PlannedNotification, label: string) {
  if (p.kind === 'checkin') {
    return {
      title: i18n.t('notif.checkinTitle', { day: p.day, food: label }),
      body: i18n.t('notif.checkinBody', { food: label }),
      categoryIdentifier: CHECKIN_CATEGORY,
    };
  }
  // The retries are a different sentence, not the same one repeated: by then
  // the parent has already let a prompt go by, and the app's job is to make
  // coming back easy rather than to restate the ask.
  const key = p.attempt === 0 ? 'windowEnd' : 'windowEndAgain';
  return {
    title: i18n.t(`notif.${key}Title`, { food: label }),
    body: i18n.t(`notif.${key}Body`, { food: label }),
  };
}

// Takes the food row, not a display string: resolving the Korean name is this
// module's job, since it already owns every other word the user reads here.
export type TrialNotificationDriver = {
  getAllScheduledNotificationsAsync: () => Promise<{ identifier: string }[]>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  scheduleNotificationAsync: (
    request: Parameters<typeof Notifications.scheduleNotificationAsync>[0],
  ) => Promise<string>;
};

async function scheduleTrialNotifications(
  driver: TrialNotificationDriver,
  trialId: string, food: { id: string; isCustom: boolean; name: string }, planned: PlannedNotification[],
): Promise<void> {
  const label = foodLabel(food);
  for (const p of planned) {
    await driver.scheduleNotificationAsync({
      identifier: `${trialId}:${p.kind}${p.kind === 'checkin' ? p.day : p.attempt}`,
      // the action handler needs to know which food it is clearing
      content: { ...content(p, label), data: { foodId: food.id, trialLifecycle: true } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.fireAt },
    });
  }
}

const TRIAL_NOTIFICATION_ID = /:(?:checkin\d+|windowEnd\d+)$/;

// Rebuilds notification state from the one authoritative active Trial. This
// also removes schedules left behind when a previous post-commit notification
// operation failed or the app was terminated between persistence and cleanup.
export async function replaceTrialNotificationsWith(
  driver: TrialNotificationDriver,
  active?: {
  trialId: string;
  food: { id: string; isCustom: boolean; name: string };
  planned: PlannedNotification[];
  },
): Promise<void> {
  const scheduled = await driver.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => TRIAL_NOTIFICATION_ID.test(notification.identifier))
      .map((notification) => driver.cancelScheduledNotificationAsync(notification.identifier)),
  );
  if (active) {
    await scheduleTrialNotifications(driver, active.trialId, active.food, active.planned);
  }
}

export const replaceTrialNotifications = (active?: {
  trialId: string;
  food: { id: string; isCustom: boolean; name: string };
  planned: PlannedNotification[];
}) => replaceTrialNotificationsWith(Notifications, active);
