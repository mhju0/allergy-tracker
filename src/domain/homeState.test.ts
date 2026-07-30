import { describeHome, deriveHomeState, trialDay, type HomeFood, type HomeTrial } from './homeState';
import { deriveStatus, latestTrial, MS_PER_DAY, type TrialLike } from './status';

const D = (s: string) => new Date(s);
const NOW = D('2026-07-28T09:00:00Z');

let n = 0;
const mk = (over: Partial<HomeTrial> = {}): HomeTrial => ({
  id: `t${n++}`, startedAt: D('2026-07-26T10:00:00Z'), windowDays: 3, outcome: null, endedAt: null,
  reactions: [], checkins: [], ...over,
});

// Mirrors what useFoodsWithStatus produces, minus the db row. Uses the real
// derivation so the fixture can't drift from what the app actually feeds in.
const food = (name: string, trials: HomeTrial[]): HomeFood<string> => ({
  food: name, trials, status: deriveStatus(trials), latest: latestTrial(trials),
});

describe('trialDay', () => {
  test('the start day is day 1, not day 0', () => {
    expect(trialDay({ startedAt: D('2026-07-28T08:00:00Z'), windowDays: 3 }, NOW)).toBe(1);
  });
  test('clamps to the window length once the window has run out', () => {
    expect(trialDay({ startedAt: D('2026-07-01T10:00:00Z'), windowDays: 3 }, NOW)).toBe(3);
  });
});

describe('deriveHomeState', () => {
  test('no foods at all → empty', () => {
    expect(deriveHomeState([], NOW)).toEqual({ kind: 'empty' });
  });

  test('foods but no trial ever → empty', () => {
    expect(deriveHomeState([food('감자', [])], NOW).kind).toBe('empty');
  });

  test('active trial inside its window → observing, with the day number', () => {
    const s = deriveHomeState([food('두부', [mk({ startedAt: D('2026-07-26T08:00:00Z') })])], NOW);
    expect(s.kind).toBe('observing');
    if (s.kind !== 'observing') throw new Error('unreachable');
    expect(s.food).toBe('두부');
    expect(s.day).toBe(3);
  });

  // Pinning shipped behaviour, not proposing it: the day count is elapsed
  // 24-hour periods (app/index.tsx:96 as of this commit), so a trial started
  // yesterday evening is still day 1 this morning. A calendar-day reading
  // would say 2. Changing that is out of scope here — this test exists so the
  // choice is deliberate rather than accidental.
  test('the day count is 24-hour periods, not calendar days', () => {
    const s = deriveHomeState([food('두부', [mk({ startedAt: D('2026-07-27T18:00:00Z') })])], NOW);
    if (s.kind !== 'observing') throw new Error('unreachable');
    expect(s.day).toBe(1);
  });

  test('an active trial wins over any closed one', () => {
    const s = deriveHomeState([
      food('달걀', [mk({ outcome: 'reacted', endedAt: D('2026-07-27T10:00:00Z') })]),
      food('두부', [mk({ startedAt: D('2026-07-27T10:00:00Z') })]),
    ], NOW);
    expect(s.kind).toBe('observing');
  });

  describe('the observing → confirm boundary', () => {
    const start = D('2026-07-25T09:00:00Z');
    const at = (offset: number) => deriveHomeState([food('두부', [mk({ startedAt: start, windowDays: 3 })])],
      new Date(start.getTime() + 3 * MS_PER_DAY + offset));

    test('one millisecond before the window ends → still observing', () => {
      expect(at(-1).kind).toBe('observing');
    });
    test('exactly at startedAt + windowDays → confirm', () => {
      expect(at(0).kind).toBe('confirm');
    });
    test('after the window ends → confirm', () => {
      expect(at(MS_PER_DAY).kind).toBe('confirm');
    });
  });

  test('latest closed trial confirmed safe → safe, naming the food and the count', () => {
    const s = deriveHomeState([
      food('감자', [mk({ outcome: 'safe', endedAt: D('2026-07-20T10:00:00Z') })]),
      food('두부', [mk({ outcome: 'safe', endedAt: D('2026-07-27T10:00:00Z') })]),
    ], NOW);
    expect(s.kind).toBe('safe');
    if (s.kind !== 'safe') throw new Error('unreachable');
    expect(s.food).toBe('두부');
    expect(s.safeCount).toBe(2);
  });

  // THE DEFECT. Shipped Home has no reacted branch: logging a reaction closes
  // the trial, Home falls to its idle branch and renders home.idleTitle —
  // "N가지 안전" in green (app/index.tsx:183). This test fails against that
  // behaviour and is the reason the state machine exists.
  test('latest closed trial reacted → reacted, NOT safe', () => {
    const s = deriveHomeState([
      food('감자', [mk({ outcome: 'safe', endedAt: D('2026-07-20T10:00:00Z') })]),
      food('달걀', [mk({ outcome: 'reacted', endedAt: D('2026-07-27T14:00:00Z') })]),
    ], NOW);
    expect(s.kind).toBe('reacted');
    if (s.kind !== 'reacted') throw new Error('unreachable');
    expect(s.food).toBe('달걀');
  });

  test('a reaction logged after an earlier food was marked safe still wins', () => {
    // ordered by endedAt, not startedAt: 달걀 started first but ended last
    const s = deriveHomeState([
      food('달걀', [mk({ startedAt: D('2026-07-10T10:00:00Z'), outcome: 'reacted', endedAt: D('2026-07-27T14:00:00Z') })]),
      food('감자', [mk({ startedAt: D('2026-07-24T10:00:00Z'), outcome: 'safe', endedAt: D('2026-07-27T10:00:00Z') })]),
    ], NOW);
    expect(s.kind).toBe('reacted');
  });

  test('a cancelled trial never selects a state', () => {
    expect(deriveHomeState([
      food('두부', [mk({ outcome: 'cancelled', endedAt: D('2026-07-27T10:00:00Z') })]),
    ], NOW).kind).toBe('empty');
  });

  test('a cancelled trial does not outrank an older real one', () => {
    const s = deriveHomeState([
      food('감자', [mk({ startedAt: D('2026-07-20T10:00:00Z'), outcome: 'safe', endedAt: D('2026-07-23T10:00:00Z') })]),
      food('두부', [mk({ startedAt: D('2026-07-26T10:00:00Z'), outcome: 'cancelled', endedAt: D('2026-07-27T10:00:00Z') })]),
    ], NOW);
    expect(s.kind).toBe('safe');
    if (s.kind !== 'safe') throw new Error('unreachable');
    expect(s.food).toBe('감자');
  });
});

// describeHome is the whole field in one call. These two derivations used to be
// unexported functions at the bottom of app/index.tsx, where the only way to
// check them was to read them.
describe('describeHome', () => {
  // Stand-in for i18next: echoes the key, then its interpolations, so an
  // assertion reads as the sentence Home would actually build.
  const t = (key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}|${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')}` : key;

  test('empty → the empty line, nothing lit', () => {
    const v = describeHome([], NOW, t);
    expect(v.state.kind).toBe('empty');
    expect(v.subline).toBe('home.empty');
    expect(v.filled).toBe(0);
  });

  test('observing → the day of the window, that many segments lit', () => {
    const v = describeHome([food('두부', [mk({ startedAt: D('2026-07-26T08:00:00Z') })])], NOW, t);
    expect(v.subline).toContain('home.sub.observing|day=3,total=3');
    expect(v.filled).toBe(3);
  });

  test('confirm → the full window is lit, dated, and says how little was seen', () => {
    const v = describeHome([food('두부', [mk({ startedAt: D('2026-07-20T08:00:00Z') })])], NOW, t);
    expect(v.state.kind).toBe('confirm');
    // this state persists indefinitely, so the line carries the window's end
    // date and its observed count rather than a bare "관찰이 끝났어요"
    expect(v.subline).toBe('home.sub.confirm|total=3,date=7월 23일,observed=0');
    expect(v.filled).toBe(3);
  });

  test('confirm → check-ins on the same day count once', () => {
    const startedAt = D('2026-07-20T08:00:00Z');
    const v = describeHome([food('두부', [mk({
      startedAt,
      checkins: [
        { id: 'c1', trialId: 'x', occurredAt: D('2026-07-21T02:00:00Z') },
        { id: 'c2', trialId: 'x', occurredAt: D('2026-07-21T09:00:00Z') },
        { id: 'c3', trialId: 'x', occurredAt: D('2026-07-22T09:00:00Z') },
      ],
    })])], NOW, t);
    expect(v.subline).toContain('observed=2');
  });

  test('safe → counts every safe food, and how much of the window was watched', () => {
    const closed = mk({
      outcome: 'safe', endedAt: D('2026-07-27T10:00:00Z'),
      checkins: [{ id: 'c1', trialId: 'x', occurredAt: D('2026-07-27T02:00:00Z') }],
    });
    const v = describeHome([
      food('두부', [closed]),
      food('감자', [mk({ outcome: 'safe', endedAt: D('2026-07-25T10:00:00Z') })]),
    ], NOW, t);
    expect(v.subline).toBe('home.sub.safe|total=3,observed=1,count=2');
    expect(v.filled).toBe(3);
  });

  test('reacted → severity and symptoms, and only the days it ran are lit', () => {
    const started = D('2026-07-26T10:00:00Z');
    const reactedAt = D('2026-07-27T14:00:00Z'); // day 2 of 3
    const trial = mk({ startedAt: started, outcome: 'reacted', endedAt: reactedAt });
    const v = describeHome([food('달걀', [{ ...trial, reactions: [
      { id: 'r1', trialId: trial.id, occurredAt: reactedAt, severity: 'moderate', symptoms: ['hives', 'rash'] },
    ] }])], NOW, t);
    expect(v.subline).toBe(
      'home.sub.reacted|day=2,severity=reaction.severityLevel.moderate,'
      + 'symptoms=reaction.symptom.hives, reaction.symptom.rash',
    );
    expect(v.filled).toBe(2); // NOT 3 — the window stopped when the reaction landed
  });

  test('reacted with the reaction row missing → falls back, never crashes', () => {
    const trial = mk({ outcome: 'reacted', endedAt: D('2026-07-27T10:00:00Z') });
    const v = describeHome([food('달걀', [trial])], NOW, t);
    expect(v.subline).toBe('status.reacted');
  });
});
