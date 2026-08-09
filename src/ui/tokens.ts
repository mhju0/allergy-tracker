// Warm Care palette (owner-approved 2026-08-09). Text-bearing pairs are
// measured in tokens.test.ts; lighter values are surfaces and non-text marks.
const paper = '#FFF8F2';
const surface = '#FFFFFF';
const ink = '#362C27';
const muted = '#A9968B';
const inkSecondary = '#6E5D55';
const hairline = '#EBDDD3';
const accent = '#B64F37';
const accentPressed = '#983B27';
const accentTint = '#F9E5DC';
const onAccent = '#FFFFFF';

const amber = '#C18B2A';
const amberText = '#7A5413';
const green = '#356B4E';
const red = '#963944';
const amberTint = '#FFF0CF';
const greenTint = '#E4F2E8';
const redTint = '#F9E5E7';

// Calendar and status surfaces remain visually distinct from the paper ground.
const fieldAmber = '#F7DFA9';
const fieldGreen = '#D2E5D5';
const fieldRed = '#EFCFD3';
const inkOnField = '#5B4942';
const dayOutMonth = '#BDAEA5';

export const colors = {
  paper,
  surface,
  ink,
  muted,
  inkSecondary,
  hairline,
  accent,
  accentPressed,
  accentTint,
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

// Reused across pills/chips/dots — not a full scale, just the one radius that recurs everywhere.
export const radii = { sm: 14, md: 18, lg: 26, pill: 999 };

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typeStyles = {
  screenEyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  sectionMeta: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  rowTitle: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
  rowDetail: { fontSize: 11, lineHeight: 16, fontWeight: '400' },
  body: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  button: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
} as const;

// Shared spacing keeps row content and interactive controls aligned.
export const layout = {
  rowInset: 12,
  screenInset: 20,
  controlHeight: 52,
  touchTarget: 48,
  navHeight: 76,
  cardPadding: 16,
  rowHeight: 72,
};

export const shadows = {
  card: {
    shadowColor: '#5D3D2D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  nav: {
    shadowColor: '#5D3D2D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;
