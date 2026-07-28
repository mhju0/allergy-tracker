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

function content(p: PlannedNotification, label: string) {
  if (p.kind === 'checkin') {
    return {
      title: i18n.t('notif.checkinTitle', { day: p.day, food: label }),
      body: i18n.t('notif.checkinBody', { food: label }),
    };
  }
  return {
    title: i18n.t('notif.windowEndTitle', { food: label }),
    body: i18n.t('notif.windowEndBody', { food: label }),
  };
}

// Takes the food row, not a display string: resolving the Korean name is this
// module's job, since it already owns every other word the user reads here.
export async function scheduleTrialNotifications(
  trialId: string, food: { isCustom: boolean; name: string }, planned: PlannedNotification[],
): Promise<void> {
  const label = foodLabel(food);
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${trialId}:${p.kind}${p.kind === 'checkin' ? p.day : ''}`,
      content: content(p, label),
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
