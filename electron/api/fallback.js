const { searchSource, getSources } = require('./scrapers/sources.js')
const { extractMovie } = require('./scrapers/movie.js')
const { getSeriesInfo } = require('./scrapers/series.js')
const pelisxd = require('./scrapers/pelisxd.js')
const jkanime = require('./scrapers/jkanime.js')
const cache = require('./cache.js')

const FALLBACK_TTL = 30 * 60 * 1000

function normalizeTitle(s = '') {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function yearOf(str = '') {
  const m = String(str || '').match(/(19|20)\d{2}/)
  return m ? m[1] : ''
}

function scoreCandidate(candidate, title, year) {
  const ct = normalizeTitle(candidate.title)
  const qt = normalizeTitle(title)
  if (ct.length === 0 || qt.length === 0) return -1
  let hits = 0
  for (const t of qt) {
    if (ct.includes(t)) hits += 1
    else if (ct.some((w) => w.includes(t) || t.includes(w))) hits += 0.5
  }
  const coverage = hits / qt.length
  if (coverage < 0.6) return -1
  let score = coverage
  const cy = yearOf(candidate.year)
  if (year && cy && cy === String(year)) score += 0.3
  return score
}

async function findByTitle(title, year, types) {
  const out = []
  for (const source of getSources({ types, searchable: true })) {
    try {
      const results = await searchSource(source.id, title)
      const scored = results
        .map((candidate) => ({ candidate, score: scoreCandidate(candidate, title, year) }))
        .filter((x) => x.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
      for (const { candidate } of scored) out.push(candidate)
    } catch {
      /* fuente caida, seguir con la siguiente */
    }
  }
  return out
}

function normalizeNum(n) {
  return String(n || '').replace(/\D/g, '')
}

function findEpisodeInSeasons(seasons, season, ep) {
  const seasonNum = normalizeNum(season)
  const epNum = normalizeNum(ep)
  if (seasonNum) {
    for (const se of seasons || []) {
      if (normalizeNum(se.num) === seasonNum) {
        const found = (se.episodes || []).find((e) => normalizeNum(e.num) === epNum)
        if (found) return found
      }
    }
  }
  for (const se of seasons || []) {
    const found = (se.episodes || []).find((e) => normalizeNum(e.num) === epNum)
    if (found) return found
  }
  return null
}

async function extractFromCandidate(candidate, { type, season, ep }) {
  if (candidate.source === 'pelisxd') {
    return pelisxd.extractStreams(candidate.url)
  }
  if (candidate.kind === 'anime' || type === 'anime') {
    if (!ep) return []
    const epUrl = `${candidate.url}${normalizeNum(ep)}/`
    const data = await jkanime.extractEpisode(epUrl)
    return data.streams || []
  }
  if (candidate.kind === 'serie' || type === 'serie') {
    if (!ep) return []
    const info = await getSeriesInfo(candidate.url)
    const found = findEpisodeInSeasons(info.seasons, season, ep)
    if (found && found.url) {
      const data = await extractMovie(found.url)
      return data.streams || []
    }
    return []
  }
  const data = await extractMovie(candidate.url)
  return data.streams || []
}

async function extractFallbackStreams({ title, year = '', type = 'movie', season = '', ep = '' }) {
  if (!title) return { status: 'success', matched: null, title: '', streams: [], streamsCount: 0 }

  const types = type === 'anime' ? ['anime'] : type === 'serie' ? ['serie'] : ['movie']
  const key = `fallback:${type}:${normalizeTitle(title).join(' ')}:${year}:${season}:${ep}`
  return cache.get(
    key,
    async () => {
      const candidates = await findByTitle(title, year, types)
      for (const candidate of candidates) {
        try {
          const streams = await extractFromCandidate(candidate, { type, season, ep })
          if (streams.length > 0) {
            return {
              status: 'success',
              matched: { source: candidate.source, title: candidate.title, url: candidate.url },
              title: candidate.title,
              streams,
              streamsCount: streams.length
            }
          }
        } catch {
          /* candidato fallido, probar el siguiente */
        }
      }
      return { status: 'success', matched: null, title, streams: [], streamsCount: 0 }
    },
    FALLBACK_TTL
  )
}

module.exports = { extractFallbackStreams, findByTitle }
