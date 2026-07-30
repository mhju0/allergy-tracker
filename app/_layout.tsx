import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import i18n from '../src/i18n';
import { db } from '../src/db/client';
import { seedDemoIfEmpty, seedIfEmpty } from '../src/db/seed';
import { logCheckin } from '../src/data/mutations';
import { CHECKIN_ACTION, initNotificationHandler, registerCheckinAction } from '../src/services/notify';
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

  // The 이상 없음 button on the check-in banner. It lands here rather than in
  // services/notify because writing the row needs data/mutations, which already
  // imports notify — the listener is the one place both sides can meet.
  useEffect(() => {
    void registerCheckinAction();
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      if (res.actionIdentifier !== CHECKIN_ACTION) return;
      const { foodId } = res.notification.request.content.data ?? {};
      if (typeof foodId !== 'string') return;
      const at = new Date();
      // logCheckin owns the guards: a closed trial or an already-logged day
      // makes this a no-op rather than a duplicate row.
      void logCheckin(foodId, at, at);
    });
    return () => sub.remove();
  }, []);

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
