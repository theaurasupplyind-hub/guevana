const { fetchText, BASE } = require('../config.js')
const { getFeatured } = require('./home.js')
const cheerio = require('cheerio')

function parseMovieArticle($, $el, pathIncludes = '/movies/') {
  const $a = $el.find('.data h3 a').first()
  const href = $a.attr('href')
  if (!href || !href.includes(pathIncludes)) return null
  const $img = $el.find('.poster img').first()
  const languages = []
  $el.find('.flag-item').each((_, f) => {
    const l = $(f).attr('alt')
    if (l && !languages.includes(l)) languages.push(l)
  })
  return {
    title: $a.text().trim(),
    url: href,
    image: $img.attr('data-lazy-src') || $img.attr('src') || null,
    type: 'normal',
    rating: $el.find('.poster .rating').first().text().trim(),
    year: $el.find('.data span').first().text().trim(),
    quality: $el.find('.mepo .quality').first().text().trim() || null,
    languages
  }
}

async function getMoviesPage(page) {
  const url = page === 1 ? `${BASE}/movies/` : `${BASE}/movies/page/${page}/`
  const html = await fetchText(url, { referer: BASE + '/' })
  const $ = cheerio.load(html)

  const movies = []
  $('#archive-content article.item.movies').each((_, el) => {
    const m = parseMovieArticle($, $(el))
    if (m) movies.push(m)
  })

  let totalPages = page
  const pag = html.match(/P[áa]gina\s+\d+\s+de\s+(\d+)/i)
  if (pag && pag[1]) totalPages = parseInt(pag[1], 10)

  return { movies, totalPages }
}

async function getList(page) {
  const [home, arch] = await Promise.all([
    page === 1 ? getFeatured() : Promise.resolve([]),
    getMoviesPage(page)
  ])

  const featured = page === 1 ? home : []
  const movies = arch.movies
  return {
    status: 'success',
    currentPage: page,
    totalPages: arch.totalPages,
    remainingPages: Math.max(0, arch.totalPages - page),
    hasNextPage: page < arch.totalPages,
    hasPrevPage: page > 1,
    featuredCount: featured.length,
    moviesCount: movies.length,
    totalCount: featured.length + movies.length,
    featured,
    movies
  }
}

const RECENT_MOVIES_PAGES = 5
const RECENT_MOVIES_LIMIT = 30

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
}

function parseMovieDate(str = '') {
  const full = str.match(/([a-z]+)\.\s*(\d{1,2}),\s*(\d{4})/i)
  if (full) {
    const month = MONTHS[full[1].toLowerCase()]
    if (month) return new Date(+full[3], month - 1, +full[2]).getTime()
    return new Date(+full[3], 0, 1).getTime()
  }
  const year = str.match(/(\d{4})/)
  return year ? new Date(+year[1], 0, 1).getTime() : 0
}

async function getRecentMovies({ pages = RECENT_MOVIES_PAGES, limit = RECENT_MOVIES_LIMIT } = {}) {
  const all = []
  for (let page = 1; page <= pages; page++) {
    const arch = await getMoviesPage(page)
    all.push(...arch.movies)
    if (arch.movies.length === 0) break
  }
  const movies = all.sort((a, b) => parseMovieDate(b.year) - parseMovieDate(a.year)).slice(0, limit)
  return {
    status: 'success',
    moviesCount: movies.length,
    movies
  }
}

module.exports = { getList, getMoviesPage, getRecentMovies, parseMovieArticle }
