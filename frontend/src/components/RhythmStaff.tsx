import { useLayoutEffect, useRef, useState } from 'react'
import type { NoteStatus, Pattern } from '../api/types'
import { renderPattern } from '../lib/vexflowPattern'
import type { RenderedNote } from '../lib/vexflowPattern'

interface RhythmStaffProps {
  pattern: Pattern
  timeSignature: string
  /** Per-event feedback after an attempt (keyed by pattern event index). */
  noteStatuses?: Record<number, NoteStatus>
  /** Event index currently sounding during "I give up" playback. */
  playbackEventIndex?: number | null
  height?: number
  compact?: boolean
}

const STATUS_COLORS: Record<NoteStatus, string> = {
  hit: '#2e9e5b',
  early: '#d99a2b',
  late: '#d99a2b',
  missed: '#d64545',
}

export function RhythmStaff({
  pattern,
  timeSignature,
  noteStatuses,
  playbackEventIndex = null,
  height = 150,
  compact = false,
}: RhythmStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [renderedNotes, setRenderedNotes] = useState<RenderedNote[]>([])

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const container = containerRef.current
    if (!wrapper || !container) return

    const draw = () => {
      const width = Math.max(280, wrapper.clientWidth)
      try {
        setRenderedNotes(renderPattern(container, { pattern, timeSignature, width, height }))
      } catch (error) {
        console.error('Failed to render notation', error)
        setRenderedNotes([])
      }
    }

    draw()
    const observer = new ResizeObserver(() => draw())
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [pattern, timeSignature, height])

  const playbackNote =
    playbackEventIndex != null
      ? renderedNotes.find((note) => note.eventIndex === playbackEventIndex)
      : undefined

  return (
    <div ref={wrapperRef} className={`rhythm-staff ${compact ? 'rhythm-staff-compact' : ''}`}>
      <div ref={containerRef} className="rhythm-staff-svg" />
      <div className="rhythm-staff-overlay" aria-hidden="true">
        {noteStatuses &&
          renderedNotes
            .filter((note) => !note.isRest && noteStatuses[note.eventIndex] !== undefined)
            .map((note) => (
              <span
                key={note.eventIndex}
                className="feedback-dot"
                title={noteStatuses[note.eventIndex]}
                style={{
                  left: note.x - 6,
                  top: note.staveTop - 18,
                  backgroundColor: STATUS_COLORS[noteStatuses[note.eventIndex]],
                }}
              />
            ))}
        {playbackNote && (
          <span
            className="playback-dot"
            style={{ left: playbackNote.x - 8, top: playbackNote.staveTop - 22 }}
          />
        )}
      </div>
    </div>
  )
}
