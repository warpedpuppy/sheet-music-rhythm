import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow'
import type { Pattern, PatternEvent } from '../api/types'
import { beatsPerMeasure, splitIntoMeasures } from './rhythm'

export interface RenderedNote {
  /** Index of the event in pattern.events. */
  eventIndex: number
  isRest: boolean
  /** Center x of the notehead, relative to the rendered SVG. */
  x: number
  /** Top of the stave, relative to the rendered SVG. */
  staveTop: number
}

export function vexDuration(event: PatternEvent): string {
  const dotted = event.dots === 1 ? 'd' : ''
  return event.type === 'rest' ? `${event.duration}${dotted}r` : `${event.duration}${dotted}`
}

export interface RenderOptions {
  pattern: Pattern
  timeSignature: string
  width: number
  height?: number
}

const STAVE_TOP = 30
const LEFT_PAD = 10

/**
 * Renders the rhythm pattern into the container as an SVG and returns the
 * positions of each event's notehead so dots can be overlaid on top.
 */
export function renderPattern(container: HTMLDivElement, options: RenderOptions): RenderedNote[] {
  const { pattern, timeSignature, width } = options
  const height = options.height ?? 150
  container.innerHTML = ''

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const measures = splitIntoMeasures(pattern, timeSignature)
  if (measures.length === 0) return []

  const usableWidth = width - LEFT_PAD * 2
  const firstExtra = 60
  const measureWidth = (usableWidth - firstExtra) / measures.length

  const rendered: RenderedNote[] = []
  const allNotes: { note: StaveNote; event: PatternEvent; eventIndex: number }[] = []
  let eventIndex = 0
  let x = LEFT_PAD

  measures.forEach((measureEvents, measureIndex) => {
    const staveWidth = measureIndex === 0 ? measureWidth + firstExtra : measureWidth
    const stave = new Stave(x, STAVE_TOP, staveWidth)
    if (measureIndex === 0) {
      stave.addClef('percussion')
      stave.addTimeSignature(timeSignature)
    }
    stave.setContext(context).draw()

    const notes = measureEvents.map((event) => {
      const note = new StaveNote({
        keys: ['b/4'],
        duration: vexDuration(event),
        clef: 'percussion',
      })
      if (event.dots === 1) {
        Dot.buildAndAttach([note], { all: true })
      }
      return note
    })

    const voice = new Voice({ numBeats: beatsPerMeasure(timeSignature), beatValue: 4 })
    voice.setMode(Voice.Mode.SOFT)
    voice.addTickables(notes)

    const beams = Beam.generateBeams(notes)
    new Formatter().joinVoices([voice]).formatToStave([voice], stave)
    voice.draw(context, stave)
    beams.forEach((beam) => beam.setContext(context).draw())

    measureEvents.forEach((event, i) => {
      allNotes.push({ note: notes[i], event, eventIndex: eventIndex + i })
      rendered.push({
        eventIndex: eventIndex + i,
        isRest: event.type === 'rest',
        x: notes[i].getAbsoluteX(),
        staveTop: STAVE_TOP,
      })
    })
    eventIndex += measureEvents.length
    x += staveWidth
  })

  // Ties (within or across measures).
  allNotes.forEach((entry, i) => {
    if (entry.event.tieToNext && entry.event.type === 'note' && i + 1 < allNotes.length) {
      const next = allNotes[i + 1]
      const tie = new StaveTie({
        firstNote: entry.note,
        lastNote: next.note,
        firstIndexes: [0],
        lastIndexes: [0],
      })
      tie.setContext(context).draw()
    }
  })

  return rendered
}
