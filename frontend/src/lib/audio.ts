/** Web Audio click synthesis with a lookahead scheduler.
 *
 * All clicks are short oscillator bursts; nothing is loaded from disk. The
 * scheduler runs on a 25 ms interval and schedules audio up to 120 ms ahead on
 * the AudioContext clock, while UI callbacks fire from the same loop as each
 * tick's time is reached.
 */

export interface ScheduledTick {
  /** Time in ms relative to playback start (tick 0 of the count-in). */
  timeMs: number
  kind: 'count' | 'beat' | 'note' | 'end'
  /** Index within its kind (count-in beat number, onset index, ...). */
  index: number
  accent?: boolean
  /** If true, no sound is played; the tick only fires its callback. */
  silent?: boolean
}

export interface PlaybackHandlers {
  onTick?: (tick: ScheduledTick) => void
  onDone?: () => void
}

const LOOKAHEAD_MS = 120
const INTERVAL_MS = 25

type AudioContextFactory = () => AudioContext

export class AudioEngine {
  private ctx: AudioContext | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private createContext: AudioContextFactory

  constructor(createContext?: AudioContextFactory) {
    this.createContext = createContext ?? (() => new AudioContext())
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = this.createContext()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  private click(when: number, accent: boolean, kind: ScheduledTick['kind']): void {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const frequency = kind === 'note' ? 1700 : accent ? 1300 : 900
    osc.type = 'square'
    osc.frequency.setValueAtTime(frequency, when)
    const peak = kind === 'beat' ? 0.12 : 0.3
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(when)
    osc.stop(when + 0.08)
  }

  /**
   * Starts playback of the given ticks. Returns the performance.now() value
   * that corresponds to timeMs = 0, so callers can timestamp taps relative to
   * the first count-in click.
   */
  start(ticks: ScheduledTick[], handlers: PlaybackHandlers = {}): number {
    this.stop()
    const ctx = this.ensureContext()
    const sorted = [...ticks].sort((a, b) => a.timeMs - b.timeMs)

    const startDelayMs = 150
    const audioStart = ctx.currentTime + startDelayMs / 1000
    const perfStart = performance.now() + startDelayMs

    let scheduledIndex = 0
    let firedIndex = 0

    const tickLoop = () => {
      const elapsedMs = (ctx.currentTime - audioStart) * 1000

      while (
        scheduledIndex < sorted.length &&
        sorted[scheduledIndex].timeMs <= elapsedMs + LOOKAHEAD_MS
      ) {
        const tick = sorted[scheduledIndex]
        if (!tick.silent && tick.kind !== 'end') {
          this.click(audioStart + tick.timeMs / 1000, Boolean(tick.accent), tick.kind)
        }
        scheduledIndex += 1
      }

      while (firedIndex < sorted.length && sorted[firedIndex].timeMs <= elapsedMs) {
        handlers.onTick?.(sorted[firedIndex])
        firedIndex += 1
      }

      if (firedIndex >= sorted.length) {
        this.stopTimer()
        handlers.onDone?.()
      }
    }

    this.intervalId = setInterval(tickLoop, INTERVAL_MS)
    tickLoop()
    return perfStart
  }

  private stopTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  stop(): void {
    this.stopTimer()
  }

  dispose(): void {
    this.stop()
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close()
    }
    this.ctx = null
  }
}

/** Builds the tick schedule for an exercise run: count-in clicks then quiet beat clicks. */
export function buildExerciseTicks(
  countInBeats: number,
  beatMs: number,
  totalDurationMs: number,
): ScheduledTick[] {
  const ticks: ScheduledTick[] = []
  for (let i = 0; i < countInBeats; i++) {
    ticks.push({ timeMs: i * beatMs, kind: 'count', index: i, accent: i === 0 })
  }
  const totalBeats = Math.round(totalDurationMs / beatMs)
  for (let beat = countInBeats; beat < totalBeats; beat++) {
    ticks.push({ timeMs: beat * beatMs, kind: 'beat', index: beat - countInBeats })
  }
  ticks.push({ timeMs: totalDurationMs + beatMs * 0.75, kind: 'end', index: 0, silent: true })
  return ticks
}

/** Builds the tick schedule for "I give up" playback: count-in then the rhythm itself. */
export function buildPlaybackTicks(
  countInBeats: number,
  beatMs: number,
  onsetsMs: number[],
  totalDurationMs: number,
): ScheduledTick[] {
  const ticks: ScheduledTick[] = []
  for (let i = 0; i < countInBeats; i++) {
    ticks.push({ timeMs: i * beatMs, kind: 'count', index: i, accent: i === 0 })
  }
  onsetsMs.forEach((timeMs, index) => {
    ticks.push({ timeMs, kind: 'note', index, accent: true })
  })
  ticks.push({ timeMs: totalDurationMs + beatMs * 0.5, kind: 'end', index: 0, silent: true })
  return ticks
}
