import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext.jsx'
import { searchIndexed } from '../search.js'
import { slugFromUrl } from '../api.js'
import MovieGrid from '../components/MovieGrid.jsx'
import SearchResults from '../components/SearchResults.jsx'
import LoadingBox from '../components/LoadingBox.jsx'

export default function SeriesPage() {
  const { seriesCatalog, seriesLoading, recentSeriesEpisodes, titleIndex, refreshSeriesCatalog, loadRecentSeriesEpisodes } = useCatalog()
  const [params] = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const query = params.get('q') || ''

  const results = useMemo(
    () => (query ? searchIndexed(titleIndex, seriesCatalog, query) : null),
    [query, titleIndex, seriesCatalog]
  )

  const onRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    Promise.all([refreshSeriesCatalog(), loadRecentSeriesEpisodes({ forceRefresh: true })]).finally(() =>
      setRefreshing(false)
    )
  }

  if (seriesLoading && seriesCatalog.length === 0) {
    return (
      <div className="loading">
        <LoadingBox label="Cargando series..." />
      </div>
    )
  }

  if (query) {
    return (
      <div className="series-page">
        <SearchResults items={results} query={query} empty="Sin series encontradas." />
      </div>
    )
  }

  return (
    <div className="series-page">
      <div className="row-title-row">
        <h2 className="row-title">
          Series <span className="category-count">({seriesCatalog.length})</span>
        </h2>
        <button
          type="button"
          className={refreshing ? 'refresh-btn spinning' : 'refresh-btn'}
          onClick={onRefresh}
          title="Actualizar catálogo"
          aria-label="Actualizar catálogo"
        >
          ⟳
        </button>
      </div>

      {recentSeriesEpisodes.length > 0 && (
        <section className="recent-section" aria-label="Últimos capítulos">
          <h3 className="row-title">Últimos capítulos</h3>
          <div className="recent-row">
            {recentSeriesEpisodes.slice(0, 16).map((ep) => (
              <Link
                key={ep.url}
                to={`/movie/${slugFromUrl(ep.url)}`}
                state={{
                  movie: {
                    url: ep.url,
                    title: ep.series ? `${ep.series} · ${ep.label || ep.title}` : ep.title,
                    image: ep.image
                  },
                  from: '/series'
                }}
                className="recent-card"
                title={`${ep.series} — ${ep.label || ep.title}`}
              >
                <div className="recent-thumb">
                  {ep.image ? (
                    <img src={ep.image} alt={ep.series} loading="lazy" />
                  ) : (
                    <div className="card-placeholder">{ep.series}</div>
                  )}
                </div>
                <div className="recent-meta">
                  <span className="recent-title">{ep.series}</span>
                  <span className="recent-date">{ep.label || ep.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid-section">
        <MovieGrid movies={seriesCatalog} />
      </div>
      {seriesCatalog.length === 0 && <p className="empty">Aún no hay series disponibles.</p>}
    </div>
  )
}
