import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Captures spacebar taps while `active` is true. Tap times are recorded in ms
 * relative to `startTime` (a performance.now() value from when recording
 * began). `onTap` fires synchronously on each accepted tap — used to play the
 * tick sound with minimal latency.
 */
export function useTapCapture(active: boolean, startTime: number | null, onTap?: () => void) {
  const [taps, setTaps] = useState<number[]>([])
  const startRef = useRef<number | null>(startTime)
  startRef.current = startTime
  const onTapRef = useRef<(() => void) | undefined>(onTap)
  onTapRef.current = onTap

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      if (event.repeat) return
      if (startRef.current == null) return
      const tapMs = performance.now() - startRef.current
      onTapRef.current?.()
      setTaps((previous) => [...previous, tapMs])
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [active])

  const reset = useCallback(() => setTaps([]), [])

  return { taps, reset }
}
