const store = new Map()
const inflight = new Map()

async function get(key, loader, ttl) {
  const hit = store.get(key)
  if (hit && Date.now() - hit.ts < ttl) return hit.value
  if (inflight.has(key)) return inflight.get(key)
  const promise = (async () => {
    const value = await loader()
    store.set(key, { ts: Date.now(), value })
    return value
  })()
  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}

module.exports = { get }
