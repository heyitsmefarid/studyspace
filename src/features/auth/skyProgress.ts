import { passwordStrength } from './passwordStrength';
import { isEmail, type SignUpInput } from './signUpForm';

/** Links in the auth constellation between "you" and "your person". Each one lights as the form fills in. */
export const SKY_LINKS = 4;

/** Log-in: a plausible email lights one link; the password lights the rest, completing at 8 characters. */
export function loginProgress(email: string, password: string): number {
  const pw = password.length;
  return (isEmail(email) ? 1 : 0) + (pw >= 1 ? 1 : 0) + (pw >= 4 ? 1 : 0) + (pw >= 8 ? 1 : 0);
}

/** New password (sign-up, set-password): one link each for 8+ characters, a Bright password and a matching confirmation. */
export function passwordProgress(password: string, confirm: string): number {
  if (password.length < 8) return 0;
  return 1 + (passwordStrength(password) >= 3 ? 1 : 0) + (confirm === password ? 1 : 0);
}

export function signUpProgress({ email, password, confirm }: SignUpInput): number {
  return (isEmail(email) ? 1 : 0) + passwordProgress(password, confirm);
}
