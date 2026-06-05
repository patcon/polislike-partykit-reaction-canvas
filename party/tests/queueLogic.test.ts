import { describe, it, expect } from 'vitest';
import {
  getCurrentActiveStatementId,
  computeNextDisplayTimestamp,
  computeClearedQueue,
  type QueueItem,
} from '../lib/queueLogic';

const NOW = 1_000_000;

describe('getCurrentActiveStatementId', () => {
  it('returns 1 when queue is empty', () => {
    expect(getCurrentActiveStatementId([], NOW)).toBe(1);
  });

  it('returns the most recent past statement', () => {
    const items: QueueItem[] = [
      { statementId: 3, displayTimestamp: NOW - 5000 },
      { statementId: 7, displayTimestamp: NOW - 1000 },
      { statementId: 9, displayTimestamp: NOW + 5000 },
    ];
    expect(getCurrentActiveStatementId(items, NOW)).toBe(7);
  });

  it('ignores future statements', () => {
    const items: QueueItem[] = [
      { statementId: 5, displayTimestamp: NOW + 1000 },
    ];
    expect(getCurrentActiveStatementId(items, NOW)).toBe(1);
  });

  it('returns statement with exactly now timestamp', () => {
    const items: QueueItem[] = [
      { statementId: 4, displayTimestamp: NOW },
    ];
    expect(getCurrentActiveStatementId(items, NOW)).toBe(4);
  });
});

describe('computeNextDisplayTimestamp', () => {
  it('schedules 10s after latest queued item', () => {
    const items: QueueItem[] = [
      { statementId: 1, displayTimestamp: NOW },
      { statementId: 2, displayTimestamp: NOW + 10_000 },
    ];
    expect(computeNextDisplayTimestamp(items, NOW)).toBe(NOW + 20_000);
  });

  it('schedules 10s from now when queue is empty', () => {
    expect(computeNextDisplayTimestamp([], NOW)).toBe(NOW + 10_000);
  });
});

describe('computeClearedQueue', () => {
  it('returns empty array when nothing has been displayed yet', () => {
    const items: QueueItem[] = [
      { statementId: 1, displayTimestamp: NOW + 5000 },
    ];
    expect(computeClearedQueue(items, NOW)).toEqual([]);
  });

  it('keeps only the most recent past statement', () => {
    const items: QueueItem[] = [
      { statementId: 3, displayTimestamp: NOW - 20_000 },
      { statementId: 5, displayTimestamp: NOW - 5000 },
      { statementId: 7, displayTimestamp: NOW + 5000 },
    ];
    expect(computeClearedQueue(items, NOW)).toEqual([
      { statementId: 5, displayTimestamp: NOW - 5000 },
    ]);
  });

  it('drops all future statements', () => {
    const items: QueueItem[] = [
      { statementId: 2, displayTimestamp: NOW - 1000 },
      { statementId: 4, displayTimestamp: NOW + 1000 },
      { statementId: 6, displayTimestamp: NOW + 2000 },
    ];
    const result = computeClearedQueue(items, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].statementId).toBe(2);
  });
});
