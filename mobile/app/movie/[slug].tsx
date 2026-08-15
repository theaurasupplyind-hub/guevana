import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { extractMovie } from '../../lib/api'
import type { Stream } from '../../lib/types'
import { VideoPlayer } from '../../components/VideoPlayer'

export default function MovieDetailScreen() {
  const params = useLocalSearchParams<{ sourceUrl?: string; title?: string }>()
  const sourceUrl = typeof params.sourceUrl === 'string' ? params.sourceUrl : ''
  const [data, setData] = useState<{ title?: string; description?: string; streams?: Stream[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sourceUrl) {
      setLoading(false)
      setError('No se encontró la URL del título.')
      return
    }
    extractMovie(sourceUrl)
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo extraer el título.'))
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
          <Text className="text-3xl font-black text-white">{data?.title || params.title || 'Título'}</Text>
          <View className="mt-5">
            <VideoPlayer stream={data?.streams?.[0]} title={data?.title || ''} />
          </View>
          {!!data?.description && <Text className="mt-6 text-base leading-6 text-muted">{data.description}</Text>}
        </View>
      )}
    </ScrollView>
  )
}
