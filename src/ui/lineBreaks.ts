// iOS still breaks between a digit or closing quote and Hangul ("2" / "시간",
// "’" / "을") and can leave a lone last word ("주세요.") even with
// hangul-word. A word joiner and a no-break space close those gaps.
export function keepKoreanLinesTogether(text: string): string {
  return text.replace(/([\d’”)])(?=[가-힣])/g, '$1⁠').replace(/ (\S+\s*)$/, ' $1');
}
