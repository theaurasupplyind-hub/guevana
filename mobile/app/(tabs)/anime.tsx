import { CatalogScreen } from '../../components/CatalogScreen'
import { useCatalog } from '../../lib/CatalogContext'

export default function AnimeScreen() {
  const { animeCatalog, refreshing, reload, hasMoreAnime, loadingMoreAnime, loadMoreAnime } = useCatalog()
  return (
    <CatalogScreen
      title="Anime"
      items={animeCatalog}
      refreshing={refreshing}
      onRefresh={reload}
      hasMore={hasMoreAnime}
      loadingMore={loadingMoreAnime}
      onLoadMore={loadMoreAnime}
    />
  )
}
