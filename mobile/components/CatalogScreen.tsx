import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { useCatalog } from '../lib/CatalogContext'
import { firstLetterOf, searchItems } from '../lib/search'
import type { CatalogItem } from '../lib/types'
import { ItemCard } from './ItemCard'

type Props = {
  title: string
  items: CatalogItem[]
  refreshing: boolean
  onRefresh: () => Promise<void>
}

export function CatalogScreen({ title, items, refreshing, onRefresh }: Props) {
  const [query, setQuery] = useState('')
  const [letter, setLetter] = useState('')
  const filtered = useMemo(() => {
    const searched = searchItems(items, query)
    return letter ? searched.filter((item) => firstLetterOf(item.title) === letter) : searched
  }, [items, query, letter])
  const letters = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')]

  return (
    <View className="flex-1 bg-ink px-4 pt-5">
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-3xl font-black text-white">{title}</Text>
          <Text className="mt-1 text-sm text-muted">{filtered.length} títulos</Text>
        </View>
        <Pressable className="rounded-full bg-accent px-4 py-2" onPress={onRefresh}>
          <Text className="text-lg font-bold text-white">⟳</Text>
        </Pressable>
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={`Buscar ${title.toLowerCase()}...`}
        placeholderTextColor="#697386"
        className="mb-3 rounded-xl border border-[#2a3040] bg-panel px-4 py-3 text-white"
      />
      <FlatList
        horizontal
        data={letters}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        className="mb-4 max-h-9"
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setLetter(letter === item ? '' : item)}
            className={`mr-2 h-8 min-w-8 items-center justify-center rounded-full px-2 ${letter === item ? 'bg-accent' : 'bg-panel'}`}
          >
            <Text className="text-xs font-bold text-white">{item}</Text>
          </Pressable>
        )}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.url}
        numColumns={3}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e50914" />}
        renderItem={({ item }) => <ItemCard item={item} />}
        ListEmptyComponent={<Text className="py-12 text-center text-muted">No hay resultados.</Text>}
      />
    </View>
  )
}
