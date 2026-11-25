export function dayKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = type => parts.find(entry => entry.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function dayStreak(dates, today) {
  const completed = new Set(dates)
  const day = new Date(today + 'T00:00:00Z')
  const previous = () => day.setUTCDate(day.getUTCDate() - 1)
  const key = () => day.toISOString().slice(0, 10)
  if (!completed.has(today)) previous()
  let streak = 0
  while (completed.has(key())) {
    streak += 1
    previous()
  }
  return streak
}

export function gameStorage(gameId, storage) {
  const prefix = `${gameId}:v1:`
  const memory = new Map()
  let persistent = Boolean(storage)
  return {
    read(key, fallback) {

      if (persistent) {
        try {
          const stored = storage.getItem(prefix + key)
          if (stored !== null) return JSON.parse(stored)
        } catch { persistent = false }
      }
      return memory.has(key) ? memory.get(key) : fallback
    },
    write(key, value) {
      memory.set(key, value)
      if (persistent) {
        try { storage.setItem(prefix + key, JSON.stringify(value)) }
        catch { persistent = false }
      }
    },
    remove(key) {
      memory.delete(key)
      if (persistent) {
        try { storage.removeItem(prefix + key) }
        catch { persistent = false }
      }
    },
    get persistent() { return persistent },
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch { return false }
}
