import { memo } from 'react'
import MovieCard from './MovieCard.jsx'

function MovieGrid({ movies }) {
  if (!movies || movies.length === 0) return null
  return (
    <div className="movie-grid">
      {movies.map((m) => (
        <MovieCard key={m.url} movie={m} />
      ))}
    </div>
  )
}

export default memo(MovieGrid)
