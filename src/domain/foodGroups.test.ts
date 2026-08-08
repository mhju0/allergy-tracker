import { groupByFamily } from './foodGroups';
import type { FamilyId } from '../db/families';

type Row = { id: string; highRisk: boolean };
const row = (id: string, highRisk = false): Row => ({ id, highRisk });

// Korean labels for the families these tests touch. Real labels, so the
// ordering assertion is the ordering the app actually produces.
const LABELS: Partial<Record<FamilyId, string>> = {
  fish: '생선', egg: '알', grain: '곡물', citrus: '감귤', meat: '고기', bean: '콩',
};
const label = (f: FamilyId) => LABELS[f] ?? f;

const group = (items: Row[]) => groupByFamily(items, (r) => r.id, (r) => r.highRisk, label);

describe('groupByFamily', () => {
  it('puts each food under its family', () => {
    const { bands } = group([row('salmon'), row('egg'), row('cod')]);
    const fish = bands.find((b) => b.family === 'fish');
    expect(fish?.members.map((m) => m.id)).toEqual(['salmon', 'cod']);
    expect(bands.find((b) => b.family === 'egg')?.members.map((m) => m.id)).toEqual(['egg']);
  });

  it('orders bands 가나다순 by Korean label, not by insertion or family id', () => {
    // insertion order here is deliberately the reverse of the correct answer,
    // and the id order ('fish' < 'grain' < 'meat') disagrees with Korean too,
    // so passing by accident is not possible
    const { bands } = group([row('salmon'), row('beef'), row('rice'), row('tangerine')]);
    expect(bands.map((b) => label(b.family))).toEqual(['감귤', '고기', '곡물', '생선']);
  });

  it('preserves the caller sort inside a band', () => {
    const { bands } = group([row('cod'), row('anchovy'), row('salmon')]);
    expect(bands[0].members.map((m) => m.id)).toEqual(['cod', 'anchovy', 'salmon']);
  });

  it('flags a band as high-risk only when every member is', () => {
    // 생선 is wholly high-risk; 곡물 has one 밀 among many
    const allRisk = group([row('salmon', true), row('cod', true)]);
    expect(allRisk.bands[0].allHighRisk).toBe(true);

    const mixed = group([row('wheat', true), row('rice', false)]);
    expect(mixed.bands[0].allHighRisk).toBe(false);
  });

  it('does not flag a band high-risk just because one member is', () => {
    const { bands } = group([row('soy', true), row('tofu', true), row('pea', false)]);
    expect(bands[0].family).toBe('bean');
    expect(bands[0].allHighRisk).toBe(false);
  });

  it('an empty band cannot exist, so every() vacuous-truth cannot leak', () => {
    // every([]) === true would mark an empty band high-risk; bands are only
    // created from a member, so this asserts the invariant holds
    const { bands } = group([]);
    expect(bands).toEqual([]);
  });

  it('sends a food with no family to unfamiliar, not into a band', () => {
    // greenbean was cut from the catalog but can still sit in an older install
    const { bands, unfamiliar } = group([row('greenbean'), row('salmon')]);
    expect(unfamiliar.map((m) => m.id)).toEqual(['greenbean']);
    expect(bands).toHaveLength(1);
    expect(bands[0].family).toBe('fish');
  });

  it('never drops a food', () => {
    const items = [row('salmon'), row('greenbean'), row('rice'), row('egg')];
    const { bands, unfamiliar } = group(items);
    const seen = [...bands.flatMap((b) => b.members), ...unfamiliar].map((m) => m.id);
    expect(seen.sort()).toEqual(items.map((i) => i.id).sort());
  });
});
