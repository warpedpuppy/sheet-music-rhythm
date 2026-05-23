import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTapCapture } from './useTapCapture'

function pressSpace(options: { repeat?: boolean } = {}) {
  window.dispatchEvent(
    new KeyboardEvent('keydown', { code: 'Space', repeat: options.repeat ?? false }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTapCapture', () => {
  it('records spacebar taps relative to the start time', () => {
    const nowSpy = vi.spyOn(performance, 'now')
    const { result } = renderHook(() => useTapCapture(true, 1000))

    nowSpy.mockReturnValue(1500)
    act(() => pressSpace())
    nowSpy.mockReturnValue(2250)
    act(() => pressSpace())

    expect(result.current.taps).toEqual([500, 1250])
  })

  it('ignores key auto-repeat', () => {
    vi.spyOn(performance, 'now').mockReturnValue(2000)
    const { result } = renderHook(() => useTapCapture(true, 1000))

    act(() => pressSpace())
    act(() => pressSpace({ repeat: true }))
    act(() => pressSpace({ repeat: true }))

    expect(result.current.taps).toHaveLength(1)
  })

  it('ignores other keys and does nothing while inactive', () => {
    vi.spyOn(performance, 'now').mockReturnValue(2000)
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) => useTapCapture(active, 1000),
      { initialProps: { active: false } },
    )

    act(() => pressSpace())
    expect(result.current.taps).toHaveLength(0)

    rerender({ active: true })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    })
    expect(result.current.taps).toHaveLength(0)

    act(() => pressSpace())
    expect(result.current.taps).toHaveLength(1)
  })

  it('does not record taps before a start time exists', () => {
    vi.spyOn(performance, 'now').mockReturnValue(2000)
    const { result } = renderHook(() => useTapCapture(true, null))
    act(() => pressSpace())
    expect(result.current.taps).toHaveLength(0)
  })

  it('reset clears recorded taps', () => {
    vi.spyOn(performance, 'now').mockReturnValue(2000)
    const { result } = renderHook(() => useTapCapture(true, 1000))
    act(() => pressSpace())
    expect(result.current.taps).toHaveLength(1)
    act(() => result.current.reset())
    expect(result.current.taps).toHaveLength(0)
  })

  it('fires onTap for every accepted tap (and not for repeats)', () => {
    vi.spyOn(performance, 'now').mockReturnValue(2000)
    const onTap = vi.fn()
    renderHook(() => useTapCapture(true, 1000, onTap))

    act(() => pressSpace())
    act(() => pressSpace({ repeat: true }))
    act(() => pressSpace())

    expect(onTap).toHaveBeenCalledTimes(2)
  })
})
