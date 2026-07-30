import { useCallback, useEffect, useState } from 'react';
import { Animated, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useFoodsWithStatus } from '../src/data/queries';
import { updateBabySettings } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { autoclosedBy, type FoodStatus } from '../src/domain/status';
import { describeHome } from '../src/domain/homeState';
import { buildLedger, DayLedger } from '../src/ui/DayLedger';
import { StateField, useFieldFade } from '../src/ui/StateField';
import { Button } from '../src/ui/Button';
import { CheckinPill } from '../src/ui/CheckinPill';
import { MarkSafeButton } from '../src/ui/MarkSafeButton';
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

  const { state, subline, filled } = describeHome(foods, now, t);
  const counts: Record<FoodStatus, number> = { safe: 0, testing: 0, reacted: 0, untried: 0 };
  for (const f of foods) counts[f.status]++;

  const active = state.kind === 'observing' || state.kind === 'confirm' ? state : null;
  const field = useFieldFade(state.kind);

  const ledger = active ? buildLedger(active.trial, now, t) : null;

  // Starting a food auto-closes a previous elapsed trial as 안전, silently.
  const autoclosed = active ? autoclosedBy(foods, active.trial) : undefined;

  return (
    <Animated.ScrollView style={{ backgroundColor: field }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 4 }}>
        {state.kind === 'empty' ? (
          <StateField
            kind="empty"
            eyebrow={t('home.title')}
            name={t('home.emptyTitle')}
            stateWord=""
            subline={subline}
          />
        ) : (
          <StateField
            kind={state.kind}
            eyebrow={t('home.title')}
            name={foodLabel(state.food)}
            stateWord={t(`home.state.${state.kind}`)}
            subline={subline}
            recordLabel={t('home.viewRecord')}
            onPressRecord={() =>
              router.push({ pathname: '/food/[id]', params: { id: state.food.id, from: 'home' } })}
            filled={filled}
            total={state.trial.windowDays}
          />
        )}
      </View>

      {/* Everything below the field returns to paper. flexGrow on the container
          plus flex:1 here is what lets the paper run to the bottom of a tall
          screen instead of stopping under the last nav row. */}
      <View
        style={{
          flex: 1, backgroundColor: colors.paper,
          paddingHorizontal: layout.screenInset, paddingTop: 20,
        }}
      >
        {ledger && active && <DayLedger days={ledger} backfillFoodId={active.food.id} />}

        {autoclosed && (
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.green, marginTop: 10, paddingLeft: layout.rowInset }}>
            {t('home.autoclosed', { food: foodLabel(autoclosed.food) })}
          </Text>
        )}

        {/* Primacy follows the state. Window running → the check-in is filled.
            Window elapsed → 안전으로 표시 takes the fill. After a reaction
            NOTHING is filled: pushing a parent toward the next food seconds
            after they logged facial swelling is the wrong instinct. */}
        <View style={{ gap: 10, marginTop: ledger ? 20 : 0, marginBottom: 10 }}>
          {state.kind === 'observing' && (
            <CheckinPill foodId={state.food.id} trial={state.trial} now={now} filled />
          )}
          {state.kind === 'confirm' && <MarkSafeButton trial={state.trial} />}
          {active && (
            <Button
              label={t('home.logReaction')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: active.food.id } })}
            />
          )}
          {state.kind === 'reacted' && (
            <>
              <Button
                label={t('home.viewRecord')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: state.food.id, from: 'home' } })}
              />
              <Button
                label={t('home.tryNewFood')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/foods', params: { pick: '1' } })}
              />
            </>
          )}
          {(state.kind === 'safe' || state.kind === 'empty') && (
            <Button label={t('home.tryNewFood')} onPress={() => router.push({ pathname: '/foods', params: { pick: '1' } })} />
          )}
        </View>

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
      </View>
    </Animated.ScrollView>
  );
}
