import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import MomentsTab from '../app/components/panels/AdminPanelNoDB/tabs/MomentsTab'
import { DEFAULT_ANCHORS } from '../app/utils/voteRegion'

function renderTab(overrides: Record<string, unknown> = {}) {
  const props = {
    moments: [],
    setMoments: vi.fn(),
    seenUsers: new Set<string>(),
    connectedUsers: new Set<string>(),
    liveCursors: new Map<string, { x: number; y: number }>(),
    momentLabelInput: '',
    setMomentLabelInput: vi.fn(),
    expandedMoments: new Set<string>(),
    setExpandedMoments: vi.fn(),
    editingMomentId: null,
    setEditingMomentId: vi.fn(),
    editingMomentLabel: '',
    setEditingMomentLabel: vi.fn(),
    snapMoment: vi.fn(),
    startFlashTimer: vi.fn(),
    importPolisCSV: vi.fn(),
    activeLabels: { positive: 'Agree', negative: 'Disagree', neutral: 'Pass' },
    activeAnchors: DEFAULT_ANCHORS,
    room: 'test',
    ...overrides,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...render(<MomentsTab {...(props as any)} />), props }
}

function snapButton(container: HTMLElement): HTMLButtonElement {
  const btn = [...container.querySelectorAll('button')].find(b => /^Snap/.test(b.textContent ?? ''))
  if (!btn) throw new Error('snap button not found')
  return btn as HTMLButtonElement
}

beforeEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

describe('MomentsTab flash-timer button', () => {
  it('disables the snap button and shows a countdown after starting a flash timer', () => {
    localStorage.setItem('v4-flash-enabled', 'true')
    localStorage.setItem('v4-flash-duration', '5')
    const { container, props } = renderTab()

    const btn = snapButton(container)
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Snap in 5s')

    act(() => { fireEvent.click(btn) })

    expect(props.startFlashTimer).toHaveBeenCalledWith(5)
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toMatch(/Snapping in \ds/)
  })

  it('re-enables the button once the countdown elapses', () => {
    vi.useFakeTimers()
    localStorage.setItem('v4-flash-enabled', 'true')
    localStorage.setItem('v4-flash-duration', '3')
    const { container } = renderTab()

    const btn = snapButton(container)
    act(() => { fireEvent.click(btn) })
    expect(btn.disabled).toBe(true)

    act(() => { vi.advanceTimersByTime(3100) })
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Snap in 3s')
  })
})
