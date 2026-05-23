import type { Pattern } from '../api/types'
import { RhythmStaff } from './RhythmStaff'

interface NotationExampleProps {
  pattern: Pattern
  caption: string
  timeSigTop?: number
  timeSigBottom?: number
}

/** A small captioned notation diagram used throughout the Learn section. */
export function NotationExample({
  pattern,
  caption,
  timeSigTop = 4,
  timeSigBottom = 4,
}: NotationExampleProps) {
  return (
    <div className="notation-example">
      <RhythmStaff
        pattern={pattern}
        timeSigTop={timeSigTop}
        timeSigBottom={timeSigBottom}
        caption={caption}
      />
    </div>
  )
}
