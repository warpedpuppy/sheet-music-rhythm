import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Captures spacebar taps while `active` is true. Tap times are recorded in ms
 * relative to `startTime` (a performance.now() value, normally the moment of
 * the first count-in click).
 */
export function useTapCapture(active: boolean, startTime: number | null) {
  const [taps, setTaps] = useState<number[]>([])
  const startRef = useRef<number | null>(startTime)
  startRef.current = startTime

  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      if (event.repeat) return
      if (startRef.current == null) return
      const tapMs = performance.now() - startRef.current
      setTaps((previous) => [...previous, tapMs])
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [active])

  const reset = useCallback(() => setTaps([]), [])

  return { taps, reset }
}
