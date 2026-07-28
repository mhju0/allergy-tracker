import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { readAllTables, useBaby, useFoodsWithStatus, useReactions } from '../src/data/queries';
import { updateBabySettings } from '../src/data/mutations';
import { isPermissionGranted } from '../src/services/notify';
import { Button } from '../src/ui/Button';
import { press } from '../src/ui/pressable';
import { colors, layout } from '../src/ui/tokens';
import { buildBackup, buildReport } from '../src/services/export';

const labelStyle = { fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.5, color: colors.inkSecondary, marginTop: 18, marginBottom: 4, paddingLeft: layout.rowInset };
const rowStyle = {
  flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const,
  paddingVertical: 14, paddingHorizontal: layout.rowInset, borderBottomWidth: 1, borderColor: colors.hairline,
};
const rowLabelText = { fontSize: 15, fontWeight: '600' as const, color: colors.ink };

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const baby = useBaby();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const reactions = useReactions();
  const exporting = useRef(false);
  const [notifOn, setNotifOn] = useState<boolean | null>(null); // null = still checking
  useEffect(() => {
    isPermissionGranted().then(setNotifOn).catch(() => {});
  }, []);
  if (!baby) return null;

  const exportPdf = async () => {
    if (exporting.current) return;
    exporting.current = true;
    try {
      const html = buildReport({ baby, foods, reactions }, new Date(), t);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      exporting.current = false;
    }
  };

  const exportJson = async () => {
    if (exporting.current) return;
    exporting.current = true;
    try {
      const json = buildBackup(await readAllTables(), new Date());
      const path = `${FileSystem.cacheDirectory}allergy-tracker-backup.json`;
      await FileSystem.writeAsStringAsync(path, json);
      await Sharing.shareAsync(path, { mimeType: 'application/json' });
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      exporting.current = false;
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 12, paddingBottom: 22 + insets.bottom, backgroundColor: colors.paper }}>
      <View style={{ justifyContent: 'center', paddingBottom: 12 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2.2, color: colors.inkSecondary, textAlign: 'center' }}>
          {t('settings.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('food.close')}
          onPress={() => router.back()}
          hitSlop={12}
          style={press({ position: 'absolute', right: 0, top: -6, minWidth: 32, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center' })}
        >
          <Text style={{ fontSize: 17, color: colors.inkSecondary }}>✕</Text>
        </Pressable>
      </View>

      <Text style={[labelStyle, { marginTop: 6 }]}>{t('settings.babySection')}</Text>
      <View style={rowStyle}>
        <Text style={rowLabelText}>{t('setup.babyName')}</Text>
        <TextInput
          defaultValue={baby.name ?? ''}
          placeholder={t('settings.optional')}
          placeholderTextColor={colors.inkSecondary}
          onEndEditing={(e) => updateBabySettings({ name: e.nativeEvent.text.trim() || null })}
          // A stored value must not look like the 미입력 placeholder — that was
          // the one screen where you could not tell saved from unsaved.
          style={{ fontSize: 15, color: colors.ink, textAlign: 'right', flex: 1, marginLeft: 12 }}
        />
      </View>
      <View style={rowStyle}>
        <Text style={rowLabelText}>{t('setup.birthdate')}</Text>
        <DateTimePicker
          locale="ko-KR"
          // ponytail: unset birthdate displays as today until first picked —
          // add an explicit "not set" affordance if that ever confuses anyone.
          value={baby.birthdate ?? new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => d && updateBabySettings({ birthdate: d })}
        />
      </View>

      <Text style={labelStyle}>{t('settings.appSection')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openSettings()}
        style={press(rowStyle)}
      >
        <Text style={rowLabelText}>{t('settings.notifications')}</Text>
        <Text style={{ fontSize: 14, color: notifOn === false ? colors.red : colors.inkSecondary }}>
          {notifOn === null ? '' : notifOn ? t('settings.notifOn') : t('settings.notifOff')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          await updateBabySettings({ welcomedAt: null });
          router.back(); // home now shows the welcome card again
        }}
        style={press(rowStyle)}
      >
        <Text style={rowLabelText}>{t('settings.showGuide')}</Text>
        <Text style={{ fontSize: 15, color: colors.inkSecondary }}>→</Text>
      </Pressable>

      <Text style={labelStyle}>{t('settings.exportSection')}</Text>
      <View style={{ gap: 10, marginTop: 10 }}>
        <Button label={t('settings.exportPdf')} onPress={exportPdf} />
        <Button label={t('settings.exportJson')} variant="secondary" onPress={exportJson} />
      </View>

      <Text style={{ fontSize: 11.5, color: colors.inkSecondary, lineHeight: 17, marginTop: 18, paddingLeft: layout.rowInset }}>
        {t('settings.privacy')}{'\n'}{t('settings.disclaimer')}
      </Text>
    </ScrollView>
  );
}
