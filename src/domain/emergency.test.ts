import { showsEmergency } from './emergency';

describe('showsEmergency', () => {
  test.each(['breathing', 'swelling', 'cough', 'floppy'])('%s alone, even mild, shows the 119 card', (symptom) => {
    expect(showsEmergency('mild', [symptom])).toBe(true);
  });

  test('severe alone shows the 119 card', () => {
    expect(showsEmergency('severe', [])).toBe(true);
  });

  test('vomiting alone does not', () => {
    expect(showsEmergency('mild', ['vomiting'])).toBe(false);
  });

  test('vomiting with hives does', () => {
    expect(showsEmergency('mild', ['vomiting', 'hives'])).toBe(true);
  });

  test('vomiting with rash does', () => {
    expect(showsEmergency('moderate', ['vomiting', 'rash'])).toBe(true);
  });

  test('mild hives alone does not', () => {
    expect(showsEmergency('mild', ['hives'])).toBe(false);
  });

  test('diarrhea alone does not', () => {
    expect(showsEmergency('mild', ['diarrhea'])).toBe(false);
  });
});
