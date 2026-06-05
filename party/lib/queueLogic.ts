export interface QueueItem {
  statementId: number;
  displayTimestamp: number;
}

export function getCurrentActiveStatementId(items: QueueItem[], now: number): number {
  const displayed = items
    .filter(item => item.displayTimestamp <= now)
    .sort((a, b) => b.displayTimestamp - a.displayTimestamp);
  return displayed.length > 0 ? displayed[0].statementId : 1;
}

export function computeNextDisplayTimestamp(items: QueueItem[], now: number): number {
  const currentActive = getCurrentActiveStatementId(items, now);
  if (currentActive === -1) return now;
  if (items.length === 0) return now + 10_000;
  const latest = items.reduce((a, b) => a.displayTimestamp > b.displayTimestamp ? a : b);
  return latest.displayTimestamp + 10_000;
}

export function computeClearedQueue(items: QueueItem[], now: number): QueueItem[] {
  const past = items
    .filter(item => item.displayTimestamp <= now)
    .sort((a, b) => b.displayTimestamp - a.displayTimestamp);
  return past.length > 0 ? [past[0]] : [];
}
