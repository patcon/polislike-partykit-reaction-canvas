import { describe, it, expect, vi } from 'vitest';
import { createSocketSink } from '../../app/lib/simulation/sinks/socketSink';
import type { CursorEvent } from '../../app/lib/simulation/types';

describe('createSocketSink', () => {
  it('sends a simCursorBatch message wrapping the events', () => {
    const send = vi.fn();
    const sink = createSocketSink(send);
    const events: CursorEvent[] = [
      { type: 'move', position: { x: 10, y: 20, timestamp: 1, userId: 'sim_0' } },
      { type: 'remove', position: { x: 0, y: 0, timestamp: 2, userId: 'sim_1' } },
    ];

    sink.emit(events);

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][0])).toEqual({ type: 'simCursorBatch', cursors: events });
  });

  it('does not send on an empty batch', () => {
    const send = vi.fn();
    createSocketSink(send).emit([]);
    expect(send).not.toHaveBeenCalled();
  });
});
