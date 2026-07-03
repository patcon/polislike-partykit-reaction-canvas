import React from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- partysocket/react mock (captures the provider's onMessage) ---
let _onMessage: ((evt: MessageEvent) => void) | null = null;

vi.mock('partysocket/react', () => ({
  default: ({ onMessage }: { onMessage: (evt: MessageEvent) => void }) => {
    _onMessage = onMessage;
    return { send: vi.fn(), close: vi.fn(), reconnect: vi.fn(), readyState: 1 };
  },
}));

vi.mock('../app/utils/partyHost', () => ({
  getPartySocketConfig: () => ({ host: 'localhost:1999' }),
}));

import { useValenceStream, type ValenceMode } from '../app/hooks/useValenceStream';
import { RoomSocketProvider } from '../app/contexts/RoomSocketContext';
import { CURSOR_STALE_MS } from '../app/utils/cursor';

function emit(data: object) {
  act(() => {
    _onMessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  });
}

function renderStream(mode: ValenceMode, opts: { includeSelf?: boolean } = {}) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <RoomSocketProvider room="test-room" userId="me">
      {children}
    </RoomSocketProvider>
  );
  return renderHook(() => useValenceStream('me', { mode, ...opts }), { wrapper });
}

describe('useValenceStream', () => {
  beforeEach(() => { _onMessage = null; });
  afterEach(() => cleanup());

  it('continuous mode: projects cursors to −1..1 via computeCursorValence', () => {
    const { result } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'pos', x: 95, y: 5 } });   // positive anchor
    emit({ type: 'move', position: { userId: 'neg', x: 5, y: 95 } });   // negative anchor
    const v = result.current.getValences();
    expect(v.get('pos')).toBeCloseTo(1, 5);
    expect(v.get('neg')).toBeCloseTo(-1, 5);
  });

  it('unit mode: snaps to {−1, 0, +1} via the argmax region', () => {
    const { result } = renderStream('unit');
    emit({ type: 'move', position: { userId: 'pos', x: 95, y: 5 } });
    emit({ type: 'move', position: { userId: 'neu', x: 95, y: 95 } });
    emit({ type: 'move', position: { userId: 'neg', x: 5, y: 95 } });
    const v = result.current.getValences();
    expect(v.get('pos')).toBe(1);
    expect(v.get('neu')).toBe(0);
    expect(v.get('neg')).toBe(-1);
  });

  // The correctness trap: at (59, 54.5) the continuous valence is ≈ +0.05
  // (nearly neutral) but the argmax region is 'positive'. Unit mode must follow
  // the region, not a quantization of the continuous value.
  it('unit and continuous modes diverge at a boundary', () => {
    const boundary = { userId: 'b', x: 59, y: 54.5 };
    const { result: cont } = renderStream('continuous');
    emit({ type: 'move', position: boundary });
    expect(cont.current.getValences().get('b')).toBeCloseTo(0.05, 2);

    cleanup();
    _onMessage = null;
    const { result: unit } = renderStream('unit');
    emit({ type: 'move', position: boundary });
    expect(unit.current.getValences().get('b')).toBe(1);
  });

  it('drops a cursor on remove', () => {
    const { result } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'u1', x: 95, y: 5 } });
    expect(result.current.getValences().has('u1')).toBe(true);
    emit({ type: 'remove', position: { userId: 'u1', x: 95, y: 5 } });
    expect(result.current.getValences().has('u1')).toBe(false);
  });

  // Compute-on-read is what makes this pass: useCoordStream prunes positionsRef
  // via a CURSOR_STALE_MS timeout WITHOUT emitting any socket message, so a cache
  // rebuilt only on messages would keep the stale entry. getValences reads
  // positionsRef live, so the timed-out cursor is gone on the next read.
  it('drops a cursor that expires silently (no remove message)', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderStream('continuous');
      emit({ type: 'move', position: { userId: 'u1', x: 95, y: 5 } });
      expect(result.current.getValences().has('u1')).toBe(true);

      act(() => { vi.advanceTimersByTime(CURSOR_STALE_MS + 1); });
      expect(result.current.getValences().has('u1')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('excludes self by default, includes it when includeSelf is set', () => {
    const { result: excluded } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'me', x: 95, y: 5 } });
    expect(excluded.current.getValences().has('me')).toBe(false);

    cleanup();
    _onMessage = null;
    const { result: included } = renderStream('continuous', { includeSelf: true });
    emit({ type: 'move', position: { userId: 'me', x: 95, y: 5 } });
    expect(included.current.getValences().get('me')).toBeCloseTo(1, 5);
  });

  it('projects under the current mode when it flips at runtime (no new move)', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RoomSocketProvider room="test-room" userId="me">
        {children}
      </RoomSocketProvider>
    );
    const { result, rerender } = renderHook(
      ({ mode }: { mode: ValenceMode }) => useValenceStream('me', { mode }),
      { wrapper, initialProps: { mode: 'continuous' as ValenceMode } },
    );
    emit({ type: 'move', position: { userId: 'b', x: 59, y: 54.5 } });
    expect(result.current.getValences().get('b')).toBeCloseTo(0.05, 2);

    rerender({ mode: 'unit' });
    expect(result.current.getValences().get('b')).toBe(1);
  });

  it('projects against updated anchors (no new move needed)', () => {
    const { result } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'u1', x: 95, y: 5 } });
    expect(result.current.getValences().get('u1')).toBeCloseTo(1, 5);

    // Swap positive/negative anchors — the same point now reads as negative,
    // and it must update without another cursor message.
    emit({
      type: 'roomAnchorsChanged',
      anchors: {
        positive: { x: 5, y: 95 },
        negative: { x: 95, y: 5 },
        neutral: { x: 95, y: 95 },
      },
    });
    expect(result.current.getValences().get('u1')).toBeCloseTo(-1, 5);
  });
});
