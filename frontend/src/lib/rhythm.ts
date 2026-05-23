// Mirrors backend/app/services/rhythm.py — beat values are in quarter-note beats.
import type { Duration, Pattern, PatternEvent } from '../api/types'

export const DURATION_BEATS: Record<Duration, number> = {
  w: 4,
  h: 2,
  q: 1,
  '8': 0.5,
  '16': 0.25,
}

export function eventBeats(event: PatternEvent): number {
  let beats = DURATION_BEATS[event.duration]
  if (event.dots) {
    beats *= 1.5
  }
  return beats
}

export function totalBeats(pattern: Pattern): number {
  return pattern.events.reduce((sum, event) => sum + eventBeats(event), 0)
}

export interface Onset {
  eventIndex: number
  beat: number
}

/** Beat positions of every note the student must tap (tied continuations excluded). */
export function expectedOnsets(pattern: Pattern): Onset[] {
  const onsets: Onset[] = []
  let position = 0
  let tiedFromPrevious = false
  for (let i = 0; i < pattern.events.length; i++) {
    const event = pattern.events[i]
    if (event.type === 'note' && !tiedFromPrevious) {
      onsets.push({ eventIndex: i, beat: position })
    }
    position += eventBeats(event)
    tiedFromPrevious = event.type === 'note' && Boolean(event.tieToNext)
  }
  return onsets
}

export function tapCount(pattern: Pattern): number {
  return expectedOnsets(pattern).length
}

/** Convert expected onsets to millisecond offsets at the given tempo. */
export function onsetTimesMs(pattern: Pattern, bpm: number): number[] {
  const msPerBeat = 60000 / bpm
  return expectedOnsets(pattern).map((onset) => onset.beat * msPerBeat)
}

/**
 * Convert a list of tap timestamps into a notated rhythm so students can see what
 * they actually played. Each inter-tap gap is snapped to the nearest representable
 * duration (in beats at the inferred tempo); the final note is rendered as a quarter.
 */
export function tapsToPattern(tapsMs: number[], msPerBeat: number): Pattern {
  if (tapsMs.length === 0) {
    return { events: [] }
  }
  const SNAP_CHOICES: Array<{ beats: number; duration: Duration; dots?: number }> = [
    { beats: 0.25, duration: '16' },
    { beats: 0.375, duration: '16', dots: 1 },
    { beats: 0.5, duration: '8' },
    { beats: 0.75, duration: '8', dots: 1 },
    { beats: 1, duration: 'q' },
    { beats: 1.5, duration: 'q', dots: 1 },
    { beats: 2, duration: 'h' },
    { beats: 3, duration: 'h', dots: 1 },
    { beats: 4, duration: 'w' },
  ]
  const events: PatternEvent[] = []
  for (let i = 0; i < tapsMs.length - 1; i++) {
    const gapBeats = (tapsMs[i + 1] - tapsMs[i]) / msPerBeat
    let best = SNAP_CHOICES[0]
    for (const choice of SNAP_CHOICES) {
      if (Math.abs(choice.beats - gapBeats) < Math.abs(best.beats - gapBeats)) {
        best = choice
      }
    }
    events.push({ type: 'note', duration: best.duration, dots: best.dots ?? 0 })
  }
  events.push({ type: 'note', duration: 'q', dots: 0 })
  return { events }
}

export function describeTimeSignature(top: number, bottom: number): string {
  return `${top}/${bottom}`
}
