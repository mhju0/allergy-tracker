import { keepKoreanLinesTogether } from './lineBreaks';

const NBSP = ' ';
const WJ = '⁠';

describe('keepKoreanLinesTogether', () => {
  test('joins the last two words so the final line never holds one word', () => {
    expect(keepKoreanLinesTogether('부드럽게 으깨거나 갈아 주세요.')).toBe(`부드럽게 으깨거나 갈아${NBSP}주세요.`);
  });

  test('keeps a number attached to the Hangul unit after it', () => {
    expect(keepKoreanLinesTogether('먹은 뒤 2시간 안에')).toBe(`먹은 뒤 2${WJ}시간${NBSP}안에`);
  });

  test('keeps a closing quote attached to the particle after it', () => {
    expect(keepKoreanLinesTogether('‘이상 없음’을 눌러요')).toBe(`‘이상 없음’${WJ}을${NBSP}눌러요`);
  });

  test('leaves a single word unchanged', () => {
    expect(keepKoreanLinesTogether('설정')).toBe('설정');
  });

  test('ignores trailing whitespace when finding the last word', () => {
    expect(keepKoreanLinesTogether('다시 시도해 주세요. ')).toBe(`다시 시도해${NBSP}주세요. `);
  });
});
