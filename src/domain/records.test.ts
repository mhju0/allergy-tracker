import {
  buildRecords, reactionSummary, type ReactionLike, type RecordedTrial,
} from './records';
import type { ObservationLike } from '../observation';

const D = (s: string) => new Date(s);

let n = 0;
const mk = (over: Partial<RecordedTrial> = {}): RecordedTrial => ({
  id: `t${n++}`, startedAt: D('2026-07-01T09:00:00Z'), windowDays: 3, outcome: null, endedAt: null,
  reactions: [], observations: [], ...over,
});
const reaction = (over: Partial<ReactionLike> & { trialId: string }): ReactionLike => ({
  id: `r${n++}`, occurredAt: D('2026-07-02T14:00:00Z'), severity: 'mild', symptoms: ['hives'], ...over,
});
const observation = (trialId: string, at: string): ObservationLike => ({ id: `o${n++}`, trialId, occurredAt: D(at) });

const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);

describe('buildRecords', () => {
  test('an active trial has only a start', () => {
    const rows = buildRecords([{ food: '두부', trials: [mk()] }]);
    expect(kinds(rows)).toEqual(['start']);
    expect(rows[0].food).toBe('두부');
  });

  test('a safe trial emits start then safe', () => {
    const tr = mk({ outcome: 'safe', endedAt: D('2026-07-04T09:00:00Z') });
    expect(kinds(buildRecords([{ food: '두부', trials: [tr] }]))).toEqual(['start', 'safe']);
  });

  // The rule that was written — and commented — in both screens.
  test('a reacted trial emits NO end row; the reaction is that moment', () => {
    const tr = mk({ outcome: 'reacted', endedAt: D('2026-07-02T14:00:00Z') });
    tr.reactions = [reaction({ trialId: tr.id, occurredAt: D('2026-07-02T14:00:00Z') })];
    const rows = buildRecords([{ food: '달걀', trials: [tr] }]);
    expect(kinds(rows)).toEqual(['start', 'reacted']);
  });

  test('check-ins and reactions attach through their trial', () => {
    const tr = mk();
    tr.reactions = [reaction({ trialId: tr.id })];
    tr.observations = [observation(tr.id, '2026-07-02T11:00:00Z')];
    const rows = buildRecords([{ food: '두부', trials: [tr] }]);
    expect(kinds(rows)).toEqual(['start', 'observation', 'reacted']);
    expect(rows.every((r) => r.food === '두부')).toBe(true);
  });

  test('a food shown with no trials contributes nothing', () => {
    expect(buildRecords([{ food: '두부', trials: [] }])).toEqual([]);
  });

  describe('cancelled trials', () => {
    const tr = mk({ outcome: 'cancelled', endedAt: D('2026-07-02T09:00:00Z') });
    tr.observations = [observation(tr.id, '2026-07-01T20:00:00Z')];
    const foods = [{ food: '두부', trials: [tr] }];

    test('are invisible by default — the calendar shows no rows, no dots', () => {
      expect(buildRecords(foods)).toEqual([]);
    });
    test('and their check-ins go with them', () => {
      expect(buildRecords(foods).length).toBe(0);
    });
    test('but the detail page opts them back in, end row and all', () => {
      const rows = buildRecords(foods, { includeCancelled: true });
      expect(kinds(rows)).toEqual(['start', 'observation', 'cancelled']);
    });
  });

  test('ordering is chronological, and a start lists last at a shared instant', () => {
    // The autoclose handoff: 소고기 closes and 달걀 opens at the same 09:00.
    const at = D('2026-07-10T09:00:00Z');
    const closed = mk({ id: 'beef', startedAt: D('2026-07-07T09:00:00Z'), outcome: 'safe', endedAt: at });
    const opened = mk({ id: 'egg', startedAt: at });
    const rows = buildRecords([
      { food: '소고기', trials: [closed] },
      { food: '달걀', trials: [opened] },
    ]);
    expect(rows.map((r) => `${r.food}:${r.kind}`)).toEqual([
      '소고기:start', '소고기:safe', '달걀:start',
    ]);
  });

  test('reversing gives a newest-first view with the same tie-break, mirrored', () => {
    const at = D('2026-07-10T09:00:00Z');
    const closed = mk({ id: 'beef', startedAt: D('2026-07-07T09:00:00Z'), outcome: 'safe', endedAt: at });
    const opened = mk({ id: 'egg', startedAt: at });
    const rows = buildRecords([
      { food: '소고기', trials: [closed] },
      { food: '달걀', trials: [opened] },
    ]).reverse();
    expect(rows.map((r) => `${r.food}:${r.kind}`)).toEqual([
      '달걀:start', '소고기:safe', '소고기:start',
    ]);
  });
});

describe('reactionSummary', () => {
  const t = (key: string) => key.split('.').pop()!;
  test('severity then symptoms, comma-joined', () => {
    expect(reactionSummary({ severity: 'moderate', symptoms: ['hives', 'rash'] }, t))
      .toBe('moderate · hives, rash');
  });
  test('a single symptom needs no comma', () => {
    expect(reactionSummary({ severity: 'mild', symptoms: ['cough'] }, t)).toBe('mild · cough');
  });
});
