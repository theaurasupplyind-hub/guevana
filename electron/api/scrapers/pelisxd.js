const cheerio = require('cheerio')
const { fetchText } = require('../config.js')
const { resolveEmbed } = require('./player.js')
const { classifyStream } = require('./movie.js')

const PXD_BASE = 'https://pelisxd.com'

function cleanOgTitle(s = '') {
  let t = String(s).replace(/^Ver\s+/i, '')
  t = t.replace(/\s*\(\d{4}\)\s*Online.*$/i, '')
  t = t.replace(/\s*\|\s*PelisXD.*$/i, '')
  return t.trim()
}

function cleanDescription(s = '') {
  return String(s || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
}

function extractVideos(html) {
  const out = []
  const re = /v_source\\?":\\?"([A-Za-z0-9+/=]+)\\?"/g
  let m
  while ((m = re.exec(html))) {
    const raw = m[1]
    let s = null
    if (/^[A-Za-z0-9+/=]{20,}$/.test(raw)) {
      try {
        s = Buffer.from(raw, 'base64').toString('utf8')
      } catch {
        /* no base64 */
      }
    }
    if (!s || !/^https?:/.test(s)) s = /^https?:/.test(raw) ? raw : null
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

function yearFrom(text) {
  const m = String(text || '').match(/(19|20)\d{2}/)
  return m ? m[0] : ''
}

async function search(query) {
  const html = await fetchText(`${PXD_BASE}/buscar?q=${encodeURIComponent(query)}`, {
    referer: PXD_BASE + '/'
  })
  const $ = cheerio.load(html)
  const out = []
  $('main a[href^="/pelicula/"], main a[href^="/serie/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const slug = (href.match(/^\/(?:pelicula|serie)\/([^/]+)/) || [])[1]
    if (!slug) return
    const kind = href.startsWith('/serie/') ? 'serie' : 'movie'
    const $img = $a.find('img').first()
    out.push({
      source: 'pelisxd',
      kind,
      title: $a.find('h3').first().text().trim(),
      url: `${PXD_BASE}${href}`,
      image: $img.attr('src') || null,
      year: yearFrom($a.text()),
      rating: '',
      type: kind === 'serie' ? 'serie' : 'normal'
    })
  })
  return out
}

async function listMovies(page) {
  if (page > 1) return { movies: [], totalPages: 1 }
  const html = await fetchText(`${PXD_BASE}/peliculas?page=1`, { referer: PXD_BASE + '/' })
  const $ = cheerio.load(html)
  const movies = []
  $('main a[href^="/pelicula/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const slug = (href.match(/^\/pelicula\/([^/]+)/) || [])[1]
    if (!slug) return
    const $img = $a.find('img').first()
    movies.push({
      source: 'pelisxd',
      title: $a.find('h3').first().text().trim(),
      url: `${PXD_BASE}${href}`,
      image: $img.attr('src') || null,
      year: yearFrom($a.text()),
      rating: '',
      quality: '',
      languages: [],
      type: 'normal'
    })
  })
  return { movies, totalPages: 1 }
}

async function getDetail(url) {
  const html = await fetchText(url, { referer: PXD_BASE + '/' })
  const $ = cheerio.load(html)
  const title =
    $('h1').first().text().trim() ||
    cleanOgTitle($('meta[property="og:title"]').attr('content') || '')
  return {
    url,
    title,
    description: cleanDescription($('meta[name="description"]').attr('content') || ''),
    poster: $('meta[property="og:image"]').attr('content') || null,
    year: ($('title').text().match(/\((\d{4})\)/) || [])[1] || '',
    videos: extractVideos(html)
  }
}

async function extractStreams(url) {
  const detail = await getDetail(url)
  const streams = []
  for (const embedUrl of detail.videos || []) {
    try {
      const resolved = await resolveEmbed(embedUrl, url)
      if (!resolved) continue
      const cls = await classifyStream(resolved, embedUrl)
      if (!cls.ok) continue
      streams.push({
        type: cls.type,
        url: resolved,
        source: embedUrl.replace(/^https?:\/\//, '').slice(0, 48),
        contentType: cls.contentType || null,
        referer: embedUrl
      })
      if (streams.length >= 2) break
    } catch {
      /* embed fallido, probar el siguiente */
    }
  }
  return streams
}

async function getMovie(url) {
  const detail = await getDetail(url)
  const streams = await extractStreams(url)
  return {
    status: 'success',
    url,
    title: detail.title,
    description: detail.description,
    poster: detail.poster,
    year: detail.year,
    genres: [],
    rating: '',
    tmdbRating: '',
    streams,
    streamsCount: streams.length
  }
}

module.exports = { search, listMovies, getDetail, extractStreams, getMovie }
