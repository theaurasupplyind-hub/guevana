const { fetchText, fetchJson, fetchUpstream, BASE } = require('../config.js')

function extract(html, key) {
  const m = html.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`))
  return m ? m[1] : null
}

function extractJwPlayerFile(html) {
  const m = html.match(/file:\s*["']([^"']+)["']/)
  return m ? m[1] : null
}

async function flowDataPhp(origin, configId, authToken, referer) {
  const res = await fetchJson(`${origin}/api/data.php?${configId}`, {
    referer,
    headers: { 'X-Auth-Token': authToken }
  })
  const file = res.sources && res.sources[0] && res.sources[0].file
  return file || null
}

async function flowGetVideoConfig(configId) {
  const cfg = await fetchJson(`${BASE}/get_video_config.php?id=${configId}`, {
    referer: BASE + '/'
  })
  const file = cfg.sources && cfg.sources[0] && cfg.sources[0].file
  if (!file) return null

  const master = await fetchText(`${BASE}${file}`, { referer: BASE + '/' })
  const m = master.match(/mode=redirect&token=([^\r\n]+)/)
  if (!m) return null

  const token = decodeURIComponent(m[1].trim())
  const redir = await fetchUpstream(`${BASE}/video.php?mode=redirect&token=${token}`, {
    referer: BASE + '/',
    redirect: 'manual'
  })
  return redir.headers.get('location')
}

async function resolveEmbedPure(embedUrl, referer) {
  const html = await fetchText(embedUrl, { referer })
  const configId = extract(html, 'configId')
  if (configId) {
    const authToken = extract(html, 'AUTH_TOKEN')
    const origin = new URL(embedUrl).origin

    if (authToken) {
      try {
        return await flowDataPhp(origin, configId, authToken, embedUrl)
      } catch {
        /* seguir con el otro flujo */
      }
    }
    try {
      return await flowGetVideoConfig(configId)
    } catch {
      return null
    }
  }
  const jw = extractJwPlayerFile(html)
  if (jw) return jw
  return null
}

function resolveWithElectronCapture(embedUrl, referer) {
  try {
    const { BrowserWindow, session } = require('electron')
    return new Promise((resolve) => {
      let done = false
      let candidate = null
      const finish = (url) => {
        if (done) return
        done = true
        cleanup()
        resolve(url)
      }
      const win = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true, javascript: true, contextIsolation: true }
      })
      const filter = { urls: ['*://*/*'] }
      const onBeforeRequest = (details, cb) => {
        if (/\.m3u8|mpegurl/i.test(details.url)) {
          finish(details.url)
        } else if (!candidate && /\.mp4(\?|$)/i.test(details.url)) {
          candidate = details.url
        }
        cb({})
      }
      session.defaultSession.webRequest.onBeforeRequest(filter, onBeforeRequest)
      const cleanup = () => {
        try {
          session.defaultSession.webRequest.onBeforeRequest(null)
        } catch {}
        if (!win.isDestroyed()) win.destroy()
      }
      win.webContents.on('did-finish-load', () => setTimeout(() => finish(candidate), 5000))
      win.webContents.on('did-fail-load', () => finish(candidate))
      win.webContents.on('render-process-gone', () => finish(candidate))
      win.loadURL(embedUrl, { extraHeaders: `Referer: ${referer}\r\n` })
    })
  } catch {
    return null
  }
}

async function resolveEmbed(embedUrl, referer) {
  try {
    const pure = await resolveEmbedPure(embedUrl, referer)
    if (pure) return pure
  } catch {}
  return resolveWithElectronCapture(embedUrl, referer)
}

module.exports = { resolveEmbed }
