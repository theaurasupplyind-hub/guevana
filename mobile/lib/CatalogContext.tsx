import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  getAnimeCatalog,
  getCatalog,
  getRecentAnimeEpisodes,
  getRecentMovies,
  getRecentSeriesEpisodes,
  getSeriesCatalog
} from './api'
import { storage } from './storage'
import type { CatalogItem, Episode } from './types'

type CatalogContextValue = {
  catalog: CatalogItem[]
  seriesCatalog: CatalogItem[]
  animeCatalog: CatalogItem[]
  recentMovies: CatalogItem[]
  recentSeriesEpisodes: Episode[]
  recentAnimeEpisodes: Episode[]
  loading: boolean
  refreshing: boolean
  reload: () => Promise<void>
  hasMoreMovies: boolean
  hasMoreSeries: boolean
  hasMoreAnime: boolean
  loadingMoreMovies: boolean
  loadingMoreSeries: boolean
  loadingMoreAnime: boolean
  loadMoreMovies: () => Promise<void>
  loadMoreSeries: () => Promise<void>
  loadMoreAnime: () => Promise<void>
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

function itemKey(item: CatalogItem) {
  const year = String(item.year || '').match(/(19|20)\d{2}/)?.[0] || ''
  return `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${year}`
}

function mergeItems(...groups: CatalogItem[][]) {
  const result: CatalogItem[] = []
  const byKey = new Map<string, CatalogItem>()
  for (const group of groups) {
    for (const item of group) {
      if (!item.url) continue
      const key = itemKey(item)
      const current = byKey.get(key)
      if (!current) {
        const withSource = item.sources?.length ? item : { ...item, sources: [{ source: item.source, url: item.url }] }
        byKey.set(key, withSource)
        result.push(withSource)
        continue
      }
      const sources = [...(current.sources || [])]
      if (!sources.some((source) => source.url === item.url)) sources.push({ source: item.source, url: item.url })
      Object.assign(current, { sources })
    }
  }
  return result
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [seriesCatalog, setSeriesCatalog] = useState<CatalogItem[]>([])
  const [animeCatalog, setAnimeCatalog] = useState<CatalogItem[]>([])
  const [recentMovies, setRecentMovies] = useState<CatalogItem[]>([])
  const [recentSeriesEpisodes, setRecentSeriesEpisodes] = useState<Episode[]>([])
  const [recentAnimeEpisodes, setRecentAnimeEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [moviePage, setMoviePage] = useState(1)
  const [movieTotal, setMovieTotal] = useState(0)
  const [seriesPage, setSeriesPage] = useState(1)
  const [seriesTotal, setSeriesTotal] = useState(0)
  const [animePage, setAnimePage] = useState(1)
  const [animeTotal, setAnimeTotal] = useState(0)
  const [loadingMoreMovies, setLoadingMoreMovies] = useState(false)
  const [loadingMoreSeries, setLoadingMoreSeries] = useState(false)
  const [loadingMoreAnime, setLoadingMoreAnime] = useState(false)

  const catalogRef = useRef<CatalogItem[]>([])
  const seriesRef = useRef<CatalogItem[]>([])
  const animeRef = useRef<CatalogItem[]>([])
  const loadingMoreMoviesRef = useRef(false)
  const loadingMoreSeriesRef = useRef(false)
  const loadingMoreAnimeRef = useRef(false)

  useEffect(() => {
    catalogRef.current = catalog
  }, [catalog])

  useEffect(() => {
    seriesRef.current = seriesCatalog
  }, [seriesCatalog])

  useEffect(() => {
    animeRef.current = animeCatalog
  }, [animeCatalog])

  const reload = useCallback(async () => {
    setRefreshing(true)
    try {
      const [moviePage, seriesPage, animePage, movies, seriesEpisodes, animeEpisodes] = await Promise.all([
        getCatalog(1, true),
        getSeriesCatalog(1, 'series-de-tv', true),
        getAnimeCatalog(1, true),
        getRecentMovies(true),
        getRecentSeriesEpisodes(true),
        getRecentAnimeEpisodes(true)
      ])
      const nextCatalog = mergeItems(moviePage.all || [])
      const nextSeries = mergeItems(seriesPage.series || [])
      const nextAnime = mergeItems(animePage.anime || [])
      setCatalog(nextCatalog)
      setSeriesCatalog(nextSeries)
      setAnimeCatalog(nextAnime)
      setRecentMovies(movies)
      setRecentSeriesEpisodes(seriesEpisodes)
      setRecentAnimeEpisodes(animeEpisodes)
      setMoviePage(1)
      setMovieTotal(Math.max(1, Number(moviePage.totalPages) || 1))
      setSeriesPage(1)
      setSeriesTotal(Math.max(1, Number(seriesPage.totalPages) || 1))
      setAnimePage(1)
      setAnimeTotal(Math.max(1, Number(animePage.totalPages) || 1))
      await Promise.all([
        storage.catalog.save(nextCatalog),
        storage.series.save(nextSeries),
        storage.anime.save(nextAnime),
        storage.recentMovies.save(movies),
        storage.recentSeries.save(seriesEpisodes),
        storage.recentAnime.save(animeEpisodes),
        storage.catalogMeta.save({ page: 1, totalPages: Math.max(1, Number(moviePage.totalPages) || 1) }),
        storage.seriesMeta.save({ page: 1, totalPages: Math.max(1, Number(seriesPage.totalPages) || 1) }),
        storage.animeMeta.save({ page: 1, totalPages: Math.max(1, Number(animePage.totalPages) || 1) })
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const loadMoreMovies = useCallback(async () => {
    if (loadingMoreMoviesRef.current || moviePage >= movieTotal || catalogRef.current.length === 0) return
    loadingMoreMoviesRef.current = true
    setLoadingMoreMovies(true)
    try {
      const next = moviePage + 1
      const data = await getCatalog(next)
      const movies = data.movies || []
      const total = Math.max(next, Number(data.totalPages) || next)
      if (movies.length === 0) {
        setMovieTotal(total)
        return
      }
      const merged = mergeItems([...catalogRef.current, ...movies])
      setCatalog(merged)
      setMoviePage(next)
      setMovieTotal(total)
      storage.catalog.save(merged)
      storage.catalogMeta.save({ page: next, totalPages: total })
    } catch {
      /* detenerse sin romper */
    } finally {
      loadingMoreMoviesRef.current = false
      setLoadingMoreMovies(false)
    }
  }, [moviePage, movieTotal])

  const loadMoreSeries = useCallback(async () => {
    if (loadingMoreSeriesRef.current || seriesPage >= seriesTotal || seriesRef.current.length === 0) return
    loadingMoreSeriesRef.current = true
    setLoadingMoreSeries(true)
    try {
      const next = seriesPage + 1
      const data = await getSeriesCatalog(next, 'series-de-tv')
      const series = data.series || []
      const total = Math.max(next, Number(data.totalPages) || next)
      if (series.length === 0) {
        setSeriesTotal(total)
        return
      }
      const merged = mergeItems([...seriesRef.current, ...series])
      setSeriesCatalog(merged)
      setSeriesPage(next)
      setSeriesTotal(total)
      storage.series.save(merged)
      storage.seriesMeta.save({ page: next, totalPages: total })
    } catch {
      /* detenerse sin romper */
    } finally {
      loadingMoreSeriesRef.current = false
      setLoadingMoreSeries(false)
    }
  }, [seriesPage, seriesTotal])

  const loadMoreAnime = useCallback(async () => {
    if (loadingMoreAnimeRef.current || animePage >= animeTotal || animeRef.current.length === 0) return
    loadingMoreAnimeRef.current = true
    setLoadingMoreAnime(true)
    try {
      const next = animePage + 1
      const data = await getAnimeCatalog(next)
      const anime = data.anime || []
      const total = Math.max(next, Number(data.totalPages) || next)
      if (anime.length === 0) {
        setAnimeTotal(total)
        return
      }
      const merged = mergeItems([...animeRef.current, ...anime])
      setAnimeCatalog(merged)
      setAnimePage(next)
      setAnimeTotal(total)
      storage.anime.save(merged)
      storage.animeMeta.save({ page: next, totalPages: total })
    } catch {
      /* detenerse sin romper */
    } finally {
      loadingMoreAnimeRef.current = false
      setLoadingMoreAnime(false)
    }
  }, [animePage, animeTotal])

  useEffect(() => {
    let active = true
    Promise.all([
      storage.catalog.load(),
      storage.series.load(),
      storage.anime.load(),
      storage.recentMovies.load(),
      storage.recentSeries.load(),
      storage.recentAnime.load(),
      storage.catalogMeta.load(),
      storage.seriesMeta.load(),
      storage.animeMeta.load()
    ]).then(([movies, series, anime, recentMovieItems, recentSeries, recentAnime, catMeta, serMeta, aniMeta]) => {
      if (!active) return
      setCatalog(movies as CatalogItem[])
      setSeriesCatalog(series as CatalogItem[])
      setAnimeCatalog(anime as CatalogItem[])
      setRecentMovies(recentMovieItems as CatalogItem[])
      setRecentSeriesEpisodes(recentSeries as Episode[])
      setRecentAnimeEpisodes(recentAnime as Episode[])
      setMoviePage(catMeta.page)
      setMovieTotal(catMeta.totalPages)
      setSeriesPage(serMeta.page)
      setSeriesTotal(serMeta.totalPages)
      setAnimePage(aniMeta.page)
      setAnimeTotal(aniMeta.totalPages)
      if (movies.length === 0 && series.length === 0 && anime.length === 0) {
        reload()
      } else {
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [reload])

  const value = useMemo(
    () => ({
      catalog,
      seriesCatalog,
      animeCatalog,
      recentMovies,
      recentSeriesEpisodes,
      recentAnimeEpisodes,
      loading,
      refreshing,
      reload,
      hasMoreMovies: movieTotal > 0 && moviePage < movieTotal,
      hasMoreSeries: seriesTotal > 0 && seriesPage < seriesTotal,
      hasMoreAnime: animeTotal > 0 && animePage < animeTotal,
      loadingMoreMovies,
      loadingMoreSeries,
      loadingMoreAnime,
      loadMoreMovies,
      loadMoreSeries,
      loadMoreAnime
    }),
    [
      catalog,
      seriesCatalog,
      animeCatalog,
      recentMovies,
      recentSeriesEpisodes,
      recentAnimeEpisodes,
      loading,
      refreshing,
      reload,
      moviePage,
      movieTotal,
      seriesPage,
      seriesTotal,
      animePage,
      animeTotal,
      loadingMoreMovies,
      loadingMoreSeries,
      loadingMoreAnime,
      loadMoreMovies,
      loadMoreSeries,
      loadMoreAnime
    ]
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider')
  return context
}
