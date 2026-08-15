const CATALOG_KEY = 'guevana.catalog.v1'
const CATALOG_TS_KEY = 'guevana.catalog.ts.v1'
const SERIES_KEY = 'guevana.series.v2'
const SERIES_TS_KEY = 'guevana.series.ts.v2'
const ANIME_KEY = 'guevana.anime.v2'
const ANIME_TS_KEY = 'guevana.anime.ts.v2'
const GENRES_KEY = 'guevana.genres.v1'
const FAILED_KEY = 'guevana.genres.failed.v1'
const PAUSED_KEY = 'guevana.index.paused.v1'
const DAILY_KEY = 'guevana.index.daily.v1'
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento lleno o no disponible: mantener en memoria */
  }
}

export const catalogStorage = {
  load: () => read(CATALOG_KEY, []),
  save: (movies) => write(CATALOG_KEY, movies)
}

export const catalogTsStorage = {
  load: () => Number(read(CATALOG_TS_KEY, 0)),
  save: (ts) => write(CATALOG_TS_KEY, ts)
}

export const seriesStorage = {
  load: () => read(SERIES_KEY, []),
  save: (series) => write(SERIES_KEY, series)
}

export const seriesTsStorage = {
  load: () => Number(read(SERIES_TS_KEY, 0)),
  save: (ts) => write(SERIES_TS_KEY, ts)
}

export const animeStorage = {
  load: () => read(ANIME_KEY, []),
  save: (anime) => write(ANIME_KEY, anime)
}

export const animeTsStorage = {
  load: () => Number(read(ANIME_TS_KEY, 0)),
  save: (ts) => write(ANIME_TS_KEY, ts)
}

export const genresStorage = {
  load: () => read(GENRES_KEY, {}),
  save: (genres) => write(GENRES_KEY, genres)
}

export const failedStorage = {
  load: () => read(FAILED_KEY, []),
  save: (failed) => write(FAILED_KEY, failed)
}

export const pausedStorage = {
  load: () => read(PAUSED_KEY, false),
  save: (paused) => write(PAUSED_KEY, paused)
}

export const dailyUsageStorage = {
  load: () => read(DAILY_KEY, { date: '', count: 0 }),
  save: (usage) => write(DAILY_KEY, usage)
}

const RECENT_EPISODES_KEY = 'guevana.recent.anime.v1'
const RECENT_EPISODES_TS_KEY = 'guevana.recent.anime.ts.v1'

export const recentEpisodesStorage = {
  load: () => read(RECENT_EPISODES_KEY, []),
  save: (episodes) => write(RECENT_EPISODES_KEY, episodes),
  ts: {
    load: () => Number(read(RECENT_EPISODES_TS_KEY, 0)),
    save: (ts) => write(RECENT_EPISODES_TS_KEY, ts)
  }
}

const RECENT_MOVIES_KEY = 'guevana.recent.movies.v1'
const RECENT_MOVIES_TS_KEY = 'guevana.recent.movies.ts.v1'

export const recentMoviesStorage = {
  load: () => read(RECENT_MOVIES_KEY, []),
  save: (movies) => write(RECENT_MOVIES_KEY, movies),
  ts: {
    load: () => Number(read(RECENT_MOVIES_TS_KEY, 0)),
    save: (ts) => write(RECENT_MOVIES_TS_KEY, ts)
  }
}

const RECENT_SERIES_EPISODES_KEY = 'guevana.recent.series.episodes.v1'
const RECENT_SERIES_EPISODES_TS_KEY = 'guevana.recent.series.episodes.ts.v1'

export const recentSeriesEpisodesStorage = {
  load: () => read(RECENT_SERIES_EPISODES_KEY, []),
  save: (episodes) => write(RECENT_SERIES_EPISODES_KEY, episodes),
  ts: {
    load: () => Number(read(RECENT_SERIES_EPISODES_TS_KEY, 0)),
    save: (ts) => write(RECENT_SERIES_EPISODES_TS_KEY, ts)
  }
}
