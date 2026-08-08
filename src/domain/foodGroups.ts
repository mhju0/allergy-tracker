import { familyOf, type FamilyId } from '../db/families';

// The 안 먹어봄 grouping, kept pure so it can be tested without rendering a
// list. The UI decides how a band LOOKS; this decides what the bands ARE.

export type FamilyBand<T> = {
  family: FamilyId;
  members: T[];
  // True when every member of this band is high-risk, which is what lets the
  // badge move onto the band and out of the rows. Computed over the members
  // actually shown, not the family in the abstract: if nine of eleven fish are
  // already tried, a band of two still tells the truth about those two.
  allHighRisk: boolean;
};

export function groupByFamily<T>(
  items: T[],
  idOf: (item: T) => string,
  highRiskOf: (item: T) => boolean,
  familyLabel: (family: FamilyId) => string,
): { bands: FamilyBand<T>[]; unfamiliar: T[] } {
  const byFamily = new Map<FamilyId, T[]>();
  const unfamiliar: T[] = [];

  for (const item of items) {
    const family = familyOf(idOf(item));
    if (!family) {
      unfamiliar.push(item);
      continue;
    }
    const bucket = byFamily.get(family);
    if (bucket) bucket.push(item);
    else byFamily.set(family, [item]);
  }

  // 가나다순 between bands, by the family's Korean label — the same principle
  // the rows inside already follow. Members keep the order they arrived in,
  // which is the caller's sort, so this never reorders within a band.
  const bands = [...byFamily.keys()]
    .sort((a, b) => familyLabel(a).localeCompare(familyLabel(b)))
    .map((family) => {
      const members = byFamily.get(family) ?? [];
      return { family, members, allHighRisk: members.every(highRiskOf) };
    });

  return { bands, unfamiliar };
}
