import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import Canvas from '../app/components/shared/Canvas'
import { RoomSocketProvider } from '../app/contexts/RoomSocketContext'

const mockSend = vi.hoisted(() => vi.fn())
const capturedConfig = vi.hoisted(() => ({ current: null as any }))
const capturedOnMessage = vi.hoisted(() => ({ fn: null as ((evt: MessageEvent) => void) | null }))

vi.mock('partysocket/react', () => ({
  default: vi.fn((config: any) => {
    capturedConfig.current = config
    capturedOnMessage.fn = config.onMessage ?? null
    config.onOpen?.()
    return { send: mockSend, readyState: 1, close: vi.fn(), reconnect: vi.fn() }
  })
}))

function emitMessage(data: object) {
  capturedOnMessage.fn?.(new MessageEvent('message', { data: JSON.stringify(data) }))
}

function renderWithProvider(ui: React.ReactElement, { readOnly = false } = {}) {
  return render(
    <RoomSocketProvider room="test" userId="user1" readOnly={readOnly}>
      {ui}
    </RoomSocketProvider>
  )
}

beforeEach(() => {
  mockSend.mockClear()
  capturedConfig.current = null
  capturedOnMessage.fn = null
})

describe('Canvas socket behaviour', () => {
  it('calls onSocketReady with a send function on mount', () => {
    const onSocketReady = vi.fn()
    renderWithProvider(<Canvas userId="user1" onSocketReady={onSocketReady} />)
    expect(onSocketReady).toHaveBeenCalledOnce()
    expect(typeof onSocketReady.mock.calls[0][0]).toBe('function')
  })

  it('calls onPresenceCount when presenceCount message is received', () => {
    const onPresenceCount = vi.fn()
    renderWithProvider(<Canvas userId="user1" onPresenceCount={onPresenceCount} />)
    act(() => emitMessage({ type: 'presenceCount', count: 42, viewerCount: 3 }))
    expect(onPresenceCount).toHaveBeenCalledWith(42)
  })

  it('calls onConnected with inviteEdges and currentActivity from connected message', () => {
    const onConnected = vi.fn()
    renderWithProvider(<Canvas userId="user1" onConnected={onConnected} />)
    act(() => emitMessage({
      type: 'connected',
      inviteEdges: { user2: 'user1' },
      currentActivity: 'canvas',
    }))
    expect(onConnected).toHaveBeenCalledWith({ user2: 'user1' }, 'canvas')
  })

  it('opens socket as admin when readOnly is true', () => {
    renderWithProvider(<Canvas userId="user1" />, { readOnly: true })
    expect(capturedConfig.current.query).toEqual({ isAdmin: 'true' })
  })
})
