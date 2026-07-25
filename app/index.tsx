import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useCheckins, useFoodsWithStatus, useReactions } from '../src/data/queries';
import { confirmSafe, updateBabySettings } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { isWindowElapsed, MS_PER_DAY, type FoodStatus } from '../src/domain/status';
import { buildLedger, DayLedger } from '../src/ui/DayLedger';
import { Button } from '../src/ui/Button';
import { CheckinPill } from '../src/ui/CheckinPill';
import { press } from '../src/ui/pressable';
import { colors, layout } from '../src/ui/tokens';

const eyebrowStyle = { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2.2, color: colors.inkSecondary, paddingBottom: 12, paddingLeft: layout.rowInset };

export default function Home() {
  const baby = useBaby();
  if (!baby) return null; // seed hasn't landed yet (first frame)
  if (!baby.welcomedAt) return <WelcomeCard windowDays={baby.defaultWindowDays} />;
  return <Dashboard />;
}

// One-time first-run explainer (Apple "welcome sheet" idiom: title, three
// rows, one button). Info only — no input; dismissal persists in the DB.
function WelcomeCard({ windowDays }: { windowDays: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22, paddingTop: insets.top + 4, paddingBottom: (insets.bottom > 0 ? insets.bottom : 12) + 22, backgroundColor: colors.paper }}>
      <Text style={eyebrowStyle}>{t('home.title')}</Text>
      <Text style={{ fontSize: 44, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>{t('welcome.title')}</Text>
      <Text style={{ fontSize: 14, color: colors.inkSecondary, lineHeight: 20, marginTop: 10, paddingLeft: layout.rowInset }}>
        {t('welcome.intro')}
      </Text>

      <View style={{ gap: 18, marginTop: 28, marginBottom: 28 }}>
        {([1, 2, 3] as const).map((n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: layout.rowInset }}>
            <View
              style={{
                width: 26, height: 26, borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{n}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 21 }}>
              {t(`welcome.step${n}`, { days: windowDays })}
            </Text>
          </View>
        ))}
      </View>

      <Button label={t('welcome.start')} onPress={() => updateBabySettings({ welcomedAt: new Date() })} />

      <Text style={{ fontSize: 11.5, color: colors.inkSecondary, lineHeight: 17, marginTop: 18, paddingLeft: layout.rowInset }}>
        {t('settings.privacy')}{'\n'}{t('settings.disclaimer')}
      </Text>
    </ScrollView>
  );
}

function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const checkins = useCheckins();
  const reactions = useReactions();
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((x) => x + 1), []);
  useFocusEffect(bump);
  // `elapsed` below is derived from a render-time clock, and the only other
  // re-render triggers are live-query changes and the focus effect. Tapping the
  // 09:00 window-end notification foregrounds an app whose Home is ALREADY
  // focused, so nothing re-ran and the screen kept offering a check-in instead
  // of 안전으로 표시 — the app's own prompt could not deliver its own action.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') bump();
    });
    return () => sub.remove();
  }, [bump]);
  const now = new Date();

  const active = foods.find((f) => f.status === 'testing');
  const latest = active?.latest;
  const counts: Record<FoodStatus, number> = { safe: 0, testing: 0, reacted: 0, untried: 0 };
  for (const f of foods) counts[f.status]++;
  const hasAnyTrial = foods.some((f) => f.trials.some((tr) => tr.outcome !== 'cancelled'));

  const elapsed = latest ? isWindowElapsed(latest, now) : false;
  const day = latest
    ? Math.min(latest.windowDays, Math.floor((now.getTime() - latest.startedAt.getTime()) / MS_PER_DAY) + 1)
    : 0;

  const ledger = latest
    ? buildLedger(
        latest,
        checkins.filter((c) => c.trialId === latest.id).map((c) => c.occurredAt),
        reactions.find((r) => r.trialId === latest.id)?.occurredAt ?? null,
        now,
        t,
      )
    : null;

  // Starting a food auto-closes a previous elapsed trial as 안전, silently. The
  // autoclose writes endedAt at the same instant as the new trial's startedAt,
  // so it is derivable — no schema change needed to finally disclose it.
  const autoclosed = latest
    ? foods.find((f) =>
        f.food.id !== active?.food.id &&
        f.latest?.outcome === 'safe' &&
        f.latest.endedAt?.getTime() === latest.startedAt.getTime())
    : undefined;

  // Between trials Home used to render nothing at all — this is its steady
  // state after the first week, and it was the app's only empty primary slot.
  const lastClosed = !active
    ? foods
        .filter((f) => f.latest?.outcome === 'safe' && f.latest.endedAt)
        .sort((a, b) => b.latest!.endedAt!.getTime() - a.latest!.endedAt!.getTime())[0]
    : undefined;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, paddingTop: insets.top + 4, backgroundColor: colors.paper }}>
      <Text style={eyebrowStyle}>{t('home.title')}</Text>

      {active && latest && ledger ? (
        <View>
          {/* Name + status line are ONE target. The 58px headline navigated with
              no affordance of any kind, so the 기록 보기 → label has to sit
              inside the same Pressable it describes. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={foodLabel(active.food)}
            accessibilityHint={t('home.viewRecord')}
            onPress={() => router.push({ pathname: '/food/[id]', params: { id: active.food.id, from: 'home' } })}
            style={press()}
          >
            <Text style={{ fontSize: 52, fontWeight: '900', color: colors.ink, letterSpacing: -1, lineHeight: 54 }}>
              {foodLabel(active.food)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 9, paddingLeft: layout.rowInset }}>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.amberText }}>
                {elapsed
                  ? t('home.readyToConfirm', { total: latest.windowDays })
                  : `${t('status.testing')} · ${t('home.dayOf', { day, total: latest.windowDays })}`}
              </Text>
              <Text style={{ fontSize: 12, color: colors.inkSecondary }}>{t('home.viewRecord')} →</Text>
            </View>
          </Pressable>

          <DayLedger days={ledger} />

          {autoclosed && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.green, marginTop: 10, paddingLeft: layout.rowInset }}>
              {t('home.autoclosed', { food: foodLabel(autoclosed.food) })}
            </Text>
          )}

          {/* Primacy follows the trial. Window running → the check-in is the
              filled control. Window elapsed → 안전으로 표시 takes the fill.
              새 재료 시작하기 is demoted to a row below either way, because it
              is blocked while an observation is live. */}
          <View style={{ gap: 10, marginTop: 20, marginBottom: 10 }}>
            {elapsed ? (
              <Button label={t('home.markSafe')} onPress={() => confirmSafe(latest.id, new Date())} />
            ) : (
              <CheckinPill foodId={active.food.id} trialId={latest.id} filled />
            )}
            <Button
              label={t('home.logReaction')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: active.food.id } })}
            />
          </View>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: 52, fontWeight: '900', color: colors.green, letterSpacing: -1, lineHeight: 54 }}>
            {t('home.idleTitle', { count: counts.safe })}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkSecondary, marginTop: 9, paddingLeft: layout.rowInset }}>
            {hasAnyTrial && lastClosed
              ? t('home.lastConfirmed', { food: foodLabel(lastClosed.food) })
              : t('home.empty')}
          </Text>
          <View style={{ marginTop: 20, marginBottom: 10 }}>
            <Button label={t('home.tryNewFood')} onPress={() => router.push({ pathname: '/foods', params: { pick: '1' } })} />
          </View>
        </View>
      )}

      {/* One band, not four 44pt rows — that is the ~130pt which lets 캘린더 and
          설정 sit above the fold on a mini. */}
      <View
        style={{
          flexDirection: 'row', marginTop: 20,
          borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairline,
        }}
      >
        {(['safe', 'testing', 'reacted', 'untried'] as const).map((s, i) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`${t(`status.${s}`)} ${counts[s]}`}
            // A 0 count used to be a live target that navigated and then did
            // nothing (the focus effect no-ops when the status isn't present).
            disabled={counts[s] === 0}
            onPress={() => router.push({ pathname: '/foods', params: { focus: s } })}
            style={press({
              flex: 1, alignItems: 'center', paddingVertical: 11,
              borderLeftWidth: i === 0 ? 0 : 1, borderColor: colors.hairline,
              opacity: counts[s] === 0 ? 0.4 : 1,
            })}
          >
            <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSecondary }}>{t(`status.${s}`)}</Text>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.status[s].fg, fontVariant: ['tabular-nums'], marginTop: 2 }}>
              {counts[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 'auto', paddingTop: 24, paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }}>
        {/* Demoted, not removed: while an observation is running this is the
            action the one-active-trial rule blocks, so it must not hold the
            fill — but it stays reachable, because letting the window elapse and
            starting the next food is a legitimate way to close this one. */}
        {active && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.tryNewFood')}
            onPress={() => router.push({ pathname: '/foods', params: { pick: '1' } })}
            style={press({
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: 15, paddingHorizontal: layout.rowInset,
              borderTopWidth: 1, borderColor: colors.hairline,
            })}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{t('home.tryNewFood')}</Text>
            <Text style={{ fontSize: 15, color: colors.inkSecondary }}>→</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.calendar')}
          onPress={() => router.push('/calendar')}
          style={press({
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingVertical: 15, paddingHorizontal: layout.rowInset,
            borderTopWidth: 1, borderColor: colors.hairline,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{t('home.calendar')}</Text>
          <Text style={{ fontSize: 15, color: colors.inkSecondary }}>→</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          onPress={() => router.push('/settings')}
          style={press({
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingVertical: 15, paddingHorizontal: layout.rowInset,
            borderTopWidth: 1, borderColor: colors.hairline,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink }}>{t('settings.title')}</Text>
          <Text style={{ fontSize: 15, color: colors.inkSecondary }}>→</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
