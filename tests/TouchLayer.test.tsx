import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import TouchLayer from '../app/components/shared/TouchLayer'
import { RoomSocketProvider } from '../app/contexts/RoomSocketContext'

const mockSend = vi.hoisted(() => vi.fn())

vi.mock('partysocket/react', () => ({
  default: vi.fn((config: any) => {
    config.onOpen?.()
    return { send: mockSend, readyState: 1, close: vi.fn(), reconnect: vi.fn() }
  })
}))

const defaultProps = {
  userId: 'test-user',
  onReactionStateChange: vi.fn(),
  onBackgroundColorChange: vi.fn(),
  throttleMs: 0,
}

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <RoomSocketProvider room="test-room" userId="test-user">
      {ui}
    </RoomSocketProvider>
  )
}

beforeEach(() => {
  mockSend.mockClear()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800,
    x: 0, y: 0, toJSON: () => {},
  } as DOMRect)
})

describe('TouchLayer socket behaviour', () => {
  it('sends a move event when the mouse moves over the layer', () => {
    const { container } = renderWithProvider(<TouchLayer {...defaultProps} />)
    const layer = container.firstChild as HTMLElement
    fireEvent.mouseMove(layer, { clientX: 500, clientY: 400 })
    expect(mockSend).toHaveBeenCalledOnce()
    const sent = JSON.parse(mockSend.mock.calls[0][0])
    expect(sent.type).toBe('move')
    expect(sent.position.userId).toBe('test-user')
  })

  it('sends a remove event when the mouse leaves the layer', () => {
    const { container } = renderWithProvider(<TouchLayer {...defaultProps} />)
    const layer = container.firstChild as HTMLElement
    fireEvent.mouseMove(layer, { clientX: 500, clientY: 400 })
    mockSend.mockClear()
    fireEvent.mouseLeave(layer)
    const calls = mockSend.mock.calls.map((args: string[]) => JSON.parse(args[0]))
    expect(calls.some((c: any) => c.type === 'remove')).toBe(true)
  })

  it('sends a touch event on touch start', () => {
    const { container } = renderWithProvider(<TouchLayer {...defaultProps} />)
    const layer = container.firstChild as HTMLElement
    fireEvent.touchStart(layer, { touches: [{ clientX: 300, clientY: 200 }] })
    expect(mockSend).toHaveBeenCalledOnce()
    const sent = JSON.parse(mockSend.mock.calls[0][0])
    expect(sent.type).toBe('touch')
    expect(sent.position.userId).toBe('test-user')
  })

  it('sends a remove event on touch end', () => {
    const { container } = renderWithProvider(<TouchLayer {...defaultProps} />)
    const layer = container.firstChild as HTMLElement
    fireEvent.touchStart(layer, { touches: [{ clientX: 300, clientY: 200 }] })
    mockSend.mockClear()
    fireEvent.touchEnd(layer, { changedTouches: [{ clientX: 300, clientY: 200 }] })
    const calls = mockSend.mock.calls.map((args: string[]) => JSON.parse(args[0]))
    expect(calls.some((c: any) => c.type === 'remove')).toBe(true)
  })

  it('does not send cursor events when disabled', () => {
    const { container } = renderWithProvider(<TouchLayer {...defaultProps} disabled />)
    const layer = container.firstChild as HTMLElement
    fireEvent.mouseMove(layer, { clientX: 500, clientY: 400 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends a setTimecode event on mouse leave when getTimecode is provided', () => {
    const getTimecode = () => 42000
    const { container } = renderWithProvider(<TouchLayer {...defaultProps} getTimecode={getTimecode} />)
    const layer = container.firstChild as HTMLElement
    fireEvent.mouseMove(layer, { clientX: 500, clientY: 400 })
    mockSend.mockClear()
    fireEvent.mouseLeave(layer)
    const calls = mockSend.mock.calls.map((args: string[]) => JSON.parse(args[0]))
    const timecodeCall = calls.find((c: any) => c.type === 'setTimecode')
    expect(timecodeCall).toBeDefined()
    expect(timecodeCall.timecode).toBe(42000)
  })
})
