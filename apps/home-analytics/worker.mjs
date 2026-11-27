const origin = 'https://dailyden.games'
const targets = new Set(['visit', 'lineup', 'unruled', 'switchlight', 'cropweave', 'sponsor', 'contact', 'privacy'])
const sources = new Set(['direct', 'daily-den', 'lineup', 'unruled', 'switchlight', 'cropweave'])
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
})

async function readJSON(stream, limit = 768) {
  const reader = stream?.getReader()
  if (!reader) return null
  const buffer = new Uint8Array(limit)
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

const cookie = '__Secure-dailyden_analytics'
const sessionSeconds = 12 * 60 * 60
const encoder = new TextEncoder()
const dayMs = 86400000

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers
  } })
}

function sessionCookie(value, age) {
  return `${cookie}=${value}; Path=/api/home-analytics/events; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`
}

function validDay(day) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
}

const cropMilestones = new Set(['start', 'finish', 'reopen'])
const cropEvents = new Set(['visit', 'share_visit', 'share_attempt', 'share_success', 'share_failure',
  'achievement', 'practice', 'reveal', 'button', ...cropMilestones])
const cropButtons = new Set([
  'help-button', 'settings-button', 'pickup', 'scores-button', 'undo', 'finish', 'results', 'return',
  'tour-again', 'contrast', 'motion', 'preview-enabled', 'reset-tips', 'stats-button', 'tour-back',
  'tour-next', 'share', 'practice', 'reveal', 'show-solution', 'feedback', 'achievements-button',
  'home', 'switchlight', 'sponsor', 'contact', 'privacy', 'close-help', 'close-settings', 'close-tutorial',
  'close-score-detail', 'close-outcome', 'close-solution', 'close-stats', 'close-achievements'
])

function validCropEvent(event, day) {
  if (!event || typeof event.id !== 'string' || !uuid.test(event.id) || !cropEvents.has(event.kind)) return false
  if (cropMilestones.has(event.kind) &&
      (typeof event.puzzle !== 'string' || !validDay(event.puzzle) || event.puzzle > day)) return false
  if (event.kind === 'finish' &&
      (!Number.isInteger(event.stars) || event.stars < 0 || event.stars > 3 ||
       !Number.isInteger(event.coins) || event.coins < 0 || event.coins > 10000)) return false
  if (event.kind === 'button') return cropButtons.has(event.detail) ||
    (typeof event.detail === 'string' && /^score-category-[0-7]$/.test(event.detail))
  return true
}

async function storeCropEvents(request, env) {
  const input = await readJSON(request.body, 4096)
  const day = dayFormat.format(new Date())
  if (!input || typeof input.visitor !== 'string' || !uuid.test(input.visitor) ||
      !Array.isArray(input.events) || !input.events.length || input.events.length > 16 ||
      !input.events.every(event => validCropEvent(event, day))) return json({ error: 'Invalid event batch.' }, 400)

  const hash = await crypto.subtle.digest('SHA-256', encoder.encode('cropweave:' + input.visitor))
  const visitor = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
  try {
    const db = env.HOME_ANALYTICS
    const statements = input.events.map(event => {
      const { kind, id, puzzle } = event
      const dedup = kind === 'start' || kind === 'finish' ? puzzle :
        kind === 'reopen' ? day + ':' + puzzle : kind === 'visit' || kind === 'share_visit' ? day : id
      return db.prepare(`INSERT OR IGNORE INTO cropweave_activity
        (event_key, day, visitor, kind, detail, stars, coins) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(`${visitor}:${kind}:${dedup}`, day, visitor, kind,
          kind === 'button' ? event.detail : '', kind === 'finish' ? event.stars : null, kind === 'finish' ? event.coins : null)
    })
    if (input.events.some(event => event.kind === 'visit')) {
      statements.unshift(db.prepare(`INSERT INTO cropweave_visitors (visitor, first_day) VALUES (?, ?)
        ON CONFLICT(visitor) DO UPDATE SET first_day = MIN(first_day, excluded.first_day)`).bind(visitor, day))
    }
    await db.batch(statements)
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error(JSON.stringify({ event: 'cropweave_analytics_write_failed' }))
    return json({ error: 'Analytics unavailable.' }, 503)
  }
}

async function cropReport(db, from, to, today) {
  const queries = [
    `SELECT e.day, SUM(kind='visit') AS players,
      SUM(kind='visit' AND v.first_day=e.day) AS new_players,
      SUM(kind='visit' AND v.first_day<e.day) AS returning_players,
      SUM(kind='start') AS starts, SUM(kind='finish') AS finishes,
      SUM(kind='finish' AND stars=3) AS three_stars,
      ROUND(AVG(CASE WHEN kind='finish' THEN coins END), 1) AS average_coins,
      SUM(kind='share_attempt') AS shares, SUM(kind='share_success') AS shared,
      SUM(kind='share_failure') AS share_failures, SUM(kind='share_visit') AS share_visits,
      SUM(kind='achievement') AS achievements, SUM(kind='reopen') AS reopens,
      SUM(kind='practice') AS practices, SUM(kind='reveal') AS reveals
      FROM cropweave_activity e LEFT JOIN cropweave_visitors v USING(visitor)
      WHERE e.day BETWEEN ? AND ? GROUP BY e.day ORDER BY e.day DESC`,
    `SELECT day, detail AS button, COUNT(*) AS clicks, COUNT(DISTINCT visitor) AS browsers
      FROM cropweave_activity WHERE kind='button' AND day BETWEEN ? AND ? GROUP BY day, detail
      ORDER BY day DESC, clicks DESC, button`,
    `SELECT kind, COUNT(DISTINCT visitor) AS browsers FROM cropweave_activity
      WHERE kind IN ('visit','start','finish') AND day BETWEEN ? AND ? GROUP BY kind`
  ]
  const [daily, buttons, funnel, tracking] = await db.batch([
    ...queries.map(query => db.prepare(query).bind(from, to)),
    db.prepare('SELECT MIN(first_day) AS first_day FROM cropweave_visitors')
  ])
  return json({ from, to, today, daily: daily.results, buttons: buttons.results,
    funnel: funnel.results, trackingSince: tracking.results[0]?.first_day ?? null })
}

async function dashboard(request, env, url, action) {
  if (action === 'logout') return json({}, 200, { 'Set-Cookie': sessionCookie('', 0) })
  if (action !== 'login' && action !== 'report') return json({ error: 'Unknown action.' }, 404)
  const secret = env.ANALYTICS_ADMIN_SECRET
  if (!secret || secret.length < 32) return json({ error: 'Set ANALYTICS_ADMIN_SECRET on the Worker to enable dashboard sign-in.' }, 503)

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  if (action === 'login') {
    const input = await readJSON(request.body, 4096)
    if (typeof input?.password !== 'string') return json({ error: 'Enter your dashboard password.' }, 400)
    const supplied = await crypto.subtle.importKey('raw', encoder.encode(input.password || ' '),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const message = encoder.encode('dailyden-dashboard-password-check')
    const candidate = await crypto.subtle.sign('HMAC', supplied, message)
    if (!await crypto.subtle.verify('HMAC', key, candidate, message)) return json({ error: 'Incorrect password.' }, 401)
    const value = `${Date.now() + sessionSeconds * 1000}.${crypto.randomUUID()}`
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('session:' + value)))
    const signed = Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('')
    return json({}, 200, { 'Set-Cookie': sessionCookie(value + '.' + signed, sessionSeconds) })
  }

  const value = request.headers.get('Cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookie + '='))?.slice(cookie.length + 1) || ''
  const match = /^(\d{13})\.([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(value)
  if (!match || Number(match[1]) <= Date.now() ||
      !await crypto.subtle.verify('HMAC', key, Uint8Array.from(match[3].match(/../g), byte => parseInt(byte, 16)),
        encoder.encode('session:' + match[1] + '.' + match[2]))) {
    return json({ error: 'Sign in to view analytics.' }, 401)
  }

  const today = dayFormat.format(new Date())
  const to = url.searchParams.get('to') || today
  const from = url.searchParams.get('from') || new Date(Date.parse(today) - 29 * dayMs).toISOString().slice(0, 10)
  if (!validDay(from) || !validDay(to) || from > to || to > today || Date.parse(to) - Date.parse(from) > 365 * dayMs) {
    return json({ error: 'Choose a valid date range of up to 366 days ending today or earlier.' }, 400)
  }

  try {
    if (url.searchParams.get('game') === 'cropweave') return await cropReport(env.HOME_ANALYTICS, from, to, today)
    const queries = [
      'SELECT * FROM homepage_daily WHERE day BETWEEN ? AND ? ORDER BY day',
      'SELECT source, SUM(unique_browsers) AS browser_days, SUM(page_views) AS page_views FROM homepage_referrals WHERE day BETWEEN ? AND ? GROUP BY source ORDER BY page_views DESC, source',
      'SELECT day, target, unique_clickers, clicks FROM homepage_clicks WHERE day BETWEEN ? AND ? ORDER BY day DESC, clicks DESC, target',
      "SELECT day, COUNT(DISTINCT visitor) AS unique_clickers FROM homepage_activity WHERE target <> 'visit' AND day BETWEEN ? AND ? GROUP BY day"
    ]
    const [daily, referrals, clicks, dailyClickers] = await env.HOME_ANALYTICS.batch(
      queries.map(query => env.HOME_ANALYTICS.prepare(query).bind(from, to)))
    return json({ today, from, to, daily: daily.results, referrals: referrals.results,
      clicks: clicks.results, dailyClickers: dailyClickers.results })
  } catch {
    console.error(JSON.stringify({ event: 'homepage_analytics_report_failed' }))
    return json({ error: 'Report unavailable. Check the D1 binding and homepage migration.' }, 503)
  }
}

export default {
  async fetch(request, env) {
    const respond = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })
    const url = new URL(request.url)
    if (url.origin !== origin || url.pathname !== '/api/home-analytics/events') return respond(404)
    if (request.method !== 'POST') return respond(405)
    if (request.headers.get('Origin') !== origin) return respond(403)
    const action = url.searchParams.get('action')
    if (action && action !== 'cropweave') return dashboard(request, env, url, action)
    if (request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1') return respond(204)
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return respond(415)

    if (action === 'cropweave') return storeCropEvents(request, env)
    const event = await readJSON(request.body)
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
