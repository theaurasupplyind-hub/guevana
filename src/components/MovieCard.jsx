import { Link } from 'react-router-dom'

export default function MovieCard({ movie, large }) {
  const target =
    movie.type === 'serie'
      ? `/serie/${movie.slug}`
      : movie.type === 'anime'
        ? `/anime/${movie.slug}`
        : `/movie/${movie.slug}`
  return (
    <Link
      to={target}
      state={{ movie }}
      className={large ? 'card large' : 'card'}
      title={movie.title}
    >
      <div className="card-poster">
        {movie.image ? (
          <img src={movie.image} alt={movie.title} loading="lazy" />
        ) : (
          <div className="card-placeholder">{movie.title}</div>
        )}
        {movie.rating && Number(movie.rating) > 0 && (
          <span className="card-rating">★ {movie.rating}</span>
        )}
      </div>
      <div className="card-meta">
        <span className="card-title">{movie.title}</span>
        <span className="card-sub">
          {movie.year && <span>{String(movie.year).split(' ').pop()}</span>}
          {movie.quality && <span className="quality">{movie.quality}</span>}
        </span>
      </div>
    </Link>
  )
}
