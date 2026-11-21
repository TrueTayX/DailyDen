const dayInMs = 86_400_000

export function localDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

export function dayIndex(day) {
  return Date.parse(`${day}T00:00:00Z`) / dayInMs
}

export function nextLocalMidnight(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
}

export function formatDay(day) {
  const [year, month, date] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(year, month - 1, date, 12))
}

export function challengeForDay(catalog, day) {
  const offset = dayIndex(day) - dayIndex(catalog.epoch)
  const number = Math.max(1, offset + 1)
  if (catalog.season && day >= catalog.season.startsOn) {
    const scheduled = catalog.season.days[day]
    return scheduled ? { ...scheduled, day, number } : null
  }
  let rotation = catalog
  if (catalog.variety && day >= catalog.variety.epoch) rotation = catalog.variety
  if (catalog.workshop && day >= catalog.workshop.epoch) {
    rotation = { epoch: catalog.workshop.epoch, sets: [...catalog.workshop.sets, ...catalog.variety.sets] }
  }
  const position = dayIndex(day) - dayIndex(rotation.epoch)
  const index = ((position % rotation.sets.length) + rotation.sets.length) % rotation.sets.length
  return { ...rotation.sets[index], day, number }
}

export function challengeForPlaytest(catalog, key) {
  if (key === 'first-month') {
    const first = catalog.season && challengeForDay(catalog, catalog.season.startsOn)
    return first ? { ...first, playtest: true } : null
  }
  const group = key === 'variety' ? catalog.variety : catalog.workshop
  const set = key === 'variety' ? group?.sets[0] : group?.sets.find(item => item.id === key)
  return set ? { ...set, day: group.epoch, playtest: true } : null
}

export function countdown(now = new Date()) {
  const seconds = Math.ceil((nextLocalMidnight(now) - now) / 1000)
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
  return parts.map(part => String(part).padStart(2, '0')).join(':')
}
