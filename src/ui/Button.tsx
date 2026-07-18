import { Pressable, Text } from 'react-native';
import { colors, radii } from './tokens';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean };

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const borderColor = isDanger ? colors.red : colors.ink;
  const fg = isPrimary ? colors.onAccent : isDanger ? colors.red : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        backgroundColor: isPrimary ? colors.accent : 'transparent',
        borderWidth: isPrimary ? 0 : 1.5,
        borderColor,
        opacity: disabled ? 0.4 : 1,
        paddingVertical: isPrimary ? 14 : 12.5,
        borderRadius: radii.pill,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
