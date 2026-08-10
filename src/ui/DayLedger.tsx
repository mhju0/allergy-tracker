import { Alert, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RecordedTrial } from '../domain/records';
import { projectObservationDays, type ObservationDay } from '../observation';
import { recordObservation } from '../observation/sqlite';
import { press } from './pressable';
import { colors, radii, spacing } from './tokens';

// The observation window, rendered as one named cell per day instead of an
// anonymous progress bar. The rule under each cell carries its state, so the
// bar and the record are the same object: you can see which days were actually
// observed, not just how far along the window is.
//
// Never assumes a 3-day window — the cell count comes from trial.windowDays,
// which is a real per-install column.
const RULE: Record<ObservationDay['state'], { color: string; height: number }> = {
  cleared: { color: colors.green, height: 3 },
  today: { color: colors.amber, height: 3 },
  reacted: { color: colors.red, height: 3 },
  unobserved: { color: colors.hairline, height: 1 },
  pending: { color: colors.hairline, height: 1 },
  stopped: { color: colors.hairline, height: 1 },
};

const FG: Record<ObservationDay['state'], string> = {
  cleared: colors.green,
  today: colors.amberText,
  reacted: colors.red,
  unobserved: colors.inkSecondary,
  pending: colors.inkSecondary,
  stopped: colors.inkSecondary,
};

// `backfillFoodId` turns the missed days into the recovery path. A parent who
// lost a day to a normal busy Tuesday had no way to say so afterwards — the
// day was gone, and the window silently got weaker. Passing the food id (only
// while its trial is open) makes every 기록 없음 cell one tap from being
// filled in. Data access in a ui/ component follows CheckinPill's precedent.
export function DayLedger({ trial, now, backfillFoodId }: {
  trial: RecordedTrial;
  now: Date;
  backfillFoodId?: string;
}) {
  const { t } = useTranslation();
  const days = projectObservationDays(trial, now);
  const label = (day: ObservationDay) => t('ledger.day', { n: day.day });
  const stamp = (day: ObservationDay) => {
    if (day.reactionAt) return day.reactionAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    if (day.observation) {
      return day.observation.backfilledAt
        ? t('ledger.recalled')
        : day.observation.occurredAt.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
    }
    return day.state === 'today' ? t('ledger.notYet') : '';
  };

  const backfill = (day: ObservationDay) => {
    if (!backfillFoodId) return;
    const date = day.date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    Alert.alert(t('ledger.backfillTitle', { date }), t('ledger.backfillBody'), [
      {
        text: t('ledger.backfillYes'),
        onPress: async () => {
          const res = await recordObservation({ foodId: backfillFoodId, targetDay: day.date });
          if (!res.ok) Alert.alert(t('errors.generic'));
        },
      },
      { text: t('ledger.backfillNo'), style: 'cancel' },
    ]);
  };

  return (
    <View
      accessible={!backfillFoodId}
      accessibilityLabel={days.map((day) => `${label(day)} ${t(`ledger.state.${day.state}`)}`).join(', ')}
      style={{ flexDirection: 'row', gap: spacing.xs }}
    >
      {days.map((day) => {
        const fillable = backfillFoodId !== undefined && day.state === 'unobserved';
        return (
          <Pressable
            key={day.day}
            disabled={!fillable}
            accessibilityRole={fillable ? 'button' : undefined}
            accessibilityLabel={fillable ? t('ledger.backfillA11y', { day: label(day) }) : `${label(day)} ${t(`ledger.state.${day.state}`)}`}
            onPress={() => backfill(day)}
            style={press({
              flex: 1,
              minHeight: 88,
              borderWidth: day.state === 'today' ? 2 : 1,
              borderColor: day.state === 'today' ? colors.accent : colors.hairline,
              borderRadius: radii.md,
              padding: spacing.sm,
              backgroundColor: day.state === 'cleared'
                ? colors.greenTint
                : day.state === 'reacted'
                  ? colors.redTint
                  : colors.surface,
            })}
          >
            <View>
              <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.6, color: colors.inkSecondary }}>
                {label(day)}
              </Text>
              <Text style={{ fontSize: 12.5, lineHeight: 18, fontWeight: '800', color: FG[day.state], marginTop: spacing.xxs }}>
                {t(`ledger.state.${day.state}`)}
              </Text>
              <Text
                style={{
                  fontSize: 10.5, lineHeight: 15, color: fillable ? colors.green : colors.inkSecondary,
                  fontWeight: fillable ? '700' : '400', minHeight: 15,
                }}
              >
                {fillable ? t('ledger.backfillHint') : stamp(day)}
              </Text>
            </View>
            <View
              style={{
                position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: spacing.xs,
                height: RULE[day.state].height, borderRadius: radii.pill, backgroundColor: RULE[day.state].color,
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
