export function normalizeSearch(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function tokensMatch(queryTokens: string[], titleTokens: string[]) {
  return queryTokens.every((token) => titleTokens.some((word) => word.includes(token)))
}

export function searchItems<T extends { title?: string }>(items: T[], query: string) {
  const queryTokens = normalizeSearch(query)
  if (queryTokens.length === 0) return items
  return items.filter((item) => tokensMatch(queryTokens, normalizeSearch(item.title || '')))
}

export function firstLetterOf(title = '') {
  const first = normalizeSearch(title)[0]?.[0] || ''
  return /[a-z]/.test(first) ? first.toUpperCase() : '#'
}

export function slugFromUrl(url = '') {
  return url.replace(/\/+$/, '').split('/').pop() || 'item'
}
