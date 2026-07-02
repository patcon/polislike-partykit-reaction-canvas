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
    const v = result.current.valencesRef.current;
    expect(v.get('pos')).toBeCloseTo(1, 5);
    expect(v.get('neg')).toBeCloseTo(-1, 5);
  });

  it('unit mode: snaps to {−1, 0, +1} via the argmax region', () => {
    const { result } = renderStream('unit');
    emit({ type: 'move', position: { userId: 'pos', x: 95, y: 5 } });
    emit({ type: 'move', position: { userId: 'neu', x: 95, y: 95 } });
    emit({ type: 'move', position: { userId: 'neg', x: 5, y: 95 } });
    const v = result.current.valencesRef.current;
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
    expect(cont.current.valencesRef.current.get('b')).toBeCloseTo(0.05, 2);

    cleanup();
    _onMessage = null;
    const { result: unit } = renderStream('unit');
    emit({ type: 'move', position: boundary });
    expect(unit.current.valencesRef.current.get('b')).toBe(1);
  });

  it('drops a cursor on remove', () => {
    const { result } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'u1', x: 95, y: 5 } });
    expect(result.current.valencesRef.current.has('u1')).toBe(true);
    emit({ type: 'remove', position: { userId: 'u1', x: 95, y: 5 } });
    expect(result.current.valencesRef.current.has('u1')).toBe(false);
  });

  it('excludes self by default, includes it when includeSelf is set', () => {
    const { result: excluded } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'me', x: 95, y: 5 } });
    expect(excluded.current.valencesRef.current.has('me')).toBe(false);

    cleanup();
    _onMessage = null;
    const { result: included } = renderStream('continuous', { includeSelf: true });
    emit({ type: 'move', position: { userId: 'me', x: 95, y: 5 } });
    expect(included.current.valencesRef.current.get('me')).toBeCloseTo(1, 5);
  });

  it('recomputes existing valences when anchors change (no new move needed)', () => {
    const { result } = renderStream('continuous');
    emit({ type: 'move', position: { userId: 'u1', x: 95, y: 5 } });
    expect(result.current.valencesRef.current.get('u1')).toBeCloseTo(1, 5);

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
    expect(result.current.valencesRef.current.get('u1')).toBeCloseTo(-1, 5);
  });
});
