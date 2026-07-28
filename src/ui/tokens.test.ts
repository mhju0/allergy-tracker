import { colors } from './tokens';

// WCAG 2.1 relative luminance + contrast ratio. Guards the palette against
// anyone re-lightening a token that carries text: every value below is rendered
// as a readable string somewhere in app/, so 4.5:1 is the floor (SC 1.4.3).
// Non-text marks (dots, rules, progress fills) are deliberately excluded —
// they only owe 3:1, and colors.muted/colors.amber survive precisely for those.
function luminance(hex: string): number {
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('contrast', () => {
  it('agrees with the WCAG reference pair', () => {
    // black on white is exactly 21:1 — proves the formula, not the palette
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it.each([
    ['ink', colors.ink],
    ['inkSecondary', colors.inkSecondary],
    ['amberText', colors.amberText],
    ['green', colors.green],
    ['red', colors.red],
  ])('%s meets AA as text on paper', (_name, fg) => {
    expect(contrast(fg, colors.paper)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ['untried', colors.status.untried.fg],
    ['testing', colors.status.testing.fg],
    ['safe', colors.status.safe.fg],
    ['reacted', colors.status.reacted.fg],
  ])('status.%s.fg meets AA — it is rendered as a label, not just a dot', (_name, fg) => {
    expect(contrast(fg, colors.paper)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('primary button label meets AA on the accent fill', () => {
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('accent fill is distinguishable from paper as a control', () => {
    expect(contrast(colors.accent, colors.paper)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('ink stays readable on the calendar tints it now sits on', () => {
    expect(contrast(colors.ink, colors.amberTint)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(colors.ink, colors.redTint)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('red stays readable on redTint (the emergency advisory rule)', () => {
    expect(contrast(colors.red, colors.redTint)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // Home's state field. Everything readable on one is ink or inkOnField —
  // these two assertions are what let the field go a step deeper than the
  // tints without anyone re-checking by eye.
  const fields: [string, string][] = [
    ['fieldAmber', colors.fieldAmber],
    ['fieldGreen', colors.fieldGreen],
    ['fieldRed', colors.fieldRed],
  ];

  it.each(fields)('ink meets AA on %s', (_name, bg) => {
    expect(contrast(colors.ink, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(fields)('inkOnField meets AA on %s', (_name, bg) => {
    expect(contrast(colors.inkOnField, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // The reason inkOnField exists. If someone deletes it and reaches for the
  // ordinary secondary ink, this fails rather than shipping 4.33:1 on red.
  it('inkSecondary is NOT safe on the red field — inkOnField is why', () => {
    expect(contrast(colors.inkSecondary, colors.fieldRed)).toBeLessThan(AA_TEXT);
    expect(contrast(colors.inkOnField, colors.fieldRed)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // The field has to read as a distinct surface against paper, but it is not
  // text and owes no ratio — this only guards against someone lightening it
  // until the seam disappears entirely.
  it.each(fields)('%s is distinguishable from paper', (_name, bg) => {
    expect(contrast(bg, colors.paper)).toBeGreaterThan(1.2);
  });
});
