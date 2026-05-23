import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, StaveTie, Voice } from 'vexflow'
import type { Pattern, PatternEvent } from '../api/types'
import { eventBeats } from './rhythm'

export interface NoteAnchor {
  /** Index of the event in `pattern.events` this anchor belongs to. */
  eventIndex: number
  /** Pixel position of the note head within the rendered SVG. */
  x: number
  y: number
}

export interface RenderResult {
  width: number
  height: number
  anchors: NoteAnchor[]
}

interface MeasureGroup {
  events: Array<{ event: PatternEvent; index: number }>
}

const STAVE_Y = 20
const STAVE_HEIGHT = 110

function splitIntoMeasures(pattern: Pattern, beatsPerMeasure: number): MeasureGroup[] {
  const measures: MeasureGroup[] = [{ events: [] }]
  let position = 0
  for (let i = 0; i < pattern.events.length; i++) {
    const event = pattern.events[i]
    const measureIndex = Math.floor(position / beatsPerMeasure + 1e-9)
    while (measures.length <= measureIndex) {
      measures.push({ events: [] })
    }
    measures[measureIndex].events.push({ event, index: i })
    position += eventBeats(event)
  }
  return measures.filter((m) => m.events.length > 0)
}

function toStaveNote(event: PatternEvent): StaveNote {
  const duration = event.type === 'rest' ? `${event.duration}r` : event.duration
  const note = new StaveNote({
    keys: ['b/4'],
    duration,
    clef: 'percussion',
  })
  if (event.dots) {
    Dot.buildAndAttach([note], { all: true })
  }
  return note
}

/**
 * Render a rhythm pattern as engraved notation inside `container` and return the
 * pixel position of every note head so the caller can overlay feedback dots.
 */
export function renderPattern(
  container: HTMLDivElement,
  pattern: Pattern,
  timeSigTop: number,
  timeSigBottom: number,
  options: { showTimeSignature?: boolean; scale?: number } = {},
): RenderResult {
  const { showTimeSignature = true } = options
  container.innerHTML = ''

  const beatsPerMeasure = timeSigTop * (4 / timeSigBottom)
  const measures = splitIntoMeasures(pattern, beatsPerMeasure)

  const measureWidths = measures.map((measure, measureIndex) => {
    const base = Math.max(140, measure.events.length * 64)
    return measureIndex === 0 ? base + 80 : base
  })
  const totalWidth = measureWidths.reduce((a, b) => a + b, 0) + 20
  const height = STAVE_Y + STAVE_HEIGHT + 30

  const renderer = new Renderer(container, Renderer.Backends.SVG)
  renderer.resize(totalWidth, height)
  const context = renderer.getContext()

  const allNotes: StaveNote[] = []
  const noteEventIndexes: number[] = []
  let x = 10

  measures.forEach((measure, measureIndex) => {
    const stave = new Stave(x, STAVE_Y, measureWidths[measureIndex])
    if (measureIndex === 0) {
      stave.addClef('percussion')
      if (showTimeSignature) {
        stave.addTimeSignature(`${timeSigTop}/${timeSigBottom}`)
      }
    }
    if (measureIndex === measures.length - 1) {
      stave.setEndBarType(3) // end barline
    }
    stave.setContext(context).draw()

    const notes = measure.events.map(({ event }) => toStaveNote(event))
    const beams = Beam.generateBeams(notes.filter((note) => !note.isRest()))
    const voice = new Voice({ numBeats: timeSigTop, beatValue: timeSigBottom })
    voice.setMode(Voice.Mode.SOFT)
    voice.addTickables(notes)
    new Formatter().joinVoices([voice]).formatToStave([voice], stave)
    voice.draw(context, stave)
    beams.forEach((beam) => beam.setContext(context).draw())

    measure.events.forEach(({ event, index }, i) => {
      if (event.type === 'note') {
        allNotes.push(notes[i])
        noteEventIndexes.push(index)
      }
    })

    x += measureWidths[measureIndex]
  })

  // Ties (may cross measure boundaries).
  pattern.events.forEach((event, index) => {
    if (event.type !== 'note' || !event.tieToNext) {
      return
    }
    const fromPosition = noteEventIndexes.indexOf(index)
    const toPosition = noteEventIndexes.indexOf(index + 1)
    if (fromPosition === -1 || toPosition === -1) {
      return
    }
    new StaveTie({
      firstNote: allNotes[fromPosition],
      lastNote: allNotes[toPosition],
    })
      .setContext(context)
      .draw()
  })

  const anchors: NoteAnchor[] = allNotes.map((note, i) => ({
    eventIndex: noteEventIndexes[i],
    x: note.getAbsoluteX(),
    y: STAVE_Y,
  }))

  return { width: totalWidth, height, anchors }
}
