import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine, buildPlaybackTicks } from './audio'
import type { ScheduledTick } from './audio'

interface FakeContext {
  currentTime: number
  state: string
  resume: () => Promise<void>
  close: () => Promise<void>
  destination: object
  createOscillator: () => {
    type: string
    frequency: { setValueAtTime: () => void }
    connect: () => void
    start: () => void
    stop: () => void
  }
  createGain: () => {
    gain: { setValueAtTime: () => void; exponentialRampToValueAtTime: () => void }
    connect: () => void
  }
}

function makeFakeContext(): { ctx: FakeContext; oscillatorsStarted: () => number } {
  let started = 0
  const ctx: FakeContext = {
    currentTime: 0,
    state: 'running',
    resume: () => Promise.resolve(),
    close: () => Promise.resolve(),
    destination: {},
    createOscillator: () => ({
      type: 'square',
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {
        started += 1
      },
      stop: () => {},
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    }),
  }
  return { ctx, oscillatorsStarted: () => started }
}

describe('AudioEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clickNow plays a tick immediately', () => {
    const { ctx, oscillatorsStarted } = makeFakeContext()
    const engine = new AudioEngine(() => ctx as unknown as AudioContext)
    engine.clickNow()
    engine.clickNow()
    expect(oscillatorsStarted()).toBe(2)
  })

  it('fires playback tick callbacks in order and onDone at the end', () => {
    const { ctx, oscillatorsStarted } = makeFakeContext()
    const engine = new AudioEngine(() => ctx as unknown as AudioContext)

    const ticks: ScheduledTick[] = [
      { timeMs: 0, kind: 'note', index: 0 },
      { timeMs: 500, kind: 'note', index: 1 },
      { timeMs: 1500, kind: 'note', index: 2 },
      { timeMs: 2000, kind: 'end', index: 0, silent: true },
    ]

    const fired: string[] = []
    let done = false
    engine.start(ticks, {
      onTick: (tick) => fired.push(`${tick.kind}:${tick.index}`),
      onDone: () => {
        done = true
      },
    })

    // Advance simulated audio clock and timers together (engine starts 150 ms in).
    for (let elapsed = 0; elapsed <= 2500; elapsed += 25) {
      ctx.currentTime = (150 + elapsed) / 1000
      vi.advanceTimersByTime(25)
    }

    expect(fired).toEqual(['note:0', 'note:1', 'note:2', 'end:0'])
    expect(done).toBe(true)
    // The silent end tick must not produce a click.
    expect(oscillatorsStarted()).toBe(3)
  })

  it('stop() cancels pending callbacks', () => {
    const { ctx } = makeFakeContext()
    const engine = new AudioEngine(() => ctx as unknown as AudioContext)
    const fired: string[] = []

    engine.start(
      [
        { timeMs: 0, kind: 'note', index: 0 },
        { timeMs: 5000, kind: 'note', index: 1 },
      ],
      { onTick: (tick) => fired.push(`${tick.kind}:${tick.index}`) },
    )

    ctx.currentTime = 0.2
    vi.advanceTimersByTime(50)
    engine.stop()
    ctx.currentTime = 10
    vi.advanceTimersByTime(10000)

    expect(fired).toEqual(['note:0'])
  })
})

describe('buildPlaybackTicks', () => {
  it('schedules a note tick for every onset plus a silent end marker', () => {
    const ticks = buildPlaybackTicks([0, 500, 1500], 2000)
    const notes = ticks.filter((t) => t.kind === 'note')
    const ends = ticks.filter((t) => t.kind === 'end')
    expect(notes.map((t) => t.timeMs)).toEqual([0, 500, 1500])
    expect(notes.map((t) => t.index)).toEqual([0, 1, 2])
    expect(ends).toHaveLength(1)
    expect(ends[0].silent).toBe(true)
    expect(ends[0].timeMs).toBeGreaterThan(2000)
  })
})
