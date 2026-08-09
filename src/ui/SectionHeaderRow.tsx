import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, typeStyles } from './tokens';

export function SectionHeaderRow({ title, meta, style }: {
  title: string;
  meta?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          minHeight: 24,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginTop: spacing.lg,
          marginBottom: spacing.xs,
        },
        style,
      ]}
    >
      <Text style={{ flex: 1, ...typeStyles.sectionTitle, color: colors.ink }}>{title}</Text>
      {meta ? <Text style={{ ...typeStyles.sectionMeta, color: colors.inkSecondary, textAlign: 'right' }}>{meta}</Text> : null}
    </View>
  );
}
