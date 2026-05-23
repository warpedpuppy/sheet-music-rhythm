import type { Pattern } from '../api/types'
import { RhythmStaff } from './RhythmStaff'

interface NotationExampleProps {
  pattern: Pattern
  timeSignature?: string
  caption?: string
}

/** A small notation diagram used throughout the Learn page. */
export function NotationExample({ pattern, timeSignature = '4/4', caption }: NotationExampleProps) {
  return (
    <figure className="notation-example">
      <RhythmStaff pattern={pattern} timeSignature={timeSignature} height={120} compact />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
