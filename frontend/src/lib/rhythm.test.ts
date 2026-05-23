import { describe, expect, it } from 'vitest'
import type { Pattern } from '../api/types'
import { eventBeats, expectedOnsets, onsetTimesMs, tapCount, tapsToPattern, totalBeats } from './rhythm'

const pattern = (events: Pattern['events']): Pattern => ({ events })

describe('eventBeats', () => {
  it('maps durations to quarter-note beats', () => {
    expect(eventBeats({ type: 'note', duration: 'w' })).toBe(4)
    expect(eventBeats({ type: 'note', duration: 'h' })).toBe(2)
    expect(eventBeats({ type: 'note', duration: 'q' })).toBe(1)
    expect(eventBeats({ type: 'note', duration: '8' })).toBe(0.5)
    expect(eventBeats({ type: 'note', duration: '16' })).toBe(0.25)
  })

  it('extends dotted notes by half their value', () => {
    expect(eventBeats({ type: 'note', duration: 'q', dots: 1 })).toBe(1.5)
    expect(eventBeats({ type: 'note', duration: 'h', dots: 1 })).toBe(3)
  })
})

describe('expectedOnsets', () => {
  it('returns one onset per note at its cumulative beat position', () => {
    const onsets = expectedOnsets(
      pattern([
        { type: 'note', duration: 'q' },
        { type: 'note', duration: 'h' },
        { type: 'note', duration: 'q' },
      ]),
    )
    expect(onsets).toEqual([
      { eventIndex: 0, beat: 0 },
      { eventIndex: 1, beat: 1 },
      { eventIndex: 2, beat: 3 },
    ])
  })

  it('skips rests but advances time through them', () => {
    const onsets = expectedOnsets(
      pattern([
        { type: 'note', duration: 'q' },
        { type: 'rest', duration: 'q' },
        { type: 'note', duration: 'h' },
      ]),
    )
    expect(onsets).toEqual([
      { eventIndex: 0, beat: 0 },
      { eventIndex: 2, beat: 2 },
    ])
  })

  it('does not create an onset for the continuation of a tie', () => {
    const onsets = expectedOnsets(
      pattern([
        { type: 'note', duration: 'q', tieToNext: true },
        { type: 'note', duration: 'q' },
        { type: 'note', duration: 'h' },
      ]),
    )
    expect(onsets).toEqual([
      { eventIndex: 0, beat: 0 },
      { eventIndex: 2, beat: 2 },
    ])
  })

  it('counts taps', () => {
    expect(
      tapCount(
        pattern([
          { type: 'note', duration: 'q' },
          { type: 'rest', duration: 'q' },
          { type: 'note', duration: 'q', tieToNext: true },
          { type: 'note', duration: 'q' },
        ]),
      ),
    ).toBe(2)
  })
})

describe('onsetTimesMs', () => {
  it('converts beats to milliseconds at the given tempo', () => {
    const times = onsetTimesMs(
      pattern([
        { type: 'note', duration: 'q' },
        { type: 'note', duration: 'q' },
        { type: 'note', duration: 'h' },
      ]),
      120,
    )
    expect(times).toEqual([0, 500, 1000])
  })
})

describe('totalBeats', () => {
  it('sums every event including rests', () => {
    expect(
      totalBeats(
        pattern([
          { type: 'note', duration: 'q', dots: 1 },
          { type: 'note', duration: '8' },
          { type: 'rest', duration: 'h' },
        ]),
      ),
    ).toBe(4)
  })
})

describe('tapsToPattern', () => {
  it('returns an empty pattern for no taps', () => {
    expect(tapsToPattern([], 600)).toEqual({ events: [] })
  })

  it('snaps even gaps to quarter notes', () => {
    const result = tapsToPattern([0, 600, 1200, 1800], 600)
    expect(result.events).toHaveLength(4)
    expect(result.events.slice(0, 3).every((e) => e.duration === 'q')).toBe(true)
  })

  it('snaps a long-short pair to dotted-quarter plus eighth', () => {
    const result = tapsToPattern([0, 900, 1200], 600)
    expect(result.events[0]).toMatchObject({ duration: 'q', dots: 1 })
    expect(result.events[1]).toMatchObject({ duration: '8' })
  })
})
