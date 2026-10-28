import * as Notifications from 'expo-notifications';
import i18n, { foodLabel } from '../i18n';
import type { PlannedNotification } from '../domain/notifications';
import { isSameLocalDay } from '../observation';

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

// True when iOS will still show its permission prompt; false once the user has
// denied it, after which only the Settings app can turn notifications on.
export async function canAskForPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  return !current.granted && current.canAskAgain;
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
  getPresentedNotificationsAsync: () => Promise<{ request: { identifier: string } }[]>;
  dismissNotificationAsync: (identifier: string) => Promise<void>;
};

async function scheduleTrialNotifications(
  driver: TrialNotificationDriver,
  trialId: string, food: { id: string; isCustom: boolean; name: string }, planned: PlannedNotification[],
): Promise<void> {
  const label = foodLabel(food);
  for (const p of planned) {
    await driver.scheduleNotificationAsync({
      identifier: `${trialId}:${p.kind}${p.kind === 'checkin' ? p.day : p.attempt}`,
      // the action handler needs to know which food, Trial, and day it is clearing
      content: {
        ...content(p, label),
        data: {
          foodId: food.id,
          trialId,
          trialLifecycle: true,
          ...(p.kind === 'checkin' ? { targetDay: p.fireAt.toISOString() } : {}),
        },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.fireAt },
    });
  }
}

const TRIAL_NOTIFICATION_ID = /:(?:checkin\d+|windowEnd\d+)$/;

// Reads the 이상 없음 action's notification data into an Observation command.
// The target day is the day the prompt asked about, so a late tap is recorded
// against that day (as a recalled Observation) rather than the day of the tap.
// Prompts scheduled by older versions carry only foodId and keep recording
// today.
export function checkinActionCommand(
  data: Record<string, unknown> | null | undefined,
  now: Date,
): { foodId: string; trialId?: string; targetDay?: Date } | undefined {
  const { foodId, trialId, targetDay } = data ?? {};
  if (typeof foodId !== 'string') return undefined;
  const command: { foodId: string; trialId?: string; targetDay?: Date } = { foodId };
  if (typeof trialId === 'string') command.trialId = trialId;
  const day = typeof targetDay === 'string' ? new Date(targetDay) : undefined;
  if (day && !Number.isNaN(day.getTime()) && !isSameLocalDay(day, now)) command.targetDay = day;
  return command;
}

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
  // Delivered banners outlive their Trial in Notification Center, and their
  // 이상 없음 button would otherwise still be tappable after the Trial closed.
  // Best-effort and last: the action handler also ignores a stale Trial, so a
  // failed dismissal must not cost the active Trial its schedule.
  try {
    const presented = await driver.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .map((notification) => notification.request.identifier)
        .filter((identifier) => TRIAL_NOTIFICATION_ID.test(identifier)
          && !(active && identifier.startsWith(`${active.trialId}:`)))
        .map((identifier) => driver.dismissNotificationAsync(identifier)),
    );
  } catch {
    // stale banners stay; recordObservation rejects their Trial id
  }
}

export const replaceTrialNotifications = (active?: {
  trialId: string;
  food: { id: string; isCustom: boolean; name: string };
  planned: PlannedNotification[];
}) => replaceTrialNotificationsWith(Notifications, active);
