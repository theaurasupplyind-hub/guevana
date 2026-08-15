const cheerio = require('cheerio')
const { fetchText } = require('../config.js')
const { classifyStream } = require('./movie.js')

const PPLUS_BASE = 'https://pelisplus.rest'

function decodeEntities(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&oacute;/g, 'ó')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&aacute;/g, 'á')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
}

function yearFrom(text) {
  const m = String(text || '').match(/(19|20)\d{2}/)
  return m ? m[0] : ''
}

function parseCards(html) {
  const $ = cheerio.load(html)
  const out = []
  $('li.TPostMv').each((_, el) => {
    const $el = $(el)
    const $a = $el.find('a[href*="/peliculas/"], a[href*="/serie/"]').first()
    const href = $a.attr('href')
    if (!href) return
    const isSerie = /^\/serie\/\d+\/[^/]+\/$/.test(href) || href.includes('/serie/')
    const isEpisode = /^\/serie\/\d+-\d+-\d+\//.test(href)
    const kind = isSerie && !isEpisode ? 'serie' : 'movie'
    const $img = $el.find('img').first()
    const title = decodeEntities($el.find('.Title').first().text().trim())
    out.push({
      source: 'pelisplus',
      kind,
      title,
      url: `${PPLUS_BASE}${href}`,
      image: $img.attr('data-src') || $img.attr('src') || null,
      year: yearFrom($el.find('.Year').first().text() || $el.find('.Date').first().text()),
      rating: $el.find('.Vote').first().text().trim(),
      quality: $el.find('.Qlty').first().text().trim() || null,
      type: kind === 'serie' ? 'serie' : 'normal'
    })
  })
  return out
}

function parseGenres($, $el) {
  const out = []
  const span = $el.find('span.color-w').first().text().trim()
  if (span) {
    for (const g of span.split(',')) {
      const clean = decodeEntities(g.trim())
      if (clean && !out.includes(clean)) out.push(clean)
    }
  }
  $el.find('a[href*="/genre/"]').each((_, a) => {
    const g = decodeEntities($(a).text().trim())
    if (g && !out.includes(g)) out.push(g)
  })
  return out
}

function getGenres($) {
  const genres = []
  $('.InfoList li').each((_, el) => {
    const $el = $(el)
    if (/Género/i.test($el.find('strong').first().text())) {
      for (const g of parseGenres($, $el)) genres.push(g)
    }
  })
  return genres
}

async function search(query) {
  const html = await fetchText(`${PPLUS_BASE}/?s=${encodeURIComponent(query)}`, {
    referer: PPLUS_BASE + '/'
  })
  return parseCards(html)
}

async function listMovies(page) {
  const path = page > 1 ? `/nuevas-peliculas/page/${page}/` : '/nuevas-peliculas/'
  const html = await fetchText(`${PPLUS_BASE}${path}`, { referer: PPLUS_BASE + '/' })
  const movies = parseCards(html).filter((c) => c.kind === 'movie')
  let totalPages = page
  const pag = [...html.matchAll(/page\/(\d+)\//g)].map((m) => parseInt(m[1], 10))
  if (pag.length > 0) totalPages = Math.max(page, ...pag)
  return { movies, totalPages: Math.min(totalPages, 50) }
}

async function listSeries(page) {
  const path = page > 1 ? `/ultimas-series-h4n1/page/${page}/` : '/ultimas-series-h4n1/'
  const html = await fetchText(`${PPLUS_BASE}${path}`, { referer: PPLUS_BASE + '/' })
  const series = parseCards(html).filter((c) => c.kind === 'serie')
  let totalPages = page
  const pag = [...html.matchAll(/page\/(\d+)\//g)].map((m) => parseInt(m[1], 10))
  if (pag.length > 0) totalPages = Math.max(page, ...pag)
  return { series, totalPages: Math.min(totalPages, 20) }
}

async function listSeriesFavorites(page) {
  const path = page > 1 ? `/mas-favoritas-series-n0tr3/page/${page}/` : '/mas-favoritas-series-n0tr3/'
  const html = await fetchText(`${PPLUS_BASE}${path}`, { referer: PPLUS_BASE + '/' })
  const series = parseCards(html).filter((c) => c.kind === 'serie')
  let totalPages = page
  const pag = [...html.matchAll(/page\/(\d+)\//g)].map((m) => parseInt(m[1], 10))
  if (pag.length > 0) totalPages = Math.max(page, ...pag)
  return { series, totalPages: Math.min(totalPages, 20) }
}

function parsePlaySources(html) {
  const $ = cheerio.load(html)
  const out = []
  $('video source[src]').each((_, el) => {
    const src = $(el).attr('src')
    if (src && !out.includes(src)) out.push(src)
  })
  const srcScript = html.match(/player\.src\(\{\s*src:\s*['"]([^'"]+)['"]/)
  if (srcScript && srcScript[1] && !out.includes(srcScript[1])) out.push(srcScript[1])
  return out
}

function playUrl(url) {
  return `${url.replace(/\/+$/, '')}/play/`
}

async function getStreamsForUrl(url, { season = '', ep = '' } = {}) {
  let target = url
  const seriesMain = url.match(/\/serie\/(\d+)\/([^/]+)\/$/)
  if (seriesMain && (season || ep)) {
    const id = seriesMain[1]
    const slug = seriesMain[2]
    const s = String(season || '').replace(/\D/g, '') || '1'
    const e = String(ep || '').replace(/\D/g, '')
    if (e) target = `${PPLUS_BASE}/serie/${id}-${s}-${e}/${slug}/`
  }
  const html = await fetchText(playUrl(target), { referer: PPLUS_BASE + '/' })
  const sources = parsePlaySources(html)
  const streams = []
  for (const src of sources) {
    try {
      const cls = await classifyStream(src, target)
      if (!cls.ok) continue
      streams.push({
        type: cls.type,
        url: src,
        source: src.replace(/^https?:\/\//, '').slice(0, 48),
        contentType: cls.contentType || null,
        referer: target
      })
      if (streams.length >= 2) break
    } catch {
      /* fuente caida, probar la siguiente */
    }
  }
  return streams
}

async function getSeriesInfo(url) {
  const html = await fetchText(url, { referer: PPLUS_BASE + '/' })
  const $ = cheerio.load(html)

  const title =
    decodeEntities($('h1.Title').first().text().trim()) ||
    decodeEntities($('h1').first().text().trim())
  const description = $('.Description p').first().text().replace(/\s+/g, ' ').trim()
  const poster = $('meta[property="og:image"]').attr('content') || null
  const year = yearFrom($('.meta').first().text())

  const genres = getGenres($)

  const seasons = []
  const $select = $('select[name="links"]')
  const seasonLinks = []
  $select.find('option').each((_, el) => {
    const val = $(el).attr('value')
    const text = $(el).text().trim()
    if (val && /\/serie\/\d+-\d+\//.test(val)) {
      seasonLinks.push({ url: `${PPLUS_BASE}${val}`, title: decodeEntities(text) })
    }
  })

  for (const sl of seasonLinks) {
    try {
      const sh = await fetchText(sl.url, { referer: PPLUS_BASE + '/' })
      const $s = cheerio.load(sh)
      const seasonNum = (sl.url.match(/\/serie\/\d+-(\d+)\//) || [])[1] || ''
      const episodes = []
      $s('ul.all-episodes li').each((_, el) => {
        const $el = $(el)
        const $a = $el.find('a[href*="/serie/"]').first()
        const href = $a.attr('href')
        if (!href) return
        const m = href.match(/\/serie\/\d+-\d+-(\d+)\//)
        const num = m ? m[1] : ''
        const epTitle = decodeEntities($el.find('.Title').first().text().trim())
        episodes.push({
          num,
          title: epTitle,
          url: `${PPLUS_BASE}${href}`,
          image: $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || null,
          date: $el.find('p').first().text().trim()
        })
      })
      if (episodes.length > 0) {
        seasons.push({ num: seasonNum, title: sl.title, episodes })
      }
    } catch {
      /* temporada fallida, continuar */
    }
  }

  return {
    status: 'success',
    url,
    title,
    rating: $('.post-ratings').first().text().replace(/\s+/g, ' ').trim(),
    tmdbRating: '',
    description,
    genres,
    poster,
    year,
    network: '',
    seasons
  }
}

async function getMovie(url) {
  const html = await fetchText(url, { referer: PPLUS_BASE + '/' })
  const $ = cheerio.load(html)
  const title =
    decodeEntities($('h1.Title').first().text().trim()) ||
    decodeEntities($('h1').first().text().trim())
  const description = $('.Description p').first().text().replace(/\s+/g, ' ').trim()
  const poster = $('meta[property="og:image"]').attr('content') || null
  const year = yearFrom($('.meta').first().text())
  const genres = getGenres($)
  const rating = $('.post-ratings').first().text().replace(/\s+/g, ' ').trim()
  const streams = await getStreamsForUrl(url)
  return {
    status: 'success',
    url,
    title,
    rating,
    tmdbRating: '',
    description,
    poster,
    year,
    genres,
    quality: $('.Qlty').first().text().trim() || null,
    streams,
    streamsCount: streams.length
  }
}

async function getGenresForUrl(url) {
  const html = await fetchText(url, { referer: PPLUS_BASE + '/' })
  const $ = cheerio.load(html)
  return {
    status: 'success',
    url,
    title: decodeEntities($('h1.Title').first().text().trim() || $('h1').first().text().trim()),
    genres: getGenres($),
    rating: $('.post-ratings').first().text().replace(/\s+/g, ' ').trim(),
    tmdbRating: '',
    year: yearFrom($('.meta').first().text())
  }
}

module.exports = { search, listMovies, listSeries, listSeriesFavorites, getSeriesInfo, getMovie, getStreamsForUrl, getGenresForUrl }
