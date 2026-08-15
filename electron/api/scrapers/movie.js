const { fetchText, fetchUpstream } = require('../config.js')
const cache = require('../cache.js')
const { resolveEmbed } = require('./player.js')
const cheerio = require('cheerio')

const INFO_TTL = 7 * 24 * 60 * 60 * 1000

function resolvePlaylistUrl(base, u) {
  try {
    return new URL(u, base).href
  } catch {
    return null
  }
}

function firstUri(playlist, base) {
  for (const line of playlist.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const abs = resolvePlaylistUrl(base, t)
    if (abs) return abs
  }
  const map = playlist.match(/URI="([^"]+)"/)
  if (map && map[1]) return resolvePlaylistUrl(base, map[1])
  return null
}

async function validateHls(url, referer) {
  let text = ''
  try {
    const res = await fetchUpstream(url, { referer })
    if (!res.ok) return false
    text = await res.text()
  } catch {
    return false
  }
  if (!text.includes('#EXTM3U')) return false

  let playlist = text
  if (/#EXT-X-STREAM-INF/i.test(text)) {
    const levelUrl = firstUri(text, url)
    if (!levelUrl) return false
    try {
      const res = await fetchUpstream(levelUrl, { referer })
      if (!res.ok) return false
      playlist = await res.text()
    } catch {
      return false
    }
  }
  if (!playlist.includes('#EXTM3U')) return false

  const segUrl = firstUri(playlist, url)
  if (segUrl) {
    try {
      const res = await fetchUpstream(segUrl, { referer, headers: { Range: 'bytes=0-0' } })
      if (!res.ok && res.status !== 206) return false
      const contentType = (res.headers.get('content-type') || '').toLowerCase()
      if (contentType.includes('text/html')) return false
      let head = ''
      try {
        const reader = res.body.getReader()
        const { value } = await reader.read()
        try {
          reader.cancel()
        } catch {}
        head = Buffer.from(value || []).toString('latin1')
      } catch {}
      if (/^<(!doctype|html)/i.test(head.trim())) return false
    } catch {
      return false
    }
  }
  return true
}

async function classifyStream(resolved, referer) {
  if (/\.m3u8|mpegurl/i.test(resolved)) {
    const ok = await validateHls(resolved, referer)
    return ok ? { type: 'hls', ok: true } : { ok: false }
  }

  let res
  try {
    res = await fetchUpstream(resolved, { referer, headers: { Range: 'bytes=0-0' } })
  } catch {
    return { ok: false }
  }
  if (!res.ok && res.status !== 206) return { ok: false }

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('mpegurl')) return { type: 'hls', ok: true, contentType }

  let head = ''
  try {
    const reader = res.body.getReader()
    const { value } = await reader.read()
    try {
      reader.cancel()
    } catch {}
    head = Buffer.from(value || []).toString('latin1')
  } catch {}

  if (head.includes('#EXTM3U')) return { type: 'hls', ok: true, contentType }
  if (contentType.includes('text/html') || /^<(!doctype|html)/i.test(head.trim())) {
    return { ok: false }
  }
  return { type: 'direct', ok: true, contentType }
}

async function getMovieInfo(url) {
  const html = await fetchText(url, { referer: 'https://zonaaps.com/' })
  const $ = cheerio.load(html)

  const postId = $('meta[data-postid]').attr('data-postid') || $('#player-option-1').attr('data-post') || null

  const title =
    $('.sheader .data h1').first().text().trim() ||
    $('h1').first().text().trim() ||
    ''

  const rating = $('.dt_rating_vgs').first().text().trim() || $('.starstruck-main').first().attr('data-rating') || ''

  let tmdbRating = ''
  $('.custom_fields').each((_, el) => {
    const $el = $(el)
    if (/TMDb/i.test($el.find('.variante').text())) {
      tmdbRating = $el.find('.valor strong').text().trim()
    }
  })

  const $desc = $('[itemprop="description"]').first().clone()
  $desc.find('script, style, .code-block, iframe').remove()
  const description = $desc.text().replace(/\s+/g, ' ').trim()

  const genres = []
  $('.sgeneros a').each((_, el) => {
    const g = $(el).text().trim()
    if (g) genres.push(g)
  })

  const $poster = $('.sheader .poster img').first()
  const poster = $poster.attr('data-lazy-src') || $poster.attr('src') || null

  const year = $('.sheader .data .extra .date').first().text().trim()

  const gallery = []
  $('.g-item a').each((_, el) => {
    const href = $(el).attr('href')
    if (href && /^https?:/.test(href)) gallery.push(href)
  })

  const sources = []
  $('#dooplay_player_content iframe').each((i, el) => {
    const $el = $(el)
    const src = $el.attr('src')
    if (!src || src.includes('youtube.com')) return
    const boxId = $el.closest('.source-box').attr('id') || ''
    const num = (boxId.match(/player-(\d+)/) || [])[1]
    sources.push({ name: num ? `movie/${num}` : `source-${i + 1}`, url: src })
  })

  return { post_id: postId, title, rating, tmdbRating, description, poster, genres, year, gallery, sources }
}

async function getMovieGenres(url) {
  const info = await cache.get(`movie:${url}`, () => getMovieInfo(url), INFO_TTL)
  return {
    status: 'success',
    url,
    title: info.title,
    genres: info.genres,
    rating: info.rating,
    tmdbRating: info.tmdbRating,
    year: info.year
  }
}

async function extractMovie(url) {
  const info = await cache.get(`movie:${url}`, () => getMovieInfo(url), INFO_TTL)

  const streams = []
  for (const src of info.sources || []) {
    try {
      const resolved = await resolveEmbed(src.url, url)
      if (!resolved) continue
      const cls = await classifyStream(resolved, url)
      if (!cls.ok) continue
      streams.push({ type: cls.type, url: resolved, source: src.name, contentType: cls.contentType || null, referer: url })
      if (streams.length >= 2) break
    } catch {
      /* fuente fallida, seguir con la siguiente */
    }
  }

  const { sources, ...rest } = info
  return { status: 'success', ...rest, streams, streamsCount: streams.length }
}

module.exports = { extractMovie, getMovieInfo, getMovieGenres, classifyStream }
