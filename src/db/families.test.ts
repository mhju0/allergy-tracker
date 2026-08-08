import { CATALOG } from './catalog';
import { FAMILY_IDS, FOOD_FAMILY, familyOf, type FamilyId } from './families';

// The coverage guarantee the 재료 list leans on. The list draws a glyph on
// every family band; if a catalog food had no family it would either vanish
// from the grouped section or render an unlabelled band. Both directions are
// asserted so the failure is a red test, not a blank icon on someone's phone.
describe('food families', () => {
  it('covers every catalog food', () => {
    const missing = CATALOG.filter((f) => !FOOD_FAMILY[f.id]).map((f) => f.id);
    expect(missing).toEqual([]);
  });

  it('has no family entry for a food that is not in the catalog', () => {
    const ids = new Set(CATALOG.map((f) => f.id));
    const orphans = Object.keys(FOOD_FAMILY).filter((id) => !ids.has(id));
    expect(orphans).toEqual([]);
  });

  it('uses only declared family ids', () => {
    const declared = new Set<string>(FAMILY_IDS);
    const unknown = [...new Set(Object.values(FOOD_FAMILY))].filter((f) => !declared.has(f));
    expect(unknown).toEqual([]);
  });

  it('every declared family actually has members — no empty bands', () => {
    const used = new Set<FamilyId>(Object.values(FOOD_FAMILY));
    expect(FAMILY_IDS.filter((f) => !used.has(f))).toEqual([]);
  });

  it('falls back to null for a food from an older build', () => {
    // greenbean was cut from the catalog but can still sit in an install's DB
    expect(familyOf('greenbean')).toBeNull();
    expect(familyOf('tofu')).toBe('bean');
  });
});
