const { getMoviesPage } = require('./scrapers/archive.js')
const { getSeriesPage } = require('./scrapers/series.js')
const { getSources } = require('./scrapers/sources.js')

const LISTERS = {
  zonaaps: {
    movie: (page) => getMoviesPage(page),
    serie: (page, genre) => getSeriesPage(page, genre)
  }
}

function normalizeTitle(s = '') {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function yearOf(str = '') {
  const m = String(str || '').match(/(19|20)\d{2}/)
  return m ? m[1] : ''
}

function titleKey(item) {
  return `${normalizeTitle(item.title)}|${yearOf(item.year)}`
}

function mergeItems(results, listKey) {
  const seen = new Map()
  const merged = []
  for (const { source, items } of results) {
    for (const item of items || []) {
      const key = titleKey(item)
      const existing = seen.get(key)
      if (existing) {
        const entry = { source, url: item.url }
        if (!existing.sources.some((s) => s.url === entry.url)) existing.sources.push(entry)
      } else {
        const copy = { ...item, source, sources: [{ source, url: item.url }] }
        seen.set(key, copy)
        merged.push(copy)
      }
    }
  }
  return { [listKey]: merged, totalPages: Math.max(1, ...results.map((r) => r.totalPages || 1)) }
}

async function getMergedMoviesPage(page) {
  const results = []
  for (const src of getSources({ types: ['movie'], searchable: true })) {
    const lister = LISTERS[src.id] && LISTERS[src.id].movie
    if (!lister) continue
    try {
      const arch = await lister(page)
      results.push({ source: src.id, items: arch.movies, totalPages: arch.totalPages })
    } catch {
      /* fuente caida, seguir con las demas */
    }
  }
  const merged = mergeItems(results, 'movies')
  return {
    status: 'success',
    currentPage: page,
    moviesCount: merged.movies.length,
    ...merged
  }
}

async function getMergedSeriesPage(page, genre) {
  const results = []
  for (const src of getSources({ types: ['serie'], searchable: true })) {
    const lister = LISTERS[src.id] && LISTERS[src.id].serie
    if (!lister) continue
    try {
      const s = await lister(page, genre)
      results.push({ source: src.id, items: s.series, totalPages: s.totalPages })
    } catch {
      /* fuente caida, seguir con las demas */
    }
  }
  const merged = mergeItems(results, 'series')
  return {
    status: 'success',
    currentPage: page,
    seriesCount: merged.series.length,
    ...merged
  }
}

module.exports = { getMergedMoviesPage, getMergedSeriesPage }
