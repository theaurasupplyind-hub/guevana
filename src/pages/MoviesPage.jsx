import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext.jsx'
import { searchIndexed, firstLetterOf } from '../search.js'
import MovieGrid from '../components/MovieGrid.jsx'
import SearchResults from '../components/SearchResults.jsx'
import LoadingBox from '../components/LoadingBox.jsx'
import AlphabetFilter from '../components/AlphabetFilter.jsx'
import Row from '../components/Row.jsx'

export default function MoviesPage() {
  const { catalog, loading, recentMovies, titleIndex, loadRecentMovies } = useCatalog()
  const [params, setParams] = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const query = params.get('q') || ''
  const letter = params.get('letra') || ''

  const movies = useMemo(() => catalog.filter((m) => m.type !== 'featured'), [catalog])

  const results = useMemo(
    () => (query ? searchIndexed(titleIndex, movies, query) : null),
    [query, titleIndex, movies]
  )

  const filtered = useMemo(() => {
    if (!letter) return movies
    return movies.filter((m) => firstLetterOf(m.title) === letter)
  }, [movies, letter])

  const onLetter = (l) => setParams(l ? { letra: l } : {})

  const onRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    loadRecentMovies({ forceRefresh: true }).finally(() => setRefreshing(false))
  }

  if (loading && catalog.length === 0) {
    return (
      <div className="loading">
        <LoadingBox label="Cargando películas..." />
      </div>
    )
  }

  if (query) {
    return (
      <div className="series-page">
        <SearchResults items={results} query={query} empty="Sin películas encontradas." />
      </div>
    )
  }

  return (
    <div className="series-page">
      <div className="row-title-row">
        <h2 className="row-title">
          Películas{letter ? ` · ${letter}` : ''} <span className="category-count">({filtered.length})</span>
        </h2>
        <button
          type="button"
          className={refreshing ? 'refresh-btn spinning' : 'refresh-btn'}
          onClick={onRefresh}
          title="Actualizar novedades"
          aria-label="Actualizar novedades"
        >
          ⟳
        </button>
      </div>

      {recentMovies.length > 0 && <Row title="Últimas películas" movies={recentMovies.slice(0, 16)} />}

      <AlphabetFilter active={letter} onChange={onLetter} />
      <div className="grid-section">
        <MovieGrid movies={filtered} />
      </div>
      {filtered.length === 0 && <p className="empty">No hay películas en esta letra.</p>}
    </div>
  )
}
