const footerTargets = new Map([
  ['/privacy.html', 'privacy'],
  ['mailto:sponsor@dailyden.games', 'sponsor'],
  ['mailto:feedback@dailyden.games', 'contact']
])

const games = ['lineup', 'unruled', 'switchlight', 'cropweave']

export function referral(referrer, page) {
  const tag = page.searchParams.get('from')
  if (tag === 'wirewise') return 'switchlight'
  if (games.includes(tag)) return tag
  if (!referrer) return 'direct'
  try {
    const url = new URL(referrer)
    if (!['https:', 'http:'].includes(url.protocol)) return 'direct'
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'lineup.day') return 'lineup'
    if (host === 'dailyden.games') {
      const path = url.pathname.split('/')[1]
      if (['crosswired', 'switchlight', 'wirewise'].includes(path)) return 'switchlight'
      if (['farmhouse', 'cropweave'].includes(path)) return 'cropweave'
      if (['rulebreaker', 'unruled'].includes(path)) return 'unruled'
      return 'daily-den'
    }
    return /^[a-z0-9.-]{1,253}$/.test(host) ? 'web:' + host : 'direct'
  } catch {
    return 'direct'
  }
}

function start() {
  if (location.hostname !== 'dailyden.games' || navigator.globalPrivacyControl ||
      [navigator.doNotTrack, window.doNotTrack].includes('1')) return

  try {
    const key = 'dailyden.home-analytics.v1'
    let visitor = localStorage.getItem(key)
    if (!visitor) {
      visitor = crypto.randomUUID()
      localStorage.setItem(key, visitor)
    }
    const source = referral(document.referrer, new URL(location.href))
    const record = target => {
      const body = JSON.stringify({ visitor, source, target })
      fetch('/api/home-analytics/events', {
        method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true,
        credentials: 'omit'
      }).catch(() => {})
    }
    if (document.prerendering) {
      document.addEventListener('prerenderingchange', () => record('visit'), { once: true })
    } else {
      record('visit')
    }
    const trackClick = event => {
      if (!event.isTrusted || (event.type === 'auxclick' && event.button !== 1)) return
      const link = event.target.closest('a')
      const target = link?.dataset.analyticsTarget ||
        footerTargets.get(link?.getAttribute('href')?.split('?')[0])
      if (target) record(target)
    }
    document.addEventListener('click', trackClick)
    document.addEventListener('auxclick', trackClick)
  } catch {
    // Analytics is optional when browser storage is unavailable.
  }
}

if (typeof window !== 'undefined') start()
