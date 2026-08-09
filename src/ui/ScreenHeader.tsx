import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { press } from './pressable';
import { colors, layout, radii, spacing, typeStyles } from './tokens';

export function ScreenHeader({ title, eyebrow, right, alignRightWithTitle = false }: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  alignRightWithTitle?: boolean;
}) {
  if (eyebrow && right && alignRightWithTitle) {
    return (
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typeStyles.screenEyebrow, color: colors.inkSecondary, marginBottom: 2 }}>{eyebrow}</Text>
        <View style={{ minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text accessibilityRole="header" style={{ flexShrink: 1, ...typeStyles.screenTitle, color: colors.ink }}>
            {title}
          </Text>
          {right}
        </View>
      </View>
    );
  }

  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md }}>
      <View style={{ flexShrink: 1 }}>
        {eyebrow ? <Text style={{ ...typeStyles.screenEyebrow, color: colors.inkSecondary, marginBottom: 2 }}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={{ ...typeStyles.screenTitle, color: colors.ink }}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

export function HeaderButton({ label, onPress, icon = 'settings' }: {
  label: string;
  onPress: () => void;
  icon?: 'settings' | 'close';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={press({
        minHeight: layout.touchTarget,
        minWidth: layout.touchTarget,
        paddingHorizontal: icon === 'settings' ? 12 : 0,
        borderRadius: radii.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: icon === 'settings' ? colors.surface : 'transparent',
        borderWidth: icon === 'settings' ? 1 : 0,
        borderColor: colors.hairline,
      })}
    >
      <Icon name={icon} size={icon === 'settings' ? 18 : 22} color={colors.ink} />
      {icon === 'settings' ? <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '800', color: colors.ink }}>{label}</Text> : null}
    </Pressable>
  );
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={press({ minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, alignSelf: 'flex-start' })}
    >
      <Icon name="back" size={21} color={colors.ink} />
      <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
