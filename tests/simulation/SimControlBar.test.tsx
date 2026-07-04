import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent, cleanup } from '@testing-library/react';
import SimControlBar from '../../app/components/demos/SimControlBar';
import { RoomSocketProvider } from '../../app/contexts/RoomSocketContext';
import { SIM_TICK_MS } from '../../app/lib/simulation/types';

const mockSend = vi.hoisted(() => vi.fn());
vi.mock('partysocket/react', () => ({
  default: vi.fn((config: any) => {
    config.onOpen?.();
    return { send: mockSend, readyState: 1, close: vi.fn(), reconnect: vi.fn() };
  }),
}));

function renderBar() {
  return render(
    <RoomSocketProvider room="test" userId="sim-driver">
      <SimControlBar />
    </RoomSocketProvider>,
  );
}

function simBatches() {
  return mockSend.mock.calls.map((c: string[]) => JSON.parse(c[0])).filter((m: any) => m.type === 'simCursorBatch');
}

beforeEach(() => {
  mockSend.mockClear();
  vi.useFakeTimers();
  // SimControlBar probes program availability with fetch on mount; stub it so
  // no real network request hangs the test worker. Default: recording present.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('SimControlBar', () => {
  it('emits simCursorBatch messages of sim_ cursors after Play', () => {
    const { getByRole } = renderBar();
    act(() => { fireEvent.click(getByRole('button', { name: /play/i })); });
    act(() => { vi.advanceTimersByTime(SIM_TICK_MS * 3); });

    const batches = simBatches();
    expect(batches.length).toBeGreaterThan(0);
    expect(batches[0].cursors[0].position.userId).toMatch(/^sim_/);
  });

  it('drives the selected number of users', () => {
    const { getByRole, getByLabelText } = renderBar();
    fireEvent.change(getByLabelText('Users'), { target: { value: '50' } });
    act(() => { fireEvent.click(getByRole('button', { name: /play/i })); });
    act(() => { vi.advanceTimersByTime(SIM_TICK_MS); });

    expect(simBatches()[0].cursors).toHaveLength(50);
  });

  it('emits removes for all sim cursors on Stop', () => {
    const { getByRole } = renderBar();
    act(() => { fireEvent.click(getByRole('button', { name: /play/i })); });
    act(() => { vi.advanceTimersByTime(SIM_TICK_MS * 2); });
    mockSend.mockClear();

    act(() => { fireEvent.click(getByRole('button', { name: /stop/i })); });

    const removeBatch = simBatches().find((b: any) => b.cursors.every((c: any) => c.type === 'remove'));
    expect(removeBatch).toBeTruthy();
    expect(removeBatch.cursors.length).toBeGreaterThan(0);
  });

  it('locks program/user selects while running', () => {
    const { getByRole, getByLabelText } = renderBar();
    expect((getByLabelText('Program') as HTMLSelectElement).disabled).toBe(false);
    act(() => { fireEvent.click(getByRole('button', { name: /play/i })); });
    expect((getByLabelText('Program') as HTMLSelectElement).disabled).toBe(true);
    expect((getByLabelText('Users') as HTMLSelectElement).disabled).toBe(true);
  });

  it('disables a program whose availability probe fails', async () => {
    vi.useRealTimers(); // let findBy* poll for the async probe + state update
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    const { findByRole } = renderBar();
    const recorded = (await findByRole('option', { name: /recorded playback \(unavailable\)/i })) as HTMLOptionElement;
    expect(recorded.disabled).toBe(true);
  });
});
