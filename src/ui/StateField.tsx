import { Pressable, Text, View } from 'react-native';
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
    <View>
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
