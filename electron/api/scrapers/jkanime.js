const { fetchText, fetchUpstream, UA } = require('../config.js')
const { classifyStream } = require('./movie.js')
const cheerio = require('cheerio')

const JK_BASE = 'https://jkanime.net'
const JK_CDN = 'https://cdn.jkdesa.com'
const NON_GENRES = new Set(['invierno', 'primavera', 'verano', 'latino'])

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

async function fetchGenrePage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      Referer: JK_BASE + '/'
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function extractJsonVar(html, name) {
  const start = html.indexOf(`var ${name} = `)
  if (start < 0) return null
  const jsonStart = html.indexOf('{', start)
  if (jsonStart < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]
    if (esc) {
      esc = false
      continue
    }
    if (ch === '\\') {
      esc = true
      continue
    }
    if (ch === '"') {
      inStr = !inStr
      continue
    }
    if (inStr) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return html.slice(jsonStart, i + 1)
    }
  }
  return null
}

function extractM3u8(html) {
  const m = html.match(/url:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/)
  if (m) return m[1]
  const m2 = html.match(/hls\.loadSource\(\s*['"]([^'"]+)['"]/)
  if (m2) return m2[1]
  const m3 = html.match(/(https?:[^'"\s]+\.m3u8[^'"\s]*)/)
  return m3 ? m3[1] : null
}

function decodeEntities(str = '') {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#0*39;/g, "'").replace(/&quot;/g, '"')
}

function parseInfoList($) {
  const out = { genres: [], year: null, status: '', totalEpisodes: null, network: '', season: '' }
  $('.anime_data li').each((_, el) => {
    const $el = $(el)
    const $label = $el.find('span').first()
    const label = $label.text().trim().replace(/:$/, '').trim()
    if (/Generos/i.test(label)) {
      $el.find('a').each((_, a) => {
        const g = $(a).text().trim()
        if (g && !out.genres.includes(g)) out.genres.push(g)
      })
      return
    }
    const val = $el.text().replace($label.text(), '').replace(/\s+/g, ' ').trim()
    if (/Emitido/i.test(label)) {
      const m = val.match(/[0-9]{4}/)
      if (m) out.year = m[0]
    } else if (/Estado/i.test(label)) {
      out.status = val
    } else if (/Episodios/i.test(label)) {
      out.totalEpisodes = parseInt(val, 10) || null
    } else if (/Studios|Estudio/i.test(label)) {
      out.network = val
    } else if (/Temporada/i.test(label)) {
      out.season = val
    }
  })
  return out
}

async function getCatalog(page) {
  const url = `${JK_BASE}/directorio?p=${page}`
  const html = await fetchText(url, { referer: JK_BASE + '/' })
  const raw = extractJsonVar(html, 'animes')
  if (!raw) throw new Error('No se pudo parsear el directorio de jkanime')
  const obj = JSON.parse(raw)
  const series = (obj.data || []).map((a) => ({
    title: decodeEntities(a.title),
    url: a.url,
    image: a.image || null,
    type: a.type
  }))
  return {
    status: 'success',
    currentPage: page,
    totalPages: obj.last_page || page,
    totalCount: obj.total || null,
    seriesCount: series.length,
    series
  }
}

async function getAnimeInfo(url) {
  const res = await fetchUpstream(url, { referer: JK_BASE + '/' })
  const html = await res.text()
  const cookie = collectSetCookie(res)
  const $ = cheerio.load(html)

  const title =
    $('.anime_info h3').first().text().trim() ||
    $('h1').first().text().trim() ||
    ''
  const description = $('.anime_info p.scroll').first().text().replace(/\s+/g, ' ').trim()
  const poster =
    $('.anime_info .movpic img').first().attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null

  const info = parseInfoList($)
  const animeId = (html.match(/ajax\/episodes\/(\d+)/) || [])[1] || null
  const csrf = $('meta[name="csrf-token"]').attr('content') || null

  const episodes = await getEpisodes(url, animeId, csrf, info.totalEpisodes, cookie)

  return {
    status: 'success',
    url,
    title: decodeEntities(title),
    description,
    genres: info.genres,
    poster,
    year: info.year,
    airStatus: info.status,
    season: info.season,
    network: info.network,
    rating: '',
    tmdbRating: '',
    seasons: [{ num: 1, title: 'Temporada 1', episodes }]
  }
}

function collectSetCookie(res) {
  try {
    if (typeof res.headers.getSetCookie === 'function') {
      return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
    }
  } catch {
    /* ignorar */
  }
  const single = res.headers.get('set-cookie')
  return single ? single.split(/,\s*(?=[A-Za-z]+=)/)[0] : ''
}

async function fetchEpisodesAjax(url, animeId, csrf, cookie) {
  const first = await fetchUpstream(`${JK_BASE}/ajax/episodes/${animeId}/1`, {
    method: 'POST',
    referer: url,
    body: `_token=${encodeURIComponent(csrf)}`,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookie ? { Cookie: cookie } : {})
    }
  })
  if (!first.ok) throw new Error(`HTTP ${first.status}`)
  const firstJson = await first.json()
  const all = [...(firstJson.data || [])]
  const lastPage = firstJson.last_page || 1
  for (let p = 2; p <= lastPage; p++) {
    const res = await fetchUpstream(`${JK_BASE}/ajax/episodes/${animeId}/${p}`, {
      method: 'POST',
      referer: url,
      body: `_token=${encodeURIComponent(csrf)}`,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookie ? { Cookie: cookie } : {})
      }
    })
    if (!res.ok) break
    const json = await res.json()
    all.push(...(json.data || []))
  }
  return all
}

async function getEpisodes(url, animeId, csrf, totalEpisodes, cookie) {
  if (animeId && csrf) {
    try {
      const list = await fetchEpisodesAjax(url, animeId, csrf, cookie)
      if (list.length > 0) {
        return list.map((ep) => ({
          num: ep.number,
          title: `Capítulo ${ep.number}`,
          url: `${url}${ep.number}/`,
          image: ep.image ? `${JK_CDN}/assets/images/animes/video/image_thumb/${ep.image}` : null,
          date: ep.timestamp ? ep.timestamp.split(' ')[0] : ''
        }))
      }
    } catch {
      /* fallback deterministico */
    }
  }
  const n = totalEpisodes || 0
  const out = []
  for (let i = 1; i <= n; i++) {
    out.push({ num: i, title: `Capítulo ${i}`, url: `${url}${i}/`, image: null, date: '' })
  }
  return out
}

async function extractEpisode(url) {
  const html = await fetchText(url, { referer: JK_BASE + '/' })
  const $ = cheerio.load(html)
  const $title = $('h1.mb-2').first().clone()
  $title.find('.lang_def').remove()
  const title = $title.text().replace(/\s*-\s*[^-]*$/, '').replace(/\s+/g, ' ').trim()

  const iframes = []
  const re = /src="(https:\/\/jkanime\.net\/jkplayer\/um[^"]*)"/g
  let m
  while ((m = re.exec(html))) {
    const u = m[1].replace(/&amp;/g, '&')
    if (!iframes.includes(u)) iframes.push(u)
  }

  const streams = []
  for (const iframe of iframes) {
    try {
      const proxy = await fetchText(iframe, { referer: url })
      const m3u8 = extractM3u8(proxy)
      if (!m3u8) continue
      const cls = await classifyStream(m3u8, iframe)
      if (cls.ok) {
        streams.push({ type: cls.type, url: m3u8, source: iframe.slice(0, 48), contentType: cls.contentType || null, referer: iframe })
        if (streams.length >= 2) break
      }
    } catch {
      /* fuente fallida, probar siguiente */
    }
  }

  return { status: 'success', url, title: decodeEntities(title), streams, streamsCount: streams.length }
}

async function getGenres(url) {
  const html = await fetchText(url, { referer: JK_BASE + '/' })
  const $ = cheerio.load(html)
  const info = parseInfoList($)
  return { status: 'success', url, genres: info.genres }
}

async function getRecentEpisodes() {
  const html = await fetchText(`${JK_BASE}/`, { referer: JK_BASE + '/' })
  const $ = cheerio.load(html)
  const episodes = []
  $('div.dir1 .card a[href^="https://jkanime.net/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const m = href.match(/^https:\/\/jkanime\.net\/([a-z0-9-]+)\/(\d+)\/$/)
    if (!m) return
    const series = $a.find('h5.card-title').first().text().replace(/\s*-\s*\d+$/, '').trim()
    if (!series) return
    const $img = $a.find('img').first()
    const image = $img.attr('data-animepic') || $img.attr('src') || null
    const date = $a.find('.badge-secondary').text().replace(/\s+/g, ' ').trim() || ''
    episodes.push({
      series: decodeEntities(series),
      num: parseInt(m[2], 10),
      title: `Episodio ${parseInt(m[2], 10)}`,
      url: href,
      image,
      date,
      slug: m[1]
    })
  })
  return { status: 'success', episodesCount: episodes.length, episodes }
}

async function getGenreList() {
  const html = await fetchText(`${JK_BASE}/directorio?p=1`, { referer: JK_BASE + '/' })
  const $ = cheerio.load(html)
  const out = []
  $('select[name="genero"] option').each((_, el) => {
    const slug = $(el).attr('value')
    const name = decodeEntities($(el).text().trim())
    if (slug && name && !NON_GENRES.has(slug)) out.push({ slug, name })
  })
  return out
}

function parseGenrePage($) {
  const urls = []
  $('div.page_directorio .dir1 a[href^="https://jkanime.net/"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href && /^https:\/\/jkanime\.net\/[a-z0-9-]+\/$/.test(href)) urls.push(href)
  })
  let lastPage = 1
  $('a.page-link[href*="/genero/"]').each((_, el) => {
    const m = $(el).attr('href').match(/[?&]p=(\d+)/)
    if (m) lastPage = Math.max(lastPage, parseInt(m[1], 10))
  })
  return { urls, lastPage }
}

async function getGenresMap() {
  const genres = await getGenreList()
  const perUrl = new Map()

  await mapLimit(genres, 4, async ({ slug, name }) => {
    try {
      const first = parseGenrePage(cheerio.load(await fetchGenrePage(`${JK_BASE}/genero/${slug}?p=1`)))
      if (first.urls.length === 0 && first.lastPage === 1) return
      const pages = [first]
      for (let p = 2; p <= first.lastPage; p++) {
        pages.push(parseGenrePage(cheerio.load(await fetchGenrePage(`${JK_BASE}/genero/${slug}?p=${p}`))))
      }
      for (const page of pages) {
        for (const url of page.urls) {
          if (!perUrl.has(url)) perUrl.set(url, new Set())
          perUrl.get(url).add(name)
        }
      }
    } catch {
      /* un genero falla, seguir con los demas */
    }
  })

  const genresMap = {}
  for (const [url, set] of perUrl) genresMap[url] = [...set]
  return { status: 'success', total: genres.length, items: Object.keys(genresMap).length, genres: genresMap }
}

module.exports = { getCatalog, getAnimeInfo, extractEpisode, getGenres, getGenresMap, getRecentEpisodes }
