import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { CatalogProvider } from '../lib/CatalogContext'

export default function RootLayout() {
  return (
    <CatalogProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0d1018' } }} />
    </CatalogProvider>
  )
}
