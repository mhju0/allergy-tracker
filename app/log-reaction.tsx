import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFoodsWithStatus } from '../src/data/queries';
import { logReaction } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { Button } from '../src/ui/Button';
import { HeaderButton, ScreenHeader } from '../src/ui/ScreenHeader';
import { WarmCard } from '../src/ui/WarmCard';
import { Icon } from '../src/ui/Icon';
import { press } from '../src/ui/pressable';
import { colors, layout, radii } from '../src/ui/tokens';

const SYMPTOMS = ['hives', 'rash', 'vomiting', 'diarrhea', 'swelling', 'cough', 'breathing', 'other'] as const;
const SEVERITIES = ['mild', 'moderate', 'severe'] as const;

export default function LogReaction() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { foodId } = useLocalSearchParams<{ foodId: string }>();
  const insets = useSafeAreaInsets();
  const entry = useFoodsWithStatus().find((food) => food.food.id === foodId);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('mild');
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [note, setNote] = useState('');
  const saving = useRef(false);

  if (!entry) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: layout.screenInset, gap: 16, backgroundColor: colors.paper }}>
        <Text style={{ fontSize: 15, color: colors.inkSecondary, textAlign: 'center' }}>{t('reaction.missing')}</Text>
        <Button label={t('food.close')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const showEmergency = severity === 'severe' || symptoms.includes('breathing') || symptoms.includes('swelling');
  const toggle = (symptom: string) => setSymptoms((current) => current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]);
  const delayed = entry.status !== 'testing';

  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      const result = await logReaction(entry.food.id, { symptoms, severity, occurredAt, note: note.trim() || null }, new Date());
      if (!result.ok) {
        Alert.alert(t('errors.generic'));
        return;
      }
      if (navigation.isFocused()) router.back();
      Alert.alert(t('reaction.savedTitle', { food: foodLabel(entry.food) }), t(delayed ? 'reaction.savedBodyDelayed' : 'reaction.savedBodyActive'));
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      saving.current = false;
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8, paddingBottom: 24 }}
      >
        <ScreenHeader title={t('reaction.title')} right={<HeaderButton label={t('food.close')} icon="close" onPress={() => router.back()} />} />
        <WarmCard tone="observing" style={{ padding: 15 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>{t('reaction.question', { food: foodLabel(entry.food) })}</Text>
          <Text style={{ fontSize: 11.5, color: colors.inkSecondary, lineHeight: 17, marginTop: 3 }}>{t('reaction.changeHint')}</Text>
        </WarmCard>

        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink, marginTop: 21, marginBottom: 9 }}>
          {t('reaction.symptoms')} <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSecondary }}>{t('reaction.requiredHint')}</Text>
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SYMPTOMS.map((symptom) => {
            const selected = symptoms.includes(symptom);
            return (
              <Pressable
                key={symptom}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggle(symptom)}
                style={press({
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: 13,
                  borderRadius: radii.sm,
                  borderWidth: selected ? 1.5 : 1,
                  borderColor: selected ? colors.red : colors.hairline,
                  backgroundColor: selected ? colors.redTint : colors.surface,
                })}
              >
                <Text style={{ color: selected ? colors.red : colors.ink, fontSize: 13, fontWeight: '700' }}>{t(`reaction.symptom.${symptom}`)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink, marginTop: 21, marginBottom: 9 }}>{t('reaction.severityQuestion')}</Text>
        <View style={{ flexDirection: 'row', gap: 5, padding: 5, borderRadius: radii.md, backgroundColor: '#F1E7E1' }}>
          {SEVERITIES.map((level) => {
            const selected = severity === level;
            return (
              <Pressable
                key={level}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSeverity(level)}
                style={press({ flex: 1, minHeight: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.surface : 'transparent' })}
              >
                <Text style={{ color: selected ? colors.ink : colors.inkSecondary, fontSize: 13, fontWeight: '800' }}>{t(`reaction.severityLevel.${level}`)}</Text>
              </Pressable>
            );
          })}
        </View>

        {showEmergency && (
          <WarmCard tone="reaction" style={{ marginTop: 13, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
              <Icon name="warning" size={21} color={colors.red} />
              <Text accessibilityRole="alert" style={{ flex: 1, color: colors.red, fontSize: 12.5, fontWeight: '800', lineHeight: 19 }}>{t('reaction.emergency')}</Text>
            </View>
          </WarmCard>
        )}

        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink, marginTop: 21, marginBottom: 9 }}>{t('reaction.when')}</Text>
        <View style={{ minHeight: layout.controlHeight, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.md, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.surface }}>
          <DateTimePicker locale="ko-KR" value={occurredAt} mode="datetime" maximumDate={new Date()} onValueChange={(_, date) => setOccurredAt(date)} />
        </View>

        <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink, marginTop: 21, marginBottom: 9 }}>{t('reaction.note')}</Text>
        <TextInput
          accessibilityLabel={t('reaction.note')}
          placeholder={t('reaction.notePlaceholder')}
          placeholderTextColor={colors.inkSecondary}
          value={note}
          onChangeText={setNote}
          multiline
          style={{ minHeight: 78, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.md, padding: 13, fontSize: 15, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top' }}
        />
      </ScrollView>
      <View style={{ paddingHorizontal: layout.screenInset, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderColor: colors.hairline, backgroundColor: colors.paper }}>
        <Button
          label={symptoms.length > 0 ? t('reaction.saveClear') : t('reaction.saveDisabled')}
          disabled={symptoms.length === 0}
          icon={<Icon name="check" size={20} color={colors.onAccent} />}
          onPress={save}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
