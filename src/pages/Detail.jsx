import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { extractMovie, getCachedMovieInfo, decodeEntities, slugFromUrl, LOCAL_BASE } from '../api.js'
import Player from '../components/Player.jsx'
import LoadingBox from '../components/LoadingBox.jsx'

const MAX_STREAM_RETRIES = 3

export default function Detail() {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const fromCard = location.state?.movie
  const backTo = location.state?.from || '/'

  const episodeList = location.state?.episodes || null
  const currentIndex = location.state?.currentIndex ?? -1
  const seriesTitle = location.state?.seriesTitle || fromCard?.title || ''
  const nextEp = episodeList ? episodeList[currentIndex + 1] : null
  const prevEp = episodeList ? episodeList[currentIndex - 1] : null

  const [movie, setMovie] = useState(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState(null)
  const [reExtracting, setReExtracting] = useState(false)

  const url = useMemo(() => {
    if (fromCard?.url) return fromCard.url
    return `https://zonaaps.com/movies/${slug}/`
  }, [fromCard, slug])

  const streamRetriesRef = useRef(0)
  const streamIndexRef = useRef(0)

  const fetchFresh = useCallback(async (selectFirst = true, forceRefresh = false) => {
    try {
      let data = await extractMovie(url, { forceRefresh })
      const isAnime = url.includes('jkanime.net')
      if (!isAnime && data.streams.length === 0) {
        data = await extractMovie(url, { forceRefresh, requireStreams: true })
      }
      setMovie(data)
      setError(null)
      if (selectFirst && data.streams.length > 0) {
        streamIndexRef.current = 0
        setStream(data.streams[0])
      } else if (data.streams.length === 0) {
        setError('Esta película no tiene streams disponibles.')
      }
      return data
    } catch (e) {
      setError(`No se pudo contactar la API (${e.message}).`)
      return null
    }
  }, [url])

  useEffect(() => {
    setMovie(getCachedMovieInfo(url))
    setError(null)
    setStream(null)
    streamRetriesRef.current = 0
    streamIndexRef.current = 0
    fetchFresh()
  }, [url, fetchFresh])

  const handleStreamFatal = useCallback(async () => {
    if (streamRetriesRef.current >= MAX_STREAM_RETRIES) {
      setError('No se pudo obtener un stream válido. Vuelve a intentar más tarde.')
      return
    }
    streamRetriesRef.current += 1
    setStream(null)
    await new Promise((r) => setTimeout(r, 800))

    const list = movie?.streams || []
    const nextIndex = streamIndexRef.current + 1
    if (list[nextIndex]) {
      streamIndexRef.current = nextIndex
      setStream(list[nextIndex])
      return
    }

    setReExtracting(true)
    const data = await fetchFresh(true, true)
    if (data && data.streams.length === 0) {
      setError('No se pudo obtener un stream válido. Vuelve a intentar más tarde.')
    }
    setReExtracting(false)
  }, [fetchFresh, movie])

  const play = useCallback((s, i) => {
    streamRetriesRef.current = 0
    streamIndexRef.current = i >= 0 ? i : 0
    setStream(s)
    setError(null)
  }, [])

  const goToEpisode = useCallback(
    (ep, index) => {
      navigate(`/movie/${slugFromUrl(ep.url)}`, {
        state: {
          movie: {
            url: ep.url,
            title: `${seriesTitle} ${ep.num} — ${ep.title}`,
            image: ep.image
          },
          seriesTitle,
          episodes: episodeList,
          currentIndex: index,
          from: backTo
        }
      })
    },
    [navigate, seriesTitle, episodeList, backTo]
  )

  return (
    <div className="detail">
      <Link to={backTo} className="btn btn-ghost back">← Volver</Link>

      <div className="player-zone">
        {stream && (
          <>
            <Player streamUrl={stream.url} streamType={stream.type} title={movie.title} onFatal={handleStreamFatal} />
            {movie.streams.length > 1 && (
              <div className="stream-switch">
                {movie.base && movie.base !== LOCAL_BASE && (
                  <span className="stream-source-note">
                    Fuente de respaldo{typeof movie.base === 'string' ? ` · ${movie.base.replace(/^https?:\/\//, '')}` : ''}
                  </span>
                )}
                {movie.streams.map((s, i) => (
                  <button
                    key={i}
                    className={s.url === stream.url ? 'active' : ''}
                    onClick={() => play(s, i)}
                  >
                    {s.source || `Fuente ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!stream && (
          <div className="player-placeholder">
            {error ? (
              <p className="detail-error">{error}</p>
            ) : (
              <LoadingBox
                label={reExtracting ? 'Re-extrayendo stream...' : 'Extrayendo información...'}
              />
            )}
          </div>
        )}
      </div>

      {(nextEp || prevEp) && (
        <div className="episode-nav">
          {prevEp && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => goToEpisode(prevEp, currentIndex - 1)}
            >
              ← Anterior
            </button>
          )}
          {nextEp && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => goToEpisode(nextEp, currentIndex + 1)}
            >
              Siguiente capítulo →
            </button>
          )}
        </div>
      )}

      {movie && (
        <section className="detail-info-section">
          <div className="detail-head">
            {movie.poster && <img className="detail-poster" src={movie.poster} alt={movie.title} />}
            <div className="detail-info">
              <h1 className="detail-title">{decodeEntities(movie.title)}</h1>
              <div className="detail-meta">
                {Number(movie.rating) > 0 && <span className="rating">★ {movie.rating}</span>}
                {Number(movie.tmdbRating) > 0 && <span className="tmdb">TMDB {movie.tmdbRating}</span>}
                <span>{movie.year}</span>
                {movie.quality && <span className="quality">{movie.quality}</span>}
                {movie.languages && movie.languages.length > 0 && (
                  <span>{movie.languages.join(' · ')}</span>
                )}
              </div>
              {movie.genres && movie.genres.length > 0 && (
                <div className="genres">
                  {movie.genres.map((g) => (
                    <span key={g} className="genre">{g}</span>
                  ))}
                </div>
              )}
              {movie.description && <p className="detail-desc">{decodeEntities(movie.description)}</p>}
            </div>
          </div>

          {movie.gallery && movie.gallery.length > 0 && (
            <section className="gallery">
              <h2 className="row-title">Galería</h2>
              <div className="gallery-track">
                {movie.gallery.map((g, i) => (
                  <img key={i} src={g} alt={`${movie.title} ${i + 1}`} loading="lazy" />
                ))}
              </div>
            </section>
          )}
        </section>
      )}
    </div>
  )
}
