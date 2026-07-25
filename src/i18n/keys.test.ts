import ko from './ko.json';

// This project deliberately has no @types/node, so declare the three node
// globals this test needs rather than adding a dependency for a test file.
declare const __dirname: string;
declare const require: (id: string) => unknown;

const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (path: string) => string[];
  readFileSync: (path: string, encoding: string) => string;
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { join } = require('path') as { join: (...parts: string[]) => string };

// Renaming a translation key without its call site renders the raw key to the
// user ("reaction.savedBody" in a Korean alert). Nothing else in the suite
// catches that, so scan the source for static t('...') literals and assert
// every one resolves. Template-literal keys (t(`status.${s}`)) can't be
// resolved statically — their families are asserted explicitly below.
const ROOTS = ['app', 'src'];
const SKIP_DIRS = new Set(['node_modules', '__tests__']);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(entry) ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

function resolve(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) return (node as Record<string, unknown>)[part];
    return undefined;
  }, ko);
}

const REPO_ROOT = join(__dirname, '..', '..');
const files = ROOTS.flatMap((r) => sourceFiles(join(REPO_ROOT, r)));

describe('i18n keys', () => {
  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('every static t() key resolves to a string', () => {
    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
        if (typeof resolve(m[1]) !== 'string') missing.push(`${file.replace(REPO_ROOT + '/', '')} → ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it.each([
    ['status', ['untried', 'testing', 'safe', 'reacted']],
    ['food.outcome', ['safe', 'reacted', 'cancelled']],
    ['reaction.severityLevel', ['mild', 'moderate', 'severe']],
    ['reaction.symptom', ['hives', 'rash', 'vomiting', 'diarrhea', 'swelling', 'cough', 'breathing', 'other']],
    ['calendar.weekday', ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6']],
    ['welcome', ['step1', 'step2', 'step3']],
  ])('%s family is complete (interpolated at the call site)', (prefix, members) => {
    for (const m of members) expect(typeof resolve(`${prefix}.${m}`)).toBe('string');
  });

  it('no key still says 테스트 — the app standardised on 관찰', () => {
    expect(JSON.stringify(ko)).not.toContain('테스트');
  });

  it('window length is interpolated, never hardcoded, in window-length copy', () => {
    for (const key of ['home.readyToConfirm', 'foods.pickHint', 'welcome.step2', 'welcome.step3', 'food.startTrial', 'food.retest']) {
      const value = resolve(key) as string;
      expect(value).toMatch(/\{\{(days|total)\}\}/);
      expect(value).not.toMatch(/\d일/);
    }
  });
});
