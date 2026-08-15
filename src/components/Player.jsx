import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

export default function Player({ streamUrl, streamType, title, onFatal }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const fatalRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls = null
    fatalRef.current = false
    setError(null)

    const isHls = streamType === 'hls' || /\.m3u8|mpegurl/i.test(streamUrl)
    const canPlayNative = video.canPlayType('application/vnd.apple.mpegurl')

    const handleFatal = (detail) => {
      if (fatalRef.current) return
      fatalRef.current = true
      if (hls) hls.destroy()
      setError(detail)
      if (onFatal) onFatal()
    }

    if (isHls && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 60, enableWorker: true })
      let recoverAttempts = 0
      const MAX_RECOVER = 2
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && recoverAttempts < MAX_RECOVER) {
          recoverAttempts += 1
          setTimeout(() => hls && hls.startLoad(), 1000)
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && recoverAttempts < MAX_RECOVER) {
          recoverAttempts += 1
          setTimeout(() => hls && hls.recoverMediaError(), 500)
          return
        }
        handleFatal('El stream falló (enlace caducado o CDN caído). Re-extrayendo una fuente nueva...')
      })
    } else if (isHls && canPlayNative) {
      video.addEventListener('error', () => handleFatal('Error nativo de reproducción.'))
      video.src = streamUrl
    } else if (!isHls) {
      video.addEventListener('error', () => handleFatal('Error de reproducción del archivo.'))
      video.src = streamUrl
    } else {
      setError('Tu navegador no soporta reproducción HLS.')
    }

    return () => {
      if (hls) hls.destroy()
    }
  }, [streamUrl, onFatal])

  return (
    <div className="player">
      <video ref={videoRef} controls autoPlay playsInline controlsList="nodownload" />
      {error && <p className="player-error">{error}</p>}
      {!error && <p className="player-title">{title}</p>}
    </div>
  )
}
