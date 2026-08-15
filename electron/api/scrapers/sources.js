const cheerio = require('cheerio')
const { fetchText, BASE } = require('../config.js')
const pelisxd = require('./pelisxd.js')

const AF_BASE = 'https://animeflv.net'

const SOURCES = [
  {
    id: 'zonaaps',
    name: 'ZonaApps',
    types: ['movie', 'serie'],
    enabled: true,
    primary: true,
    searchable: true
  },
  {
    id: 'pelisxd',
    name: 'PelisXD',
    types: ['movie'],
    enabled: true,
    primary: false,
    searchable: true
  },
  {
    id: 'jkanime',
    name: 'JKAnime',
    types: ['anime'],
    enabled: true,
    primary: true,
    searchable: true
  },
  {
    // Staged: el catalogo y la busqueda responden a fetch plano, pero los streams
    // no se embeben en el HTML (la API de video requiere token/JS). Activar cuando
    // se resuelva la extraccion de streams.
    id: 'animeflv',
    name: 'AnimeFLV',
    types: ['anime'],
    enabled: false,
    primary: false,
    searchable: true,
    staged: true
  },
  {
    id: 'mirror-xzod',
    name: 'ZonaAPI xzod',
    types: ['movie', 'serie'],
    enabled: true,
    base: 'https://apizonalatamsrc.xzod.cloud'
  },
  {
    id: 'mirror-worker',
    name: 'ZonaAPI worker',
    types: ['movie', 'serie'],
    enabled: true,
    base: 'https://zonaapp.ikkihkurogane.workers.dev'
  }
]

function getSources({ types, searchable, enabled = true } = {}) {
  return SOURCES.filter(
    (s) =>
      (!enabled || s.enabled) &&
      (!types || (s.types || []).some((t) => types.includes(t))) &&
      (!searchable || s.searchable)
  )
}

async function searchZonaaps(query) {
  const html = await fetchText(`${BASE}/?s=${encodeURIComponent(query)}`, { referer: BASE + '/' })
  const $ = cheerio.load(html)
  const out = []
  $('.search-page .result-item article').each((_, el) => {
    const $el = $(el)
    const $a = $el.find('.image .thumbnail a').first()
    const href = $a.attr('href')
    if (!href) return
    const $img = $el.find('.image img').first()
    const badge = $el.find('.thumbnail .movies').first().text().trim()
    const kind = href.includes('/tvshows/') || /serie|series/i.test(badge) ? 'serie' : 'movie'
    out.push({
      source: 'zonaaps',
      kind,
      title: $el.find('.details .title a').first().text().trim(),
      url: href,
      image: $img.attr('data-lazy-src') || $img.attr('src') || null,
      year: $el.find('.details .meta .year').first().text().trim(),
      rating: $el.find('.details .meta .rating').first().text().trim(),
      type: kind === 'serie' ? 'serie' : 'normal'
    })
  })
  return out
}

async function searchJkanime(query) {
  const html = await fetchText(
    `https://jkanime.net/buscar?q=${encodeURIComponent(query)}`,
    { referer: 'https://jkanime.net/' }
  )
  const $ = cheerio.load(html)
  const out = []
  $('div.anime__item').each((_, el) => {
    const $el = $(el)
    const $a = $el.find('a[href^="https://jkanime.net/"]').first()
    const href = $a.attr('href')
    if (!href || !/^https:\/\/jkanime\.net\/[a-z0-9-]+\/$/.test(href)) return
    const $pic = $el.find('.anime__item__pic').first()
    out.push({
      source: 'jkanime',
      kind: 'anime',
      title: $el.find('.anime__item__text h5').first().text().trim(),
      url: href,
      image: $pic.attr('data-setbg') || null,
      year: '',
      rating: '',
      type: 'anime'
    })
  })
  return out
}

function parseAnimeflvBrowse($) {
  const out = []
  $('ul.ListAnimes li a[href*="/anime/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const slug = (href.match(/\/anime\/([^/?]+)/) || [])[1]
    if (!slug) return
    const $img = $a.find('.Image img').first()
    out.push({
      title: $a.find('.Title').first().text().trim(),
      url: `${AF_BASE}/anime/${slug}`,
      image: $img.attr('src') || null,
      type: 'anime',
      slug
    })
  })
  return out
}

async function listAnimeflv(page) {
  const html = await fetchText(`${AF_BASE}/browse?page=${page}`, { referer: AF_BASE + '/' })
  const series = parseAnimeflvBrowse(cheerio.load(html))
  let totalPages = page
  const pag = [...html.matchAll(/browse\?page=(\d+)/g)].map((m) => parseInt(m[1], 10))
  if (pag.length > 0) totalPages = Math.max(page, ...pag)
  return { series, totalPages }
}

async function searchAnimeflv(query) {
  const html = await fetchText(`${AF_BASE}/browse?q=${encodeURIComponent(query)}`, {
    referer: AF_BASE + '/'
  })
  return parseAnimeflvBrowse(cheerio.load(html)).map((a) => ({ ...a, source: 'animeflv', kind: 'anime' }))
}

async function searchSource(sourceId, query) {
  switch (sourceId) {
    case 'zonaaps':
      return searchZonaaps(query)
    case 'jkanime':
      return searchJkanime(query)
    case 'animeflv':
      return searchAnimeflv(query)
    case 'pelisxd':
      return pelisxd.search(query)
    default:
      return []
  }
}

module.exports = { SOURCES, getSources, searchSource, listAnimeflv, searchAnimeflv }
