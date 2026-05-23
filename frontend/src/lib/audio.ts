/**
 * Web Audio tick engine.
 *
 * - `tick()` plays an immediate click (used for every spacebar tap).
 * - `playSchedule()` schedules a click at each offset and reports back which note is
 *   currently sounding so the UI can move a dot across the notation ("I give up").
 */

type TickKind = 'tap' | 'playback'

export interface ScheduledPlayback {
  cancel: () => void
}

export class TickEngine {
  private context: AudioContext | null = null
  private timers: number[] = []

  private ensureContext(): AudioContext {
    if (!this.context) {
      type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }
      const Ctor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext
      if (!Ctor) {
        throw new Error('Web Audio is not supported in this browser')
      }
      this.context = new Ctor()
    }
    if (this.context.state === 'suspended') {
      void this.context.resume()
    }
    return this.context
  }

  /** Play a short click right now. */
  tick(kind: TickKind = 'tap'): void {
    const context = this.ensureContext()
    this.click(context, context.currentTime, kind)
  }

  private click(context: AudioContext, when: number, kind: TickKind): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'square'
    oscillator.frequency.value = kind === 'tap' ? 1000 : 1500
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(0.4, when + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(when)
    oscillator.stop(when + 0.08)
  }

  /**
   * Tick out a rhythm. `offsetsMs[i]` is when note `i` should sound, relative to now.
   * `onNote(i)` fires as each note sounds and `onDone` fires after the last note has
   * finished ringing.
   */
  playSchedule(
    offsetsMs: number[],
    onNote: (index: number) => void,
    onDone: () => void,
    tailMs = 600,
  ): ScheduledPlayback {
    const context = this.ensureContext()
    const start = context.currentTime + 0.1
    offsetsMs.forEach((offset, index) => {
      this.click(context, start + offset / 1000, 'playback')
      this.timers.push(
        window.setTimeout(() => onNote(index), 100 + offset),
      )
    })
    const last = offsetsMs.length > 0 ? offsetsMs[offsetsMs.length - 1] : 0
    this.timers.push(window.setTimeout(onDone, 100 + last + tailMs))
    return { cancel: () => this.cancelAll() }
  }

  cancelAll(): void {
    for (const timer of this.timers) {
      window.clearTimeout(timer)
    }
    this.timers = []
  }
}

export const tickEngine = new TickEngine()
