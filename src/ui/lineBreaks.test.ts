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
    expect(keepKoreanLinesTogether('‘이상 없음’을 눌러요')).toBe(`‘이상${NBSP}없음’${WJ}을${NBSP}눌러요`);
  });

  test('keeps a quoted phrase on one line', () => {
    expect(keepKoreanLinesTogether('아직 없어요. “새 재료 시작하기”를 눌러 보세요.'))
      .toBe(`아직 없어요. “새${NBSP}재료${NBSP}시작하기”${WJ}를 눌러${NBSP}보세요.`);
  });

  test('keeps "만들 수 있어요" together so the line never ends at "만들"', () => {
    expect(keepKoreanLinesTogether('리포트도 만들 수 있어요.')).toBe(`리포트도 만들${NBSP}수${NBSP}있어요.`);
    expect(keepKoreanLinesTogether('표시할 수 없어요. 다시 해 주세요.'))
      .toBe(`표시할${NBSP}수${NBSP}없어요. 다시 해${NBSP}주세요.`);
  });

  test('leaves a single word unchanged', () => {
    expect(keepKoreanLinesTogether('설정')).toBe('설정');
  });

  test('ignores trailing whitespace when finding the last word', () => {
    expect(keepKoreanLinesTogether('다시 시도해 주세요. ')).toBe(`다시 시도해${NBSP}주세요. `);
  });
});
