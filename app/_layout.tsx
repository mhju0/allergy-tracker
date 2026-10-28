import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import i18n from '../src/i18n';
import { db } from '../src/db/client';
import { seedIfEmpty } from '../src/db/seed';
import { recordObservation } from '../src/observation/sqlite';
import {
  CHECKIN_ACTION, checkinActionCommand, initNotificationHandler, registerCheckinAction,
} from '../src/services/notify';
import { reconcileTrialLifecycle } from '../src/trialLifecycle/sqlite';
import { colors, layout, spacing } from '../src/ui/tokens';
import { Text } from '../src/ui/Text';
import { showAlert } from '../src/ui/alert';
import { DialogHost } from '../src/ui/DialogHost';

initNotificationHandler();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (success) {
      // Demo seed must run first: it triggers on "no baby row yet", and
      // seedIfEmpty creates that row.
      (process.env.EXPO_PUBLIC_DEMO === '1'
        // Lazy require keeps the demo fixture out of production bundles.
        ? require('../src/db/demoSeed').seedDemoIfEmpty(new Date())
        : Promise.resolve())
        .then(() => seedIfEmpty())
        .then(() => setSeeded(true))
        .catch((e: unknown) => setSeedError(e instanceof Error ? e : new Error(String(e))));
    }
  }, [success]);

  useEffect(() => { registerCheckinAction().catch(() => undefined); }, []);

  useEffect(() => {
    if (!seeded) return;
    void reconcileTrialLifecycle();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcileTrialLifecycle();
    });
    return () => subscription.remove();
  }, [seeded]);

  // The 이상 없음 button on the check-in banner. It lands here rather than in
  // Root waits for migrations because the action may cold-launch the app before
  // the Observation persistence adapter can read its active Trial.
  //
  // The hook, NOT addNotificationResponseReceivedListener: that listener never
  // fires for the response that cold-launched the app, which is the ordinary
  // case here. A 09:00 prompt arrives with the app killed, so the tap meant to
  // record the day would have recorded nothing at all.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    // A cold launch delivers the response before the db has been migrated.
    if (!seeded || response?.actionIdentifier !== CHECKIN_ACTION) return;
    // The hook keeps returning this response until it is cleared, and an
    // uncleared one would re-fire on a later render — dating a check-in to
    // whatever day the app happened to re-render on.
    Notifications.clearLastNotificationResponse();
    const command = checkinActionCommand(response.notification.request.content.data);
    if (!command) return;
    // recordObservation owns the guards: a closed or replaced Trial, a day outside
    // the window, or one already logged makes this a no-op rather than a bad row.
    // A closed Trial stays silent — the prompt is simply stale — but a tap that
    // meant to record and couldn't says so.
    recordObservation(command)
      .then((result) => {
        if (result.ok || result.reason === 'no_active_trial') return;
        showAlert(i18n.t(result.reason === 'outside_window' ? 'notif.checkinOutsideWindow' : 'errors.generic'));
      })
      .catch(() => showAlert(i18n.t('errors.generic')));
  }, [response, seeded]);

  const initError = error ?? seedError;
  useEffect(() => {
    if (initError) void SplashScreen.hideAsync();
  }, [initError]);

  if (initError) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          backgroundColor: colors.paper,
          paddingHorizontal: layout.screenInset,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 24 }}>{i18n.t('errors.dbInit')}</Text>
        <Text selectable style={{ color: colors.inkSecondary, fontSize: 12, marginTop: spacing.xs }}>
          {i18n.t('errors.dbInitDetail', { message: initError.message })}
        </Text>
      </View>
    );
  }
  if (!success || !seeded) return null;
  return (
    <View style={{ flex: 1 }}>
      <AppStack />
      <DialogHost />
    </View>
  );
}

function AppStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="foods" />
      <Stack.Screen name="food/[id]" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="log-reaction" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
