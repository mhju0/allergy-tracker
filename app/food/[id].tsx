import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
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
import { press } from '../../src/ui/pressable';
import { colors, layout, statusIcon } from '../../src/ui/tokens';

const eyebrowStyle = { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2.2, color: colors.inkSecondary, paddingBottom: 12 };

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
  const bump = useCallback(() => setTick((x) => x + 1), []);
  useFocusEffect(bump);
  // Same staleness as Home: `isWindowElapsed` reads a render-time clock, and
  // returning from the background does not re-run the focus effect.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') bump();
    });
    return () => sub.remove();
  }, [bump]);

  const entry = foods.find((f) => f.food.id === id);
  const startFlow = useStartTrialFlow(foods, baby?.defaultWindowDays ?? 3);
  if (!entry || !baby) return null;

  const { food, trials, status, latest } = entry;
  const now = new Date();
  const windowDays = baby.defaultWindowDays;
  const activeHere = latest && latest.outcome === null ? latest : undefined;
  const fg = colors.status[status].fg;

  // A started test lives on the home hero — land the user there, not here.
  const onStart = () => startFlow(food, () => router.dismissAll());

  const testingElapsed = latest && status === 'testing' ? isWindowElapsed(latest, now) : false;
  const testingDay = latest && status === 'testing' ? trialDay(latest, now) : 0;

  const latestReaction = latest?.reactions[0];
  const subline =
    status === 'reacted' && latestReaction
      ? `${statusIcon.reacted} ${t('status.reacted')} · ${reactionSummary(latestReaction, t)}`
      : status === 'testing' && latest
        ? `${statusIcon.testing} ${t('status.testing')} · ${t('home.dayOf', { day: testingDay, total: latest.windowDays })}`
        : `${statusIcon[status]} ${t(`status.${status}`)}`;

  // Flat, newest-first history — every record is its own big bullet, mirroring
  // the calendar's day-detail model. Same stream as the calendar, reversed and
  // opted into this food's cancelled trials.
  const historyRows = buildRecords([entry], { includeCancelled: true })
    .reverse()
    .map((r) => ({
      key: r.key,
      at: r.at,
      color: KIND_COLOR[r.kind],
      outline: r.kind === 'cancelled',
      label: t(KIND_LABEL[r.kind]),
      detail: r.reaction
        ? `${reactionSummary(r.reaction, t)}${r.reaction.note ? ` — ${r.reaction.note}` : ''}`
        : undefined,
    }));

  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: insets.top + 4, gap: 20, backgroundColor: colors.paper }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={press({ minHeight: 44, justifyContent: 'center' })}
      >
        <Text style={eyebrowStyle}>
          <Text style={{ color: colors.inkSecondary }}>‹ </Text>
          {/* back went to Home whenever the hero was tapped, while the label
              always said 재료 — name wherever we actually came from. */}
          {from === 'foods' ? t('foods.title') : t('home.short')}
        </Text>
      </Pressable>

      <View>
        <Text style={{ fontSize: 52, fontWeight: '900', color: colors.ink, letterSpacing: -1, lineHeight: 54 }}>
          {foodLabel(food)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: fg, flexShrink: 1 }}>{subline}</Text>
          {food.allergenGroup && (
            <Text
              style={{
                fontSize: 10, fontWeight: '800', color: colors.red, borderWidth: 1,
                borderColor: colors.red, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
              }}
            >
              {t('foods.highRisk')}
            </Text>
          )}
        </View>
      </View>

      {latest && <DayLedger days={buildLedger(latest, now, t)} />}

      {activeHere ? (
        <View style={{ gap: 10 }}>
          {isWindowElapsed(activeHere, now) && <MarkSafeButton trial={activeHere} />}
          <Button
            label={t('home.logReaction')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: food.id } })}
          />
          <CheckinPill foodId={food.id} trial={activeHere} now={now} />
          <Button label={t('food.cancelTrial')} variant="danger"
            onPress={() => Alert.alert(
              t('food.cancelConfirmTitle', { food: foodLabel(food) }),
              t('food.cancelConfirmBody'),
              [
                { text: t('food.cancelConfirmYes'), style: 'destructive', onPress: () => cancelTrial(activeHere.id, new Date()) },
                { text: t('food.keepGoing'), style: 'cancel' },
              ],
            )} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button
            label={status === 'untried'
              ? t('food.startTrial', { days: windowDays })
              : t('food.retest', { days: windowDays })}
            onPress={onStart}
          />
          {status !== 'untried' && (
            <Button
              label={t('home.logReaction')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: food.id } })}
            />
          )}
        </View>
      )}

      <View>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: colors.inkSecondary, marginBottom: 4, paddingLeft: layout.rowInset }}>
          {t('food.history')}
        </Text>
        {historyRows.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.inkSecondary, paddingLeft: layout.rowInset }}>{t('food.noHistory')}</Text>
        ) : (
          historyRows.map((ev) => (
            <View
              key={ev.key}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, paddingHorizontal: layout.rowInset, borderBottomWidth: 1, borderColor: colors.hairline }}
            >
              <View
                style={
                  ev.outline
                    ? { width: 9, height: 9, borderRadius: 999, borderWidth: 1.5, borderColor: colors.muted, marginTop: 4 }
                    : { width: 9, height: 9, borderRadius: 999, backgroundColor: ev.color, marginTop: 4 }
                }
              />
              <View style={{ flexShrink: 1 }}>
                <Text style={{ fontSize: 11.5, color: colors.inkSecondary }}>
                  {ev.at.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} · {ev.at.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: ev.color, marginTop: 2 }}>{ev.label}</Text>
                {ev.detail && <Text style={{ fontSize: 12.5, color: colors.red, marginTop: 2 }}>{ev.detail}</Text>}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
