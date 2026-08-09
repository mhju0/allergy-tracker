import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { press } from './pressable';
import { colors, layout, radii, shadows, spacing } from './tokens';

type Tab = 'today' | 'foods' | 'history';

const ITEMS: { key: Tab; labelKey: string; icon: IconName; route: '/' | '/foods' | '/calendar' }[] = [
  { key: 'today', labelKey: 'nav.today', icon: 'home', route: '/' },
  { key: 'foods', labelKey: 'nav.foods', icon: 'foods', route: '/foods' },
  { key: 'history', labelKey: 'nav.history', icon: 'calendar', route: '/calendar' },
];

export function BottomNav({ active }: { active: Tab }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: colors.paper, paddingHorizontal: layout.screenInset, paddingTop: spacing.xs, paddingBottom: Math.max(insets.bottom, spacing.sm) }}>
      <View
        accessibilityRole="tablist"
        style={{
          minHeight: layout.navHeight,
          flexDirection: 'row',
          padding: spacing.xs,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          ...shadows.nav,
        }}
      >
        {ITEMS.map((item) => {
          const selected = item.key === active;
          const label = t(item.labelKey);
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              disabled={selected}
              onPress={() => router.replace(item.route)}
              style={press({
                flex: 1,
                minHeight: 58,
                borderRadius: radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xxs,
                backgroundColor: selected ? colors.accentTint : 'transparent',
              })}
            >
              <Icon name={item.icon} size={21} color={selected ? colors.accent : colors.muted} strokeWidth={2.1} />
              <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: '800', color: selected ? colors.accent : colors.inkSecondary }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
