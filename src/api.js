export const LOCAL_BASE = import.meta.env.VITE_EMBEDDED ? '' : 'http://127.0.0.1:3001'

const STREAM_PROXY_PATH = '/stream/proxy'

function proxifyStream(s) {
  if (!s || !s.referer || !s.url) return s
  const params = new URLSearchParams({ url: s.url, ref: s.referer })
  const path = `${STREAM_PROXY_PATH}?${params.toString()}`
  return { ...s, url: LOCAL_BASE ? `${LOCAL_BASE}${path}` : path }
}

const API_BASES = [
  { name: 'local', base: LOCAL_BASE },
  { name: 'xzod', base: 'https://apizonalatamsrc.xzod.cloud' },
  { name: 'worker', base: 'https://zonaapp.ikkihkurogane.workers.dev' }
]

const EXTRACT_TTL = 7 * 24 * 60 * 60 * 1000
const EXTRACT_KEY = 'guevana.extract.v1'

const cache = new Map()
let workingBase = null
let apiDown = false
const statusListeners = new Set()

function setApiDown(value) {
  if (apiDown === value) return
  apiDown = value
  statusListeners.forEach((cb) => cb(value))
}

export function getApiDown() {
  return apiDown
}

export function onApiStatusChange(cb) {
  statusListeners.add(cb)
  return () => statusListeners.delete(cb)
}

function readExtractCache() {
  try {
    return JSON.parse(localStorage.getItem(EXTRACT_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeExtractCache(map) {
  try {
    localStorage.setItem(EXTRACT_KEY, JSON.stringify(map))
  } catch {
    /* almacenamiento lleno: ignorar */
  }
}

export function getCachedMovieInfo(url) {
  if (url.includes('jkanime.net')) return null
  const entry = readExtractCache()[url]
  if (!entry) return null
  if (Date.now() - entry.ts > EXTRACT_TTL) return null
  return entry.data
}

function saveCachedMovieInfo(url, data) {
  if (url.includes('jkanime.net')) return
  const { streams, resolutionTrace, ...info } = data
  const map = readExtractCache()
  map[url] = { data: info, ts: Date.now() }
  writeExtractCache(map)
}

async function request(url, { retries = 0, forceRefresh = false, localOnly = false, requireStreams = false } = {}) {
  if (!forceRefresh && cache.has(url)) {
    const hit = cache.get(url)
    if (!requireStreams || (hit.streams && hit.streams.length > 0)) return hit
  }

  const order = localOnly
    ? [LOCAL_BASE]
    : workingBase
      ? [workingBase, ...API_BASES.map((b) => b.base).filter((b) => b !== workingBase)]
      : API_BASES.map((b) => b.base)

  let lastError
  for (const base of order) {
    try {
      const res = await fetch(`${base}${url}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.status && data.status !== 'success') throw new Error(`API: ${data.status}`)
      if (requireStreams && (!data.streams || data.streams.length === 0)) {
        throw new Error(`API: sin streams en ${base || 'local'}`)
      }
      if (!localOnly) workingBase = base
      setApiDown(false)
      const tagged = { ...data, base }
      cache.set(url, tagged)
      return tagged
    } catch (e) {
      lastError = e
    }
  }

  setApiDown(true)
  if (retries > 0) {
    await new Promise((r) => setTimeout(r, 800))
    return request(url, { retries: retries - 1, forceRefresh, localOnly })
  }
  throw new Error(`API no disponible: ${lastError ? lastError.message : 'sin respuesta'}`)
}

export async function pingApi() {
  try {
    await request('/list?page=1')
    return true
  } catch {
    return false
  }
}

export function decodeEntities(str = '') {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}

function cleanDescription(str = '') {
  return decodeEntities(str).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function slugFromUrl(url = '') {
  return url.replace(/\/+$/, '').split('/').pop() || 'movie'
}

export async function getCatalog(page = 1) {
  const data = await request(`/list?page=${page}`, { retries: 1 })
  const featured = (data.featured || []).map(normalize)
  const movies = (data.movies || []).map(normalize)
  return {
    ...data,
    featured,
    movies,
    all: [...featured, ...movies]
  }
}

export async function getSeriesCatalog(page = 1, genre = 'series-de-tv') {
  const data = await request(`/list/series?page=${page}&genre=${encodeURIComponent(genre)}`, {
    retries: 1
  })
  const series = (data.series || []).map((s) => normalize({ ...s, type: 'serie' }))
  return {
    ...data,
    series,
    all: series
  }
}

export async function getAnimeCatalog(page = 1, { forceRefresh = false } = {}) {
  const data = await request(`/list/anime?page=${page}${forceRefresh ? '&refresh=1' : ''}`, {
    retries: 1,
    localOnly: true,
    forceRefresh
  })
  const anime = (data.series || []).map((s) => normalize({ ...s, type: 'anime' }))
  return {
    ...data,
    anime,
    all: anime
  }
}

export async function getRecentAnimeEpisodes({ forceRefresh = false } = {}) {
  const data = await request(`/list/anime/episodes${forceRefresh ? '?refresh=1' : ''}`, {
    retries: 1,
    localOnly: true,
    forceRefresh
  })
  return data.episodes || []
}

export async function getRecentMovies({ forceRefresh = false } = {}) {
  const data = await request(`/list/movies/recent${forceRefresh ? '?refresh=1' : ''}`, {
    retries: 1,
    localOnly: true,
    forceRefresh
  })
  return (data.movies || []).map(normalize)
}

export async function getRecentSeriesEpisodes({ forceRefresh = false } = {}) {
  const data = await request(`/list/episodes?page=1${forceRefresh ? '&refresh=1' : ''}`, {
    retries: 1,
    localOnly: true,
    forceRefresh
  })
  return data.episodes || []
}

export async function getAnimeGenresMap() {
  const data = await request('/list/anime/genres', { retries: 1, localOnly: true })
  return data.genres || {}
}

const SERIES_INFO_TTL = 12 * 60 * 60 * 1000
const SERIES_INFO_KEY = 'guevana.seriesinfo.v1'

function readSeriesInfoCache() {
  try {
    return JSON.parse(localStorage.getItem(SERIES_INFO_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeSeriesInfoCache(map) {
  try {
    localStorage.setItem(SERIES_INFO_KEY, JSON.stringify(map))
  } catch {
    /* almacenamiento lleno: ignorar */
  }
}

export function getCachedSeriesInfo(url) {
  const entry = readSeriesInfoCache()[url]
  if (!entry) return null
  if (Date.now() - entry.ts > SERIES_INFO_TTL) return null
  return entry.data
}

export async function getSeriesInfo(url, { retries = 1, forceRefresh = false, localOnly = false } = {}) {
  const data = await request(`/series/info?url=${encodeURIComponent(url)}`, { retries, forceRefresh, localOnly })
  const clean = {
    ...data,
    title: decodeEntities(data.title),
    description: cleanDescription(data.description),
    seasons: (data.seasons || []).map((se) => ({
      ...se,
      episodes: (se.episodes || []).map((ep) => ({
        ...ep,
        title: decodeEntities(ep.title)
      }))
    }))
  }
  const map = readSeriesInfoCache()
  map[url] = { data: clean, ts: Date.now() }
  writeSeriesInfoCache(map)
  return clean
}

export async function extractMovie(url, { cache = true, retries = 2, forceRefresh = false, requireStreams = false } = {}) {
  const data = await request(`/extract?url=${encodeURIComponent(url)}`, { retries, forceRefresh, requireStreams })
  const clean = {
    ...data,
    title: decodeEntities(data.title),
    description: cleanDescription(data.description),
    streams: (data.streams || []).filter((s) => s && s.url).map(proxifyStream)
  }
  if (cache && clean.streams.length > 0) saveCachedMovieInfo(url, clean)
  return clean
}

export async function getMovieGenres(url, { retries = 1 } = {}) {
  const data = await request(`/genres?url=${encodeURIComponent(url)}`, { retries })
  return Array.isArray(data.genres) ? data.genres : []
}

function normalize(item) {
  const url = item.url || ''
  return {
    ...item,
    title: decodeEntities(item.title),
    slug: slugFromUrl(url),
    url,
    image: item.image || null
  }
}
