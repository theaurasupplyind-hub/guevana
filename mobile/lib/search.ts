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

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}

export function itemDate(item: { year?: string | number | null }): number {
  const str = String(item.year || '')
  const full = str.match(/([a-z]+)\.\s*(\d{1,2}),\s*(\d{4})/i)
  if (full) {
    const month = MONTHS[full[1].toLowerCase()]
    if (month) return new Date(+full[3], month - 1, +full[2]).getTime()
    return new Date(+full[3], 0, 1).getTime()
  }
  const year = str.match(/(\d{4})/)
  return year ? new Date(+year[1], 0, 1).getTime() : 0
}
