const origin = 'https://dailyden.games'
const targets = new Set(['visit', 'lineup', 'unruled', 'switchlight', 'cropweave', 'sponsor', 'contact', 'privacy'])
const sources = new Set(['direct', 'daily-den', 'lineup', 'unruled', 'switchlight', 'cropweave'])
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
})

async function readEvent(stream) {
  const reader = stream?.getReader()
  if (!reader) return null
  const buffer = new Uint8Array(768)
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return JSON.parse(new TextDecoder().decode(buffer.subarray(0, size)))
      if (size + value.length > buffer.length) {
        await reader.cancel()
        return null
      }
      buffer.set(value, size)
      size += value.length
    }
  } catch {
    return null
  }
}

export default {
  async fetch(request, env) {
    const respond = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
    const url = new URL(request.url)
    if (url.origin !== origin || url.pathname !== '/api/home-analytics/events') return respond(404)
    if (request.method !== 'POST') return respond(405)
    if (request.headers.get('Origin') !== origin) return respond(403)
    if (request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1') return respond(204)
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return respond(415)

    const event = await readEvent(request.body)
    if (!event || typeof event.visitor !== 'string' || !uuid.test(event.visitor) ||
        typeof event.source !== 'string' || (!sources.has(event.source) && !/^web:[a-z0-9.-]{1,253}$/.test(event.source)) ||
        !targets.has(event.target)) return respond(400)

    const day = dayFormat.format(new Date())
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(day + ':' + event.visitor))
    const visitor = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
    try {
      await env.HOME_ANALYTICS.prepare(`
        INSERT INTO homepage_activity (day, visitor, source, target, events)
        VALUES (?, ?, ?, ?, 1)
        ON CONFLICT (day, visitor, source, target) DO UPDATE SET events = events + 1
      `).bind(day, visitor, event.source, event.target).run()
      return respond(204)
    } catch {
      console.error(JSON.stringify({ event: 'homepage_analytics_write_failed' }))
      return respond(503)
    }
  }
}
