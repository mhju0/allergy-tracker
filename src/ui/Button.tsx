import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { press } from './pressable';
import { colors, layout, radii } from './tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  icon?: ReactNode;
};

export function Button({ label, onPress, variant = 'primary', disabled, icon }: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const borderColor = isDanger ? colors.redTint : colors.hairline;
  const fg = isPrimary ? colors.onAccent : isDanger ? colors.red : colors.ink;
  const backgroundColor = isPrimary ? colors.accent : isDanger ? colors.redTint : colors.surface;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={press({
        minHeight: layout.controlHeight,
        backgroundColor,
        borderWidth: isPrimary ? 0 : 1,
        borderColor,
        opacity: disabled ? 0.4 : 1,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: radii.md,
        flexDirection: 'row',
        gap: 9,
        justifyContent: 'center',
        alignItems: 'center',
      })}
    >
      {icon}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}
