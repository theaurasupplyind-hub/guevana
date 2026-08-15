const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const BASE = 'https://zonaaps.com'
const MIN_GAP = 150
const BROWSER_FETCH_ENABLED = true
const BROWSER_FETCH_TIMEOUT = 12000

let lastUpstream = 0

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isBlockedResponse(res) {
  if (!res) return true
  if (res.status === 403 || res.status === 503 || res.status === 429) return true
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('application/json')) return false
  return false
}

function isChallengeBody(text = '') {
  const head = text.slice(0, 8000).toLowerCase()
  return (
    head.includes('cf_chl') ||
    head.includes('cf-chl') ||
    head.includes('just a moment') ||
    head.includes('please wait while your request is being verified') ||
    head.includes('challenge-platform')
  )
}

function fetchViaBrowser(url, referer, timeout = BROWSER_FETCH_TIMEOUT) {
  try {
    const { BrowserWindow, session } = require('electron')
    return new Promise((resolve) => {
      let done = false
      const finish = (body) => {
        if (done) return
        done = true
        try {
          cleanup()
        } catch {}
        resolve(body)
      }
      const win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true, javascript: true, contextIsolation: true }
      })
      const cleanup = () => {
        try {
          if (!win.isDestroyed()) win.destroy()
        } catch {}
      }
      const timer = setTimeout(() => finish(''), timeout)
      win.webContents.once('did-finish-load', async () => {
        clearTimeout(timer)
        try {
          const body = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
          finish(body || '')
        } catch {
          finish('')
        }
      })
      win.webContents.once('did-fail-load', () => {
        clearTimeout(timer)
        finish('')
      })
      win.webContents.once('render-process-gone', () => {
        clearTimeout(timer)
        finish('')
      })
      win.loadURL(url, referer ? { extraHeaders: `Referer: ${referer}\r\n` } : undefined)
    })
  } catch {
    return Promise.resolve('')
  }
}

async function fetchTextWithFallback(url, opts = {}) {
  const { referer } = opts
  try {
    const res = await fetchUpstream(url, opts)
    if (!isBlockedResponse(res)) {
      const text = await res.text()
      if (!isChallengeBody(text)) return text
    }
  } catch {
    /* caer al navegador */
  }
  if (!BROWSER_FETCH_ENABLED) throw new Error(`HTTP bloqueado en ${url.slice(0, 80)}`)
  const html = await fetchViaBrowser(url, referer)
  if (!html) throw new Error(`No se pudo obtener ${url.slice(0, 80)}`)
  return html
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

module.exports = { UA, BASE, fetchUpstream, fetchText, fetchJson, fetchTextWithFallback, fetchViaBrowser }
