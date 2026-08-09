import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useFoodsWithStatus } from '../../src/data/queries';
import { cancelTrial } from '../../src/data/mutations';
import { useStartTrialFlow } from '../../src/data/useStartTrialFlow';
import { foodLabel } from '../../src/i18n';
import { isWindowElapsed } from '../../src/domain/status';
import { trialDay } from '../../src/domain/homeState';
import { buildRecords, reactionSummary, type RecordKind } from '../../src/domain/records';
import { Button } from '../../src/ui/Button';
import { CheckinPill } from '../../src/ui/CheckinPill';
import { buildLedger, DayLedger } from '../../src/ui/DayLedger';
import { MarkSafeButton } from '../../src/ui/MarkSafeButton';
import { BackButton } from '../../src/ui/ScreenHeader';
import { SectionHeaderRow } from '../../src/ui/SectionHeaderRow';
import { StatusChip } from '../../src/ui/StatusChip';
import { WarmCard } from '../../src/ui/WarmCard';
import { Icon } from '../../src/ui/Icon';
import { colors, layout, radii, spacing, typeStyles } from '../../src/ui/tokens';

const KIND_COLOR: Record<RecordKind, string> = {
  start: colors.amberText,
  safe: colors.green,
  reacted: colors.red,
  cancelled: colors.inkSecondary,
  checkin: colors.green,
};
const KIND_LABEL: Record<RecordKind, string> = {
  start: 'calendar.trialStart',
  safe: 'food.outcome.safe',
  reacted: 'food.outcome.reacted',
  cancelled: 'food.outcome.cancelled',
  checkin: 'food.checkinClear',
};

export default function FoodDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const insets = useSafeAreaInsets();
  const baby = useBaby();
  const foods = useFoodsWithStatus();
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((value) => value + 1), []);
  useFocusEffect(bump);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') bump();
    });
    return () => sub.remove();
  }, [bump]);

  const entry = foods.find((food) => food.food.id === id);
  const startFlow = useStartTrialFlow(foods, baby?.defaultWindowDays ?? 3);
  if (!entry || !baby) return null;

  const { food, latest, status } = entry;
  const now = new Date();
  const activeHere = latest && latest.outcome === null ? latest : undefined;
  const latestReaction = latest?.reactions[0];
  const testingDay = latest && status === 'testing' ? trialDay(latest, now) : 0;
  const subline = status === 'reacted' && latestReaction
    ? `${t('status.reacted')} · ${reactionSummary(latestReaction, t)}`
    : status === 'testing' && latest
      ? `${t('status.testing')} · ${t('home.dayOf', { day: testingDay, total: latest.windowDays })}`
      : t(`status.${status}`);

  const historyRows = buildRecords([entry], { includeCancelled: true }).reverse().map((record) => ({
    key: record.key,
    at: record.at,
    color: KIND_COLOR[record.kind],
    label: t(KIND_LABEL[record.kind]),
    detail: record.reaction
      ? `${reactionSummary(record.reaction, t)}${record.reaction.note ? ` — ${record.reaction.note}` : ''}`
      : undefined,
  }));

  const onStart = () => startFlow(food, () => router.dismissAll());

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) + 24, backgroundColor: colors.paper }}
    >
      <BackButton label={from === 'foods' ? t('foods.title') : from === 'calendar' ? t('calendar.historyTitle') : t('home.short')} onPress={() => router.back()} />

      <View style={{ alignItems: 'center', paddingTop: spacing.xs, paddingBottom: spacing.lg }}>
        <View style={{ width: 92, height: 92, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: status === 'reacted' ? colors.redTint : status === 'safe' ? colors.greenTint : colors.amberTint }}>
          <Icon name={status === 'reacted' ? 'warning' : status === 'safe' ? 'check' : status === 'testing' ? 'clock' : 'foods'} size={43} color={colors.status[status].fg} strokeWidth={1.7} />
        </View>
        <Text accessibilityRole="header" style={{ fontSize: 38, lineHeight: 45, fontWeight: '900', letterSpacing: -1, color: colors.ink, marginTop: spacing.sm }}>{foodLabel(food)}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.inkSecondary, marginTop: spacing.xxs }}>{subline}</Text>
        <View style={{ marginTop: spacing.xs }}><StatusChip status={status} /></View>
      </View>

      {food.allergenGroup && (
        <WarmCard tone="reaction" style={{ marginBottom: spacing.md }}>
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '900', color: colors.red }}>{t('food.highRiskWhyTitle')}</Text>
          <Text style={{ fontSize: 12.5, color: colors.red, lineHeight: 19, marginTop: spacing.xxs }}>{t('food.highRiskWhyBody', { food: foodLabel(food) })}</Text>
        </WarmCard>
      )}

      {latest && (
        <WarmCard style={{ marginBottom: spacing.md }}>
          <Text style={{ ...typeStyles.rowTitle, fontWeight: '900', color: colors.ink, marginBottom: spacing.sm }}>{t('food.observationProgress')}</Text>
          <DayLedger days={buildLedger(latest, now, t)} backfillFoodId={activeHere ? food.id : undefined} />
        </WarmCard>
      )}

      {activeHere ? (
        <View style={{ gap: spacing.xs }}>
          {isWindowElapsed(activeHere, now) && <MarkSafeButton trial={activeHere} />}
          {!isWindowElapsed(activeHere, now) && <CheckinPill foodId={food.id} trial={activeHere} now={now} filled />}
          <Button label={t('home.symptomsHappened')} variant="danger" icon={<Icon name="warning" size={19} color={colors.red} />} onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: food.id } })} />
          <Button
            label={t('food.cancelTrial')}
            variant="secondary"
            onPress={() => Alert.alert(
              t('food.cancelConfirmTitle', { food: foodLabel(food) }),
              t('food.cancelConfirmBody'),
              [
                { text: t('food.cancelConfirmYes'), style: 'destructive', onPress: () => cancelTrial(activeHere.id, new Date()) },
                { text: t('food.keepGoing'), style: 'cancel' },
              ],
            )}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <Button
            label={status === 'untried' ? t('food.startTrial', { days: baby.defaultWindowDays }) : t('food.retest', { days: baby.defaultWindowDays })}
            icon={<Icon name="clock" size={19} color={colors.onAccent} />}
            onPress={onStart}
          />
          {status !== 'untried' && <Button label={t('food.newReaction')} variant="danger" icon={<Icon name="warning" size={19} color={colors.red} />} onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: food.id } })} />}
        </View>
      )}

      <SectionHeaderRow title={t('food.history')} meta={t('food.historyCount', { count: historyRows.length })} />
      {historyRows.length === 0 ? (
        <WarmCard style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Icon name="clock" size={24} color={colors.muted} />
          <Text style={{ fontSize: 13, lineHeight: 18, color: colors.inkSecondary, marginTop: spacing.xs }}>{t('food.noHistory')}</Text>
        </WarmCard>
      ) : (
        <WarmCard style={{ paddingVertical: spacing.xxs, paddingHorizontal: layout.cardPadding }}>
          {historyRows.map((event, index) => (
            <View key={event.key} style={{ minHeight: layout.rowHeight, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.hairline }}>
              <View style={{ width: 28, height: 28, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: event.color === colors.red ? colors.redTint : event.color === colors.green ? colors.greenTint : colors.amberTint }}>
                <View style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: event.color }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '800', color: event.color }}>{event.label}</Text>
                <Text style={{ fontSize: 11.5, lineHeight: 17, color: colors.inkSecondary }}>
                  {event.at.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} · {event.at.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {event.detail && <Text style={{ fontSize: 12, color: colors.red, lineHeight: 18, marginTop: spacing.xxs }}>{event.detail}</Text>}
              </View>
            </View>
          ))}
        </WarmCard>
      )}
    </ScrollView>
  );
}
