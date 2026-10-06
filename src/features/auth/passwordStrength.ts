export const STRENGTH_LABELS = ['', 'Faint', 'Dim', 'Bright', 'Brilliant', 'Supernova'] as const;

/** 0–5 stars. Under 8 characters scores 0 (sign-up requires 8). */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 | 5 {
  if (pw.length < 8) return 0;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(5, s) as 0 | 1 | 2 | 3 | 4 | 5;
}
