import { useEffect, useRef, useState } from 'react'
import { searchLive } from './api.js'
import { itemType } from './search.js'

const DEBOUNCE_MS = 250

export default function useLiveSearch(query, { type = null, enabled = true } = {}) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)

  useEffect(() => {
    const q = (query || '').trim()
    if (!enabled || !q) {
      setResults([])
      setLoading(false)
      return
    }
    const seq = ++seqRef.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const items = await searchLive(q)
        if (seq !== seqRef.current) return
        const filtered = type ? items.filter((m) => itemType(m) === type) : items
        setResults(filtered)
      } catch {
        if (seq !== seqRef.current) return
        setResults([])
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      seqRef.current += 1
    }
  }, [query, type, enabled])

  return { results, loading }
}
