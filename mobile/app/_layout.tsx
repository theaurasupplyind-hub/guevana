import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Text, View } from 'react-native'
import { CatalogProvider, useCatalog } from '../lib/CatalogContext'

function AppContent() {
  const { loading } = useCatalog()
  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0d1018' } }} />
      {loading && (
        <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-ink">
          <Text className="text-4xl font-black tracking-tight text-white">DHUB</Text>
          <ActivityIndicator color="#e50914" size="large" className="mt-8" />
          <Text className="mt-4 text-sm text-muted">Cargando catálogo...</Text>
        </View>
      )}
    </View>
  )
}

export default function RootLayout() {
  return (
    <CatalogProvider>
      <AppContent />
    </CatalogProvider>
  )
}
