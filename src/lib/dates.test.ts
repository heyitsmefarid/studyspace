import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, greetingFor } from './dates';

describe('dates', () => {
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(25 * 60)).toBe('25m');
    expect(formatDuration(3900)).toBe('1h 05m');
    expect(formatDuration(-5)).toBe('0s');
  });
  it('formats clocks', () => {
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(3_661_000)).toBe('1:01:01');
    expect(formatClock(-1)).toBe('00:00');
  });
  it('greets by local hour', () => {
    expect(greetingFor(new Date(2026, 9, 6, 8))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 9, 6, 14))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 9, 6, 20))).toBe('Good evening');
    expect(greetingFor(new Date(2026, 9, 6, 2))).toBe('Up late');
  });
});
