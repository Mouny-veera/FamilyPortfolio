import { useEffect, useRef } from "react"

export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback)
  const hasRun = useRef(false)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled) {
      hasRun.current = false
      return
    }

    if (!hasRun.current) {
      savedCallback.current()
      hasRun.current = true
    }

    const id = setInterval(() => savedCallback.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
