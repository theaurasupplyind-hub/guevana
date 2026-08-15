import { Link } from 'expo-router'
import { Image, Pressable, ScrollView, Text, View } from 'react-native'
import { useCatalog } from '../../lib/CatalogContext'
import { ItemCard } from '../../components/ItemCard'

export default function HomeScreen() {
  const { catalog, seriesCatalog, animeCatalog, recentMovies, refreshing, reload } = useCatalog()
  const featured = catalog.filter((item) => item.type === 'featured').slice(0, 5)

  return (
    <ScrollView className="flex-1 bg-ink" refreshControl={undefined}>
      <View className="px-4 pb-8 pt-8">
        <View className="mb-7 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-bold uppercase tracking-[3px] text-accent">DHUB</Text>
            <Text className="mt-2 text-3xl font-black text-white">Tu cine, en un solo lugar</Text>
          </View>
          <Pressable className="rounded-full bg-panel px-4 py-3" onPress={reload}>
            <Text className="text-lg text-white">⟳</Text>
          </Pressable>
        </View>

        {featured[0]?.image ? (
          <Image source={{ uri: featured[0].image }} className="h-56 rounded-2xl" resizeMode="cover" />
        ) : (
          <View className="h-56 items-center justify-center rounded-2xl bg-panel">
            <Text className="text-muted">Actualiza para cargar novedades</Text>
          </View>
        )}

        <View className="mt-7 flex-row gap-3">
          <Link href="/(tabs)/movies" asChild>
            <Pressable className="flex-1 rounded-xl bg-accent px-4 py-4">
              <Text className="font-bold text-white">Películas</Text>
              <Text className="mt-1 text-xs text-white/70">{catalog.length} títulos</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/series" asChild>
            <Pressable className="flex-1 rounded-xl bg-panel px-4 py-4">
              <Text className="font-bold text-white">Series</Text>
              <Text className="mt-1 text-xs text-muted">{seriesCatalog.length} títulos</Text>
            </Pressable>
          </Link>
        </View>

        <Text className="mb-3 mt-8 text-xl font-bold text-white">Últimas películas</Text>
        <View className="flex-row flex-wrap justify-between">
          {recentMovies.slice(0, 6).map((item) => <ItemCard key={item.url} item={item} />)}
        </View>

        <Text className="mb-3 mt-4 text-xl font-bold text-white">Catálogo disponible</Text>
        <Text className="text-sm leading-6 text-muted">
          {catalog.length} películas · {seriesCatalog.length} series · {animeCatalog.length} animes
        </Text>
      </View>
    </ScrollView>
  )
}
