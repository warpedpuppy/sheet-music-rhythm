import type { Pattern, PatternEvent } from '../api/types'

export const DURATION_BEATS: Record<string, number> = {
  w: 4,
  h: 2,
  q: 1,
  '8': 0.5,
  '16': 0.25,
}

export function eventBeats(event: PatternEvent): number {
  let beats = DURATION_BEATS[event.duration] ?? 0
  if (event.dots === 1) {
    beats *= 1.5
  }
  return beats
}

export function beatsPerMeasure(timeSignature: string): number {
  const [numerator, denominator] = timeSignature.split('/').map(Number)
  if (!numerator || !denominator) return 4
  return numerator * (4 / denominator)
}

export function beatMs(tempoBpm: number): number {
  return 60000 / tempoBpm
}

/**
 * Onset times in ms from the start of the pattern for every event the user
 * must tap. Rests and tied-into notes consume time but produce no onset.
 * Used to schedule the "I give up" rhythm playback.
 */
export function expectedOnsets(pattern: Pattern, tempoBpm: number): number[] {
  const bms = beatMs(tempoBpm)
  let t = 0
  const onsets: number[] = []
  let tiedInto = false
  for (const event of pattern.events) {
    if (event.type === 'note' && !tiedInto) {
      onsets.push(t)
    }
    t += eventBeats(event) * bms
    tiedInto = Boolean(event.tieToNext) && event.type === 'note'
  }
  return onsets
}

/** How many spacebar taps the exercise expects (one per onset). */
export function onsetCount(pattern: Pattern): number {
  return onsetEventIndices(pattern).length
}

/**
 * For each onset (in order), the index of the pattern event it belongs to.
 * Used to map per-onset scoring results back onto rendered notes.
 */
export function onsetEventIndices(pattern: Pattern): number[] {
  const indices: number[] = []
  let tiedInto = false
  pattern.events.forEach((event, index) => {
    if (event.type === 'note' && !tiedInto) {
      indices.push(index)
    }
    tiedInto = Boolean(event.tieToNext) && event.type === 'note'
  })
  return indices
}

/** Length of the full pattern in ms at the given tempo. */
export function patternDurationMs(pattern: Pattern, tempoBpm: number): number {
  const bms = beatMs(tempoBpm)
  return pattern.events.reduce((sum, event) => sum + eventBeats(event), 0) * bms
}

/** Splits the events into measures based on the time signature (greedy by beats). */
export function splitIntoMeasures(pattern: Pattern, timeSignature: string): PatternEvent[][] {
  const perMeasure = beatsPerMeasure(timeSignature)
  const measures: PatternEvent[][] = []
  let current: PatternEvent[] = []
  let beats = 0
  for (const event of pattern.events) {
    current.push(event)
    beats += eventBeats(event)
    if (beats >= perMeasure - 1e-6) {
      measures.push(current)
      current = []
      beats = 0
    }
  }
  if (current.length > 0) {
    measures.push(current)
  }
  return measures
}
