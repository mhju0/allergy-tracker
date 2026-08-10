import { useEffect, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import i18n from '../src/i18n';
import { db } from '../src/db/client';
import { seedDemoIfEmpty, seedIfEmpty } from '../src/db/seed';
import { recordObservation } from '../src/observation/sqlite';
import { CHECKIN_ACTION, initNotificationHandler, registerCheckinAction } from '../src/services/notify';
import { reconcileTrialLifecycle } from '../src/trialLifecycle/sqlite';
import { colors } from '../src/ui/tokens';

initNotificationHandler();

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (success) {
      // Demo seed must run first: it triggers on "no baby row yet", and
      // seedIfEmpty creates that row.
      (process.env.EXPO_PUBLIC_DEMO === '1' ? seedDemoIfEmpty(new Date()) : Promise.resolve())
        .then(() => seedIfEmpty())
        .then(() => setSeeded(true))
        .catch((e) => setSeedError(e instanceof Error ? e : new Error(String(e))));
    }
  }, [success]);

  useEffect(() => { void registerCheckinAction(); }, []);

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
    const { foodId } = response.notification.request.content.data ?? {};
    if (typeof foodId !== 'string') return;
    // recordObservation owns the guards: a closed Trial, a day outside the window, or
    // one already logged makes this a no-op rather than a bad row.
    void recordObservation({ foodId });
  }, [response, seeded]);

  if (error || seedError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.red }}>{i18n.t('errors.dbInit', { message: (error ?? seedError)!.message })}</Text>
      </View>
    );
  }
  if (!success || !seeded) return null;
  return <AppStack />;
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
