// Food families — the grouping layer behind the 표본 재료 list (owner-approved
// 2026-08-07). Nineteen families cover all 120 catalog foods with no leftovers,
// which is the whole point: a family band always has a glyph, so no row ever
// renders a blank where an icon should be.
//
// This is presentation only. It is a static map beside CATALOG, NOT a column —
// there is no migration and no schema change, and a food's family has no
// bearing on status, trials or any domain rule.
//
// Families are ordered 가나다순 at render time, and so are the foods inside
// them. Ordering by weaning stage would be more useful and is deliberately NOT
// done: sequencing families is 권장 개월 wearing a different hat, and that is a
// locked won't-do.

export type FamilyId =
  | 'egg' | 'dairy' | 'grain' | 'bean' | 'nut' | 'fish' | 'shell' | 'meat'
  | 'root' | 'leaf' | 'fruitveg' | 'floret' | 'mushroom' | 'seaweed'
  | 'treefruit' | 'berry' | 'citrus' | 'tropical' | 'melon';

export const FAMILY_IDS: readonly FamilyId[] = [
  'egg', 'dairy', 'grain', 'bean', 'nut', 'fish', 'shell', 'meat', 'root',
  'leaf', 'fruitveg', 'floret', 'mushroom', 'seaweed', 'treefruit', 'berry',
  'citrus', 'tropical', 'melon',
] as const;

// Every id here exists in CATALOG, and every CATALOG id appears here —
// families.test.ts asserts both directions, so a food added without a family
// fails the build rather than shipping an unglyphed band.
export const FOOD_FAMILY: Record<string, FamilyId> = {
  // 알
  egg: 'egg', eggyolk: 'egg', eggwhite: 'egg', quailegg: 'egg',
  // 유제품
  milk: 'dairy', yogurt: 'dairy', cheese: 'dairy', butter: 'dairy',
  // 곡물
  wheat: 'grain', rice: 'grain', oat: 'grain', barley: 'grain', corn: 'grain',
  buckwheat: 'grain', brownrice: 'grain', blackrice: 'grain', quinoa: 'grain',
  stickymillet: 'grain', millet: 'grain', sorghum: 'grain',
  // 콩
  soy: 'bean', tofu: 'bean', pea: 'bean', beansprout: 'bean',
  blacksoybean: 'bean', kidneybean: 'bean', lentil: 'bean', chickpea: 'bean',
  redbean: 'bean',
  // 견과·씨
  peanut: 'nut', sesame: 'nut', almond: 'nut', walnut: 'nut', cashew: 'nut',
  pinenut: 'nut', pistachio: 'nut', pecan: 'nut', hazelnut: 'nut',
  macadamia: 'nut', chestnut: 'nut', perilla: 'nut',
  // 생선
  salmon: 'fish', mackerel: 'fish', cod: 'fish', pollock: 'fish',
  spanishmackerel: 'fish', flounder: 'fish', halibut: 'fish', croaker: 'fish',
  seabream: 'fish', hairtail: 'fish', anchovy: 'fish',
  // 조개·연체
  shrimp: 'shell', crab: 'shell', squid: 'shell', octopus: 'shell',
  smalloctopus: 'shell', abalone: 'shell', oyster: 'shell', manilaclam: 'shell',
  // 고기
  beef: 'meat', chicken: 'meat', pork: 'meat', duck: 'meat',
  // 뿌리채소
  sweetpotato: 'root', potato: 'root', carrot: 'root', radish: 'root',
  burdock: 'root', lotusroot: 'root', beet: 'root',
  // 잎채소 — alliums live here with 부추 rather than under 뿌리채소
  cabbage: 'leaf', spinach: 'leaf', napacabbage: 'leaf', bokchoy: 'leaf',
  redcabbage: 'leaf', kale: 'leaf', chard: 'leaf', curledmallow: 'leaf',
  celery: 'leaf', waterparsley: 'leaf', chive: 'leaf', onion: 'leaf',
  // 열매채소
  zucchini: 'fruitveg', cucumber: 'fruitveg', tomato: 'fruitveg',
  eggplant: 'fruitveg', bellpepper: 'fruitveg', pumpkin: 'fruitveg',
  ripepumpkin: 'fruitveg',
  // 꽃채소
  broccoli: 'floret', cauliflower: 'floret',
  // 버섯
  shiitake: 'mushroom', enoki: 'mushroom', oystermushroom: 'mushroom',
  buttonmushroom: 'mushroom', kingoystermushroom: 'mushroom',
  // 해조
  seaweed: 'seaweed', laver: 'seaweed', greenlaver: 'seaweed',
  // 나무열매
  apple: 'treefruit', pear: 'treefruit', peach: 'treefruit', plum: 'treefruit',
  grape: 'treefruit', persimmon: 'treefruit', apricot: 'treefruit',
  jujube: 'treefruit',
  // 베리
  blueberry: 'berry', strawberry: 'berry', cherry: 'berry',
  // 감귤
  tangerine: 'citrus', orange: 'citrus',
  // 남국과일
  banana: 'tropical', avocado: 'tropical', mango: 'tropical',
  pineapple: 'tropical', kiwi: 'tropical',
  // 박과과일
  watermelon: 'melon', melon: 'melon',
};

// A food from an older build that is no longer in CATALOG still has to render
// somewhere, so this never throws — it falls back to the family band the row
// would otherwise be missing. Callers group by the returned id.
export function familyOf(foodId: string): FamilyId | null {
  return FOOD_FAMILY[foodId] ?? null;
}
