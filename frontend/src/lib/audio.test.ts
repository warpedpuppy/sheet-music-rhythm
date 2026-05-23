import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TickEngine } from './audio'

describe('TickEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates an oscillator click on tick()', () => {
    const engine = new TickEngine()
    engine.tick()
    const context = (engine as unknown as { context: AudioContext }).context
    expect(context.createOscillator).toHaveBeenCalledTimes(1)
    expect(context.createGain).toHaveBeenCalledTimes(1)
  })

  it('reuses the same AudioContext across ticks', () => {
    const engine = new TickEngine()
    engine.tick()
    const first = (engine as unknown as { context: AudioContext }).context
    engine.tick()
    const second = (engine as unknown as { context: AudioContext }).context
    expect(first).toBe(second)
  })

  it('schedules a click and a callback for every note plus a completion callback', () => {
    const engine = new TickEngine()
    const onNote = vi.fn()
    const onDone = vi.fn()
    engine.playSchedule([0, 500, 1000], onNote, onDone, 200)

    const context = (engine as unknown as { context: AudioContext }).context
    expect(context.createOscillator).toHaveBeenCalledTimes(3)

    vi.advanceTimersByTime(100)
    expect(onNote).toHaveBeenCalledWith(0)
    vi.advanceTimersByTime(1000)
    expect(onNote).toHaveBeenCalledTimes(3)
    expect(onDone).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('cancel stops pending callbacks', () => {
    const engine = new TickEngine()
    const onNote = vi.fn()
    const onDone = vi.fn()
    const playback = engine.playSchedule([0, 500], onNote, onDone)
    playback.cancel()
    vi.advanceTimersByTime(5000)
    expect(onNote).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })
})
