import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { TickEngine } from './audio'

interface MockedContext {
  currentTime: number
  createOscillator: Mock<() => { type: string; frequency: { value: number } }>
  createGain: Mock<() => { gain: { exponentialRampToValueAtTime: Mock } }>
}

function contextOf(engine: TickEngine): MockedContext {
  return (engine as unknown as { context: MockedContext }).context
}

/** The peak gain of the nth click is the target of its first exponential ramp. */
function peakGainOfClick(context: MockedContext, index: number): number {
  const gainNode = context.createGain.mock.results[index].value
  return gainNode.gain.exponentialRampToValueAtTime.mock.calls[0][0] as number
}

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

  describe('metronome', () => {
    it('clicks at half the volume of a spacebar tap with a different sound', () => {
      const engine = new TickEngine()
      engine.tick('tap')
      engine.startMetronome(120)
      const context = contextOf(engine)
      expect(context.createOscillator).toHaveBeenCalledTimes(2)

      const tapOscillator = context.createOscillator.mock.results[0].value
      const metronomeOscillator = context.createOscillator.mock.results[1].value
      expect(metronomeOscillator.frequency.value).not.toBe(tapOscillator.frequency.value)
      expect(metronomeOscillator.type).not.toBe(tapOscillator.type)

      const tapPeak = peakGainOfClick(context, 0)
      const metronomePeak = peakGainOfClick(context, 1)
      expect(metronomePeak).toBeCloseTo(tapPeak / 2)
    })

    it('keeps scheduling beats as audio time advances', () => {
      const engine = new TickEngine()
      engine.startMetronome(120) // one beat every 0.5s
      const context = contextOf(engine)
      const initialClicks = context.createOscillator.mock.calls.length
      expect(initialClicks).toBeGreaterThan(0)

      context.currentTime = 1
      vi.advanceTimersByTime(100)
      expect(context.createOscillator.mock.calls.length).toBeGreaterThan(initialClicks)
      expect(engine.metronomeRunning).toBe(true)
    })

    it('stops scheduling once stopped', () => {
      const engine = new TickEngine()
      engine.startMetronome(120)
      const context = contextOf(engine)
      engine.stopMetronome()
      const clicksAtStop = context.createOscillator.mock.calls.length
      context.currentTime = 10
      vi.advanceTimersByTime(2000)
      expect(context.createOscillator.mock.calls.length).toBe(clicksAtStop)
      expect(engine.metronomeRunning).toBe(false)
    })

    it('restarting replaces the previous metronome instead of stacking', () => {
      const engine = new TickEngine()
      engine.startMetronome(120)
      engine.startMetronome(60)
      engine.stopMetronome()
      const context = contextOf(engine)
      const clicksAtStop = context.createOscillator.mock.calls.length
      context.currentTime = 10
      vi.advanceTimersByTime(2000)
      expect(context.createOscillator.mock.calls.length).toBe(clicksAtStop)
    })

    it('cancelAll also stops the metronome', () => {
      const engine = new TickEngine()
      engine.startMetronome(120)
      engine.cancelAll()
      expect(engine.metronomeRunning).toBe(false)
    })
  })
})
