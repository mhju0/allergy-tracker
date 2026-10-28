import type { Ref } from 'react';
import { Text as NativeText, type TextProps } from 'react-native';
import { keepKoreanLinesTogether } from './lineBreaks';

// iOS breaks Korean between syllables by default, which strands fragments
// like "요." on their own line. hangul-word wraps between words instead.
export function Text({ children, ...props }: TextProps & { ref?: Ref<NativeText> }) {
  return (
    <NativeText lineBreakStrategyIOS="hangul-word" {...props}>
      {typeof children === 'string' ? keepKoreanLinesTogether(children) : children}
    </NativeText>
  );
}
