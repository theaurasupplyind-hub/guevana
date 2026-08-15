import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
      await Promise.all([
        storage.catalog.save(nextCatalog),
        storage.series.save(nextSeries),
        storage.anime.save(nextAnime),
        storage.recentMovies.save(movies),
        storage.recentSeries.save(seriesEpisodes),
        storage.recentAnime.save(animeEpisodes)
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      storage.catalog.load(),
      storage.series.load(),
      storage.anime.load(),
      storage.recentMovies.load(),
      storage.recentSeries.load(),
      storage.recentAnime.load()
    ]).then(([movies, series, anime, recentMovieItems, recentSeries, recentAnime]) => {
      if (!active) return
      setCatalog(movies as CatalogItem[])
      setSeriesCatalog(series as CatalogItem[])
      setAnimeCatalog(anime as CatalogItem[])
      setRecentMovies(recentMovieItems as CatalogItem[])
      setRecentSeriesEpisodes(recentSeries as Episode[])
      setRecentAnimeEpisodes(recentAnime as Episode[])
      setLoading(false)
      if (movies.length === 0 && series.length === 0 && anime.length === 0) reload()
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
      reload
    }),
    [catalog, seriesCatalog, animeCatalog, recentMovies, recentSeriesEpisodes, recentAnimeEpisodes, loading, refreshing, reload]
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const context = useContext(CatalogContext)
  if (!context) throw new Error('useCatalog must be used inside CatalogProvider')
  return context
}
