import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useFoodsWithStatus, type FoodWithStatus } from '../src/data/queries';
import { useStartTrialFlow } from '../src/data/useStartTrialFlow';
import { foodLabel } from '../src/i18n';
import { type FoodStatus } from '../src/domain/status';
import { projectFoodCatalogue, type CatalogueDetail } from '../src/foodCatalogue';
import { StatusChip } from '../src/ui/StatusChip';
import { press } from '../src/ui/pressable';
import { FoodGlyph } from '../src/ui/FoodGlyph';
import { BottomNav } from '../src/ui/BottomNav';
import { Icon } from '../src/ui/Icon';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { SectionHeaderRow } from '../src/ui/SectionHeaderRow';
import { colors, layout, radii, spacing, typeStyles } from '../src/ui/tokens';
import { useFreshNow } from '../src/ui/useFreshNow';

const FILTERS = ['testing', 'reacted', 'safe', 'untried'] as const;

export default function Foods() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { focus, pick } = useLocalSearchParams<{ focus?: string; pick?: string }>();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const baby = useBaby();
  const windowDays = baby?.defaultWindowDays ?? 3;
  const timedTrial = foods.find((food) => food.status === 'testing')?.latest;
  const now = useFreshNow(timedTrial);
  const startFlow = useStartTrialFlow(foods, windowDays);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FoodStatus | null>(
    FILTERS.includes(focus as (typeof FILTERS)[number]) ? (focus as FoodStatus) : null,
  );

  const catalogue = useMemo(() => projectFoodCatalogue({
    foods,
    now,
    query,
    filter,
    foodLabel: (item) => foodLabel(item.food),
    familyLabel: (family) => t(`foodFamily.${family}`),
  }), [foods, now, query, filter, i18n.language, t]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8 }}>
        <ScreenHeader eyebrow={t('foods.subtitle', { count: catalogue.total })} title={t('foods.title')} />
        <View style={{ minHeight: layout.controlHeight, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: layout.cardPadding, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.md, backgroundColor: colors.surface }}>
          <Icon name="search" size={20} color={colors.inkSecondary} />
          <TextInput
            accessibilityLabel={t('foods.search')}
            placeholder={t('foods.searchPlain')}
            placeholderTextColor={colors.inkSecondary}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              if (value.trim()) setFilter(null);
            }}
            clearButtonMode="while-editing"
            autoCorrect={false}
            style={{ flex: 1, minHeight: layout.controlHeight, fontSize: 16, color: colors.ink }}
          />
        </View>

        {!query.trim() && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.md, paddingRight: layout.screenInset }}>
            {([null, ...FILTERS] as const).map((item) => {
              const selected = filter === item;
              const label = item === null ? t('foods.filterAll') : t(`status.${item}`);
              const count = item === null ? catalogue.total : catalogue.counts[item];
              if (item !== null && count === 0) return null;
              return (
                <Pressable
                  key={item ?? 'all'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(item)}
                  style={press({
                    minHeight: 44,
                    justifyContent: 'center',
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: selected ? colors.ink : colors.hairline,
                    backgroundColor: selected ? colors.ink : 'transparent',
                  })}
                >
                  <Text style={{ fontSize: 12, lineHeight: 18, fontWeight: '800', color: selected ? colors.surface : colors.inkSecondary }}>{label} {count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {pick === '1' && (
          <View style={{ minHeight: layout.rowHeight, marginBottom: spacing.sm, padding: layout.cardPadding, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accentTint }}>
            <View style={{ width: 40, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' }}>
              <Icon name="plus" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typeStyles.rowTitle, color: colors.accentPressed }}>{t('foods.pickTitle')}</Text>
              <Text style={{ fontSize: 11.5, color: colors.accentPressed, lineHeight: 17 }}>{t('foods.pickHint', { days: windowDays })}</Text>
              {catalogue.pendingAutoClose && (
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: catalogue.pendingAutoClose.outcome === 'safe' ? colors.green : colors.inkSecondary, lineHeight: 17, marginTop: spacing.xxs }}>
                  {t(catalogue.pendingAutoClose.outcome === 'safe' ? 'foods.pickHintAutoclose' : 'foods.pickHintAutocloseUnobserved', { food: foodLabel(catalogue.pendingAutoClose.food.food) })}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingBottom: 18 }}
        data={catalogue.rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) => row.kind === 'header' ? (
          <SectionHeaderRow title={t(row.section === 'tried' ? 'foods.groupTried' : 'foods.groupUntried')} meta={String(row.count)} style={{ marginTop: spacing.md }} />
        ) : row.kind === 'family' ? (
          <View
            accessibilityRole="header"
            accessibilityLabel={[t(`foodFamily.${row.family}`), String(row.count), row.allHighRisk ? t('foods.highRisk') : null].filter(Boolean).join(', ')}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, paddingHorizontal: layout.cardPadding, borderRadius: radii.sm, backgroundColor: '#F5EEE9' }}
          >
            <FoodGlyph family={row.family} size={22} color={colors.inkSecondary} />
            <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '900', color: colors.ink }}>{t(`foodFamily.${row.family}`)}</Text>
            {row.allHighRisk && <Text style={{ fontSize: 10, lineHeight: 15, fontWeight: '800', color: colors.red }}>{t('foods.highRisk')}</Text>}
            <Text style={{ fontSize: 11, lineHeight: 16, fontWeight: '700', color: colors.inkSecondary }}>{row.count}</Text>
          </View>
        ) : (
          <FoodRow
            item={row.item}
            detail={row.detail}
            highRisk={row.highRisk}
            hideHighRisk={row.hideHighRisk}
            onPress={pick === '1'
              ? () => startFlow(row.item.food, () => router.dismissAll())
              : () => router.push({ pathname: '/food/[id]', params: { id: row.item.food.id, from: 'foods' } })}
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.inkSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 28 }}>{query.trim() ? t('foods.emptySearch') : t('foods.empty')}</Text>}
      />
      <BottomNav active="foods" />
    </View>
  );
}

function FoodRow({ item, detail, highRisk, onPress, hideHighRisk }: {
  item: FoodWithStatus;
  detail: CatalogueDetail;
  highRisk: boolean;
  onPress: () => void;
  hideHighRisk: boolean;
}) {
  const { t } = useTranslation();
  const statusColor = colors.status[item.status].fg;
  const icon = item.status === 'testing' ? 'clock' : item.status === 'safe' ? 'check' : item.status === 'reacted' ? 'warning' : 'plus';
  const iconBackground = item.status === 'testing' ? colors.amberTint : item.status === 'safe' ? colors.greenTint : item.status === 'reacted' ? colors.redTint : '#F5EEE9';
  const detailLabel = detail.kind === 'testing'
    ? `${t('status.testing')} · ${t('home.dayOf', { day: detail.day, total: detail.total })}`
    : detail.kind === 'untried'
      ? t('foods.untriedHint')
      : detail.kind === 'ended'
        ? detail.at.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
        : t(`status.${detail.status}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[foodLabel(item.food), highRisk ? t('foods.highRisk') : null, t(`status.${item.status}`)].filter(Boolean).join(', ')}
      onPress={onPress}
      style={press({ minHeight: layout.rowHeight, marginBottom: spacing.xs, paddingHorizontal: layout.cardPadding, paddingVertical: spacing.sm, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface })}
    >
      <View style={{ width: 44, height: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: iconBackground }}>
        <Icon name={icon} size={21} color={statusColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: item.status === 'testing' ? '900' : '700', color: colors.ink }}>{foodLabel(item.food)}</Text>
        <Text style={{ ...typeStyles.rowDetail, color: colors.inkSecondary }}>
          {detailLabel}
          {highRisk && !hideHighRisk ? ` · ${t('foods.highRisk')}` : ''}
        </Text>
      </View>
      {item.status === 'untried' ? <Icon name="chevronRight" size={18} color={colors.muted} /> : <StatusChip status={item.status} />}
    </Pressable>
  );
}
