export function normalizeSearch(s = '') {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
}

export function firstLetterOf(title = '') {
  const first = (normalizeSearch(title)[0] || '')[0] || ''
  return /[a-z]/.test(first) ? first.toUpperCase() : '#'
}

export function tokensMatch(queryTokens, titleTokens) {
  return queryTokens.every((t) => titleTokens.some((w) => w.includes(t)))
}

export function makeTitleIndex(items) {
  const index = new Map()
  for (const m of items) {
    if (m.url) index.set(m.url, normalizeSearch(m.title))
  }
  return index
}

export function searchIndexed(index, items, query) {
  if (!query) return null
  const q = normalizeSearch(query)
  if (q.length === 0) return []
  return items.filter((m) => {
    const tokens = index.get(m.url)
    return tokens ? tokensMatch(q, tokens) : false
  })
}

function safeDecode(s = '') {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function getSearchScope(pathname) {
  if (pathname.startsWith('/movies')) return { key: 'movies' }
  if (pathname.startsWith('/series')) return { key: 'series' }
  if (pathname.startsWith('/serie/')) return { key: 'series' }
  if (pathname.startsWith('/anime')) return { key: 'anime' }
  if (pathname.startsWith('/categoria/')) {
    return { key: 'category', genre: safeDecode(pathname.split('/').pop()) }
  }
  return { key: 'home' }
}

export function getSearchDataset(scope, { catalog, seriesCatalog, animeCatalog, genresOf }) {
  if (scope.key === 'movies') return catalog
  if (scope.key === 'series') return seriesCatalog
  if (scope.key === 'anime') return animeCatalog
  if (scope.key === 'category') {
    return [...catalog, ...seriesCatalog, ...animeCatalog].filter((m) =>
      genresOf(m.url).includes(scope.genre)
    )
  }
  return [...catalog, ...seriesCatalog, ...animeCatalog]
}
