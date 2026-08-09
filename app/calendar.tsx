import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodsWithStatus } from '../src/data/queries';
import { dayMark, monthMatrix, sameLocalDay } from '../src/domain/calendar';
import { buildRecords, reactionSummary, type RecordKind } from '../src/domain/records';
import { foodLabel } from '../src/i18n';
import { BottomNav } from '../src/ui/BottomNav';
import { Icon } from '../src/ui/Icon';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { SectionHeaderRow } from '../src/ui/SectionHeaderRow';
import { WarmCard } from '../src/ui/WarmCard';
import { press } from '../src/ui/pressable';
import { colors, layout, radii, spacing, typeStyles } from '../src/ui/tokens';

const weekdayKeys = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const;
const TINT_BG = { amber: colors.amberTint, green: colors.greenTint, red: colors.redTint, none: 'transparent' } as const;
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

export default function Calendar() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const [display, setDisplay] = useState(() => {
    const date = new Date();
    return { year: date.getFullYear(), month0: date.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const today = new Date();

  const goMonth = (delta: -1 | 1) => {
    const next = new Date(display.year, display.month0 + delta, 1);
    setDisplay({ year: next.getFullYear(), month0: next.getMonth() });
    setSelectedDate(next);
  };
  const goToday = () => {
    const date = new Date();
    setDisplay({ year: date.getFullYear(), month0: date.getMonth() });
    setSelectedDate(date);
  };

  const cells = useMemo(() => monthMatrix(display.year, display.month0), [display.year, display.month0]);
  const weeks = useMemo(() => {
    const result = [];
    for (let index = 0; index < cells.length; index += 7) result.push(cells.slice(index, index + 7));
    return result;
  }, [cells]);
  const allTrials = useMemo(() => foods.flatMap((food) => food.trials), [foods]);
  const records = useMemo(() => buildRecords(foods), [foods]);
  const reactionDays = useMemo(() => records.filter((record) => record.kind === 'reacted').map((record) => record.at), [records]);
  const checkinDays = useMemo(() => records.filter((record) => record.kind === 'checkin').map((record) => record.at), [records]);
  const events = useMemo(() => records.filter((record) => sameLocalDay(record.at, selectedDate)).map((record) => ({
    key: record.key,
    at: record.at,
    color: KIND_COLOR[record.kind],
    foodId: record.food.id,
    text: `${foodLabel(record.food)} · ${record.reaction ? reactionSummary(record.reaction, t) : t(KIND_LABEL[record.kind])}`,
  })), [records, selectedDate, t]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8, paddingBottom: 20 }}>
        <ScreenHeader eyebrow={t('calendar.subtitle')} title={t('calendar.historyTitle')} />
        <View style={{ minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.today')} onPress={goToday} style={press({ minHeight: layout.touchTarget, justifyContent: 'center' })}>
            <Text style={{ fontSize: 24, lineHeight: 32, fontWeight: '900', letterSpacing: -0.5, color: colors.ink }}>{t('calendar.monthTitle', { year: display.year, month: display.month0 + 1 })}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.prevMonth')} onPress={() => goMonth(-1)} style={press({ width: 48, height: 48, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface })}>
              <Icon name="back" size={20} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.nextMonth')} onPress={() => goMonth(1)} style={press({ width: 48, height: 48, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surface })}>
              <Icon name="chevronRight" size={20} />
            </Pressable>
          </View>
        </View>

        <WarmCard style={{ padding: spacing.xxs }}>
          <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
            {weekdayKeys.map((key, index) => <Text key={key} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, lineHeight: 15, fontWeight: '800', color: index === 0 ? colors.red : colors.inkSecondary }}>{t(`calendar.weekday.${key}`)}</Text>)}
          </View>
          {weeks.map((week, weekIndex) => (
            <View key={weekIndex} style={{ flexDirection: 'row' }}>
              {week.map((cell) => {
                const mark = dayMark(cell.date, allTrials, reactionDays, checkinDays, today);
                const selected = sameLocalDay(cell.date, selectedDate);
                const isToday = sameLocalDay(cell.date, today);
                const marks = [
                  mark.tint === 'amber' ? t('calendar.a11yObserving') : null,
                  mark.tint === 'green' ? t('calendar.a11ySafe') : null,
                  mark.tint === 'red' ? t('calendar.a11yReaction') : null,
                  mark.dot ? t('calendar.a11yRecord') : null,
                  isToday ? t('calendar.todayLabel') : null,
                ].filter(Boolean);
                return (
                  <Pressable
                    key={cell.date.toISOString()}
                    accessibilityRole="button"
                    accessibilityLabel={[cell.date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }), ...marks].join(', ')}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedDate(cell.date)}
                    style={press({
                      flex: 1,
                      minHeight: 44,
                      aspectRatio: 1,
                      margin: 1,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: TINT_BG[mark.tint ?? 'none'],
                      borderWidth: selected ? 2 : isToday ? 1 : 0,
                      borderColor: selected ? colors.accent : colors.inkSecondary,
                    })}
                  >
                    <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: selected ? '900' : '700', color: cell.inMonth ? colors.ink : colors.dayOutMonth }}>{cell.date.getDate()}</Text>
                    {mark.dot && <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: radii.pill, backgroundColor: mark.dot === 'red' ? colors.red : colors.green }} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </WarmCard>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.xs, marginTop: spacing.sm }}>
          {[
            { label: t('calendar.legendWindow'), color: colors.amberTint, icon: 'clock' as const },
            { label: t('calendar.legendSafe'), color: colors.greenTint, icon: 'check' as const },
            { label: t('calendar.legendReaction'), color: colors.redTint, icon: 'warning' as const },
            { label: t('calendar.legendRecord'), color: '#F5EEE9', icon: 'file' as const },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
              <View style={{ width: 20, height: 20, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: item.color }}><Icon name={item.icon} size={11} color={colors.ink} /></View>
              <Text style={{ fontSize: 10.5, lineHeight: 15, fontWeight: '700', color: colors.inkSecondary }}>{item.label}</Text>
            </View>
          ))}
        </View>

        <SectionHeaderRow
          title={selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          meta={t('calendar.eventCount', { count: events.length })}
        />
        {events.length === 0 ? (
          <WarmCard style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
            <Icon name="calendar" size={24} color={colors.muted} />
            <Text style={{ fontSize: 13, lineHeight: 18, color: colors.inkSecondary, marginTop: spacing.xs }}>{t('calendar.noEvents')}</Text>
          </WarmCard>
        ) : (
          <WarmCard style={{ paddingVertical: spacing.xxs, paddingHorizontal: layout.cardPadding }}>
            {events.map((event, index) => (
              <Pressable
                key={event.key}
                accessibilityRole="button"
                accessibilityLabel={event.text}
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: event.foodId, from: 'calendar' } })}
                style={press({ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: index === 0 ? 0 : 1, borderColor: colors.hairline })}
              >
                <View style={{ width: 10, height: 10, borderRadius: radii.pill, backgroundColor: event.color }} />
                <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: event.color, lineHeight: 20 }}>{event.text}</Text>
                <Text style={{ ...typeStyles.rowDetail, color: colors.inkSecondary, textAlign: 'right' }}>{event.at.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}</Text>
                <Icon name="chevronRight" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </WarmCard>
        )}
      </ScrollView>
      <BottomNav active="history" />
    </View>
  );
}
