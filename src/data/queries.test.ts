// connectFoods is the shape the whole app reads. It used to be four flat lists
// and a join rebuilt in every screen, so there was nothing to test.
jest.mock('../db/client', () => ({ db: {} }));

import { connectFoods } from './queries';
import type { Checkin, Food, Reaction, Trial } from '../db/schema';

const D = (s: string) => new Date(s);

const food = (id: string, name = id): Food =>
  ({ id, name, isCustom: false, allergenGroup: null }) as Food;
const trial = (id: string, foodId: string, over: Partial<Trial> = {}): Trial =>
  ({ id, foodId, startedAt: D('2026-07-01T09:00:00Z'), windowDays: 3, outcome: null, endedAt: null, ...over }) as Trial;
const reaction = (id: string, trialId: string, at: string): Reaction =>
  ({ id, trialId, occurredAt: D(at), severity: 'mild', symptoms: ['hives'], note: null }) as Reaction;
const checkin = (id: string, trialId: string, at: string): Checkin =>
  ({ id, trialId, occurredAt: D(at), note: null }) as Checkin;

describe('connectFoods', () => {
  test('a food with no trials still appears, untried', () => {
    const [f] = connectFoods([food('rice')], [], [], []);
    expect(f.status).toBe('untried');
    expect(f.trials).toEqual([]);
    expect(f.latest).toBeUndefined();
  });

  test('records attach to their own trial, not to the food', () => {
    const [f] = connectFoods(
      [food('egg')],
      [trial('t1', 'egg', { outcome: 'safe', endedAt: D('2026-07-04T09:00:00Z') }), trial('t2', 'egg')],
      [reaction('r1', 't2', '2026-07-05T14:00:00Z')],
      [checkin('c1', 't1', '2026-07-02T11:00:00Z')],
    );
    const [first, second] = f.trials;
    expect(first.observations.map((c) => c.id)).toEqual(['c1']);
    expect(first.reactions).toEqual([]);
    expect(second.reactions.map((r) => r.id)).toEqual(['r1']);
    expect(second.observations).toEqual([]);
  });

  test('a record whose trial is gone is dropped, not attached to the wrong one', () => {
    const [f] = connectFoods(
      [food('egg')],
      [trial('t1', 'egg')],
      [reaction('r1', 'deleted-trial', '2026-07-05T14:00:00Z')],
      [checkin('c1', 'deleted-trial', '2026-07-02T11:00:00Z')],
    );
    expect(f.trials[0].reactions).toEqual([]);
    expect(f.trials[0].observations).toEqual([]);
  });

  // Everything downstream reads reactions[0] / checkins[i], so the order has to
  // be a property of this function, not of whatever order sqlite returned rows.
  test('records sort chronologically regardless of row order', () => {
    const [f] = connectFoods(
      [food('egg')],
      [trial('t1', 'egg')],
      [reaction('late', 't1', '2026-07-03T09:00:00Z'), reaction('early', 't1', '2026-07-02T09:00:00Z')],
      [checkin('c-late', 't1', '2026-07-03T20:00:00Z'), checkin('c-early', 't1', '2026-07-02T20:00:00Z')],
    );
    expect(f.trials[0].reactions.map((r) => r.id)).toEqual(['early', 'late']);
    expect(f.trials[0].observations.map((c) => c.id)).toEqual(['c-early', 'c-late']);
  });

  test('trials land on their own food, and status is derived from them', () => {
    const connected = connectFoods(
      [food('egg'), food('tofu')],
      [
        trial('t1', 'egg', { outcome: 'reacted', endedAt: D('2026-07-02T14:00:00Z') }),
        trial('t2', 'tofu'),
      ],
      [], [],
    );
    expect(connected.map((f) => [f.food.id, f.status])).toEqual([['egg', 'reacted'], ['tofu', 'testing']]);
    expect(connected[0].latest?.id).toBe('t1');
  });
});
