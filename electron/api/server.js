const express = require('express')
const path = require('path')
const fs = require('fs')
const { getList, getRecentMovies } = require('./scrapers/archive.js')
const { extractMovie, getMovieGenres } = require('./scrapers/movie.js')
const { getSeriesPage, getSeriesInfo } = require('./scrapers/series.js')
const { getRecentEpisodes, getRecentSeasons } = require('./scrapers/feed.js')
const jkanime = require('./scrapers/jkanime.js')
const proxy = require('./scrapers/proxy.js')
const { extractFallbackStreams } = require('./fallback.js')
const cache = require('./cache.js')

const LIST_TTL = 30 * 60 * 1000
const GENRES_TTL = 24 * 60 * 60 * 1000

const isJkUrl = (url = '') => url.includes('jkanime.net')

const meta = {
  status: 'ready',
  name: 'DHUB API',
  version: '1.0',
  description: 'Resolvedor local de peliculas y streams de zonaaps.com',
    endpoints: {
      list: { method: 'GET', path: '/list', params: { page: 'Numero de pagina (opcional, por defecto 1)' } },
      extract: { method: 'GET', path: '/extract', params: { url: 'URL de la pelicula en zonaaps.com (requerido)' } },
      listSeries: { method: 'GET', path: '/list/series', params: { page: 'Numero de pagina (opcional)', genre: 'Genero de series (opcional, por defecto series-de-tv)' } },
      listAnime: { method: 'GET', path: '/list/anime', params: { page: 'Numero de pagina (opcional)' } },
      listEpisodes: { method: 'GET', path: '/list/episodes', params: { page: 'Numero de pagina (opcional)', refresh: 'Forzar recarga (1)' } },
      listRecentMovies: { method: 'GET', path: '/list/movies/recent', params: { refresh: 'Forzar recarga (1)' }, note: 'Ultimas peliculas por fecha de estreno' },
      listSeasons: { method: 'GET', path: '/list/seasons', params: { page: 'Numero de pagina (opcional)' } },
      seriesInfo: { method: 'GET', path: '/series/info', params: { url: 'URL de la serie (requerido)' } },
      extractFallback: { method: 'GET', path: '/extract/fallback', params: { title: 'Titulo a buscar (requerido)', year: 'Anio (opcional)', type: 'movie|serie|anime', season: 'Temporada (para serie)', ep: 'Numero de episodio' } }
    }
}

function createApp() {
  const app = express()

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  app.get('/api', (req, res) => res.json(meta))

  app.get('/list', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const data = await cache.get(`list:${page}`, () => getList(page), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/stream/proxy', (req, res) => {
    proxy.handleProxy(req, res, req.query.url, req.query.ref)
  })

  app.get('/extract', async (req, res) => {
    try {
      const url = req.query.url
      if (!url) return res.status(400).json({ status: 'error', message: 'Parametro url requerido' })
      const data = isJkUrl(url) ? await jkanime.extractEpisode(url) : await extractMovie(url)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/extract/fallback', async (req, res) => {
    try {
      const { title, year, type, season, ep } = req.query
      if (!title) return res.status(400).json({ status: 'error', message: 'Parametro title requerido' })
      const data = await extractFallbackStreams({ title, year, type, season, ep })
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/series', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const genre = req.query.genre || 'series-de-tv'
      const data = await cache.get(`series:${genre}:${page}`, () => getSeriesPage(page, genre), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/anime', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const refresh = req.query.refresh === '1'
      const data = refresh
        ? await jkanime.getCatalog(page)
        : await cache.get(`anime-jk:${page}`, () => jkanime.getCatalog(page), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/anime/episodes', async (req, res) => {
    try {
      const refresh = req.query.refresh === '1'
      const data = refresh
        ? await jkanime.getRecentEpisodes()
        : await cache.get('anime-jk-recent', () => jkanime.getRecentEpisodes(), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/anime/genres', async (req, res) => {
    try {
      const data = await cache.get('anime-jk-genres', () => jkanime.getGenresMap(), GENRES_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/episodes', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const refresh = req.query.refresh === '1'
      const data = refresh
        ? await getRecentEpisodes(page)
        : await cache.get(`feed-episodes:${page}`, () => getRecentEpisodes(page), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/movies/recent', async (req, res) => {
    try {
      const refresh = req.query.refresh === '1'
      const data = refresh
        ? await getRecentMovies()
        : await cache.get('movies-recent', () => getRecentMovies(), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/list/seasons', async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1)
      const data = await cache.get(`feed-seasons:${page}`, () => getRecentSeasons(page), LIST_TTL)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/series/info', async (req, res) => {
    try {
      const url = req.query.url
      if (!url) return res.status(400).json({ status: 'error', message: 'Parametro url requerido' })
      const data = isJkUrl(url) ? await jkanime.getAnimeInfo(url) : await getSeriesInfo(url)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  app.get('/genres', async (req, res) => {
    try {
      const url = req.query.url
      if (!url) return res.status(400).json({ status: 'error', message: 'Parametro url requerido' })
      const data = isJkUrl(url)
        ? await cache.get(`genres-jk:${url}`, () => jkanime.getGenres(url), GENRES_TTL)
        : await getMovieGenres(url)
      res.json(data)
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message })
    }
  })

  const dist = path.resolve(__dirname, '../../dist')
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist))
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  return app
}

async function startServer() {
  const app = createApp()
  const port = 3001
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve({ port, server }))
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`El puerto ${port} ya esta en uso. Cierra otra instancia de DHUB.`))
      } else {
        reject(err)
      }
    })
  })
}

module.exports = { startServer, createApp }
