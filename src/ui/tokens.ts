import type { FoodStatus } from '../domain/status';

// Editorial design bible (owner-approved 2026-07-17).
const amber = '#B0761F';
const green = '#2E7D4F';
const red = '#A8432B';
const amberTint = '#F3E5C9';
const greenTint = '#DFEEDF';
const redTint = '#F3DED7';

const paper = '#FAF7F0';
const ink = '#26241F';
const muted = '#8B8578';
const hairline = '#E4DED2';
const accent = '#D96C3D';
const onAccent = '#FFFFFF'; // text/icon on the persimmon primary fill
const dayOutMonth = '#C9C2B4'; // calendar grid: muted out-of-month day number

export const colors = {
  paper,
  ink,
  muted,
  hairline,
  accent,
  onAccent,
  amber,
  green,
  red,
  amberTint,
  greenTint,
  redTint,
  dayOutMonth,

  // legacy-shaped aliases — existing call sites (colors.text, colors.bg, ...) keep working unchanged.
  bg: paper,
  surface: paper,
  text: ink,
  textMuted: muted,
  border: hairline,
  danger: red,
  status: {
    untried: { fg: muted, bg: paper },
    testing: { fg: amber, bg: amberTint },
    safe: { fg: green, bg: greenTint },
    reacted: { fg: red, bg: redTint },
  },
} as const;

export const statusIcon: Record<FoodStatus, string> = {
  untried: '○',
  testing: '◐',
  safe: '✓',
  reacted: '✕',
};

// Reused across pills/chips/dots — not a full scale, just the one radius that recurs everywhere.
export const radii = { pill: 999 };

// Single source for the horizontal inset of row content inside full-width
// divider lines. Dividers/buttons stay flush to the screen padding; labels and
// values sit this far inside. Used across home, calendar, and the foods list.
export const layout = { rowInset: 10 };
