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
export async function scheduleTrialNotifications(
  trialId: string, food: { id: string; isCustom: boolean; name: string }, planned: PlannedNotification[],
): Promise<void> {
  const label = foodLabel(food);
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${trialId}:${p.kind}${p.kind === 'checkin' ? p.day : p.attempt}`,
      // the action handler needs to know which food it is clearing
      content: { ...content(p, label), data: { foodId: food.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.fireAt },
    });
  }
}

export async function cancelTrialNotifications(trialId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(`${trialId}:`))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
