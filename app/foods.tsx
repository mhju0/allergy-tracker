import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useFoodsWithStatus, type FoodWithStatus } from '../src/data/queries';
import { useStartTrialFlow } from '../src/data/useStartTrialFlow';
import { foodLabel } from '../src/i18n';
import { pendingAutoclose, type FoodStatus } from '../src/domain/status';
import { trialDay } from '../src/domain/homeState';
import { StatusChip } from '../src/ui/StatusChip';
import { press } from '../src/ui/pressable';
import { FoodGlyph } from '../src/ui/FoodGlyph';
import { type FamilyId } from '../src/db/families';
import { groupByFamily } from '../src/domain/foodGroups';
import { BottomNav } from '../src/ui/BottomNav';
import { Icon } from '../src/ui/Icon';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { colors, layout, radii } from '../src/ui/tokens';

const ORDER: Record<FoodStatus, number> = { testing: 0, reacted: 1, safe: 2, untried: 3 };
const FILTERS = ['testing', 'reacted', 'safe', 'untried'] as const;

type Row =
  | { kind: 'header'; key: string; label: string; count: number }
  | { kind: 'family'; key: string; family: FamilyId; count: number; allHighRisk: boolean }
  | { kind: 'food'; key: string; item: FoodWithStatus; hideHighRisk?: boolean };

export default function Foods() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { focus, pick } = useLocalSearchParams<{ focus?: string; pick?: string }>();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const baby = useBaby();
  const windowDays = baby?.defaultWindowDays ?? 3;
  const startFlow = useStartTrialFlow(foods, windowDays);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FoodStatus | null>(
    FILTERS.includes(focus as (typeof FILTERS)[number]) ? (focus as FoodStatus) : null,
  );

  const counts = useMemo(() => {
    const result = { testing: 0, reacted: 0, safe: 0, untried: 0 } as Record<FoodStatus, number>;
    for (const food of foods) result[food.status]++;
    return result;
  }, [foods]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = foods
      .filter((food) => foodLabel(food.food).toLowerCase().includes(q))
      .filter((food) => (filter && !q ? food.status === filter : true))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || foodLabel(a.food).localeCompare(foodLabel(b.food)));

    if (filter || q) return matched.map((item): Row => ({ kind: 'food', key: item.food.id, item }));

    const out: Row[] = [];
    const tried = matched.filter((food) => food.status !== 'untried');
    const untried = matched.filter((food) => food.status === 'untried');
    if (tried.length) {
      out.push({ kind: 'header', key: 'h-tried', label: t('foods.groupTried'), count: tried.length });
      for (const item of tried) out.push({ kind: 'food', key: item.food.id, item });
    }
    if (untried.length) {
      out.push({ kind: 'header', key: 'h-untried', label: t('foods.groupUntried'), count: untried.length });
      const { bands, unfamiliar } = groupByFamily(
        untried,
        (food) => food.food.id,
        (food) => Boolean(food.food.allergenGroup),
        (family) => t(`foodFamily.${family}`),
      );
      for (const band of bands) {
        out.push({ kind: 'family', key: `f-${band.family}`, family: band.family, count: band.members.length, allHighRisk: band.allHighRisk });
        for (const item of band.members) out.push({ kind: 'food', key: item.food.id, item, hideHighRisk: band.allHighRisk });
      }
      for (const item of unfamiliar) out.push({ kind: 'food', key: item.food.id, item });
    }
    return out;
  }, [foods, query, filter, i18n.language, t]);

  const autocloses = useMemo(() => pendingAutoclose(foods, new Date()), [foods]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View style={{ paddingHorizontal: layout.screenInset, paddingTop: insets.top + 8 }}>
        <ScreenHeader eyebrow={t('foods.subtitle', { count: foods.length })} title={t('foods.title')} />
        <View style={{ minHeight: layout.controlHeight, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.md, backgroundColor: colors.surface }}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 12, paddingBottom: 14, paddingRight: 20 }}>
            {([null, ...FILTERS] as const).map((item) => {
              const selected = filter === item;
              const label = item === null ? t('foods.filterAll') : t(`status.${item}`);
              const count = item === null ? foods.length : counts[item];
              if (item !== null && count === 0) return null;
              return (
                <Pressable
                  key={item ?? 'all'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(item)}
                  style={press({
                    minHeight: 40,
                    justifyContent: 'center',
                    paddingHorizontal: 13,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: selected ? colors.ink : colors.hairline,
                    backgroundColor: selected ? colors.ink : 'transparent',
                  })}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? colors.surface : colors.inkSecondary }}>{label} {count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {pick === '1' && (
          <View style={{ minHeight: 68, marginBottom: 12, padding: 14, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.accentTint }}>
            <View style={{ width: 42, height: 42, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' }}>
              <Icon name="plus" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.accentPressed }}>{t('foods.pickTitle')}</Text>
              <Text style={{ fontSize: 11.5, color: colors.accentPressed, lineHeight: 17, marginTop: 2 }}>{t('foods.pickHint', { days: windowDays })}</Text>
              {autocloses && (
                <Text style={{ fontSize: 11.5, fontWeight: '700', color: autocloses.outcome === 'safe' ? colors.green : colors.inkSecondary, lineHeight: 17, marginTop: 3 }}>
                  {t(autocloses.outcome === 'safe' ? 'foods.pickHintAutoclose' : 'foods.pickHintAutocloseUnobserved', { food: foodLabel(autocloses.food.food) })}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: layout.screenInset, paddingBottom: 18 }}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) => row.kind === 'header' ? (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 15, paddingBottom: 9, paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>{row.label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSecondary }}>{row.count}</Text>
          </View>
        ) : row.kind === 'family' ? (
          <View
            accessibilityRole="header"
            accessibilityLabel={[t(`foodFamily.${row.family}`), String(row.count), row.allHighRisk ? t('foods.highRisk') : null].filter(Boolean).join(', ')}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10, paddingHorizontal: 12, borderRadius: radii.sm, backgroundColor: '#F5EEE9' }}
          >
            <FoodGlyph family={row.family} size={22} color={colors.inkSecondary} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '900', color: colors.ink }}>{t(`foodFamily.${row.family}`)}</Text>
            {row.allHighRisk && <Text style={{ fontSize: 10, fontWeight: '800', color: colors.red }}>{t('foods.highRisk')}</Text>}
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSecondary }}>{row.count}</Text>
          </View>
        ) : (
          <FoodRow
            item={row.item}
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

function FoodRow({ item, onPress, hideHighRisk = false }: { item: FoodWithStatus; onPress: () => void; hideHighRisk?: boolean }) {
  const { t } = useTranslation();
  const statusColor = colors.status[item.status].fg;
  const icon = item.status === 'testing' ? 'clock' : item.status === 'safe' ? 'check' : item.status === 'reacted' ? 'warning' : 'plus';
  const iconBackground = item.status === 'testing' ? colors.amberTint : item.status === 'safe' ? colors.greenTint : item.status === 'reacted' ? colors.redTint : '#F5EEE9';
  const detail = item.status === 'testing' && item.latest
    ? `${t('status.testing')} · ${t('home.dayOf', { day: trialDay(item.latest, new Date()), total: item.latest.windowDays })}`
    : item.status === 'untried'
      ? t('foods.untriedHint')
      : item.latest?.endedAt
        ? item.latest.endedAt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
        : t(`status.${item.status}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[foodLabel(item.food), item.food.allergenGroup ? t('foods.highRisk') : null, t(`status.${item.status}`)].filter(Boolean).join(', ')}
      onPress={onPress}
      style={press({ minHeight: 68, marginBottom: 9, padding: 12, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.surface })}
    >
      <View style={{ width: 43, height: 43, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: iconBackground }}>
        <Icon name={icon} size={21} color={statusColor} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: item.status === 'testing' ? '900' : '700', color: colors.ink }}>{foodLabel(item.food)}</Text>
        <Text style={{ fontSize: 11, color: colors.inkSecondary, marginTop: 3 }}>
          {detail}
          {item.food.allergenGroup && !hideHighRisk ? ` · ${t('foods.highRisk')}` : ''}
        </Text>
      </View>
      {item.status === 'untried' ? <Icon name="chevronRight" size={18} color={colors.muted} /> : <StatusChip status={item.status} />}
    </Pressable>
  );
}
