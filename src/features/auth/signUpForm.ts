export interface SignUpInput { email: string; password: string; confirm: string }

export function validateSignUp(i: SignUpInput):
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; errors: Partial<Record<keyof SignUpInput, string>> } {
  const email = i.email.trim().toLowerCase();
  const errors: Partial<Record<keyof SignUpInput, string>> = {};
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (i.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (i.password !== i.confirm) errors.confirm = "Those passwords don't match.";
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { email, password: i.password } };
}
