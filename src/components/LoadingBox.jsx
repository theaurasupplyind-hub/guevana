import { useEffect, useRef, useState } from 'react'

export default function LoadingBox({ label, compact }) {
  const startRef = useRef(Date.now())
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    startRef.current = Date.now()
    setSeconds(0)
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [label])

  return (
    <div className={compact ? 'loading-box compact' : 'loading-box'}>
      <span className="spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
      <span className="loading-seconds">{seconds}s</span>
    </div>
  )
}
