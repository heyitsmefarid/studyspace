import { describe, expect, it } from 'vitest';
import { validateSignUp } from './signUpForm';

describe('validateSignUp', () => {
  it('accepts a valid email and matching 8+ character passwords', () => {
    expect(validateSignUp({ email: ' Me@Example.com ', password: 'stars123', confirm: 'stars123' }))
      .toEqual({ ok: true, value: { email: 'me@example.com', password: 'stars123' } });
  });
  it('reports each problem on its field', () => {
    expect(validateSignUp({ email: 'nope', password: 'short', confirm: 'different' })).toEqual({
      ok: false,
      errors: { email: 'Enter a valid email address.', password: 'Use at least 8 characters.', confirm: "Those passwords don't match." },
    });
  });
});
