import AsyncStorage from '@react-native-async-storage/async-storage'

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
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
  extracted: {
    load: () => load<Record<string, unknown>>('dhub.mobile.extracted.v1', {}),
    save: (value: Record<string, unknown>) => save('dhub.mobile.extracted.v1', value)
  }
}
