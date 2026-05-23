import { describe, expect, it } from 'vitest'
import type { Pattern, PatternEvent } from '../api/types'
import {
  beatMs,
  beatsPerMeasure,
  countInMs,
  eventBeats,
  expectedOnsets,
  onsetEventIndices,
  splitIntoMeasures,
  totalDurationMs,
} from './rhythm'

const n = (duration: PatternEvent['duration'], dots = 0, tieToNext = false): PatternEvent => ({
  type: 'note',
  duration,
  ...(dots ? { dots } : {}),
  ...(tieToNext ? { tieToNext } : {}),
})
const r = (duration: PatternEvent['duration']): PatternEvent => ({ type: 'rest', duration })
const p = (...events: PatternEvent[]): Pattern => ({ events })

describe('eventBeats', () => {
  it('maps durations to beats', () => {
    expect(eventBeats(n('w'))).toBe(4)
    expect(eventBeats(n('h'))).toBe(2)
    expect(eventBeats(n('q'))).toBe(1)
    expect(eventBeats(n('8'))).toBe(0.5)
    expect(eventBeats(n('16'))).toBe(0.25)
  })

  it('extends dotted notes by half', () => {
    expect(eventBeats(n('q', 1))).toBe(1.5)
    expect(eventBeats(n('h', 1))).toBe(3)
  })
})

describe('beatsPerMeasure / beatMs', () => {
  it('reads the time signature in quarter-note beats', () => {
    expect(beatsPerMeasure('4/4')).toBe(4)
    expect(beatsPerMeasure('3/4')).toBe(3)
    expect(beatsPerMeasure('2/4')).toBe(2)
    expect(beatsPerMeasure('6/8')).toBe(3)
  })

  it('converts tempo to milliseconds per beat', () => {
    expect(beatMs(60)).toBe(1000)
    expect(beatMs(120)).toBe(500)
  })
})

describe('expectedOnsets', () => {
  it('offsets onsets by a one-measure count-in', () => {
    expect(countInMs('4/4', 60)).toBe(4000)
    expect(expectedOnsets(p(n('q'), n('q'), n('q'), n('q')), '4/4', 60)).toEqual([
      4000, 5000, 6000, 7000,
    ])
  })

  it('skips rests', () => {
    expect(expectedOnsets(p(n('q'), r('q'), n('h')), '4/4', 60)).toEqual([4000, 6000])
  })

  it('handles dotted notes', () => {
    expect(expectedOnsets(p(n('q', 1), n('8'), n('h')), '4/4', 60)).toEqual([4000, 5500, 6000])
  })

  it('does not create an onset for a tied-into note', () => {
    const onsets = expectedOnsets(p(n('q'), n('q', 0, true), n('q'), n('q')), '4/4', 60)
    expect(onsets).toEqual([4000, 5000, 7000])
  })
})

describe('onsetEventIndices', () => {
  it('maps each onset to the pattern event that produces it', () => {
    const pattern = p(n('q'), r('q'), n('q', 0, true), n('q'), n('q'))
    expect(onsetEventIndices(pattern)).toEqual([0, 2, 4])
  })
})

describe('totalDurationMs', () => {
  it('includes the count-in and all events', () => {
    expect(totalDurationMs(p(n('q'), n('q'), n('q'), n('q')), '4/4', 60)).toBe(8000)
    expect(totalDurationMs(p(n('h', 1)), '3/4', 60)).toBe(6000)
  })
})

describe('splitIntoMeasures', () => {
  it('splits events at measure boundaries', () => {
    const measures = splitIntoMeasures(
      p(n('q'), n('q'), n('h'), n('8'), n('8'), n('q'), n('h')),
      '4/4',
    )
    expect(measures).toHaveLength(2)
    expect(measures[0]).toHaveLength(3)
    expect(measures[1]).toHaveLength(4)
  })
})
