import { describe, expect, it } from 'vitest'
import type { Pattern } from '../api/types'
import { renderPattern } from './vexflowPattern'

const FOUR_QUARTERS: Pattern = {
  events: [
    { type: 'note', duration: 'q' },
    { type: 'note', duration: 'q' },
    { type: 'note', duration: 'q' },
    { type: 'note', duration: 'q' },
  ],
}

describe('renderPattern', () => {
  it('renders an SVG into the container', () => {
    const container = document.createElement('div')
    renderPattern(container, FOUR_QUARTERS, 4, 4)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('returns one anchor per note with increasing x positions', () => {
    const container = document.createElement('div')
    const result = renderPattern(container, FOUR_QUARTERS, 4, 4)
    expect(result.anchors).toHaveLength(4)
    expect(result.anchors.map((a) => a.eventIndex)).toEqual([0, 1, 2, 3])
    for (let i = 1; i < result.anchors.length; i++) {
      expect(result.anchors[i].x).toBeGreaterThan(result.anchors[i - 1].x)
    }
  })

  it('does not return anchors for rests', () => {
    const container = document.createElement('div')
    const result = renderPattern(
      container,
      {
        events: [
          { type: 'note', duration: 'q' },
          { type: 'rest', duration: 'q' },
          { type: 'note', duration: 'h' },
        ],
      },
      4,
      4,
    )
    expect(result.anchors.map((a) => a.eventIndex)).toEqual([0, 2])
  })

  it('splits a multi-measure pattern without throwing', () => {
    const container = document.createElement('div')
    const result = renderPattern(
      container,
      {
        events: [
          { type: 'note', duration: 'w' },
          { type: 'note', duration: 'q' },
          { type: 'note', duration: 'q' },
          { type: 'note', duration: 'h' },
        ],
      },
      4,
      4,
    )
    expect(result.anchors).toHaveLength(4)
  })

  it('clears any previous rendering from the container', () => {
    const container = document.createElement('div')
    renderPattern(container, FOUR_QUARTERS, 4, 4)
    renderPattern(container, FOUR_QUARTERS, 4, 4)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })
})
