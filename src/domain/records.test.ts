import { buildRecords, reactionSummary, type CheckinLike, type ReactionLike } from './records';
import type { TrialLike } from './status';

const D = (s: string) => new Date(s);

let n = 0;
const mk = (over: Partial<TrialLike> = {}): TrialLike => ({
  id: `t${n++}`, startedAt: D('2026-07-01T09:00:00Z'), windowDays: 3, outcome: null, endedAt: null, ...over,
});
const reaction = (over: Partial<ReactionLike> & { trialId: string }): ReactionLike => ({
  id: `r${n++}`, occurredAt: D('2026-07-02T14:00:00Z'), severity: 'mild', symptoms: ['hives'], ...over,
});
const checkin = (trialId: string, at: string): CheckinLike => ({ id: `c${n++}`, trialId, occurredAt: D(at) });

const kinds = (rows: { kind: string }[]) => rows.map((r) => r.kind);

describe('buildRecords', () => {
  test('an active trial has only a start', () => {
    const rows = buildRecords([{ food: '두부', trials: [mk()] }], [], []);
    expect(kinds(rows)).toEqual(['start']);
    expect(rows[0].food).toBe('두부');
  });

  test('a safe trial emits start then safe', () => {
    const tr = mk({ outcome: 'safe', endedAt: D('2026-07-04T09:00:00Z') });
    expect(kinds(buildRecords([{ food: '두부', trials: [tr] }], [], []))).toEqual(['start', 'safe']);
  });

  // The rule that was written — and commented — in both screens.
  test('a reacted trial emits NO end row; the reaction is that moment', () => {
    const tr = mk({ outcome: 'reacted', endedAt: D('2026-07-02T14:00:00Z') });
    const rows = buildRecords(
      [{ food: '달걀', trials: [tr] }],
      [reaction({ trialId: tr.id, occurredAt: D('2026-07-02T14:00:00Z') })],
      [],
    );
    expect(kinds(rows)).toEqual(['start', 'reacted']);
  });

  test('check-ins and reactions attach through their trial', () => {
    const tr = mk();
    const rows = buildRecords(
      [{ food: '두부', trials: [tr] }],
      [reaction({ trialId: tr.id })],
      [checkin(tr.id, '2026-07-02T11:00:00Z')],
    );
    expect(kinds(rows)).toEqual(['start', 'checkin', 'reacted']);
    expect(rows.every((r) => r.food === '두부')).toBe(true);
  });

  test('rows for a trial this view does not show are dropped, not orphaned', () => {
    const shown = mk();
    const rows = buildRecords(
      [{ food: '두부', trials: [shown] }],
      [reaction({ trialId: 'someone-elses-trial' })],
      [checkin('someone-elses-trial', '2026-07-02T11:00:00Z')],
    );
    expect(kinds(rows)).toEqual(['start']);
  });

  describe('cancelled trials', () => {
    const tr = mk({ outcome: 'cancelled', endedAt: D('2026-07-02T09:00:00Z') });
    const foods = [{ food: '두부', trials: [tr] }];
    const checkins = [checkin(tr.id, '2026-07-01T20:00:00Z')];

    test('are invisible by default — the calendar shows no rows, no dots', () => {
      expect(buildRecords(foods, [], checkins)).toEqual([]);
    });
    test('and their check-ins go with them', () => {
      expect(buildRecords(foods, [], checkins).length).toBe(0);
    });
    test('but the detail page opts them back in, end row and all', () => {
      const rows = buildRecords(foods, [], checkins, { includeCancelled: true });
      expect(kinds(rows)).toEqual(['start', 'checkin', 'cancelled']);
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
    ], [], []);
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
    ], [], []).reverse();
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
