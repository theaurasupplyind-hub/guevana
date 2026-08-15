import { Link, useLocation } from 'react-router-dom'
import { slugFromUrl } from '../api.js'
import { normalizeSearch } from '../search.js'

function findSeries(seriesCatalog, name) {
  const tokens = normalizeSearch(name)
  if (tokens.length === 0) return null
  return seriesCatalog.find((s) => {
    const t = normalizeSearch(s.title)
    return tokens.every((tok) => t.some((w) => w.includes(tok)))
  })
}

export default function FeedCard({ item, kind, seriesCatalog }) {
  const location = useLocation()

  let to = '/'
  let state
  let title = item.series || item.title
  let sub = item.title

  if (kind === 'episode') {
    to = `/movie/${slugFromUrl(item.url)}`
    state = {
      movie: { url: item.url, title: item.series ? `${item.series} ${item.label}` : item.title },
      from: location.pathname
    }
    sub = `${item.label || item.title}${item.quality ? ' · ' + item.quality : ''}`
  } else {
    const serie = findSeries(seriesCatalog || [], item.series)
    to = serie ? `/serie/${serie.slug}` : `/series?q=${encodeURIComponent(item.series)}`
    sub = `${item.title}${item.date ? ' · ' + item.date : ''}`
  }

  return (
    <Link to={to} state={state} className="feed-card" title={`${title} — ${sub}`}>
      <div className="feed-thumb">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" />
        ) : (
          <div className="card-placeholder">{title}</div>
        )}
        {item.quality && <span className="feed-quality">{item.quality}</span>}
      </div>
      <div className="feed-meta">
        <span className="feed-title">{title}</span>
        <span className="feed-sub">{sub}</span>
      </div>
    </Link>
  )
}
