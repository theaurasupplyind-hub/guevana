import { CatalogScreen } from '../../components/CatalogScreen'
import { useCatalog } from '../../lib/CatalogContext'

export default function AnimeScreen() {
  const { animeCatalog, refreshing, reload } = useCatalog()
  return <CatalogScreen title="Anime" items={animeCatalog} refreshing={refreshing} onRefresh={reload} />
}
