import { Text as NativeText, type TextProps } from 'react-native';

// iOS breaks Korean between syllables by default, which strands fragments
// like "요." on their own line. hangul-word wraps between words instead.
export function Text(props: TextProps) {
  return <NativeText lineBreakStrategyIOS="hangul-word" {...props} />;
}
