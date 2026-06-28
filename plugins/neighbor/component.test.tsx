import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- partysocket/react mock ---
let _onMessage: ((evt: MessageEvent) => void) | null = null;

vi.mock('partysocket/react', () => ({
  default: ({ room: _room, onMessage }: { room: string; onMessage: (evt: MessageEvent) => void }) => {
    _onMessage = onMessage;
    return { send: vi.fn(), close: vi.fn(), reconnect: vi.fn(), readyState: 1 };
  },
}));

vi.mock('../../app/utils/partyHost', () => ({
  getPartySocketConfig: () => ({ host: 'localhost:1999' }),
}));

vi.mock('../../app/utils/userId', () => ({
  generateUUID: () => 'test-user-id',
  getPersistentUserId: () => 'test-user-id',
}));

function triggerMessage(data: object) {
  act(() => {
    _onMessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  });
}

import NeighborPanel from './component';
import { PanelContextProvider } from '../../app/context/PanelContext';
import { RoomSocketProvider } from '../../app/contexts/RoomSocketContext';

function renderPanel(props: { initialView?: 'entry' | 'graph' } = {}) {
  return render(
    <PanelContextProvider value={{ room: 'test-room', userId: 'test-user', inviteEdges: {} }}>
      <RoomSocketProvider room="test-room" userId="test-user">
        <NeighborPanel {...props} />
      </RoomSocketProvider>
    </PanelContextProvider>
  );
}

describe('NeighborPanel – entry view', () => {
  beforeEach(() => { _onMessage = null; });
  afterEach(() => cleanup());

  it('renders code placeholder before any server message', () => {
    renderPanel();
    // Two '····' in the component: one for myCode display, one for digit entry
    const placeholders = screen.getAllByText('····');
    expect(placeholders).toHaveLength(2);
    expect(screen.getByText('Your code')).toBeInTheDocument();
    expect(screen.getByText("Enter a neighbour's code")).toBeInTheDocument();
  });

  it('shows code after neighborCode message', () => {
    renderPanel();
    triggerMessage({ type: 'neighborCode', code: '4827' });
    // Code display replaces '····' with actual code
    expect(screen.getByText('4827')).toBeInTheDocument();
  });

  it('partial digit entry shows dots for unfilled positions', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('12··')).toBeInTheDocument();
  });

  it('4 digits auto-submits and shows "Got it!"', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByText('Got it!')).toBeInTheDocument();
  });

  it('neighborEdgeError "self" shows correct message', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '0' }));
    await user.click(screen.getByRole('button', { name: '1' }));
    triggerMessage({ type: 'neighborEdgeError', reason: 'self' });
    expect(screen.getByText("That's your own code")).toBeInTheDocument();
  });

  it('neighborEdgeError "not_found" shows correct message', () => {
    renderPanel();
    triggerMessage({ type: 'neighborEdgeError', reason: 'not_found' });
    expect(screen.getByText('Code not found — try again')).toBeInTheDocument();
  });

  it('neighborEdgeError "duplicate" shows correct message', () => {
    renderPanel();
    triggerMessage({ type: 'neighborEdgeError', reason: 'duplicate' });
    expect(screen.getByText('Already connected')).toBeInTheDocument();
  });

  it('error overrides optimistic success state', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    await user.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByText('Got it!')).toBeInTheDocument();
    triggerMessage({ type: 'neighborEdgeError', reason: 'duplicate' });
    expect(screen.queryByText('Got it!')).not.toBeInTheDocument();
    expect(screen.getByText('Already connected')).toBeInTheDocument();
  });

  it('backspace key removes last digit', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '←' }));
    expect(screen.getByText('1···')).toBeInTheDocument();
  });

  it('✕ key clears all digits', async () => {
    renderPanel();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '✕' }));
    // Both '····' placeholders back (myCode still null, digits empty)
    expect(screen.getAllByText('····')).toHaveLength(2);
  });

  it('"map" button switches to graph view', async () => {
    renderPanel();
    triggerMessage({ type: 'neighborEdgesSnapshot', edges: [], allCodes: {} });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'map' }));
    // Graph view renders an SVG element
    expect(document.querySelector('svg')).toBeTruthy();
  });
});

describe('NeighborPanel – graph view', () => {
  beforeEach(() => { _onMessage = null; });
  afterEach(() => cleanup());

  it('shows "No connections yet" with empty snapshot', () => {
    renderPanel({ initialView: 'graph' });
    triggerMessage({ type: 'neighborEdgesSnapshot', edges: [], allCodes: {} });
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
  });

  it('shows connection count after edges arrive', () => {
    renderPanel({ initialView: 'graph' });
    triggerMessage({
      type: 'neighborEdgesSnapshot',
      edges: [{ userA: 'user-a', userB: 'user-b' }, { userA: 'user-b', userB: 'user-c' }],
      allCodes: { 'user-a': '0001', 'user-b': '0002', 'user-c': '0003' },
    });
    expect(screen.getByText('2 connections')).toBeInTheDocument();
  });

  it('shows singular "connection" for exactly 1 edge', () => {
    renderPanel({ initialView: 'graph' });
    triggerMessage({
      type: 'neighborEdgesSnapshot',
      edges: [{ userA: 'user-a', userB: 'user-b' }],
      allCodes: { 'user-a': '0001', 'user-b': '0002' },
    });
    expect(screen.getByText('1 connection')).toBeInTheDocument();
  });

  it('userLeft after snapshot does not crash', () => {
    renderPanel({ initialView: 'graph' });
    triggerMessage({
      type: 'neighborEdgesSnapshot',
      edges: [{ userA: 'user-a', userB: 'user-b' }],
      allCodes: { 'user-a': '0001', 'user-b': '0002' },
    });
    expect(() => {
      triggerMessage({ type: 'userLeft', userId: 'user-a' });
    }).not.toThrow();
  });

  it('"← Back" button returns to entry view', async () => {
    renderPanel({ initialView: 'graph' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.getByText('Your code')).toBeInTheDocument();
  });
});
