import { CatalogScreen } from '../../components/CatalogScreen'
import { useCatalog } from '../../lib/CatalogContext'

export default function MoviesScreen() {
  const { catalog, refreshing, reload } = useCatalog()
  return <CatalogScreen title="Películas" items={catalog.filter((item) => item.type !== 'featured')} refreshing={refreshing} onRefresh={reload} />
}
