import type { FoodStatus } from '../domain/status';

// Editorial design bible (owner-approved 2026-07-17), with the 2026-07-25
// contrast pass layered on. Ratios below are vs `paper` unless stated.
//
// Two colors now come in a mark/text pair: the original value stays for dots,
// fills and rules (only 3:1 is required for non-text UI), and a darkened
// sibling carries anything readable. Hues are unchanged — amber holds at 36deg,
// accent moves 18deg -> 16deg — so the palette still reads as itself.
const amber = '#B0761F'; // 3.60:1 — MARKS ONLY (progress fills, dots, tints)
const amberText = '#96631A'; // 4.79:1 — every amber string
const green = '#2E7D4F'; // 4.72:1
const red = '#A8432B'; // 5.60:1
const amberTint = '#F3E5C9';
const greenTint = '#DFEEDF';
const redTint = '#F3DED7';

// Home's state field (2026-07-28). One step deeper than the tints above, which
// keep their own jobs on chips, dots and calendar cells — these are additive.
//
// The rule on a field is: THE FIELD CARRIES THE COLOR, `ink` CARRIES THE TEXT.
// No amber/green/red string is ever set on one. Measured, that pairing fails:
// amberText on fieldAmber is 3.6:1. `ink` clears 10:1 on all three, and the
// tint has already said "amber" — repeating it in the type is redundant.
const fieldAmber = '#EBD5A8'; // ink 10.79:1
const fieldGreen = '#CBE3CB'; // ink 11.36:1
const fieldRed = '#EDCBC0'; // ink 10.26:1
const inkOnField = '#585245'; // >=5.13:1 on all three — inkSecondary fails on fieldRed at 3.99

const paper = '#FAF7F0';
const ink = '#26241F'; // 14.5:1
const muted = '#8B8578'; // 3.43:1 — MARKS ONLY (glyph strokes, dot outlines)
const inkSecondary = '#6E675A'; // 5.23:1 — every secondary string
const hairline = '#E4DED2';
const accent = '#BE4F26'; // 4.84:1 with onAccent (was #D96C3D at 3.41:1)
const onAccent = '#FFFFFF'; // text/icon on the persimmon primary fill
const dayOutMonth = '#C9C2B4'; // calendar grid: muted out-of-month day number

export const colors = {
  paper,
  ink,
  muted,
  inkSecondary,
  hairline,
  accent,
  onAccent,
  amber,
  amberText,
  green,
  red,
  amberTint,
  greenTint,
  redTint,
  dayOutMonth,
  fieldAmber,
  fieldGreen,
  fieldRed,
  inkOnField,

  // status.fg is rendered as TEXT (StatusChip label, home tally, detail
  // subline), so these are the readable variants throughout.
  status: {
    untried: { fg: inkSecondary },
    testing: { fg: amberText },
    safe: { fg: green },
    reacted: { fg: red },
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
// screenInset is the horizontal screen padding. It was a bare 22 in each
// screen until the state field needed to bleed past it by exactly that much.
export const layout = { rowInset: 10, screenInset: 22 };
