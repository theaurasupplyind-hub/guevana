const { Readable } = require('stream')
const { fetchUpstream } = require('../config.js')

const PROXY_PATH = '/stream/proxy'

function absUrl(base, u) {
  try {
    return new URL(u, base).href
  } catch {
    return null
  }
}

function rewriteUriAttr(line, ref, baseUrl, auth) {
  return line.replace(/URI="([^"]+)"/g, (m, uri) => {
    const abs = absUrl(baseUrl, uri)
    return abs
      ? `URI="${PROXY_PATH}?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(ref)}${auth}"`
      : m
  })
}

function rewriteLine(line, ref, baseUrl, auth) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return rewriteUriAttr(line, ref, baseUrl, auth)
  const abs = absUrl(baseUrl, trimmed)
  if (!abs) return line
  return `${PROXY_PATH}?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(ref)}${auth}`
}

function rewritePlaylist(text, ref, baseUrl, auth) {
  return text
    .split('\n')
    .map((line) => rewriteLine(line, ref, baseUrl, auth))
    .join('\n')
}

async function fetchUpstreamOk(url, ref, headers, throttle) {
  const res = await fetchUpstream(url, { referer: ref || undefined, headers, throttle })
  if (!res.ok && res.status !== 206) return null
  return res
}

async function probeHead(url, ref) {
  let res
  try {
    res = await fetchUpstream(url, { referer: ref || undefined, headers: { Range: 'bytes=0-1023' }, throttle: false })
  } catch {
    res = null
  }
  if (!res || (res.status !== 200 && res.status !== 206)) {
    try {
      res = await fetchUpstream(url, { referer: ref || undefined, throttle: false })
    } catch {
      return { contentType: '', head: '' }
    }
  }
  if (res.status !== 200 && res.status !== 206) return { contentType: '', head: '' }
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  let head = ''
  try {
    const reader = res.body.getReader()
    const { value } = await reader.read()
    try {
      reader.cancel()
    } catch {}
    head = Buffer.from(value || []).toString('latin1')
  } catch {}
  return { contentType, head }
}

async function handleProxy(req, res, url, ref) {
  if (!url) {
    res.status(400).json({ status: 'error', message: 'Parametro url requerido' })
    return
  }

  const { contentType, head } = await probeHead(url, ref)
  const isPlaylist = /mpegurl/i.test(contentType) || head.includes('#EXTM3U')
  const auth = req.get('X-Auth-Token') || req.query.token
  const authParam = auth ? `&token=${encodeURIComponent(auth)}` : ''

  if (isPlaylist) {
    const full = await fetchUpstreamOk(url, ref, undefined, false)
    if (!full) {
      res.status(502).json({ status: 'error', message: 'No se pudo leer la playlist' })
      return
    }
    const text = await full.text()
    const rewritten = rewritePlaylist(text, ref, url, authParam)
    res.set('Content-Type', 'application/vnd.apple.mpegurl')
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Cache-Control', 'no-store')
    res.send(rewritten)
    return
  }

  const range = req.headers.range || null
  const headers = range ? { Range: range } : undefined
  let upstream
  try {
    upstream = await fetchUpstreamOk(url, ref, headers, false)
  } catch {
    res.status(502).json({ status: 'error', message: 'No se pudo contactar el CDN' })
    return
  }
  if (!upstream) {
    res.status(502).json({ status: 'error', message: 'El CDN no respondio' })
    return
  }

  res.status(upstream.status)
  const ctype = upstream.headers.get('content-type')
  if (ctype) res.set('Content-Type', ctype)
  if (upstream.headers.get('content-range')) res.set('Content-Range', upstream.headers.get('content-range'))
  if (upstream.headers.get('content-length')) res.set('Content-Length', upstream.headers.get('content-length'))
  if (upstream.headers.get('accept-ranges')) res.set('Accept-Ranges', upstream.headers.get('accept-ranges'))
  Readable.fromWeb(upstream.body).pipe(res)
}

module.exports = { handleProxy, rewritePlaylist, PROXY_PATH }
