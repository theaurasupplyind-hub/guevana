import AsyncStorage from '@react-native-async-storage/async-storage'

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export type CatalogMeta = { page: number; totalPages: number }

const META_FALLBACK: CatalogMeta = { page: 1, totalPages: 0 }

function metaApi(key: string) {
  return {
    load: () => load<CatalogMeta>(key, META_FALLBACK),
    save: (value: CatalogMeta) => save(key, value)
  }
}

async function save<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is best effort; the in-memory state remains usable.
  }
}

export const storage = {
  catalog: {
    load: () => load('dhub.mobile.catalog.v1', []),
    save: (value: unknown[]) => save('dhub.mobile.catalog.v1', value)
  },
  series: {
    load: () => load('dhub.mobile.series.v1', []),
    save: (value: unknown[]) => save('dhub.mobile.series.v1', value)
  },
  anime: {
    load: () => load('dhub.mobile.anime.v1', []),
    save: (value: unknown[]) => save('dhub.mobile.anime.v1', value)
  },
  recentSeries: {
    load: () => load('dhub.mobile.recent.series.v1', []),
    save: (value: unknown[]) => save('dhub.mobile.recent.series.v1', value)
  },
  recentAnime: {
    load: () => load('dhub.mobile.recent.anime.v1', []),
    save: (value: unknown[]) => save('dhub.mobile.recent.anime.v1', value)
  },
  recentMovies: {
    load: () => load('dhub.mobile.recent.movies.v1', []),
    save: (value: unknown[]) => save('dhub.mobile.recent.movies.v1', value)
  },
  catalogMeta: metaApi('dhub.mobile.catalog.meta.v1'),
  seriesMeta: metaApi('dhub.mobile.series.meta.v1'),
  animeMeta: metaApi('dhub.mobile.anime.meta.v1'),
  extracted: {
    load: () => load<Record<string, unknown>>('dhub.mobile.extracted.v1', {}),
    save: (value: Record<string, unknown>) => save('dhub.mobile.extracted.v1', value)
  }
}
