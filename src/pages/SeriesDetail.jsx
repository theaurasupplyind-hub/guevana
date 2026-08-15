import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import { getSeriesInfo, getCachedSeriesInfo, slugFromUrl, decodeEntities } from '../api.js'
import LoadingBox from '../components/LoadingBox.jsx'

export default function SeriesDetail() {
  return <SeriesDetailView basePath="/series" />
}

export function SeriesDetailView({ basePath, localOnly = false }) {
  const { slug } = useParams()
  const location = useLocation()
  const stateUrl = location.state?.movie?.url
  const url =
    stateUrl ||
    (basePath === '/anime'
      ? `https://jkanime.net/${slug}/`
      : `https://zonaaps.com/tvshows/${slug}/`)
  const cached = getCachedSeriesInfo(url)
  const [info, setInfo] = useState(cached)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!cached)
  const [activeSeason, setActiveSeason] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    getSeriesInfo(url, { localOnly })
      .then((data) => {
        if (cancelled) return
        setInfo(data)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(`No se pudo contactar la API (${e.message}).`)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url, localOnly])

  const seasons = info?.seasons || []
  const current = seasons[activeSeason] || seasons[0]

  const flatEpisodes = useMemo(
    () => seasons.flatMap((se) => se.episodes.map((ep) => ({ ...ep, season: se.num }))),
    [seasons]
  )

  if (loading && !info) {
    return (
      <div className="detail">
        <Link to={basePath} className="btn btn-ghost back">← Volver</Link>
        <div className="loading">
          <LoadingBox label="Extrayendo información de la serie..." />
        </div>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="detail">
        <Link to={basePath} className="btn btn-ghost back">← Volver</Link>
        <div className="loading error">{error}</div>
      </div>
    )
  }

  if (!info) return null

  return (
    <div className="detail series-detail">
      <Link to={basePath} className="btn btn-ghost back">← Volver</Link>

      <section className="detail-info-section">
        <div className="detail-head">
          {info.poster && <img className="detail-poster" src={info.poster} alt={info.title} />}
          <div className="detail-info">
            <h1 className="detail-title">{decodeEntities(info.title)}</h1>
            <div className="detail-meta">
              {Number(info.rating) > 0 && <span className="rating">★ {info.rating}</span>}
              {Number(info.tmdbRating) > 0 && <span className="tmdb">TMDB {info.tmdbRating}</span>}
              {info.year && <span>{info.year}</span>}
              {info.network && <span className="quality">{info.network}</span>}
            </div>
            {info.genres && info.genres.length > 0 && (
              <div className="genres">
                {info.genres.map((g) => (
                  <span key={g} className="genre">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {seasons.length > 1 && (
        <div className="season-bar">
          {seasons.map((se, i) => (
            <button
              key={i}
              className={i === activeSeason ? 'season-chip active' : 'season-chip'}
              onClick={() => setActiveSeason(i)}
            >
              {se.title || `Temporada ${se.num}`}
            </button>
          ))}
        </div>
      )}

      {current && (
        <section className="episode-section">
          <h2 className="row-title">{current.title || `Temporada ${current.num}`}</h2>
          <div className="episode-grid">
            {current.episodes.map((ep, i) => {
              const epIndex = flatEpisodes.findIndex((f) => f.url === ep.url)
              return (
              <Link
                key={i}
                to={`/movie/${slugFromUrl(ep.url)}`}
                state={{
                  movie: {
                    url: ep.url,
                    title: `${info.title} ${ep.num} — ${ep.title}`,
                    image: ep.image
                  },
                  seriesTitle: info.title,
                  episodes: flatEpisodes,
                  currentIndex: epIndex,
                  season: ep.season,
                  episodeNum: ep.num,
                  from: `${basePath}/${slug}`
                }}
                className="episode-card"
                title={`${ep.num} ${ep.title}`}
              >
                <div className="episode-thumb">
                  {ep.image ? (
                    <img src={ep.image} alt={ep.title} loading="lazy" />
                  ) : (
                    <div className="card-placeholder">{ep.title}</div>
                  )}
                  <span className="episode-num">{ep.num}</span>
                </div>
                <div className="episode-meta">
                  <span className="episode-title">{ep.title}</span>
                  {ep.date && <span className="episode-date">{ep.date}</span>}
                </div>
              </Link>
              )
            })}
          </div>
        </section>
      )}

      {info.description && (
        <section className="detail-synopsis">
          <h2 className="row-title">Sinopsis</h2>
          <p className="detail-desc">{decodeEntities(info.description)}</p>
        </section>
      )}

      {error && <p className="detail-error">{error}</p>}
    </div>
  )
}
