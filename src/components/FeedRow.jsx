import FeedCard from './FeedCard.jsx'

export default function FeedRow({ title, items, kind, seriesCatalog }) {
  if (!items || items.length === 0) return null
  return (
    <section className="row">
      <h2 className="row-title">{title}</h2>
      <div className="row-track">
        {items.map((item, i) => (
          <FeedCard key={i} item={item} kind={kind} seriesCatalog={seriesCatalog} />
        ))}
      </div>
    </section>
  )
}
