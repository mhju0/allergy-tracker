import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import type { FamilyId } from '../db/families';
import { colors } from './tokens';

// The 표본 family glyphs — one per food family, drawn as specimen-plate line
// art on a 40x40 grid. Ported verbatim from the approved mock deck
// (design-audit/mockup-directions-3.html), so what shipped is what was signed
// off on rather than a redraw from memory.
//
// A glyph marks a FAMILY BAND, never a row. Eleven fish glyphs stacked down a
// 생선 band would be decoration; one at the head of the run is information.
// That is also why 19 glyphs are enough for 120 foods.
//
// Stroke-only by default. The few filled dots (a fish's eye, a bean's seeds)
// set fill explicitly and drop the stroke.
const STROKE = 2.2;

function Glyph({ family }: { family: FamilyId }) {
  switch (family) {
    case 'egg':
      return <Ellipse cx={20} cy={21} rx={8.5} ry={11} />;
    case 'dairy':
      return (
        <>
          <Path d="M12 17l8-6 8 6v13H12z" />
          <Path d="M12 17h16" />
        </>
      );
    case 'grain':
      return (
        <>
          <Path d="M20 32V10" />
          <Path d="M20 14l6-3M20 20l6-3M20 26l6-3M20 14l-6-3M20 20l-6-3M20 26l-6-3" />
        </>
      );
    case 'bean':
      return (
        <>
          <Path d="M12 25c1-8 7-13 16-13 0 8-6 14-16 13z" />
          <Circle cx={17} cy={21.5} r={1.4} fill="currentColor" stroke="none" />
          <Circle cx={21.5} cy={18.5} r={1.4} fill="currentColor" stroke="none" />
        </>
      );
    case 'nut':
      return <Path d="M20 9c6.5 5 8 13 0 22-8-9-6.5-17 0-22z" />;
    case 'fish':
      return (
        <>
          <Path d="M9 20c5-6 12-6 17 0-5 6-12 6-17 0z" />
          <Path d="M26 20l5.5-4.5v9z" />
          <Circle cx={14} cy={19} r={1.1} fill="currentColor" stroke="none" />
        </>
      );
    case 'shell':
      return (
        <>
          <Path d="M9 26c1-8 6-14 11-14s10 6 11 14z" />
          <Path d="M20 12v14M15 13.6l2.4 12.4M25 13.6l-2.4 12.4" />
        </>
      );
    case 'meat':
      return (
        <>
          <Rect x={9} y={13} width={22} height={15} rx={4.5} />
          <Path d="M13.5 18.5h13M13.5 23h8.5" />
        </>
      );
    case 'root':
      return (
        <>
          <Path d="M20 31l-5.5-14h11z" />
          <Path d="M20 17v-6M20 13.5l4.5-3M20 13.5l-4.5-3" />
        </>
      );
    case 'leaf':
      return (
        <>
          <Path d="M12 27c0-9 7-15 16-15 0 9-7 15-16 15z" />
          <Path d="M12 27L26.5 14" />
        </>
      );
    case 'fruitveg':
      return (
        <>
          <Ellipse cx={20} cy={22.5} rx={7.5} ry={9} />
          <Path d="M20 13.5V8.5" />
        </>
      );
    case 'floret':
      return (
        <>
          <Circle cx={15} cy={16} r={4.5} />
          <Circle cx={25} cy={16} r={4.5} />
          <Circle cx={20} cy={12.5} r={4.5} />
          <Path d="M20 20v11" />
        </>
      );
    case 'mushroom':
      return (
        <>
          <Path d="M9.5 20c0-6 4.5-10 10.5-10s10.5 4 10.5 10z" />
          <Path d="M16 20v7.5a4 4 0 008 0V20" />
        </>
      );
    case 'seaweed':
      return <Path d="M13 31c3-6 0-15 2-22M20 31c3-6 0-15 2-22M27 31c-1-6 0-15 0-22" />;
    case 'treefruit':
      return (
        <>
          <Circle cx={20} cy={22} r={9} />
          <Path d="M20 13V8" />
          <Path d="M20 10.5c3-2.5 5.5-1.5 5.5-1.5" />
        </>
      );
    case 'berry':
      return (
        <>
          <Circle cx={15.5} cy={24} r={5} />
          <Circle cx={24.5} cy={24} r={5} />
          <Circle cx={20} cy={16} r={5} />
        </>
      );
    case 'citrus':
      return (
        <>
          <Circle cx={20} cy={21} r={9.5} />
          <Path d="M20 11.5v19M10.5 21h19" />
        </>
      );
    case 'tropical':
      return (
        <>
          <Ellipse cx={20} cy={23} rx={7} ry={8.5} />
          <Path d="M20 14.5V9M17 10.5l3-2 3 2" />
          <Path d="M14.5 20l11 6.5M25.5 20l-11 6.5" />
        </>
      );
    case 'melon':
      return (
        <>
          <Circle cx={20} cy={21} r={9.5} />
          <Path d="M14.5 13c1.8 5 1.8 11 0 16M20 11.5v19M25.5 13c-1.8 5-1.8 11 0 16" />
        </>
      );
  }
}

export function FoodGlyph({
  family,
  size = 20,
  color = colors.inkSecondary,
}: {
  family: FamilyId;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      stroke={color}
      color={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      // The band's own text already names the family; the glyph repeats it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph family={family} />
    </Svg>
  );
}
