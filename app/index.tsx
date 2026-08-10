import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useFoodsWithStatus } from '../src/data/queries';
import { updateBabySettings } from '../src/data/mutations';
import { foodLabel } from '../src/i18n';
import { autoclosedBy, type FoodStatus } from '../src/domain/status';
import { describeHome } from '../src/domain/homeState';
import { buildLedger, DayLedger } from '../src/ui/DayLedger';
import { Button } from '../src/ui/Button';
import { CheckinPill } from '../src/ui/CheckinPill';
import { MarkSafeButton } from '../src/ui/MarkSafeButton';
import { BottomNav } from '../src/ui/BottomNav';
import { HeaderButton, ScreenHeader } from '../src/ui/ScreenHeader';
import { SectionHeaderRow } from '../src/ui/SectionHeaderRow';
import { WarmCard } from '../src/ui/WarmCard';
import { Icon } from '../src/ui/Icon';
import { press } from '../src/ui/pressable';
import { colors, layout, radii, spacing, typeStyles } from '../src/ui/tokens';
import { useFreshNow } from '../src/ui/useFreshNow';

export default function Home() {
  const baby = useBaby();
  if (!baby) return null;
  if (!baby.welcomedAt) return <WelcomeCard windowDays={baby.defaultWindowDays} />;
  return <Dashboard babyName={baby.name} />;
}

function WelcomeCard({ windowDays }: { windowDays: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: layout.screenInset,
        paddingTop: insets.top + 24,
        paddingBottom: Math.max(insets.bottom, 12) + 24,
        backgroundColor: colors.paper,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>{t('home.title')}</Text>
      <Text accessibilityRole="header" style={{ fontSize: 42, lineHeight: 48, fontWeight: '900', letterSpacing: -1, color: colors.ink, marginTop: 8 }}>
        {t('welcome.title')}
      </Text>
      <Text style={{ fontSize: 16, color: colors.inkSecondary, lineHeight: 24, marginTop: spacing.sm }}>
        {t('welcome.intro')}
      </Text>

      <WarmCard style={{ gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.lg }}>
        {([1, 2, 3] as const).map((n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 34, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentTint }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: colors.accent }}>{n}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 22 }}>
              {t(`welcome.step${n}`, { days: windowDays })}
            </Text>
          </View>
        ))}
      </WarmCard>

      <Button label={t('welcome.start')} icon={<Icon name="check" size={20} color={colors.onAccent} />} onPress={() => updateBabySettings({ welcomedAt: new Date() })} />
      <Text style={{ fontSize: 11.5, color: colors.inkSecondary, lineHeight: 17, marginTop: spacing.md }}>
        {t('settings.privacy')}{'\n'}{t('settings.disclaimer')}
      </Text>
    </ScrollView>
  );
}

function Dashboard({ babyName }: { babyName: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const timedTrial = foods.find((food) => food.status === 'testing')?.latest;
  const now = useFreshNow(timedTrial);
  const { state, subline } = describeHome(foods, now, t);
  const counts: Record<FoodStatus, number> = { safe: 0, testing: 0, reacted: 0, untried: 0 };
  for (const f of foods) counts[f.status]++;

  const active = state.kind === 'observing' || state.kind === 'confirm' ? state : null;
  const ledger = active ? buildLedger(active.trial, now, t) : null;
  const autoclosed = active ? autoclosedBy(foods, active.trial) : undefined;
  const tone = state.kind === 'reacted' ? 'reaction' : state.kind === 'safe' ? 'safe' : state.kind === 'empty' ? 'accent' : 'observing';
  const stateColor = state.kind === 'reacted' ? colors.red : state.kind === 'safe' ? colors.green : state.kind === 'empty' ? colors.accent : colors.amberText;
  const stateIcon = state.kind === 'reacted' ? 'warning' : state.kind === 'safe' ? 'check' : state.kind === 'empty' ? 'plus' : 'clock';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8, paddingBottom: 24 }}
      >
        <View style={{ paddingHorizontal: layout.cardPadding }}>
          <ScreenHeader
            eyebrow={babyName ? t('home.greetingName', { name: babyName }) : t('home.greeting')}
            title={t('home.todayTitle')}
            right={<HeaderButton label={t('settings.title')} onPress={() => router.push('/settings')} />}
            alignRightWithTitle
          />
        </View>

        <WarmCard tone={tone}>
          <View style={{ alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: spacing.sm, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(255,255,255,0.68)' }}>
            <Icon name={stateIcon} size={14} color={stateColor} strokeWidth={2.3} />
            <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '800', color: stateColor }}>
              {state.kind === 'empty' ? t('home.ready') : t(`home.state.${state.kind}`)}
            </Text>
          </View>
          <Text accessibilityRole="header" style={{ fontSize: state.kind === 'empty' ? 34 : 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1, color: colors.ink, marginTop: spacing.md }}>
            {state.kind === 'empty' ? t('home.emptyTitle') : foodLabel(state.food)}
          </Text>
          <Text style={{ ...typeStyles.body, fontWeight: '600', color: state.kind === 'reacted' ? colors.red : colors.inkSecondary, marginTop: spacing.xxs }}>
            {subline}
          </Text>
          {ledger && <View style={{ marginTop: spacing.md }}><DayLedger days={ledger} backfillFoodId={active?.food.id} /></View>}
        </WarmCard>

        <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
          {state.kind === 'observing' && <CheckinPill foodId={state.food.id} trial={state.trial} now={now} filled />}
          {state.kind === 'confirm' && <MarkSafeButton trial={state.trial} />}
          {active && (
            <Button
              label={t('home.symptomsHappened')}
              variant="danger"
              icon={<Icon name="warning" size={19} color={colors.red} />}
              onPress={() => router.push({ pathname: '/log-reaction', params: { foodId: active.food.id } })}
            />
          )}
          {state.kind === 'reacted' && (
            <>
              <Button
                label={t('home.viewRecord')}
                variant="danger"
                icon={<Icon name="file" size={19} color={colors.red} />}
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: state.food.id, from: 'home' } })}
              />
              <Button label={t('home.tryNewFood')} variant="secondary" icon={<Icon name="plus" size={19} />} onPress={() => router.push({ pathname: '/foods', params: { pick: '1' } })} />
            </>
          )}
          {(state.kind === 'safe' || state.kind === 'empty') && (
            <Button label={t('home.tryNewFood')} icon={<Icon name="plus" size={20} color={colors.onAccent} />} onPress={() => router.push({ pathname: '/foods', params: { pick: '1' } })} />
          )}
        </View>

        {state.kind === 'observing' && (
          <Text style={{ fontSize: 12, color: colors.inkSecondary, lineHeight: 18, textAlign: 'center', marginHorizontal: spacing.md, marginTop: spacing.xs }}>
            {t('home.checkinExplanation')}
          </Text>
        )}

        {autoclosed && (
          <WarmCard tone={autoclosed.outcome === 'safe' ? 'safe' : 'surface'} style={{ marginTop: spacing.md }}>
            <Text style={{ fontSize: 12.5, lineHeight: 19, fontWeight: '700', color: autoclosed.outcome === 'safe' ? colors.green : colors.inkSecondary }}>
              {t(autoclosed.outcome === 'safe' ? 'home.autoclosed' : 'home.autoclosedUnobserved', { food: foodLabel(autoclosed.food.food) })}
            </Text>
          </WarmCard>
        )}

        <SectionHeaderRow
          title={t('home.ourFoods')}
          meta={t('home.totalFoods', { count: foods.length })}
          style={{ paddingHorizontal: layout.cardPadding }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {(['safe', 'testing', 'reacted'] as const).map((status) => (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityLabel={`${t(`status.${status}`)} ${counts[status]}`}
              disabled={counts[status] === 0}
              onPress={() => router.push({ pathname: '/foods', params: { focus: status } })}
              style={press({
                flex: 1,
                minHeight: 78,
                borderRadius: radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                opacity: counts[status] === 0 ? 0.45 : 1,
              })}
            >
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.status[status].fg, fontVariant: ['tabular-nums'] }}>{counts[status]}</Text>
              <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.inkSecondary }}>{t(`status.${status}`)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <BottomNav active="today" />
    </View>
  );
}
