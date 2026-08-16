import type { CatalogItem, Episode, Season, Stream } from './types'
import { slugFromUrl } from './search'

const configuredBase = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '')
const API_BASES = [
  configuredBase || 'http://192.168.1.100:3001',
  'https://apizonalatamsrc.xzod.cloud',
  'https://zonaapp.ikkihkurogane.workers.dev'
].filter(Boolean)
const API_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN || ''
const memoryCache = new Map<string, unknown>()
let workingBase: string | null = null

export function getBackendUrl() {
  return configuredBase || API_BASES[0]
}

function decodeEntities(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
}

function cleanDescription(value = '') {
  return decodeEntities(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalize(item: CatalogItem): CatalogItem {
  return {
    ...item,
    title: decodeEntities(item.title || ''),
    url: item.url || '',
    slug: item.slug || slugFromUrl(item.url || ''),
    image: item.image || null
  }
}

function proxifyStream(stream: Stream): Stream {
  if (!stream?.url) return stream
  const base = getBackendUrl()
  const params = new URLSearchParams({ url: stream.url, ref: stream.referer || '' })
  if (API_TOKEN) params.set('token', API_TOKEN)
  return { ...stream, url: `${base}/stream/proxy?${params.toString()}` }
}

async function request<T>(path: string, options: { forceRefresh?: boolean } = {}): Promise<T> {
  if (!options.forceRefresh && memoryCache.has(path)) return memoryCache.get(path) as T
  const order = workingBase
    ? [workingBase, ...API_BASES.filter((base) => base !== workingBase)]
    : API_BASES
  let lastError: unknown
  for (const base of order) {
    try {
      const headers: Record<string, string> = {}
      if (API_TOKEN) headers['X-Auth-Token'] = API_TOKEN
      const response = await fetch(`${base}${path}`, { headers })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as T & { status?: string }
      if (data.status && data.status !== 'success' && data.status !== 'ready') {
        throw new Error(`API: ${data.status}`)
      }
      workingBase = base
      memoryCache.set(path, data)
      return data
    } catch (error) {
      lastError = error
    }
  }
  throw new Error(`Backend no disponible: ${lastError instanceof Error ? lastError.message : 'sin respuesta'}`)
}

export async function getCatalog(page = 1, forceRefresh = false) {
  const data = await request<{ featured?: CatalogItem[]; movies?: CatalogItem[]; totalPages?: number }>(
    `/list?page=${page}${forceRefresh ? '&refresh=1' : ''}`,
    { forceRefresh }
  )
  const featured = (data.featured || []).map(normalize)
  const movies = (data.movies || []).map(normalize)
  return { ...data, featured, movies, all: [...featured, ...movies] }
}

export async function getSeriesCatalog(page = 1, genre = 'series-de-tv', forceRefresh = false) {
  const data = await request<{ series?: CatalogItem[]; totalPages?: number }>(
    `/list/series?page=${page}&genre=${encodeURIComponent(genre)}${forceRefresh ? '&refresh=1' : ''}`,
    { forceRefresh }
  )
  const series = (data.series || []).map((item) => normalize({ ...item, type: 'serie' }))
  return { ...data, series, all: series }
}

export async function getAnimeCatalog(page = 1, forceRefresh = false) {
  const data = await request<{ series?: CatalogItem[]; totalPages?: number }>(
    `/list/anime?page=${page}${forceRefresh ? '&refresh=1' : ''}`,
    { forceRefresh }
  )
  const anime = (data.series || []).map((item) => normalize({ ...item, type: 'anime' }))
  return { ...data, anime, all: anime }
}

export async function getRecentSeriesEpisodes(forceRefresh = false): Promise<Episode[]> {
  const data = await request<{ episodes?: Episode[] }>(`/list/episodes?page=1${forceRefresh ? '&refresh=1' : ''}`, {
    forceRefresh
  })
  return data.episodes || []
}

export async function getRecentAnimeEpisodes(forceRefresh = false): Promise<Episode[]> {
  const data = await request<{ episodes?: Episode[] }>(`/list/anime/episodes${forceRefresh ? '?refresh=1' : ''}`, {
    forceRefresh
  })
  return data.episodes || []
}

export async function getRecentMovies(forceRefresh = false): Promise<CatalogItem[]> {
  const data = await request<{ movies?: CatalogItem[] }>(`/list/movies/recent${forceRefresh ? '?refresh=1' : ''}`, {
    forceRefresh
  })
  return (data.movies || []).map(normalize)
}

export async function getSeriesInfo(url: string, forceRefresh = false) {
  const data = await request<{ title?: string; description?: string; seasons?: Season[] }>(
    `/series/info?url=${encodeURIComponent(url)}`,
    { forceRefresh }
  )
  return {
    ...data,
    title: decodeEntities(data.title || ''),
    description: cleanDescription(data.description || ''),
    seasons: (data.seasons || []).map((season) => ({
      ...season,
      episodes: (season.episodes || []).map((episode) => ({ ...episode, title: decodeEntities(episode.title) }))
    }))
  }
}

export async function extractMovie(url: string, forceRefresh = false) {
  const data = await request<{ title?: string; description?: string; streams?: Stream[] }>(
    `/extract?url=${encodeURIComponent(url)}`,
    { forceRefresh }
  )
  return {
    ...data,
    title: decodeEntities(data.title || ''),
    description: cleanDescription(data.description || ''),
    streams: (data.streams || []).filter((stream) => stream?.url).map(proxifyStream)
  }
}

export async function getGenres(url: string) {
  const data = await request<{ genres?: string[] }>(`/genres?url=${encodeURIComponent(url)}`)
  return data.genres || []
}
