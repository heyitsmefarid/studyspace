import { describe, expect, it } from 'vitest';
import { SKY_LINKS, loginProgress, passwordProgress, signUpProgress } from './skyProgress';

describe('loginProgress', () => {
  it('starts dark', () => {
    expect(loginProgress('', '')).toBe(0);
  });
  it('lights one link for a plausible email', () => {
    expect(loginProgress('ana@uni.edu', '')).toBe(1);
    expect(loginProgress('not-an-email', '')).toBe(0);
  });
  it('lights the rest as the password is typed, completing at 8 characters', () => {
    expect(loginProgress('ana@uni.edu', 'a')).toBe(2);
    expect(loginProgress('ana@uni.edu', 'abcd')).toBe(3);
    expect(loginProgress('ana@uni.edu', 'abcdefgh')).toBe(SKY_LINKS);
  });
});

describe('passwordProgress', () => {
  it('needs 8 characters before anything lights', () => {
    expect(passwordProgress('short', 'short')).toBe(0);
  });
  it('lights a link for length, one for a bright password and one for a matching confirmation', () => {
    expect(passwordProgress('longenough', '')).toBe(1);
    expect(passwordProgress('Longenough1', '')).toBe(2);
    expect(passwordProgress('Longenough1', 'Longenough1')).toBe(3);
    expect(passwordProgress('longenough', 'longenough')).toBe(2);
  });
});

describe('signUpProgress', () => {
  it('completes the constellation when every field is ready', () => {
    expect(signUpProgress({ email: 'ana@uni.edu', password: 'Longenough1', confirm: 'Longenough1' })).toBe(SKY_LINKS);
  });
  it('leaves the email link dark until the address looks valid', () => {
    expect(signUpProgress({ email: 'ana', password: 'Longenough1', confirm: 'Longenough1' })).toBe(3);
  });
});
