import { deriveHomeState, trialDay, type HomeFood } from './homeState';
import { deriveStatus, latestTrial, MS_PER_DAY, type TrialLike } from './status';

const D = (s: string) => new Date(s);
const NOW = D('2026-07-28T09:00:00Z');

let n = 0;
const mk = (over: Partial<TrialLike> = {}): TrialLike => ({
  id: `t${n++}`, startedAt: D('2026-07-26T10:00:00Z'), windowDays: 3, outcome: null, endedAt: null, ...over,
});

// Mirrors what useFoodsWithStatus produces, minus the db row. Uses the real
// derivation so the fixture can't drift from what the app actually feeds in.
const food = (name: string, trials: TrialLike[]): HomeFood<string> => ({
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
