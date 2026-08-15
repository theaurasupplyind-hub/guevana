const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const BASE = 'https://zonaaps.com'
const MIN_GAP = 150

let lastUpstream = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchUpstream(url, { referer, headers = {}, redirect, method, body, throttle = true } = {}) {
  if (throttle) {
    const now = Date.now()
    const wait = MIN_GAP - (now - lastUpstream)
    if (wait > 0) await sleep(wait)
    lastUpstream = Date.now()
  }

  const h = {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
    ...headers
  }
  if (referer) h.Referer = referer

  const res = await fetch(url, {
    method: method || 'GET',
    headers: h,
    body,
    redirect: redirect === 'manual' ? 'manual' : 'follow'
  })
  if (redirect !== 'manual' && !res.ok) {
    throw new Error(`HTTP ${res.status} en ${url.slice(0, 80)}`)
  }
  return res
}

async function fetchText(url, opts) {
  return (await fetchUpstream(url, opts)).text()
}

async function fetchJson(url, opts) {
  return (await fetchUpstream(url, opts)).json()
}

module.exports = { UA, BASE, fetchUpstream, fetchText, fetchJson }
