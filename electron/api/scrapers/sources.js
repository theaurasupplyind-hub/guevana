const cheerio = require('cheerio')
const { fetchText, BASE } = require('../config.js')

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
    id: 'jkanime',
    name: 'JKAnime',
    types: ['anime'],
    enabled: true,
    primary: true,
    searchable: true
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

async function searchSource(sourceId, query) {
  switch (sourceId) {
    case 'zonaaps':
      return searchZonaaps(query)
    case 'jkanime':
      return searchJkanime(query)
    default:
      return []
  }
}

module.exports = { SOURCES, getSources, searchSource }
