/**
 * Web Audio tick engine.
 *
 * - `tick()` plays an immediate click (used for every spacebar tap).
 * - `playSchedule()` schedules a click at each offset and reports back which note is
 *   currently sounding so the UI can move a dot across the notation ("I give up").
 * - `startMetronome()` clicks steadily at a tempo with a softer, lower "tock" that is
 *   easy to tell apart from the spacebar tick.
 */

type TickKind = 'tap' | 'playback' | 'metronome'

// The metronome must sound different from the spacebar tick and play at half its volume.
const CLICK_PEAK_GAIN: Record<TickKind, number> = { tap: 0.4, playback: 0.4, metronome: 0.2 }
const CLICK_FREQUENCY: Record<TickKind, number> = { tap: 1000, playback: 1500, metronome: 620 }
const CLICK_WAVE: Record<TickKind, OscillatorType> = {
  tap: 'square',
  playback: 'square',
  metronome: 'triangle',
}

export interface ScheduledPlayback {
  cancel: () => void
}

export class TickEngine {
  private context: AudioContext | null = null
  private timers: number[] = []
  private metronomeTimer: number | null = null
  private nextMetronomeBeat = 0

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
    oscillator.type = CLICK_WAVE[kind]
    oscillator.frequency.value = CLICK_FREQUENCY[kind]
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(CLICK_PEAK_GAIN[kind], when + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(when)
    oscillator.stop(when + 0.08)
  }

  /**
   * Click steadily at `bpm` until `stopMetronome()` is called. Beats are scheduled a
   * short window ahead on the audio clock so they stay even regardless of main-thread
   * timer jitter.
   */
  startMetronome(bpm: number): void {
    this.stopMetronome()
    const context = this.ensureContext()
    const beatSeconds = 60 / bpm
    const lookaheadSeconds = 0.2
    this.nextMetronomeBeat = context.currentTime + 0.05
    const scheduleWindow = () => {
      while (this.nextMetronomeBeat < context.currentTime + lookaheadSeconds) {
        this.click(context, this.nextMetronomeBeat, 'metronome')
        this.nextMetronomeBeat += beatSeconds
      }
    }
    scheduleWindow()
    this.metronomeTimer = window.setInterval(scheduleWindow, 100)
  }

  stopMetronome(): void {
    if (this.metronomeTimer !== null) {
      window.clearInterval(this.metronomeTimer)
      this.metronomeTimer = null
    }
  }

  get metronomeRunning(): boolean {
    return this.metronomeTimer !== null
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
    this.stopMetronome()
  }
}

export const tickEngine = new TickEngine()
