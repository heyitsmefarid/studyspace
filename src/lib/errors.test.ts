import { describe, expect, it } from 'vitest';
import { AppError, assertOk, friendlyMessage, unwrap, unwrapMaybe } from './errors';

describe('friendlyMessage', () => {
  it.each([
    [{ code: '23505', message: 'duplicate key' }, 'That already exists.'],
    [{ code: '42501', message: 'new row violates row-level security policy' }, "You don't have permission to do that."],
    [{ code: '23514', message: 'violates check constraint' }, 'Some of that input is too long or not allowed.'],
    [{ code: 'PGRST116', message: 'no rows' }, 'Not found.'],
    [new TypeError('Failed to fetch'), "Can't reach StudySpace — check your connection."],
    [{ message: 'Invalid login credentials' }, 'Wrong email or password.'],
    [{ message: 'StudySpace is private — this email is not on the guest list.' }, 'StudySpace is private — this email is not on the guest list.'],
    [42, 'Something went wrong. Please try again.'],
  ])('maps %o', (input, expected) => {
    expect(friendlyMessage(input)).toBe(expected);
  });
});

describe('unwrap helpers', () => {
  it('returns data or throws AppError with a friendly message', () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
    expect(() => unwrap({ data: null, error: { code: '23505', message: 'dup' } })).toThrowError('That already exists.');
    expect(() => unwrap({ data: null, error: { code: '23505', message: 'dup' } })).toThrow(AppError);
    expect(() => unwrap({ data: null, error: null })).toThrowError('Not found.');
  });
  it('unwrapMaybe allows null data', () => {
    expect(unwrapMaybe({ data: null, error: null })).toBeNull();
  });
  it('assertOk only checks the error', () => {
    expect(() => assertOk({ error: null })).not.toThrow();
    expect(() => assertOk({ error: { message: 'x', code: '42501' } })).toThrow("You don't have permission to do that.");
  });
});
