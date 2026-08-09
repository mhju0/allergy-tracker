import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, layout, radii, shadows } from './tokens';

type Tone = 'surface' | 'observing' | 'safe' | 'reaction' | 'accent';

const backgrounds: Record<Tone, string> = {
  surface: colors.surface,
  observing: colors.amberTint,
  safe: colors.greenTint,
  reaction: colors.redTint,
  accent: colors.accentTint,
};

export function WarmCard({ children, tone = 'surface', style }: {
  children: ReactNode;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          padding: layout.cardPadding,
          borderRadius: radii.lg,
          borderWidth: tone === 'surface' ? 1 : 0,
          borderColor: colors.hairline,
          backgroundColor: backgrounds[tone],
        },
        tone === 'surface' ? shadows.card : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
