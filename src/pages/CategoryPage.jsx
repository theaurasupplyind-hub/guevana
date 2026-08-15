import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext.jsx'
import { searchIndexed } from '../search.js'
import MovieGrid from '../components/MovieGrid.jsx'
import SearchResults from '../components/SearchResults.jsx'

function safeDecode(s = '') {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export default function CategoryPage() {
  const { genre } = useParams()
  const genreName = safeDecode(genre)
  const { catalog, seriesCatalog, animeCatalog, genresOf, counts, titleIndex } = useCatalog()
  const [params] = useSearchParams()
  const query = params.get('q') || ''

  const list = useMemo(
    () =>
      [...catalog, ...seriesCatalog, ...animeCatalog].filter((m) =>
        genresOf(m.url).includes(genreName)
      ),
    [catalog, seriesCatalog, animeCatalog, genresOf, genreName, counts]
  )

  const results = useMemo(
    () => (query ? searchIndexed(titleIndex, list, query) : null),
    [query, titleIndex, list]
  )

  return (
    <div className="category-page">
      <Link to="/" className="btn btn-ghost back">
        ← Volver
      </Link>
      {query ? (
        <SearchResults items={results} query={query} empty="Sin resultados en esta categoría." />
      ) : (
        <>
          <h2 className="row-title">
            {genreName} <span className="category-count">({counts[genreName] || 0})</span>
          </h2>
          <div className="grid-section">
            <MovieGrid movies={list} />
          </div>
          {list.length === 0 && (
            <p className="empty">
              Este género aún no tiene películas indexadas. Espera a que termine el indexado o reintenta más tarde.
            </p>
          )}
        </>
      )}
    </div>
  )
}
