import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaby, useFoodsWithStatus, type FoodWithStatus } from '../src/data/queries';
import { addCustomFood } from '../src/data/mutations';
import { useStartTrialFlow } from '../src/data/useStartTrialFlow';
import { foodLabel } from '../src/i18n';
import { isWindowElapsed, type FoodStatus } from '../src/domain/status';
import { StatusChip } from '../src/ui/StatusChip';
import { press } from '../src/ui/pressable';
import { colors, layout, radii } from '../src/ui/tokens';

// Dependency-free magnifier glyph (no icon lib in the project) — a ring plus a
// short diagonal handle, drawn in the muted token like the app's other marks.
function SearchIcon() {
  return (
    <View style={{ width: 15, height: 15, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 9, height: 9, borderRadius: radii.pill, borderWidth: 1.5, borderColor: colors.muted }} />
      <View
        style={{
          position: 'absolute', bottom: 1, right: 1, width: 5, height: 1.5,
          borderRadius: 1, backgroundColor: colors.muted, transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

const ORDER: Record<FoodStatus, number> = { testing: 0, untried: 1, safe: 2, reacted: 3 };
const ROW_H = 44; // fixed row height (matches the previous content-sized height) — required for getItemLayout/scrollToIndex
const eyebrowStyle = { fontSize: 10, fontWeight: '700' as const, letterSpacing: 2.2, color: colors.inkSecondary, paddingBottom: 12 };

export default function Foods() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // pick=1 (home's 새 재료 시작하기): tapping a row starts its trial right away
  // and returns home, instead of opening the food detail page.
  const { focus, pick } = useLocalSearchParams<{ focus?: string; pick?: string }>();
  const insets = useSafeAreaInsets();
  const foods = useFoodsWithStatus();
  const baby = useBaby();
  const windowDays = baby?.defaultWindowDays ?? 3;
  const startFlow = useStartTrialFlow(foods, windowDays);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const submitting = useRef(false);
  const listRef = useRef<FlatList<FoodWithStatus>>(null);
  const focusApplied = useRef(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return foods
      .filter((f) => foodLabel(f.food).toLowerCase().includes(q))
      .sort((a, b) =>
        ORDER[a.status] - ORDER[b.status] || foodLabel(a.food).localeCompare(foodLabel(b.food)));
  }, [foods, query, i18n.language]);

  // The food that a start would auto-close as 안전 — only when its window has
  // already elapsed (that is the only case decideStartTrial allows through).
  const autocloses = useMemo(() => {
    const a = foods.find((f) => f.status === 'testing');
    return a?.latest && isWindowElapsed(a.latest, new Date()) ? a : undefined;
  }, [foods]);

  // Home's count rows land here with ?focus=<status>: jump once (no animation)
  // to that status's section. foods and trials arrive from two independent live
  // queries, so statuses can render as all-untried for a frame — only latch once
  // the target status actually exists in the list (a 0-count focus stays at top).
  useEffect(() => {
    if (focusApplied.current || !focus || visible.length === 0) return;
    const index = visible.findIndex((f) => f.status === focus);
    if (index === -1) return;
    focusApplied.current = true;
    if (index > 0) listRef.current?.scrollToIndex({ index, animated: false });
  }, [visible, focus]);

  const submitNew = async () => {
    const name = newName.trim();
    if (!name || submitting.current) return;
    submitting.current = true;
    try {
      setNewName('');
      const id = await addCustomFood(name);
      setAddOpen(false);
      if (pick === '1') {
        // Keep the picker's promise: a custom food starts its test right away too.
        await startFlow({ id, name, isCustom: true, allergenGroup: null }, () => router.back());
      } else {
        router.push({ pathname: '/food/[id]', params: { id, from: 'foods' } });
      }
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      submitting.current = false;
    }
  };

  return (
    <View style={{ flex: 1, padding: 22, paddingTop: insets.top + 4, backgroundColor: colors.paper }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
        style={press({ minHeight: 44, justifyContent: 'center' })}
      >
        <Text style={eyebrowStyle}>
          <Text style={{ color: colors.inkSecondary }}>‹ </Text>
          {t('foods.title')}
        </Text>
      </Pressable>

      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderBottomWidth: 2, borderColor: colors.ink, paddingBottom: 8,
        }}
      >
        <SearchIcon />
        <TextInput
          placeholder={t('foods.search')}
          placeholderTextColor={colors.inkSecondary}
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1, fontSize: 15, color: colors.ink, marginLeft: 7 }}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => setAddOpen((v) => !v)}
          hitSlop={{ top: 9, bottom: 9, left: 8, right: 8 }}
          style={press({
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1, borderColor: colors.ink, borderRadius: radii.pill,
            paddingVertical: 5, paddingHorizontal: 11,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>＋ {t('foods.customAdd')}</Text>
        </Pressable>
      </View>

      {pick === '1' && (
        <View style={{ paddingTop: 8, paddingLeft: layout.rowInset }}>
          <Text style={{ fontSize: 12, color: colors.inkSecondary }}>
            {t('foods.pickHint', { days: windowDays })}
          </Text>
          {/* Starting a food while the previous window has elapsed silently
              records that food as 안전 (the implicit-safe autoclose). Say so
              before the tap — it is the app's most consequential write. */}
          {autocloses && (
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.green, marginTop: 3 }}>
              {t('foods.pickHintAutoclose', { food: foodLabel(autocloses.food) })}
            </Text>
          )}
        </View>
      )}

      {addOpen && (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10,
            borderBottomWidth: 1, borderColor: colors.hairline,
          }}
        >
          <TextInput
            autoFocus
            placeholder={t('foods.addPlaceholder')}
            placeholderTextColor={colors.inkSecondary}
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={submitNew}
            style={{ flex: 1, fontSize: 15, color: colors.ink }}
          />
          <Pressable accessibilityRole="button" onPress={submitNew} style={press()}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>{t('foods.add')}</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(f) => f.food.id}
        getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
        renderItem={({ item }) => (
          <FoodRow
            item={item}
            onPress={
              pick === '1'
                ? () => startFlow(item.food, () => router.back())
                : () => router.push({ pathname: '/food/[id]', params: { id: item.food.id, from: 'foods' } })
            }
          />
        )}
        ListEmptyComponent={
          query.trim() ? (
            // A search that finds nothing used to be a dead end: the 직접 추가
            // control is a separate pill at the top, and it opened empty, so the
            // parent had to notice it and retype the word they just typed.
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNewName(query.trim());
                setAddOpen(true);
              }}
              style={press({ paddingVertical: 24, alignItems: 'center', gap: 6 })}
            >
              <Text style={{ color: colors.inkSecondary, fontSize: 14 }}>{t('foods.emptySearch')}</Text>
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>
                {t('foods.emptyAdd', { name: query.trim() })}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.inkSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>
              {t('foods.empty')}
            </Text>
          )
        }
      />
    </View>
  );
}

function FoodRow({ item, onPress }: { item: FoodWithStatus; onPress: () => void }) {
  const { t } = useTranslation();
  const bold = item.status === 'testing';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={press({
        flexDirection: 'row', alignItems: 'center', height: ROW_H,
        paddingHorizontal: layout.rowInset,
        borderBottomWidth: 1, borderColor: colors.hairline, gap: 7,
      })}
    >
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: bold ? '800' : '600', color: colors.ink }}>
        {foodLabel(item.food)}
      </Text>
      {item.food.allergenGroup && (
        <Text
          style={{
            fontSize: 10, fontWeight: '800', color: colors.red, borderWidth: 1,
            borderColor: colors.red, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
          }}
        >
          {t('foods.highRisk')}
        </Text>
      )}
      <StatusChip status={item.status} />
    </Pressable>
  );
}
