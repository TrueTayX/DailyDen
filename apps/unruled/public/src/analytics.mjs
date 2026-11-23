export function createAnalytics(storage, enabled) {
  const endpoint = document.querySelector('meta[name="rulebreaker-analytics"]')?.content
  if (!enabled || endpoint !== '/api/events' || navigator.globalPrivacyControl || navigator.doNotTrack === '1'
    || window.doNotTrack === '1' || !globalThis.crypto?.randomUUID) return { record() {} }

  let visitor = crypto.randomUUID()
  const key = 'rulebreaker.analytics.v1'
  try {
    visitor = storage?.getItem(key) || visitor
    storage?.setItem(key, visitor)
  } catch { /* An ephemeral ID is enough for this page. */ }

  const queue = []
  let sending = false
  let timer
  async function flush() {
    if (sending || !queue.length) return
    clearTimeout(timer)
    timer = null
    const events = queue.slice(0, 12)
    sending = true
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor, events }),
      })
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        const handled = new Set(events)
        for (let index = queue.length - 1; index >= 0; index--) {
          if (handled.has(queue[index])) queue.splice(index, 1)
        }
      }
    } catch { /* Delivery never blocks play. */ }
    finally {
      sending = false
      if (queue.length && !timer) timer = setTimeout(flush, 15_000)
    }
  }

  window.addEventListener('online', flush)
  window.addEventListener('pagehide', flush)
  return {
    record(type, day, puzzle, correct) {
      if (!day) return
      if (queue.length >= 48) queue.shift()
      queue.push({
        id: crypto.randomUUID(), type, day,
        puzzle: puzzle?.id, category: puzzle?.category, difficulty: puzzle?.difficulty, correct,
      })
      if (!timer) timer = setTimeout(flush, 1200)
    },
  }
}
