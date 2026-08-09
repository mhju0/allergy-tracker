import type { StyleProp, ViewStyle } from 'react-native';

// Every Pressable in the app used to be a static style object, so nothing
// responded to touch. On a UI built entirely from 1.25:1 hairlines with no
// cards or shadows, press feedback is the main signal that a row is a control
// at all — several rows (the home hero, the status counts, the calendar month
// title) look exactly like text otherwise.
//
// Usage: style={press({ ...layout })}
// Disabled Pressables never report pressed, so a disabled Button stays flat.
const PRESSED: ViewStyle = { opacity: 0.78, transform: [{ scale: 0.985 }] };

// base is optional: some controls (the home hero) are bare Pressables whose only
// styling is the text inside them, and they still need to acknowledge a tap.
export function press(base?: StyleProp<ViewStyle>) {
  return ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => (pressed ? [base, PRESSED] : base);
}
