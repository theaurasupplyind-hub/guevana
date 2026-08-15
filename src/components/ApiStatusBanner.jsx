import { useEffect, useState } from 'react'
import { onApiStatusChange, getApiDown, pingApi } from '../api.js'

export default function ApiStatusBanner() {
  const [down, setDown] = useState(getApiDown())
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const unsub = onApiStatusChange(setDown)
    return unsub
  }, [])

  const retry = async () => {
    setChecking(true)
    await pingApi()
    setDown(getApiDown())
    setChecking(false)
  }

  if (!down) return null

  return (
    <div className="api-banner">
      <span>
        ⚠️ La API de contenidos no está respondiendo. Mostrando datos en caché. La reproducción puede no estar disponible.
      </span>
      <button className="btn btn-ghost small" onClick={retry} disabled={checking}>
        {checking ? 'Comprobando...' : 'Reintentar'}
      </button>
    </div>
  )
}
