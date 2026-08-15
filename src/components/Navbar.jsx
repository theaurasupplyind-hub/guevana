import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useCatalog } from '../store/CatalogContext.jsx'
import { searchIndexed, getSearchScope, getSearchDataset } from '../search.js'

const MAX_SUGGESTIONS = 8

export default function Navbar() {
  const { genreList, catalog, seriesCatalog, animeCatalog, genresOf, titleIndex } = useCatalog()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [maximized, setMaximized] = useState(false)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isElectron = Boolean(window.windowBar)

  useEffect(() => {
    if (!window.windowBar) return
    const off = window.windowBar.onMaximizeChange(setMaximized)
    return off
  }, [])

  useEffect(() => {
    setOpen(false)
    setSuggestOpen(false)
    setQuery(params.get('q') || '')
  }, [location])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!suggestOpen) return
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSuggestOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [suggestOpen])

  const scope = useMemo(() => getSearchScope(location.pathname), [location.pathname])

  const dataset = useMemo(
    () => getSearchDataset(scope, { catalog, seriesCatalog, animeCatalog, genresOf }),
    [scope, catalog, seriesCatalog, animeCatalog, genresOf]
  )

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      setSuggestOpen(false)
      setActiveIndex(-1)
      return
    }
    const id = setTimeout(() => {
      const matches = searchIndexed(titleIndex, dataset, q).slice(0, MAX_SUGGESTIONS)
      setSuggestions(matches)
      setActiveIndex(-1)
      setSuggestOpen(true)
    }, 200)
    return () => clearTimeout(id)
  }, [query, dataset, titleIndex])

  function resultsPath(q) {
    const { pathname } = location
    if (pathname.startsWith('/categoria/')) return `${pathname}?q=${encodeURIComponent(q)}`
    if (pathname.startsWith('/series') || pathname.startsWith('/serie/')) {
      return `/series?q=${encodeURIComponent(q)}`
    }
    if (pathname.startsWith('/anime')) return `/anime?q=${encodeURIComponent(q)}`
    if (pathname.startsWith('/movies')) return `/movies?q=${encodeURIComponent(q)}`
    return `/?q=${encodeURIComponent(q)}`
  }

  function onSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    setSuggestOpen(false)
    if (!q) {
      const base =
        location.pathname === '/movies' ||
        location.pathname === '/series' ||
        location.pathname === '/anime' ||
        location.pathname.startsWith('/categoria/')
          ? location.pathname
          : '/'
      navigate(base)
      return
    }
    navigate(resultsPath(q))
  }

  function goTo(item) {
    const target =
      item.type === 'serie'
        ? `/serie/${item.slug}`
        : item.type === 'anime'
          ? `/anime/${item.slug}`
          : `/movie/${item.slug}`
    setSuggestOpen(false)
    setQuery('')
    navigate(target, { state: { movie: item } })
  }

  function onKeyDown(e) {
    if (!suggestOpen || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      goTo(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSuggestOpen(false)
    }
  }

  function onBarDoubleClick(e) {
    if (isElectron && e.target === e.currentTarget) {
      window.windowBar.toggleMaximize()
    }
  }

  return (
    <header className="navbar titlebar" onDoubleClick={onBarDoubleClick}>
      <Link to="/" className="logo no-drag" onClick={() => setQuery('')}>
        DHUB
      </Link>

      <nav className="nav no-drag" aria-label="Navegación principal">
        <Link
          to="/"
          className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
          onClick={() => setQuery('')}
        >
          Inicio
        </Link>
        <Link
          to="/movies"
          className={location.pathname.startsWith('/movies') ? 'nav-link active' : 'nav-link'}
          onClick={() => setQuery('')}
        >
          Películas
        </Link>
        <Link
          to="/series"
          className={location.pathname.startsWith('/serie') ? 'nav-link active' : 'nav-link'}
          onClick={() => setQuery('')}
        >
          Series
        </Link>
        <Link
          to="/anime"
          className={location.pathname.startsWith('/anime') ? 'nav-link active' : 'nav-link'}
          onClick={() => setQuery('')}
        >
          Animes
        </Link>
        <div className="dropdown" ref={dropdownRef}>
          <button
            type="button"
            className={open ? 'nav-link dropdown-toggle active' : 'nav-link dropdown-toggle'}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls="categorias-menu"
          >
            Categorías
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 3 L5 7 L9 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
          {open && (
            <ul id="categorias-menu" className="dropdown-menu" role="menu" aria-label="Categorías">
              {genreList.length === 0 ? (
                <li className="dropdown-empty" role="none">Indexando géneros...</li>
              ) : (
                genreList.map(([g, n]) => (
                  <li key={g} role="none">
                    <Link
                      to={`/categoria/${encodeURIComponent(g)}`}
                      className="dropdown-item"
                      role="menuitem"
                      onClick={() => setOpen(false)}
                    >
                      <span>{g}</span>
                      <span className="dropdown-count">{n}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </nav>

      <form className="search no-drag" onSubmit={onSubmit} role="search" ref={searchRef}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar películas y series..."
          aria-label="Buscar películas y series"
          role="combobox"
          aria-expanded={suggestOpen}
          aria-controls="search-menu"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `search-item-${activeIndex}` : undefined
          }
        />
        {suggestOpen && (
          <div id="search-menu" className="search-dropdown" role="listbox" aria-label="Sugerencias">
            {suggestions.length === 0 ? (
              <div className="search-empty">Sin resultados para "{query.trim()}"</div>
            ) : (
              suggestions.map((m, i) => (
                <button
                  key={m.url}
                  id={`search-item-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  className={i === activeIndex ? 'search-item active' : 'search-item'}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => goTo(m)}
                >
                  {m.image && (
                    <img className="search-thumb" src={m.image} alt="" loading="lazy" />
                  )}
                  <span className="search-item-body">
                    <span className="search-item-title">{m.title}</span>
                    <span className="search-item-sub">
                      {m.year && <span>{String(m.year).split(' ').pop()}</span>}
                      <span className="search-badge">
                        {m.type === 'serie' ? 'Serie' : m.type === 'anime' ? 'Anime' : 'Película'}
                      </span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </form>
      {isElectron && (
        <div className="window-controls no-drag">
          <button
            className="wc-btn"
            onClick={() => window.windowBar.minimize()}
            title="Minimizar"
            aria-label="Minimizar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="wc-btn"
            onClick={() => window.windowBar.toggleMaximize()}
            title={maximized ? 'Restaurar' : 'Maximizar'}
            aria-label={maximized ? 'Restaurar' : 'Maximizar'}
          >
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M2.5 2.5 V0.5 H9.5 V7.5 H7.5" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button
            className="wc-btn wc-close"
            onClick={() => window.windowBar.close()}
            title="Cerrar"
            aria-label="Cerrar"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
              <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      )}
    </header>
  )
}
