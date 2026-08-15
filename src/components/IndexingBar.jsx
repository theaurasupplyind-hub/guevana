import { useCatalog } from '../store/CatalogContext.jsx'

export default function IndexingBar() {
  const {
    indexing,
    paused,
    dailyLimitReached,
    progress,
    failed,
    pause,
    resume,
    retryFailed,
    resetDailyLimit
  } = useCatalog()

  if (!indexing && failed.length === 0 && !dailyLimitReached) return null

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const label = dailyLimitReached
    ? 'Límite diario de indexado alcanzado. Se reanudará mañana automáticamente.'
    : indexing
      ? paused
        ? 'Indexado de géneros pausado'
        : 'Indexando géneros...'
      : 'Indexación de géneros incompleta'

  return (
    <div className="index-bar">
      <div className="index-info">
        <span className="index-label">{label}</span>
        <span className="index-nums">
          {progress.done}/{progress.total} ({pct}%)
        </span>
        <div className="index-track">
          <div className="index-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="index-actions">
        {failed.length > 0 && (
          <button className="btn btn-ghost small" onClick={retryFailed}>
            Reintentar fallidas ({failed.length})
          </button>
        )}
        {dailyLimitReached ? (
          <button className="btn btn-ghost small" onClick={resetDailyLimit}>
            Continuar indexando hoy
          </button>
        ) : indexing ? (
          <button className="btn btn-ghost small" onClick={pause}>
            Pausar
          </button>
        ) : (
          <button className="btn btn-ghost small" onClick={resume}>
            Reanudar
          </button>
        )}
      </div>
    </div>
  )
}
