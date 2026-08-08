import type { FoodStatus } from '../domain/status';

// Editorial design bible (owner-approved 2026-07-17), with the 2026-07-25
// contrast pass layered on, then restruck in the 표본 (herbarium) palette
// owner-approved 2026-08-07. Ratios below are vs `paper` unless stated.
//
// 표본 is a VISUAL LANGUAGE, not a vocabulary — the Korean strings are
// untouched. What changed is the ground: paper goes from near-white to a warm
// specimen-sheet cream, so every value that carries text was re-measured
// against it rather than carried over. src/ui/tokens.test.ts is the authority;
// the mock's own amber (#A4761D) failed there at 3.31:1 and is kept only as a
// mark, exactly as the previous amber was.
//
// Two colors come in a mark/text pair: the lighter value stays for dots, fills
// and rules (only 3:1 is required for non-text UI), and a darkened sibling
// carries anything readable.
const amber = '#A4761D'; // 3.31:1 — MARKS ONLY (progress fills, dots, tints)
const amberText = '#825B17'; // 4.97:1 — every amber string
const green = '#3F6B45'; // 5.05:1
const red = '#8C3B2E'; // 6.18:1
const amberTint = '#EDD6A8';
const greenTint = '#CFE0CA';
const redTint = '#EDCEC2';

// Home's state field (2026-07-28). One step deeper than the tints above, which
// keep their own jobs on chips, dots and calendar cells — these are additive.
//
// The rule on a field is: THE FIELD CARRIES THE COLOR, `ink` CARRIES THE TEXT.
// No amber/green/red string is ever set on one. Measured, that pairing fails:
// amberText on fieldAmber is 3.6:1. `ink` clears 10:1 on all three, and the
// tint has already said "amber" — repeating it in the type is redundant.
// These sit a step deeper than they did on the old near-white paper: the
// herbarium ground is itself tinted, so the previous field values collapsed to
// ~1.20 against it and the seam disappeared. Re-struck to clear 1.2 with room.
const fieldAmber = '#E2C793'; // ink 8.72:1, vs paper 1.34
const fieldGreen = '#C6D9C0'; // ink 9.58:1, vs paper 1.22
const fieldRed = '#E6C2B4'; // ink 8.66:1, vs paper 1.35
const inkOnField = '#524C40'; // >=5.17:1 on all three — inkSecondary fails on fieldRed at 3.69

const paper = '#EDE8DC'; // the specimen sheet itself
const surface = '#F6F2E8'; // mounted label paper — rows, family bands, cards
const ink = '#2E2A22'; // 11.68:1
const muted = '#9C947F'; // 2.55:1 — MARKS ONLY (glyph strokes, dot outlines)
const inkSecondary = '#6B6152'; // 4.97:1 — every secondary string
const hairline = '#D3CAB6';
const accent = '#BE4F26'; // 4.84:1 with onAccent; 3.96:1 vs paper as a control
const onAccent = '#FFFFFF'; // text/icon on the persimmon primary fill
const dayOutMonth = '#BFB6A2'; // calendar grid: muted out-of-month day number

export const colors = {
  paper,
  surface,
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
