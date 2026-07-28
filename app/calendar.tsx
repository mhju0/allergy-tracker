import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodsWithStatus } from '../src/data/queries';
import { dayMark, monthMatrix, sameLocalDay } from '../src/domain/calendar';
import { buildRecords, reactionSummary, type RecordKind } from '../src/domain/records';
import { foodLabel } from '../src/i18n';
import { press } from '../src/ui/pressable';
import { colors, layout, statusIcon } from '../src/ui/tokens';

const eyebrowStyle = { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2.2, color: colors.inkSecondary, paddingBottom: 12 };
// alignItems flex-end right-hugs the ‹ › glyphs so the next control lands on the
// grid's right edge (the tap targets stay 44pt; only the glyph shifts within).
const navBtnStyle = { minWidth: 44, minHeight: 44, alignItems: 'flex-end' as const, justifyContent: 'center' as const };
const weekdayKeys = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'] as const;

const TINT_BG = {
  amber: colors.amberTint,
  green: colors.greenTint,
  red: colors.redTint,
  none: 'transparent',
} as const;

// Icons are ink, not the status colour: the swatch behind them already carries
// the hue, and a status colour on its own tint measures as low as 4.19:1 — an
// icon that exists so colour isn't the sole carrier has to be legible itself.
const LEGEND = [
  { key: 'legendWindow', bg: colors.amberTint, icon: statusIcon.testing },
  { key: 'legendSafe', bg: colors.greenTint, icon: statusIcon.safe },
  { key: 'legendReaction', bg: colors.redTint, icon: statusIcon.reacted },
  { key: 'legendRecord', bg: 'transparent', icon: '•' },
] as const;

type EventRow = { key: string; at: Date; color: string; text: string };

// How each record kind reads on the day list. Reaction rows carry their own
// summary instead of a fixed label.
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
    const d = new Date();
    return { year: d.getFullYear(), month0: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const today = new Date();

  // Month nav moves the selection to the 1st of the shown month so the day
  // list below never silently shows a day from a month that's off-screen.
  const goMonth = (delta: -1 | 1) => {
    const { year, month0 } = display;
    const next = new Date(year, month0 + delta, 1);
    setDisplay({ year: next.getFullYear(), month0: next.getMonth() });
    setSelectedDate(next);
  };
  const goToday = () => {
    const d = new Date();
    setDisplay({ year: d.getFullYear(), month0: d.getMonth() });
    setSelectedDate(d);
  };

  const cells = useMemo(() => monthMatrix(display.year, display.month0), [display.year, display.month0]);
  const weeks = useMemo(() => {
    const w = [];
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7));
    return w;
  }, [cells]);

  const allTrials = useMemo(() => foods.flatMap((f) => f.trials), [foods]);
  // Cancelled trials are invisible on the calendar (owner decision 2026-07-23):
  // no rows, no dots. buildRecords drops them; the tint needs the same cut.
  const records = useMemo(() => buildRecords(foods), [foods]);
  const reactionDays = useMemo(
    () => records.filter((r) => r.kind === 'reacted').map((r) => r.at),
    [records],
  );
  const checkinDays = useMemo(
    () => records.filter((r) => r.kind === 'checkin').map((r) => r.at),
    [records],
  );

  const events = useMemo(
    () => records
      .filter((r) => sameLocalDay(r.at, selectedDate))
      .map((r): EventRow => ({
        key: r.key, at: r.at, color: KIND_COLOR[r.kind],
        text: `${foodLabel(r.food)} — ${r.reaction ? reactionSummary(r.reaction, t) : t(KIND_LABEL[r.kind])}`,
      })),
    [records, selectedDate, t],
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: insets.top + 4, backgroundColor: colors.paper }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={press({ minHeight: 44, justifyContent: 'center' })}
      >
        <Text style={eyebrowStyle}>
          <Text style={{ color: colors.inkSecondary }}>‹ </Text>
          {t('calendar.title')}
        </Text>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.today')} onPress={goToday} style={press()}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, paddingLeft: layout.rowInset }}>
            {t('calendar.monthTitle', { year: display.year, month: display.month0 + 1 })}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.prevMonth')} onPress={() => goMonth(-1)} style={press(navBtnStyle)}>
            <Text style={{ fontSize: 18, color: colors.inkSecondary }}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('calendar.nextMonth')} onPress={() => goMonth(1)} style={press(navBtnStyle)}>
            <Text style={{ fontSize: 18, color: colors.inkSecondary }}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderColor: colors.hairline }}>
        {weekdayKeys.map((wk, i) => (
          <Text
            key={wk}
            style={{ flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: '800', color: i === 0 ? colors.red : colors.inkSecondary }}
          >
            {t(`calendar.weekday.${wk}`)}
          </Text>
        ))}
      </View>

      <View style={{ paddingTop: 6 }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((cell) => {
              const mark = dayMark(cell.date, allTrials, reactionDays, checkinDays, today);
              const isSelected = sameLocalDay(cell.date, selectedDate);
              const isToday = sameLocalDay(cell.date, today);
              const bg = TINT_BG[mark.tint ?? 'none'];
              // The tint already states the day's status and the dot states its
              // events, so the date itself stays ink — tinting it too put amber
              // on amberTint at 3.09:1, the worst contrast in the app.
              const fg = cell.inMonth ? colors.ink : colors.dayOutMonth;
              // VoiceOver used to hear the date and nothing else — neither the
              // tint nor the dot was announced, on the one screen whose entire
              // information layer is colour.
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
                  accessibilityLabel={[
                    cell.date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
                    ...marks,
                  ].join(', ')}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedDate(cell.date)}
                  style={press({
                    flex: 1, aspectRatio: 1, margin: 1.5, borderRadius: 9,
                    backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
                    // Today is ringed; the selected day is filled-outline. Nothing
                    // marked today before, and one month-nav tap moves the
                    // selection to the 1st, so today lost all identity.
                    borderWidth: isSelected ? 2 : isToday ? 1 : 0,
                    borderColor: isSelected ? colors.ink : colors.inkSecondary,
                    borderStyle: isSelected || !isToday ? 'solid' : 'dashed',
                  })}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: fg }}>{cell.date.getDate()}</Text>
                  {mark.dot && (
                    <View
                      style={{
                        // Dot sits in the lower gap, centered between the digit's
                        // bottom and the cell floor. Positioned as a share of cell
                        // height (cells are aspectRatio 1) so it holds at any size.
                        position: 'absolute', bottom: '18%', width: 4, height: 4, borderRadius: 999,
                        backgroundColor: mark.dot === 'red' ? colors.red : colors.green,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* CLAUDE.md: icon + label always accompany status colours. This was the
          one screen that shipped bare swatches. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingLeft: layout.rowInset }}>
        {LEGEND.map(({ key, bg, icon }) => (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.ink }}>{icon}</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.inkSecondary }}>{t(`calendar.${key}`)}</Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: colors.inkSecondary, marginTop: 18, marginBottom: 4, paddingLeft: layout.rowInset }}>
        {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
      </Text>
      {events.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.inkSecondary, paddingVertical: 12, paddingLeft: layout.rowInset }}>{t('calendar.noEvents')}</Text>
      ) : (
        events.map((ev) => (
          <View
            key={ev.key}
            style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingVertical: 9, paddingHorizontal: layout.rowInset, borderBottomWidth: 1, borderColor: colors.hairline }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: ev.color }} />
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: ev.color, flexShrink: 1 }}>{ev.text}</Text>
            <Text style={{ fontSize: 12, color: colors.inkSecondary, marginLeft: 'auto' }}>
              {ev.at.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
