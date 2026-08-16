import { CatalogScreen } from '../../components/CatalogScreen'
import { useCatalog } from '../../lib/CatalogContext'

export default function SeriesScreen() {
  const { seriesCatalog, refreshing, reload, hasMoreSeries, loadingMoreSeries, loadMoreSeries } = useCatalog()
  return (
    <CatalogScreen
      title="Series"
      items={seriesCatalog}
      refreshing={refreshing}
      onRefresh={reload}
      hasMore={hasMoreSeries}
      loadingMore={loadingMoreSeries}
      onLoadMore={loadMoreSeries}
    />
  )
}
