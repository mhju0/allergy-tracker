import { buildBackup, buildReport, escapeHtml, type ReportInput } from './export';
import type { RecordedTrial } from '../domain/records';

// The report is driven from domain values now, so the fixture is what the app
// actually holds — foods, trials, reactions — not a hand-written view-model.
// Foods are custom (isCustom: true) so their Korean name is the row itself.
const D = (s: string) => new Date(s);
const NOW = D('2026-07-16T00:00:00Z');

// Echoes the key so an assertion reads as the label the report would print.
const t = (key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}(${Object.values(opts).join(',')})` : key;

let n = 0;
const mk = (over: Partial<RecordedTrial> = {}): RecordedTrial => ({
  id: `t${n++}`, startedAt: D('2026-07-10T09:00:00Z'), windowDays: 3, outcome: null, endedAt: null,
  reactions: [], checkins: [], ...over,
});
const foodRow = (name: string) => ({ isCustom: true as const, name });

const reactedTrial = mk({
  outcome: 'reacted', endedAt: D('2026-07-11T14:00:00Z'),
  reactions: [{
    id: 'r1', trialId: 'egg-trial', occurredAt: D('2026-07-11T14:00:00Z'),
    severity: 'moderate', symptoms: ['hives', 'rash'], note: null,
  }],
});
const base: ReportInput<{ isCustom: boolean; name: string }> = {
  baby: { name: '하율', birthdate: D('2025-11-02T00:00:00Z') },
  foods: [
    { food: foodRow('달걀'), status: 'reacted', trials: [reactedTrial], latest: reactedTrial },
  ],
};

describe('escapeHtml', () => {
  test('escapes the five specials', () => {
    expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('buildReport', () => {
  test('prints the foods tried, their status, and the reaction line', () => {
    const html = buildReport(base, NOW, t);
    expect(html).toContain('달걀');
    expect(html).toContain('status.reacted');
    expect(html).toContain('reaction.severityLevel.moderate · reaction.symptom.hives, reaction.symptom.rash');
  });

  // The join that used to be an O(n·m) flatMap().find() in the screen.
  test('each reaction is attributed to the food whose trial it belongs to', () => {
    const other = mk({ outcome: 'safe', endedAt: D('2026-07-05T09:00:00Z') });
    const html = buildReport({
      ...base,
      foods: [
        { food: foodRow('두부'), status: 'safe', trials: [other], latest: other },
        ...base.foods,
      ],
    }, NOW, t);
    expect(html).toMatch(/<li><strong>달걀<\/strong>/);
    expect(html).not.toMatch(/<li><strong>두부<\/strong>/);
  });

  // Grouping the list by food would bury a pattern that runs across foods.
  test('reactions list chronologically, not grouped by food', () => {
    const earlier = mk({
      outcome: 'reacted', endedAt: D('2026-07-02T09:00:00Z'),
      reactions: [{
        id: 'r0', trialId: 'tofu-trial', occurredAt: D('2026-07-02T09:00:00Z'),
        severity: 'mild', symptoms: ['cough'], note: null,
      }],
    });
    const html = buildReport({
      ...base,
      foods: [...base.foods, { food: foodRow('두부'), status: 'reacted', trials: [earlier], latest: earlier }],
    }, NOW, t);
    expect(html.indexOf('두부</strong>')).toBeLessThan(html.indexOf('달걀</strong>'));
  });

  test('an untried food is left out of the table', () => {
    const html = buildReport({
      ...base,
      foods: [...base.foods, { food: foodRow('감자'), status: 'untried', trials: [], latest: undefined }],
    }, NOW, t);
    expect(html).not.toContain('감자');
  });

  test('a food whose only trial was cancelled counts as untried', () => {
    const cancelled = mk({ outcome: 'cancelled', endedAt: D('2026-07-02T09:00:00Z') });
    const html = buildReport({
      ...base,
      foods: [{ food: foodRow('당근'), status: 'untried', trials: [cancelled], latest: undefined }],
    }, NOW, t);
    expect(html).not.toContain('당근');
  });

  test('escapes a malicious custom food name', () => {
    const tr = mk({ outcome: 'safe', endedAt: D('2026-07-12T09:00:00Z') });
    const html = buildReport({
      baby: { name: null, birthdate: null },
      foods: [{ food: foodRow('<script>x</script>'), status: 'safe', trials: [tr], latest: tr }],
    }, NOW, t);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('no reactions → the none label', () => {
    const clean = mk({ outcome: 'safe', endedAt: D('2026-07-13T09:00:00Z') });
    expect(buildReport({
      ...base,
      foods: [{ food: foodRow('두부'), status: 'safe', trials: [clean], latest: clean }],
    }, NOW, t)).toContain('report.none');
  });

  test('no name and no birthdate drops the line, not just its text', () => {
    const html = buildReport({ ...base, baby: { name: null, birthdate: null } }, NOW, t);
    expect(html).not.toContain('<br>'); // no orphan break before the generated line
    expect(html).toContain('report.generated');
  });

  test('a name without a birthdate still prints', () => {
    const html = buildReport({ ...base, baby: { name: '하율', birthdate: null } }, NOW, t);
    expect(html).toContain('하율');
    expect(html).not.toContain('report.born');
  });
});

describe('buildBackup', () => {
  test('versioned envelope with ISO timestamp and every table', () => {
    const out = JSON.parse(buildBackup(
      { baby: [], foods: [{ id: 'rice' }], trials: [], reactions: [], checkins: [{ id: 'c1' }] },
      D('2026-07-16T00:00:00Z')));
    expect(out.app).toBe('allergy-tracker');
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe('2026-07-16T00:00:00.000Z');
    expect(out.foods).toEqual([{ id: 'rice' }]);
    expect(out.checkins).toEqual([{ id: 'c1' }]); // backup must carry check-ins too
  });
});
