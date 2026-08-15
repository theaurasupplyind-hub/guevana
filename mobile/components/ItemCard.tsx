import { Image, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { CatalogItem } from '../lib/types'
import { slugFromUrl } from '../lib/search'

export function ItemCard({ item }: { item: CatalogItem }) {
  const isSeries = item.type === 'serie'
  const isAnime = item.type === 'anime'
  const path = isAnime ? '/anime/[slug]' : isSeries ? '/series/[slug]' : '/movie/[slug]'

  return (
    <Pressable
      className="mb-5 w-[31%]"
      onPress={() => router.push({ pathname: path as never, params: { slug: slugFromUrl(item.url), sourceUrl: item.url } })}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} className="h-44 w-full rounded-xl bg-panel" resizeMode="cover" />
      ) : (
        <View className="h-44 items-center justify-center rounded-xl bg-panel px-2">
          <Text className="text-center text-xs text-white">{item.title}</Text>
        </View>
      )}
      <Text numberOfLines={2} className="mt-2 text-xs font-semibold text-white">
        {item.title}
      </Text>
      <Text className="mt-1 text-[11px] text-muted">{String(item.year || '')}</Text>
    </Pressable>
  )
}
