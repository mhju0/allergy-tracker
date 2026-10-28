// iOS still breaks between a digit or closing quote and Hangul ("2" / "시간",
// "’" / "을"), inside a quoted label ("“새 재료" / "시작하기”"), and can leave a
// lone last word ("주세요.") even with hangul-word. Word joiners and no-break
// spaces close those gaps.
export function keepKoreanLinesTogether(text: string): string {
  return text
    .replace(/[‘“][^’”]*[’”]/g, (quote) => quote.replace(/ /g, ' '))
    .replace(/([\d’”)])(?=[가-힣])/g, '$1⁠')
    .replace(/ (\S+\s*)$/, ' $1');
}

