import { describe, it, expect } from 'vitest';
import {
  FLASH_TIMER_DEFAULT_SEC,
  normalizeFlashDuration,
  buildFlashTimerStart,
  buildFlashTimerStarted,
  flashSecondsRemaining,
} from '../app/utils/flashTimer';

describe('normalizeFlashDuration', () => {
  it('passes through a valid positive duration', () => {
    expect(normalizeFlashDuration(8)).toBe(8);
  });

  it('floors fractional seconds to whole seconds', () => {
    expect(normalizeFlashDuration(5.9)).toBe(5);
  });

  it('falls back to the default for non-positive or non-numeric input', () => {
    expect(normalizeFlashDuration(0)).toBe(FLASH_TIMER_DEFAULT_SEC);
    expect(normalizeFlashDuration(-3)).toBe(FLASH_TIMER_DEFAULT_SEC);
    expect(normalizeFlashDuration(NaN)).toBe(FLASH_TIMER_DEFAULT_SEC);
    expect(normalizeFlashDuration(undefined as unknown as number)).toBe(FLASH_TIMER_DEFAULT_SEC);
  });
});

describe('buildFlashTimerStart', () => {
  it('builds a startFlashTimer message with an absolute endTimestamp', () => {
    const msg = buildFlashTimerStart(5, 'Round 1', 1_000_000);
    expect(msg).toEqual({
      type: 'startFlashTimer',
      endTimestamp: 1_005_000,
      label: 'Round 1',
    });
  });

  it('normalizes the duration before computing endTimestamp', () => {
    const msg = buildFlashTimerStart(0, '', 1_000_000);
    expect(msg.endTimestamp).toBe(1_000_000 + FLASH_TIMER_DEFAULT_SEC * 1000);
  });

  it('trims the label', () => {
    expect(buildFlashTimerStart(5, '  hi  ', 0).label).toBe('hi');
  });
});

describe('buildFlashTimerStarted', () => {
  it('echoes endTimestamp and label into a flashTimerStarted broadcast', () => {
    expect(buildFlashTimerStarted(1_005_000, 'Round 1')).toEqual({
      type: 'flashTimerStarted',
      endTimestamp: 1_005_000,
      label: 'Round 1',
    });
  });
});

describe('flashSecondsRemaining', () => {
  it('rounds up partial seconds so the displayed count covers the full remaining time', () => {
    expect(flashSecondsRemaining(1_004_200, 1_000_000)).toBe(5); // 4.2s left → show 5
    expect(flashSecondsRemaining(1_005_000, 1_000_000)).toBe(5); // exactly 5s left
  });

  it('clamps to zero once the deadline has passed', () => {
    expect(flashSecondsRemaining(1_000_000, 1_000_000)).toBe(0);
    expect(flashSecondsRemaining(1_000_000, 1_009_000)).toBe(0);
  });
});
