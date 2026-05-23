/** Web Audio click synthesis with a lookahead scheduler.
 *
 * All clicks are short oscillator bursts; nothing is loaded from disk. There is
 * no automatic metronome: ticks are either triggered directly by the user's
 * spacebar taps (clickNow) or scheduled for the "I give up" rhythm playback.
 */

export interface ScheduledTick {
  /** Time in ms relative to playback start. */
  timeMs: number
  kind: 'note' | 'end'
  /** Onset index for note ticks. */
  index: number
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

  private click(when: number): void {
    if (!this.ctx) return
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1700, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(0.3, when + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start(when)
    osc.stop(when + 0.08)
  }

  /** Plays a tick immediately — used as feedback for each spacebar tap. */
  clickNow(): void {
    const ctx = this.ensureContext()
    this.click(ctx.currentTime + 0.001)
  }

  /**
   * Starts scheduled playback of the given ticks (the "I give up" rhythm).
   * Returns the performance.now() value that corresponds to timeMs = 0.
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
          this.click(audioStart + tick.timeMs / 1000)
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

/** Builds the tick schedule for "I give up" playback: one tick per onset, then a silent end marker. */
export function buildPlaybackTicks(onsetsMs: number[], totalDurationMs: number): ScheduledTick[] {
  const ticks: ScheduledTick[] = onsetsMs.map((timeMs, index) => ({
    timeMs,
    kind: 'note' as const,
    index,
  }))
  ticks.push({ timeMs: totalDurationMs + 400, kind: 'end', index: 0, silent: true })
  return ticks
}
