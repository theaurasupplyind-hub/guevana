import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext.jsx'
import { searchIndexed, firstLetterOf, mergeResults } from '../search.js'
import useLiveSearch from '../useLiveSearch.js'
import MovieGrid from '../components/MovieGrid.jsx'
import SearchResults from '../components/SearchResults.jsx'
import LoadingBox from '../components/LoadingBox.jsx'
import AlphabetFilter from '../components/AlphabetFilter.jsx'

export default function AnimePage() {
  const { animeCatalog, animeLoading, recentEpisodes, titleIndex, refreshAnimeCatalog } = useCatalog()
  const [params, setParams] = useSearchParams()
  const [refreshing, setRefreshing] = useState(false)
  const query = params.get('q') || ''
  const letter = params.get('letra') || ''

  const { results: liveResults, loading: liveLoading } = useLiveSearch(query, { type: 'anime' })

  const results = useMemo(() => {
    if (!query) return null
    const local = searchIndexed(titleIndex, animeCatalog, query)
    return mergeResults(local || [], liveResults)
  }, [query, titleIndex, animeCatalog, liveResults])

  const filtered = useMemo(() => {
    if (!letter) return animeCatalog
    return animeCatalog.filter((m) => firstLetterOf(m.title) === letter)
  }, [animeCatalog, letter])

  const onLetter = (l) => setParams(l ? { letra: l } : {})

  const onRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    refreshAnimeCatalog()
      .finally(() => setRefreshing(false))
  }

  if (animeLoading && animeCatalog.length === 0) {
    return (
      <div className="loading">
        <LoadingBox label="Cargando animes..." />
      </div>
    )
  }

  if (query) {
    return (
      <div className="series-page">
        <SearchResults items={results} query={query} loading={liveLoading} empty="Sin animes encontrados." />
      </div>
    )
  }

  return (
    <div className="series-page">
      <div className="row-title-row">
        <h2 className="row-title">
          Animes{letter ? ` · ${letter}` : ''} <span className="category-count">({filtered.length})</span>
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

      {recentEpisodes.length > 0 && (
        <section className="recent-section" aria-label="Últimos capítulos">
          <h3 className="row-title">Últimos capítulos</h3>
          <div className="recent-row">
            {recentEpisodes.map((ep) => (
              <Link
                key={ep.url}
                to={`/movie/${ep.slug}-ep-${ep.num}`}
                state={{
                  movie: {
                    url: ep.url,
                    title: `${ep.series} · Episodio ${ep.num}`,
                    image: ep.image
                  },
                  from: '/anime'
                }}
                className="recent-card"
                title={`${ep.series} — Episodio ${ep.num}`}
              >
                <div className="recent-thumb">
                  {ep.image ? (
                    <img src={ep.image} alt={ep.series} loading="lazy" />
                  ) : (
                    <div className="card-placeholder">{ep.series}</div>
                  )}
                  <span className="recent-num">Ep {ep.num}</span>
                </div>
                <div className="recent-meta">
                  <span className="recent-title">{ep.series}</span>
                  {ep.date && <span className="recent-date">{ep.date}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AlphabetFilter active={letter} onChange={onLetter} />
      <div className="grid-section">
        <MovieGrid movies={filtered} />
      </div>
      {filtered.length === 0 && <p className="empty">No hay animes en esta letra.</p>}
    </div>
  )
}
