import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { HomeState } from '../domain/homeState';
import { colors, layout } from './tokens';
import { press } from './pressable';

// Home's state field: a tinted region carrying the food name at display size.
// The colour IS the state, so nothing inside it is coloured — see tokens.ts.
//
// The window segments sit on the field's BOTTOM edge, not the top of the
// screen. The mockup drew them at y=0 across the full width, which on a
// notched device puts the middle third behind hardware. On the seam they also
// do a second job: fieldAmber is only 1.34:1 against paper, so without them
// the boundary is nearly invisible.

type Kind = HomeState<unknown>['kind'];

export const fieldColor: Record<Kind, string> = {
  empty: colors.paper,
  observing: colors.fieldAmber,
  confirm: colors.fieldAmber,
  safe: colors.fieldGreen,
  reacted: colors.fieldRed,
};

const markColor: Record<Kind, string> = {
  empty: colors.hairline,
  observing: colors.amber,
  confirm: colors.amber,
  safe: colors.green,
  reacted: colors.red,
};

// Cross-fades the field when the state changes — confirming safe should feel
// like amber becoming green, not a jump cut.
//
// This uses RN's own Animated rather than reanimated. reanimated is installed
// but has never been used here, so reaching for it would newly depend on the
// worklets babel plugin being wired correctly for the sake of one colour tween.
// backgroundColor cannot use the native driver either way, so there is nothing
// to win: a single 320ms interpolation on the JS thread is not a dropped frame.
const FADE_MS = 320;

export function useFieldFade(kind: Kind): Animated.AnimatedInterpolation<string> {
  const previous = useRef(kind);
  const progress = useRef(new Animated.Value(1)).current;
  const [[from, to], setPair] = useState<[Kind, Kind]>([kind, kind]);

  useEffect(() => {
    if (previous.current === kind) return;
    setPair([previous.current, kind]);
    previous.current = kind;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: FADE_MS, useNativeDriver: false }).start();
  }, [kind, progress]);

  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fieldColor[from], fieldColor[to]],
  });
}

const CORNER = 15;
const CORNER_W = 1.5;

function MountCorner({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  const top = corner[0] === 't';
  const left = corner[1] === 'l';
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        width: CORNER,
        height: CORNER,
        [top ? 'top' : 'bottom']: 0,
        [left ? 'left' : 'right']: 0,
        borderColor: colors.inkOnField,
        borderTopWidth: top ? CORNER_W : 0,
        borderBottomWidth: top ? 0 : CORNER_W,
        borderLeftWidth: left ? CORNER_W : 0,
        borderRightWidth: left ? 0 : CORNER_W,
      }}
    />
  );
}

export function StateField({
  kind, eyebrow, name, stateWord, subline, recordLabel, onPressRecord, filled, total,
}: {
  kind: Kind;
  eyebrow: string;
  name: string;
  stateWord: string;
  subline: string;
  recordLabel?: string;
  onPressRecord?: () => void;
  /** window days elapsed; omit to hide the segment bar */
  filled?: number;
  total?: number;
}) {
  const body = (
    <>
      <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2.2, color: colors.inkOnField, paddingLeft: 3 }}>
        {eyebrow}
      </Text>
      <Text
        style={{
          fontSize: 72, lineHeight: 74, fontWeight: '900', letterSpacing: -3,
          color: colors.ink, marginTop: 26,
        }}
      >
        {name}
      </Text>
      <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginTop: 16, paddingLeft: 3 }}>
        {stateWord}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkOnField, marginTop: 5, paddingLeft: 3, lineHeight: 19 }}>
        {subline}
      </Text>
      {recordLabel && (
        <Text style={{ fontSize: 12, color: colors.inkOnField, marginTop: 18, paddingLeft: 3 }}>
          {recordLabel} →
        </Text>
      )}
    </>
  );

  return (
    <View style={{ position: 'relative' }}>
      {/* 표본 mounting corners — the four brackets that hold a specimen to its
          sheet. Decorative only: pointerEvents none so they never intercept
          the record tap, and no accessibility node, since they say nothing a
          screen reader needs. */}
      <MountCorner corner="tl" />
      <MountCorner corner="tr" />
      <MountCorner corner="bl" />
      <MountCorner corner="br" />

      {onPressRecord ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${stateWord}`}
          accessibilityHint={recordLabel}
          onPress={onPressRecord}
          style={press({ paddingBottom: 22 })}
        >
          {body}
        </Pressable>
      ) : (
        <View style={{ paddingBottom: 22 }}>{body}</View>
      )}

      {total != null && total > 0 && (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: filled ?? 0 }}
          style={{ flexDirection: 'row', gap: 2, marginHorizontal: -layout.screenInset }}
        >
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1, height: 5,
                backgroundColor: markColor[kind],
                opacity: i < (filled ?? 0) ? 1 : 0.22,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
