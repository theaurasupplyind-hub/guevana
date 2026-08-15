import { useCallback, useEffect, useRef, useState } from 'react'
import MovieCard from './MovieCard.jsx'

const EDGE_EPSILON = 4

function Chevron() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6 L15 12 L9 18" />
    </svg>
  )
}

export default function Row({ title, movies, large }) {
  const trackRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > EDGE_EPSILON)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_EPSILON)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [update])

  const scrollDir = useCallback((dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }, [])

  if (!movies || movies.length === 0) return null

  return (
    <section className={large ? 'row large' : 'row'}>
      <h2 className="row-title">{title}</h2>
      <div className="row-scroll">
        <button
          type="button"
          className={canLeft ? 'row-scroll-btn left visible' : 'row-scroll-btn left'}
          onClick={() => scrollDir(-1)}
          tabIndex={canLeft ? 0 : -1}
          aria-label="Ver anteriores"
        >
          <Chevron />
        </button>
        <div className="row-track" ref={trackRef}>
          {movies.map((m) => (
            <MovieCard key={m.url} movie={m} large={large} />
          ))}
        </div>
        <button
          type="button"
          className={canRight ? 'row-scroll-btn right visible' : 'row-scroll-btn right'}
          onClick={() => scrollDir(1)}
          tabIndex={canRight ? 0 : -1}
          aria-label="Ver siguientes"
        >
          <Chevron />
        </button>
      </div>
    </section>
  )
}
