import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getCatalog, getSeriesCatalog, getAnimeCatalog, getAnimeGenresMap, getRecentAnimeEpisodes, getRecentMovies, getRecentSeriesEpisodes, getMovieGenres, slugFromUrl } from '../api.js'
import { makeTitleIndex, normalizeSearch } from '../search.js'
import {
  catalogStorage,
  catalogTsStorage,
  seriesStorage,
  seriesTsStorage,
  animeStorage,
  animeTsStorage,
  genresStorage,
  failedStorage,
  pausedStorage,
  dailyUsageStorage,
  recentEpisodesStorage,
  recentMoviesStorage,
  recentSeriesEpisodesStorage
} from '../storage.js'

const TOTAL_PAGES = 16
const MAX_SERIES_PAGES = 20
const MAX_ANIME_PAGES = 500
const SERIES_GENRES = [
  'series-de-tv',
  'k-dramas',
  'accion',
  'aventura',
  'comedia',
  'crimen',
  'drama',
  'familia',
  'romance',
  'suspense',
  'terror',
  'animacion'
]
const CONCURRENCY = 5
const MAX_ATTEMPTS = 3
const INDEX_DAILY_LIMIT = 10000
const CATALOG_TTL = 24 * 60 * 60 * 1000
const RECENT_EPISODES_TTL = 30 * 60 * 1000
const PERIODIC_REFRESH_MS = 60 * 60 * 1000

const CatalogContext = createContext(null)

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function titleKeyOf(m) {
  const tokens = normalizeSearch((m.title || '').replace(/\([^)]*\)/g, ' ')).join(' ')
  const y = String(m.year || '').match(/(19|20)\d{2}/)
  return `${tokens}|${y ? y[0] : ''}`
}

function mergeSources(item, entry) {
  const sources = item.sources || []
  if (sources.some((s) => s.url === entry.url)) return item
  return { ...item, sources: [...sources, entry] }
}

function createDedupe(existing) {
  const acc = [...existing]
  const seenUrl = new Set(acc.map((m) => m.url))
  const seenKey = new Map()
  for (const m of acc) {
    const key = titleKeyOf(m)
    if (!seenKey.has(key)) seenKey.set(key, m)
  }
  const add = (item) => {
    if (seenUrl.has(item.url)) return false
    const key = titleKeyOf(item)
    const existingItem = seenKey.get(key)
    if (existingItem) {
      const entry = { source: item.source, url: item.url }
      const idx = acc.indexOf(existingItem)
      const merged = mergeSources(existingItem, entry)
      acc[idx] = merged
      seenKey.set(key, merged)
      return true
    }
    seenUrl.add(item.url)
    seenKey.set(key, item)
    acc.push(item)
    return true
  }
  return { acc, add }
}

function computeCounts(genres) {
  const counts = {}
  for (const url of Object.keys(genres)) {
    for (const g of genres[url]) {
      counts[g] = (counts[g] || 0) + 1
    }
  }
  return counts
}

export function CatalogProvider({ children }) {
  const [catalog, setCatalog] = useState(() => catalogStorage.load())
  const [loading, setLoading] = useState(() => catalogStorage.load().length === 0)
  const [catalogTs, setCatalogTs] = useState(() => catalogTsStorage.load())
  const [seriesCatalog, setSeriesCatalog] = useState(() => seriesStorage.load())
  const [seriesLoading, setSeriesLoading] = useState(() => seriesStorage.load().length === 0)
  const [seriesTs, setSeriesTs] = useState(() => seriesTsStorage.load())
  const [animeCatalog, setAnimeCatalog] = useState(() => animeStorage.load())
  const [animeLoading, setAnimeLoading] = useState(() => animeStorage.load().length === 0)
  const [animeTs, setAnimeTs] = useState(() => animeTsStorage.load())
  const [counts, setCounts] = useState(() => computeCounts(genresStorage.load()))
  const [failed, setFailed] = useState(() => failedStorage.load())
  const [paused, setPaused] = useState(() => pausedStorage.load())
  const [indexing, setIndexing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [dailyLimitReached, setDailyLimitReached] = useState(false)
  const [bulkGenresLoaded, setBulkGenresLoaded] = useState(false)
  const [recentEpisodes, setRecentEpisodes] = useState(() => recentEpisodesStorage.load())
  const [recentMovies, setRecentMovies] = useState(() => recentMoviesStorage.load())
  const [recentSeriesEpisodes, setRecentSeriesEpisodes] = useState(() => recentSeriesEpisodesStorage.load())

  const genresRef = useRef(genresStorage.load())
  const failedRef = useRef(failed)
  const pausedRef = useRef(paused)
  const runningRef = useRef(false)
  const refreshingRef = useRef(false)
  const refreshingSeriesRef = useRef(false)
  const refreshingAnimeRef = useRef(false)
  const bulkGenresBusyRef = useRef(false)
  const saveTimer = useRef(null)
  const dailyRef = useRef(dailyUsageStorage.load())
  const animeCatalogRef = useRef(animeCatalog)
  const loadAnimeCatalogRef = useRef(null)
  const catalogRef = useRef(catalog)

  const checkDailyBudget = useCallback(() => {
    if (dailyRef.current.date !== todayKey()) {
      dailyRef.current = { date: todayKey(), count: 0 }
      dailyUsageStorage.save(dailyRef.current)
      setDailyLimitReached(false)
      return true
    }
    if (dailyRef.current.count >= INDEX_DAILY_LIMIT) {
      setDailyLimitReached(true)
      return false
    }
    return true
  }, [])

  const spendDailyBudget = useCallback((n) => {
    dailyRef.current.count += n
    dailyUsageStorage.save(dailyRef.current)
  }, [])

  const persist = useCallback(() => {
    genresStorage.save(genresRef.current)
    failedStorage.save(failedRef.current)
  }, [])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) return
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      persist()
    }, 3000)
  }, [persist])

  useEffect(() => {
    const flush = () => persist()
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [persist])

  const loadFullCatalog = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    try {
      const { acc, add } = createDedupe(catalog)
      const setAndSave = (arr) => {
        setCatalog(arr)
        catalogStorage.save(arr)
      }
      for (let page = 1; page <= TOTAL_PAGES; page++) {
        const data = await getCatalog(page)
        let changed = false
        for (const m of data.all) {
          if (add(m)) changed = true
        }
        if (changed) setAndSave(acc)
        if (page === 1) setLoading(false)
      }
      if (acc.length === 0) catalogStorage.save([])
      const now = Date.now()
      catalogTsStorage.save(now)
      setCatalogTs(now)
    } catch {
      setLoading(false)
    } finally {
      refreshingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (catalog.length === 0) {
      loadFullCatalog()
      return
    }
    if (Date.now() - catalogTs > CATALOG_TTL) loadFullCatalog()
  }, [catalog.length, catalogTs, loadFullCatalog])

  const loadSeriesCatalog = useCallback(async ({ forceRefresh = false } = {}) => {
    if (refreshingSeriesRef.current) return
    refreshingSeriesRef.current = true
    try {
      const baseTitle = (t) => normalizeSearch((t || '').replace(/\([^)]*\)/g, ' ')).join(' ')
      const animeTitles = new Set(animeCatalog.map((a) => baseTitle(a.title)))
      const { acc, add } = createDedupe(seriesCatalog)
      for (const genre of SERIES_GENRES) {
        let page = 1
        let totalPages = 1
        while (page <= totalPages && page <= MAX_SERIES_PAGES) {
          const data = await getSeriesCatalog(page, genre, { forceRefresh })
          const isLiveGenre = genre === 'series-de-tv' || genre === 'k-dramas'
          let changed = false
          for (const s of data.series) {
            if (!isLiveGenre && animeTitles.has(baseTitle(s.title))) continue
            if (add({ ...s, genre })) changed = true
          }
          if (changed) {
            setSeriesCatalog(acc)
            seriesStorage.save(acc)
          }
          if (page === 1) setSeriesLoading(false)
          if (data.totalPages && data.totalPages > totalPages) totalPages = data.totalPages
          page += 1
        }
      }
      const now = Date.now()
      seriesTsStorage.save(now)
      setSeriesTs(now)
    } catch {
      setSeriesLoading(false)
    } finally {
      refreshingSeriesRef.current = false
    }
  }, [seriesCatalog, animeCatalog])

  useEffect(() => {
    if (seriesCatalog.length === 0) {
      loadSeriesCatalog()
      return
    }
    if (Date.now() - seriesTs > CATALOG_TTL) loadSeriesCatalog()
  }, [seriesCatalog.length, seriesTs, loadSeriesCatalog])

  const refreshSeriesCatalog = useCallback(async () => {
    await loadSeriesCatalog({ forceRefresh: true })
  }, [loadSeriesCatalog])

  useEffect(() => {
    if (animeCatalog.length === 0 || seriesCatalog.length === 0) return
    const baseTitle = (t) => normalizeSearch((t || '').replace(/\([^)]*\)/g, ' ')).join(' ')
    const animeTitles = new Set(animeCatalog.map((a) => baseTitle(a.title)))
    const filtered = seriesCatalog.filter((s) => {
      const live = s.genre === 'series-de-tv' || s.genre === 'k-dramas'
      return live || !animeTitles.has(baseTitle(s.title))
    })
    if (filtered.length !== seriesCatalog.length) {
      setSeriesCatalog(filtered)
      seriesStorage.save(filtered)
    }
  }, [animeCatalog, seriesCatalog])

  const loadAnimeCatalog = useCallback(async () => {
    if (refreshingAnimeRef.current) return
    refreshingAnimeRef.current = true
    let started = false
    let anySuccess = false
    try {
      const seen = new Set(animeCatalog.map((s) => s.url))
      const acc = [...animeCatalog]
      let page = 1
      let totalPages = 1
      while (page <= totalPages && page <= MAX_ANIME_PAGES) {
        const targets = []
        while (targets.length < CONCURRENCY && page <= totalPages && page <= MAX_ANIME_PAGES) {
          targets.push(page)
          page += 1
        }
        const results = await Promise.allSettled(targets.map((p) => getAnimeCatalog(p)))
        let changed = false
        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          anySuccess = true
          const data = r.value
          if (data.totalPages && data.totalPages > totalPages) totalPages = data.totalPages
          for (const s of data.anime) {
            if (!seen.has(s.url)) {
              seen.add(s.url)
              acc.push(s)
              changed = true
            }
          }
        }
        if (changed) {
          setAnimeCatalog(acc)
          animeStorage.save(acc)
        }
        if (!started) {
          started = true
          setAnimeLoading(false)
        }
      }
      if (anySuccess) {
        const now = Date.now()
        animeTsStorage.save(now)
        setAnimeTs(now)
      }
    } catch {
      setAnimeLoading(false)
    } finally {
      refreshingAnimeRef.current = false
    }
  }, [animeCatalog])

  useEffect(() => {
    if (animeCatalog.length === 0) {
      loadAnimeCatalog()
      return
    }
    if (Date.now() - animeTs > CATALOG_TTL) loadAnimeCatalog()
  }, [animeCatalog.length, animeTs, loadAnimeCatalog])

  useEffect(() => {
    animeCatalogRef.current = animeCatalog
  }, [animeCatalog])

  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  useEffect(() => {
    loadAnimeCatalogRef.current = loadAnimeCatalog
  }, [loadAnimeCatalog])

  const mergeFeedIntoCatalog = useCallback((eps) => {
    const known = new Set(animeCatalogRef.current.map((m) => m.url))
    const toAdd = []
    for (const ep of eps) {
      const detailUrl = `https://jkanime.net/${ep.slug}/`
      if (!known.has(detailUrl)) {
        known.add(detailUrl)
        toAdd.push({
          title: ep.series,
          url: detailUrl,
          image: ep.image || null,
          type: 'anime',
          slug: ep.slug
        })
      }
    }
    if (toAdd.length > 0) {
      const merged = [...animeCatalogRef.current, ...toAdd]
      animeCatalogRef.current = merged
      setAnimeCatalog(merged)
      animeStorage.save(merged)
    }
  }, [])

  const loadRecentEpisodes = useCallback(async ({ forceRefresh = false } = {}) => {
    try {
      const eps = await getRecentAnimeEpisodes({ forceRefresh })
      setRecentEpisodes(eps)
      recentEpisodesStorage.save(eps)
      recentEpisodesStorage.ts.save(Date.now())
      mergeFeedIntoCatalog(eps)
    } catch {
      /* mantener lo cacheado */
    }
  }, [mergeFeedIntoCatalog])

  useEffect(() => {
    if (recentEpisodes.length === 0 || Date.now() - recentEpisodesStorage.ts.load() > RECENT_EPISODES_TTL) {
      loadRecentEpisodes()
    }
  }, [recentEpisodes.length, loadRecentEpisodes])

  const mergeRecentMoviesIntoCatalog = useCallback((movies) => {
    const known = new Set(catalogRef.current.map((m) => m.url))
    const toAdd = movies.filter((m) => m.url && !known.has(m.url))
    if (toAdd.length > 0) {
      const merged = [...catalogRef.current, ...toAdd]
      catalogRef.current = merged
      setCatalog(merged)
      catalogStorage.save(merged)
    }
  }, [])

  const loadRecentMovies = useCallback(async ({ forceRefresh = false } = {}) => {
    try {
      const movies = await getRecentMovies({ forceRefresh })
      setRecentMovies(movies)
      recentMoviesStorage.save(movies)
      recentMoviesStorage.ts.save(Date.now())
      mergeRecentMoviesIntoCatalog(movies)
    } catch {
      /* mantener lo cacheado */
    }
  }, [mergeRecentMoviesIntoCatalog])

  const loadRecentSeriesEpisodes = useCallback(async ({ forceRefresh = false } = {}) => {
    try {
      const eps = await getRecentSeriesEpisodes({ forceRefresh })
      setRecentSeriesEpisodes(eps)
      recentSeriesEpisodesStorage.save(eps)
      recentSeriesEpisodesStorage.ts.save(Date.now())
    } catch {
      /* mantener lo cacheado */
    }
  }, [])

  useEffect(() => {
    if (recentMovies.length === 0 || Date.now() - recentMoviesStorage.ts.load() > RECENT_EPISODES_TTL) {
      loadRecentMovies()
    }
  }, [recentMovies.length, loadRecentMovies])

  useEffect(() => {
    if (
      recentSeriesEpisodes.length === 0 ||
      Date.now() - recentSeriesEpisodesStorage.ts.load() > RECENT_EPISODES_TTL
    ) {
      loadRecentSeriesEpisodes()
    }
  }, [recentSeriesEpisodes.length, loadRecentSeriesEpisodes])

  const refreshAnimeCatalog = useCallback(async () => {
    try {
      const first = await getAnimeCatalog(1, { forceRefresh: true })
      const known = new Set(animeCatalogRef.current.map((m) => m.url))
      const hasNew = (first.anime || []).some((m) => !known.has(m.url))
      if (hasNew && !refreshingAnimeRef.current) {
        await loadAnimeCatalogRef.current?.()
      }
      return hasNew
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      refreshAnimeCatalog()
      loadRecentEpisodes({ forceRefresh: true })
      loadRecentMovies({ forceRefresh: true })
      loadRecentSeriesEpisodes({ forceRefresh: true })
    }, PERIODIC_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshAnimeCatalog, loadRecentEpisodes, loadRecentMovies, loadRecentSeriesEpisodes])

  const loadAnimeGenres = useCallback(async () => {
    if (bulkGenresLoaded || bulkGenresBusyRef.current) return
    bulkGenresBusyRef.current = true
    try {
      const map = await getAnimeGenresMap()
      let changed = false
      for (const [url, gs] of Object.entries(map)) {
        if (Array.isArray(gs) && gs.length > 0 && !genresRef.current[url]) {
          genresRef.current[url] = gs
          changed = true
        }
      }
      if (changed) {
        genresStorage.save(genresRef.current)
        setCounts(computeCounts(genresRef.current))
      }
    } catch {
      /* si falla el bulk, el indexado por-titulo cubre los faltantes */
    } finally {
      bulkGenresBusyRef.current = false
      setBulkGenresLoaded(true)
    }
  }, [bulkGenresLoaded])

  useEffect(() => {
    if (animeLoading || animeCatalog.length === 0) return
    loadAnimeGenres()
  }, [animeLoading, animeCatalog.length, loadAnimeGenres])

  const setPausedBoth = useCallback((value) => {
    pausedRef.current = value
    pausedStorage.save(value)
    setPaused(value)
  }, [])

  const pause = useCallback(() => setPausedBoth(true), [setPausedBoth])
  const resume = useCallback(() => setPausedBoth(false), [setPausedBoth])

  const retryFailed = useCallback(() => {
    failedRef.current = []
    failedStorage.save([])
    setFailed([])
    setPausedBoth(false)
  }, [setPausedBoth])

  const resetDailyLimit = useCallback(() => {
    dailyRef.current = { date: todayKey(), count: 0 }
    dailyUsageStorage.save(dailyRef.current)
    setDailyLimitReached(false)
    setPausedBoth(false)
  }, [setPausedBoth])

  const runIndexing = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setIndexing(true)
    try {
      while (!pausedRef.current) {
        if (!checkDailyBudget()) break

        const todo = [...catalog, ...seriesCatalog, ...animeCatalog]
          .map((m) => m.url)
          .filter((u) => !genresRef.current[u] && !failedRef.current.includes(u))
          .filter((u) => bulkGenresLoaded || !u.includes('jkanime.net'))
        if (todo.length === 0) break

        const batch = todo.slice(0, CONCURRENCY)
        await Promise.all(
          batch.map(async (url) => {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
              try {
                const genres = await getMovieGenres(url)
                genresRef.current[url] = genres
                return
              } catch (e) {
                if (attempt === MAX_ATTEMPTS) failedRef.current.push(url)
                else await new Promise((r) => setTimeout(r, 1200 * attempt))
              }
            }
          })
        )
        spendDailyBudget(batch.length)

        setCounts(computeCounts(genresRef.current))
        scheduleSave()
        const total = catalog.length + seriesCatalog.length + animeCatalog.length
        const done = Object.keys(genresRef.current).length + failedRef.current.length
        setProgress({ done: Math.min(done, total), total })
      }
      persist()
    } finally {
      runningRef.current = false
      setIndexing(false)
    }
  }, [catalog, seriesCatalog, animeCatalog, persist, scheduleSave, checkDailyBudget, spendDailyBudget, bulkGenresLoaded])

  useEffect(() => {
    if (loading || seriesLoading || animeLoading || indexing || paused || dailyLimitReached) return
    if (catalog.length + seriesCatalog.length + animeCatalog.length === 0) return
    const remaining = [...catalog, ...seriesCatalog, ...animeCatalog].some(
      (m) =>
        !genresRef.current[m.url] &&
        !failedRef.current.includes(m.url) &&
        (bulkGenresLoaded || !m.url.includes('jkanime.net'))
    )
    if (remaining) runIndexing()
  }, [
    loading,
    seriesLoading,
    animeLoading,
    indexing,
    paused,
    dailyLimitReached,
    bulkGenresLoaded,
    catalog,
    seriesCatalog,
    animeCatalog,
    runIndexing
  ])

  const genresOf = useCallback((url) => genresRef.current[url] || [], [])

  const allSearchItems = useMemo(
    () => [...catalog, ...seriesCatalog, ...animeCatalog],
    [catalog, seriesCatalog, animeCatalog]
  )

  const titleIndex = useMemo(() => makeTitleIndex(allSearchItems), [allSearchItems])

  const genreList = useMemo(
    () => Object.entries(counts).sort((a, b) => b[1] - a[1]),
    [counts]
  )

  const total = catalog.length + seriesCatalog.length + animeCatalog.length
  const done = Object.keys(genresRef.current).length + failedRef.current.length
  const progressSafe = total > 0 ? { done: Math.min(done, total), total } : progress

  const value = {
    catalog,
    loading,
    seriesCatalog,
    seriesLoading,
    animeCatalog,
    animeLoading,
    recentEpisodes,
    recentMovies,
    recentSeriesEpisodes,
    counts,
    genreList,
    genresOf,
    titleIndex,
    failed,
    indexing,
    paused,
    dailyLimitReached,
    progress: progressSafe,
    pause,
    resume,
    retryFailed,
    resetDailyLimit,
    refreshAnimeCatalog,
    refreshSeriesCatalog,
    loadRecentMovies,
    loadRecentSeriesEpisodes
  }

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog debe usarse dentro de CatalogProvider')
  return ctx
}
