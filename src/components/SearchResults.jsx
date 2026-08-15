import { decodeEntities } from '../api.js'
import MovieGrid from './MovieGrid.jsx'

export default function SearchResults({ items, query, empty, loading = false }) {
  const count = items ? items.length : 0
  return (
    <section className="search-results">
      <h2 className="row-title">
        Resultados para "{decodeEntities(query)}" ({count})
      </h2>
      <MovieGrid movies={items} />
      {count === 0 && (
        <p className="empty">
          {loading ? 'Buscando en las fuentes...' : empty || 'Sin resultados.'}
        </p>
      )}
    </section>
  )
}
