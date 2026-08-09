import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { press } from './pressable';
import { colors, layout, radii } from './tokens';

export function ScreenHeader({ title, eyebrow, right }: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
}) {
  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <View style={{ flexShrink: 1 }}>
        {eyebrow ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSecondary, marginBottom: 2 }}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7, color: colors.ink }}>
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
        gap: 7,
        backgroundColor: icon === 'settings' ? colors.surface : 'transparent',
        borderWidth: icon === 'settings' ? 1 : 0,
        borderColor: colors.hairline,
      })}
    >
      <Icon name={icon} size={icon === 'settings' ? 18 : 22} color={colors.ink} />
      {icon === 'settings' ? <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{label}</Text> : null}
    </Pressable>
  );
}

export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={press({ minHeight: layout.touchTarget, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' })}
    >
      <Icon name="back" size={21} color={colors.ink} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
