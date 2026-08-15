import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext.jsx'
import { searchIndexed } from '../search.js'
import IndexingBar from '../components/IndexingBar.jsx'
import Row from '../components/Row.jsx'
import SearchResults from '../components/SearchResults.jsx'

const TOP_LARGE = 8

function topRated(list, n) {
  return [...list]
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, n)
}

export default function Home() {
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const { catalog, loading, seriesCatalog, animeCatalog, titleIndex } = useCatalog()

  const allItems = useMemo(
    () => [...catalog, ...seriesCatalog, ...animeCatalog],
    [catalog, seriesCatalog, animeCatalog]
  )

  const results = useMemo(
    () => (query ? searchIndexed(titleIndex, allItems, query) : null),
    [query, titleIndex, allItems]
  )

  const featured = useMemo(() => catalog.filter((m) => m.type === 'featured').slice(0, TOP_LARGE), [catalog])
  const topSeries = useMemo(() => topRated(seriesCatalog, TOP_LARGE), [seriesCatalog])
  const topAnime = useMemo(() => topRated(animeCatalog, TOP_LARGE), [animeCatalog])
  const topMovies = useMemo(
    () => topRated(catalog.filter((m) => m.type !== 'featured'), TOP_LARGE),
    [catalog]
  )

  if (loading) return <div className="loading">Cargando catálogo...</div>

  return (
    <div>
      <IndexingBar />

      {query && <SearchResults items={results} query={query} />}

      {!query && (
        <>
          <Row title="Destacadas" movies={featured} large />
          <Row title="Series" movies={topSeries} large />
          <Row title="Animes" movies={topAnime} large />
          <Row title="Películas" movies={topMovies} large />
        </>
      )}
    </div>
  )
}
