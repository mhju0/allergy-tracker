import { useRef } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RecordedTrial } from '../domain/records';
import { isEligibleObservationDay, isSameLocalDay } from '../observation';
import { recordObservation } from '../observation/sqlite';
import { Icon } from './Icon';
import { press } from './pressable';
import { colors, layout, radii, spacing, typeStyles } from './tokens';

// One-tap "이상 없음" observation for an active trial. Never touches trial
// outcome — it only records an Observation. Collapses to a done-state line once one
// exists for today (local calendar date).
// `filled` makes this the screen's primary action. On the two days out of three
// when the app is asking for a check-in, this IS the thing to do — it used to be
// a green outline sitting under a filled persimmon button for an action the
// one-active-trial rule blocks.
export function CheckinPill(
  { foodId, trial, now, filled }:
  { foodId: string; trial: RecordedTrial; now: Date; filled?: boolean },
) {
  const { t } = useTranslation();
  const checkingIn = useRef(false);
  // The Trial carries its own Observations, so this no longer reads the whole
  // table (or the clock) to answer a question about one trial.
  const doneToday = trial.observations.find((observation) => isSameLocalDay(observation.occurredAt, now));

  // Today may not be a day this window covers — past the close, or the fourth
  // calendar day a late-evening start spills into. The Observation module rejects those, so
  // offering the button would be offering an action that quietly does nothing.
  if (!doneToday && !isEligibleObservationDay(trial, now, now)) return null;

  if (doneToday) {
    const time = doneToday.occurredAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    return (
      <View style={{ minHeight: layout.controlHeight, paddingHorizontal: layout.cardPadding, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.greenTint }}>
        <Icon name="check" size={20} color={colors.green} strokeWidth={2.4} />
        <View>
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '800', color: colors.green, textAlign: 'center' }}>
            {t('food.checkinDone', { time })}
          </Text>
          <Text style={{ fontSize: 11, lineHeight: 15, color: colors.inkSecondary, textAlign: 'center' }}>
            {t('food.checkinHint')}
          </Text>
        </View>
      </View>
    );
  }

  const onPress = async () => {
    if (checkingIn.current) return;
    checkingIn.current = true;
    try {
      const result = await recordObservation({ foodId });
      if (!result.ok) Alert.alert(t('errors.generic'));
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      checkingIn.current = false;
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t('food.checkinHint')}
      onPress={onPress}
      style={press({
        minHeight: layout.controlHeight,
        backgroundColor: filled ? colors.accent : colors.greenTint,
        borderWidth: 0,
        borderRadius: radii.md,
        paddingHorizontal: layout.cardPadding,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xs,
        alignItems: 'center',
      })}
    >
      <Icon name="check" size={20} color={filled ? colors.onAccent : colors.green} strokeWidth={2.4} />
      <Text style={{ color: filled ? colors.onAccent : colors.green, ...typeStyles.button }}>
        {filled ? t('home.todayClear') : t('food.checkinClear')}
      </Text>
    </Pressable>
  );
}
