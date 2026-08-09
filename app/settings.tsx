import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { readAllTables, useBaby, useFoodsWithStatus } from '../src/data/queries';
import { updateBabySettings } from '../src/data/mutations';
import { isPermissionGranted } from '../src/services/notify';
import { buildBackup, buildReport } from '../src/services/export';
import { HeaderButton, ScreenHeader } from '../src/ui/ScreenHeader';
import { WarmCard } from '../src/ui/WarmCard';
import { Icon, type IconName } from '../src/ui/Icon';
import { press } from '../src/ui/pressable';
import { colors, layout, radii } from '../src/ui/tokens';

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const baby = useBaby();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const exporting = useRef(false);
  const [notifOn, setNotifOn] = useState<boolean | null>(null);
  useEffect(() => { isPermissionGranted().then(setNotifOn).catch(() => {}); }, []);
  if (!baby) return null;

  const exportPdf = async () => {
    if (exporting.current) return;
    exporting.current = true;
    try {
      const html = buildReport({ baby, foods }, new Date(), t);
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
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) + 24, backgroundColor: colors.paper }}
    >
      <ScreenHeader title={t('settings.title')} right={<HeaderButton label={t('food.close')} icon="close" onPress={() => router.back()} />} />

      <SectionLabel label={t('settings.babyShort')} />
      <WarmCard style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <SettingIcon name="user" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink }}>{t('setup.babyName')}</Text>
            <Text style={{ fontSize: 10.5, color: colors.inkSecondary, marginTop: 2 }}>{t('settings.reportOnly')}</Text>
          </View>
          <TextInput
            accessibilityLabel={t('setup.babyName')}
            defaultValue={baby.name ?? ''}
            placeholder={t('settings.optional')}
            placeholderTextColor={colors.inkSecondary}
            onEndEditing={(event) => updateBabySettings({ name: event.nativeEvent.text.trim() || null })}
            style={{ minWidth: 92, minHeight: layout.touchTarget, fontSize: 14, fontWeight: '700', color: colors.ink, textAlign: 'right' }}
          />
        </View>
        <View style={{ height: 1, marginLeft: 63, backgroundColor: colors.hairline }} />
        <View style={{ minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <SettingIcon name="calendar" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink }}>{t('setup.birthdate')}</Text>
            <Text style={{ fontSize: 10.5, color: colors.inkSecondary, marginTop: 2 }}>{baby.birthdate ? t('settings.reportOnly') : t('settings.optional')}</Text>
          </View>
          <DateTimePicker locale="ko-KR" value={baby.birthdate ?? new Date()} mode="date" maximumDate={new Date()} onValueChange={(_, date) => updateBabySettings({ birthdate: date })} />
        </View>
      </WarmCard>

      <SectionLabel label={t('settings.notificationsAndGuide')} />
      <WarmCard style={{ padding: 0, overflow: 'hidden' }}>
        <SettingRow
          icon="bell"
          title={t('settings.observationNotifications')}
          detail={t('settings.notificationDetail')}
          value={notifOn === null ? '' : notifOn ? t('settings.notifOn') : t('settings.notifOffShort')}
          valueColor={notifOn === false ? colors.red : colors.green}
          onPress={() => Linking.openSettings()}
        />
        <Divider />
        <SettingRow
          icon="help"
          title={t('settings.showGuide')}
          detail={t('settings.guideDetail')}
          onPress={async () => {
            await updateBabySettings({ welcomedAt: null });
            router.back();
          }}
        />
      </WarmCard>

      <SectionLabel label={t('settings.myRecords')} />
      <WarmCard style={{ padding: 0, overflow: 'hidden' }}>
        <SettingRow icon="file" title={t('settings.exportPdfClear')} detail={t('settings.exportPdfDetail')} value="PDF" onPress={exportPdf} />
        <Divider />
        <SettingRow icon="download" title={t('settings.exportJsonClear')} detail={t('settings.exportJsonDetail')} value="JSON" onPress={exportJson} />
      </WarmCard>

      <WarmCard tone="safe" style={{ marginTop: 18, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Icon name="shield" size={21} color={colors.green} />
          <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '700', color: colors.green, lineHeight: 19 }}>{t('settings.privacyClear')}</Text>
        </View>
      </WarmCard>
      <Text style={{ fontSize: 10.5, color: colors.inkSecondary, lineHeight: 16, marginHorizontal: 5, marginTop: 13 }}>{t('settings.disclaimerClear')}</Text>
    </ScrollView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: colors.inkSecondary, marginTop: 17, marginBottom: 8, marginLeft: 3 }}>{label}</Text>;
}

function SettingIcon({ name }: { name: IconName }) {
  return <View style={{ width: 38, height: 38, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentTint }}><Icon name={name} size={20} color={colors.accent} /></View>;
}

function Divider() {
  return <View style={{ height: 1, marginLeft: 63, backgroundColor: colors.hairline }} />;
}

function SettingRow({ icon, title, detail, value, valueColor, onPress }: {
  icon: IconName;
  title: string;
  detail: string;
  value?: string;
  valueColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, value].filter(Boolean).join(', ')}
      onPress={onPress}
      style={press({ minHeight: 70, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface })}
    >
      <SettingIcon name={icon} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink }}>{title}</Text>
        <Text style={{ fontSize: 10.5, color: colors.inkSecondary, lineHeight: 15, marginTop: 2 }}>{detail}</Text>
      </View>
      {value ? <Text style={{ fontSize: 11, fontWeight: '800', color: valueColor ?? colors.inkSecondary }}>{value}</Text> : null}
      <Icon name="chevronRight" size={17} color={colors.muted} />
    </Pressable>
  );
}
