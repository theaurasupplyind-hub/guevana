import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#171b26', borderTopColor: '#2a3040' },
        tabBarActiveTintColor: '#e50914',
        tabBarInactiveTintColor: '#9aa3b2'
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarLabel: 'Inicio' }} />
      <Tabs.Screen name="movies" options={{ title: 'Películas', tabBarLabel: 'Películas' }} />
      <Tabs.Screen name="series" options={{ title: 'Series', tabBarLabel: 'Series' }} />
      <Tabs.Screen name="anime" options={{ title: 'Anime', tabBarLabel: 'Anime' }} />
    </Tabs>
  )
}
