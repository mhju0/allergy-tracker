// When the reaction form shows the 119 card: severe, any single red flag, or
// vomiting together with a skin sign (vomiting alone does not trigger it).
const RED_FLAGS = ['breathing', 'swelling', 'cough', 'floppy'];
const SKIN_SIGNS = ['hives', 'rash'];

export function showsEmergency(severity: string, symptoms: readonly string[]): boolean {
  return severity === 'severe'
    || symptoms.some((symptom) => RED_FLAGS.includes(symptom))
    || (symptoms.includes('vomiting') && symptoms.some((symptom) => SKIN_SIGNS.includes(symptom)));
}
