import { useCallback, useEffect, useRef, useState } from 'react'

interface TapCaptureOptions {
  /** The attempt ends automatically once this many taps have been recorded. */
  expectedTaps: number
  /** Called on every tap (used to play a tick). */
  onTap?: (tapIndex: number) => void
  /** Called with the full list of timestamps once `expectedTaps` taps are recorded. */
  onComplete?: (tapsMs: number[]) => void
}

interface TapCapture {
  capturing: boolean
  taps: number[]
  start: () => void
  stop: () => number[]
  reset: () => void
}

/**
 * Captures spacebar presses while active. Each press is timestamped with
 * `performance.now()`, ticks back via `onTap`, and the capture stops itself after
 * `expectedTaps` presses. Key auto-repeat is ignored.
 */
export function useTapCapture({ expectedTaps, onTap, onComplete }: TapCaptureOptions): TapCapture {
  const [capturing, setCapturing] = useState(false)
  const [taps, setTaps] = useState<number[]>([])
  const tapsRef = useRef<number[]>([])
  const capturingRef = useRef(false)
  const onTapRef = useRef(onTap)
  const onCompleteRef = useRef(onComplete)
  onTapRef.current = onTap
  onCompleteRef.current = onComplete

  const stop = useCallback((): number[] => {
    capturingRef.current = false
    setCapturing(false)
    return tapsRef.current
  }, [])

  const start = useCallback(() => {
    tapsRef.current = []
    setTaps([])
    capturingRef.current = true
    setCapturing(true)
  }, [])

  const reset = useCallback(() => {
    capturingRef.current = false
    setCapturing(false)
    tapsRef.current = []
    setTaps([])
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' && event.key !== ' ') {
        return
      }
      if (!capturingRef.current) {
        return
      }
      event.preventDefault()
      if (event.repeat) {
        return
      }
      const now = performance.now()
      tapsRef.current = [...tapsRef.current, now]
      setTaps(tapsRef.current)
      onTapRef.current?.(tapsRef.current.length - 1)
      if (tapsRef.current.length >= expectedTaps) {
        capturingRef.current = false
        setCapturing(false)
        onCompleteRef.current?.(tapsRef.current)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expectedTaps])

  return { capturing, taps, start, stop, reset }
}
