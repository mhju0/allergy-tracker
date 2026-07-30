import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MS_PER_DAY, isSameLocalDay } from '../domain/status';
import type { RecordedTrial } from '../domain/records';
import { colors, layout } from './tokens';

// The observation window, rendered as one named cell per day instead of an
// anonymous progress bar. The rule under each cell carries its state, so the
// bar and the record are the same object: you can see which days were actually
// observed, not just how far along the window is.
//
// Never assumes a 3-day window — the cell count comes from trial.windowDays,
// which is a real per-install column.
export type LedgerDay = {
  label: string;
  state: 'cleared' | 'today' | 'reacted' | 'unobserved' | 'pending' | 'stopped';
  stamp: string;
};

const RULE: Record<LedgerDay['state'], { color: string; height: number }> = {
  cleared: { color: colors.green, height: 3 },
  today: { color: colors.amber, height: 3 },
  reacted: { color: colors.red, height: 3 },
  unobserved: { color: colors.hairline, height: 1 },
  pending: { color: colors.hairline, height: 1 },
  stopped: { color: colors.hairline, height: 1 },
};

const FG: Record<LedgerDay['state'], string> = {
  cleared: colors.green,
  today: colors.amberText,
  reacted: colors.red,
  unobserved: colors.inkSecondary,
  pending: colors.inkSecondary,
  stopped: colors.inkSecondary,
};

// Takes the trial with its records attached — both screens used to filter the
// check-in table and find the reaction themselves before they could call this.
export function buildLedger(
  trial: RecordedTrial,
  now: Date,
  t: (key: string, opts?: Record<string, unknown>) => string,
): LedgerDay[] {
  const time = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  const endedDay = trial.endedAt ?? null;
  const reactionAt = trial.reactions[0]?.occurredAt ?? null;

  return Array.from({ length: trial.windowDays }, (_, i) => {
    const date = new Date(trial.startedAt.getTime() + i * MS_PER_DAY);
    const label = t('ledger.day', { n: i + 1 });
    const checkin = trial.checkins.find((c) => isSameLocalDay(c.occurredAt, date))?.occurredAt;

    if (reactionAt && isSameLocalDay(reactionAt, date)) {
      return { label, state: 'reacted' as const, stamp: time(reactionAt) };
    }
    // A trial that ended early stops covering the days after it — say so once
    // rather than leaving them looking merely unrecorded.
    const stoppedEarly = endedDay !== null && date.getTime() > endedDay.getTime() && !isSameLocalDay(endedDay, date);
    if (stoppedEarly) return { label, state: 'stopped' as const, stamp: '' };
    if (checkin) return { label, state: 'cleared' as const, stamp: time(checkin) };
    if (trial.outcome === null && isSameLocalDay(date, now)) {
      return { label, state: 'today' as const, stamp: t('ledger.notYet') };
    }
    // A day that came and went with nothing recorded stays unrecorded. This
    // used to read 이상 없음 on any completed-safe window, which is the app
    // claiming an observation nobody made — the one thing a medical record
    // must never do. 'pending' is now only ever a day still to come.
    if (date.getTime() <= now.getTime()) return { label, state: 'unobserved' as const, stamp: '' };
    return { label, state: 'pending' as const, stamp: '' };
  });
}

export function DayLedger({ days }: { days: LedgerDay[] }) {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityLabel={days.map((d) => `${d.label} ${t(`ledger.state.${d.state}`)}`).join(', ')}
      style={{ flexDirection: 'row', marginTop: 18 }}
    >
      {days.map((d, i) => (
        <View
          key={d.label}
          style={{
            flex: 1,
            borderTopWidth: 1,
            borderLeftWidth: i === 0 ? 0 : 1,
            borderColor: colors.hairline,
            paddingTop: 10,
            paddingBottom: 9,
          }}
        >
          <View style={{ paddingLeft: layout.rowInset, paddingRight: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.inkSecondary }}>
              {d.label}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: FG[d.state], marginTop: 6 }}>
              {t(`ledger.state.${d.state}`)}
            </Text>
            <Text style={{ fontSize: 10.5, color: colors.inkSecondary, marginTop: 3, minHeight: 13 }}>
              {d.stamp}
            </Text>
          </View>
          {/* the rule under each cell IS its state — this replaces the 3px bar */}
          <View
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: RULE[d.state].height, backgroundColor: RULE[d.state].color,
            }}
          />
        </View>
      ))}
    </View>
  );
}
