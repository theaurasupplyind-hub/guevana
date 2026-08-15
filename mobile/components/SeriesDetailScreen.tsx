import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { getSeriesInfo } from '../lib/api'
import type { Season } from '../lib/types'

export function SeriesDetailScreen() {
  const params = useLocalSearchParams<{ sourceUrl?: string; slug?: string }>()
  const sourceUrl = typeof params.sourceUrl === 'string' ? params.sourceUrl : ''
  const [data, setData] = useState<{ title?: string; description?: string; seasons?: Season[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sourceUrl) {
      setLoading(false)
      setError('No se encontró la URL de la serie.')
      return
    }
    getSeriesInfo(sourceUrl)
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar la serie.'))
      .finally(() => setLoading(false))
  }, [sourceUrl])

  return (
    <ScrollView className="flex-1 bg-ink px-4 pt-6">
      <Pressable onPress={() => router.back()} className="mb-6">
        <Text className="font-semibold text-accent">‹ Volver</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator color="#e50914" size="large" />
      ) : error ? (
        <Text className="text-center text-red-400">{error}</Text>
      ) : (
        <View className="pb-10">
          <Text className="text-3xl font-black text-white">{data?.title || 'Serie'}</Text>
          {!!data?.description && <Text className="mt-4 text-base leading-6 text-muted">{data.description}</Text>}
          {(data?.seasons || []).map((season) => (
            <View key={String(season.num)} className="mt-7">
              <Text className="mb-3 text-xl font-bold text-white">{season.title || `Temporada ${season.num}`}</Text>
              <View className="flex-row flex-wrap gap-2">
                {season.episodes.map((episode) => (
                  <Pressable
                    key={episode.url}
                    className="rounded-lg bg-panel px-3 py-3"
                    onPress={() =>
                      router.push({
                        pathname: '/movie/[slug]',
                        params: {
                          slug: episode.url.split('/').filter(Boolean).pop() || String(episode.num),
                          sourceUrl: episode.url,
                          title: episode.title
                        }
                      })
                    }
                  >
                    <Text className="text-sm font-semibold text-white">{episode.num}</Text>
                    <Text numberOfLines={1} className="mt-1 max-w-[180px] text-xs text-muted">
                      {episode.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
