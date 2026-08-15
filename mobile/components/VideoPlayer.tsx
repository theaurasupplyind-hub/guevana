import { ActivityIndicator, Text, View } from 'react-native'
import Video from 'react-native-video'
import type { Stream } from '../lib/types'

export function VideoPlayer({ stream, title }: { stream?: Stream; title: string }) {
  if (!stream) {
    return (
      <View className="aspect-video items-center justify-center rounded-2xl bg-black">
        <Text className="text-sm text-muted">No hay un stream disponible.</Text>
      </View>
    )
  }

  return (
    <View className="overflow-hidden rounded-2xl bg-black">
      <Video
        source={{ uri: stream.url }}
        controls
        resizeMode="contain"
        paused={false}
        style={{ width: '100%', aspectRatio: 16 / 9 }}
        onError={(error) => console.warn('Video error', title, error)}
      />
      <View className="px-3 py-2">
        <Text numberOfLines={1} className="text-xs text-muted">
          {stream.source || title}
        </Text>
      </View>
    </View>
  )
}
