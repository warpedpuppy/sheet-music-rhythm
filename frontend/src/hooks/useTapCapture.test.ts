import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTapCapture } from './useTapCapture'

function pressSpace(options: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', ...options }))
}

describe('useTapCapture', () => {
  it('ignores taps before start() is called', () => {
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 4 }))
    act(() => pressSpace())
    expect(result.current.taps).toHaveLength(0)
  })

  it('records a timestamp and calls onTap for each spacebar press', () => {
    const onTap = vi.fn()
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 4, onTap }))
    act(() => result.current.start())
    act(() => pressSpace())
    act(() => pressSpace())
    expect(result.current.taps).toHaveLength(2)
    expect(onTap).toHaveBeenCalledTimes(2)
    expect(result.current.capturing).toBe(true)
  })

  it('stops capturing and calls onComplete after the expected number of taps', () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 2, onComplete }))
    act(() => result.current.start())
    act(() => pressSpace())
    act(() => pressSpace())
    expect(result.current.capturing).toBe(false)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete.mock.calls[0][0]).toHaveLength(2)
    act(() => pressSpace())
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('ignores key auto-repeat', () => {
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 4 }))
    act(() => result.current.start())
    act(() => pressSpace())
    act(() => pressSpace({ repeat: true }))
    expect(result.current.taps).toHaveLength(1)
  })

  it('ignores other keys', () => {
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 4 }))
    act(() => result.current.start())
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' })))
    expect(result.current.taps).toHaveLength(0)
  })

  it('reset clears recorded taps and stops capturing', () => {
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 4 }))
    act(() => result.current.start())
    act(() => pressSpace())
    act(() => result.current.reset())
    expect(result.current.taps).toHaveLength(0)
    expect(result.current.capturing).toBe(false)
  })

  it('timestamps are monotonically increasing', () => {
    const { result } = renderHook(() => useTapCapture({ expectedTaps: 3 }))
    act(() => result.current.start())
    act(() => pressSpace())
    act(() => pressSpace())
    act(() => pressSpace())
    const [a, b, c] = result.current.taps
    expect(b).toBeGreaterThanOrEqual(a)
    expect(c).toBeGreaterThanOrEqual(b)
  })
})
