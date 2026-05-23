import { useEffect, useRef, useState } from 'react'
import type { Pattern, Verdict } from '../api/types'
import { renderPattern } from '../lib/vexflowPattern'
import type { NoteAnchor } from '../lib/vexflowPattern'

export interface DotMarker {
  /** Index into `pattern.events` of the note this dot sits above. */
  eventIndex: number
  kind: Verdict | 'playing'
  label?: string
}

const DOT_COLORS: Record<DotMarker['kind'], string> = {
  on_time: '#2e9e5b',
  early: '#e0a73c',
  late: '#e0a73c',
  wrong: '#d9534f',
  missed: '#9aa0a6',
  playing: '#3b6fe0',
}

const DOT_SYMBOLS: Partial<Record<DotMarker['kind'], string>> = {
  early: '◂',
  late: '▸',
}

interface RhythmStaffProps {
  pattern: Pattern
  timeSigTop: number
  timeSigBottom: number
  dots?: DotMarker[]
  caption?: string
}

/** Engraved notation with optional colored feedback dots floating above the notes. */
export function RhythmStaff({ pattern, timeSigTop, timeSigBottom, dots = [], caption }: RhythmStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [anchors, setAnchors] = useState<NoteAnchor[]>([])
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    try {
      const result = renderPattern(container, pattern, timeSigTop, timeSigBottom)
      setAnchors(result.anchors)
      setRenderError(null)
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : 'Could not render notation')
    }
  }, [pattern, timeSigTop, timeSigBottom])

  if (renderError) {
    return <p className="error-text">Notation error: {renderError}</p>
  }

  return (
    <figure className="rhythm-staff">
      <div className="rhythm-staff-canvas">
        <div ref={containerRef} />
        {dots.map((dot, i) => {
          const anchor = anchors.find((a) => a.eventIndex === dot.eventIndex)
          if (!anchor) {
            return null
          }
          return (
            <span
              key={`${dot.eventIndex}-${dot.kind}-${i}`}
              className={`note-dot note-dot-${dot.kind}`}
              style={{ left: anchor.x - 7, top: anchor.y - 14, background: DOT_COLORS[dot.kind] }}
              title={dot.label ?? dot.kind.replace('_', ' ')}
            >
              {DOT_SYMBOLS[dot.kind] ?? ''}
            </span>
          )
        })}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
