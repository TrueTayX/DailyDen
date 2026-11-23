const types = new Set(['visit', 'shared_visit', 'daily_start', 'daily_complete', 'puzzle_open', 'attempt', 'hint', 'reveal', 'share', 'game_open'])
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const dateKey = /^\d{4}-\d{2}-\d{2}$/
const idText = /^[a-z0-9-]{1,72}$/
const categoryText = /^[A-Za-z][A-Za-z -]{0,39}$/
const puzzleEvents = new Set(['puzzle_open', 'attempt', 'hint', 'reveal'])
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value)

async function readBody(request) {
  const input = request.body?.getReader()
  if (!input) throw new Error('Missing body')
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  for (;;) {
    const { value, done } = await input.read()
    if (done) return JSON.parse(text + decoder.decode())
    bytes += value.length
    if (bytes > 12_000) {
      await input.cancel()
      throw new Error('Request too large')
    }
    text += decoder.decode(value, { stream: true })
  }
}

function fields(event) {
  if (!event || !matches(uuid, event.id) || !types.has(event.type) || !matches(dateKey, event.day)) return null
  if (puzzleEvents.has(event.type)) {
    if (!matches(idText, event.puzzle) || !matches(categoryText, event.category) || !matches(categoryText, event.difficulty)
      || (event.type === 'attempt' && typeof event.correct !== 'boolean')) return null
    return [event.puzzle, event.category, event.difficulty, event.type === 'attempt' ? Number(event.correct) : null]
  }
  return [null, null, null, null]
}

export async function onRequestPost({ request, env }) {
  const headers = request.headers
  if (headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 })
  if (headers.get('DNT') === '1' || headers.get('Sec-GPC') === '1') return new Response(null, { status: 204 })
  if (!env.RULEBREAKER_ANALYTICS) return new Response(null, { status: 503 })
  if (!headers.get('content-type')?.startsWith('application/json')) return new Response(null, { status: 415 })
  let payload
  try { payload = await readBody(request) } catch { return new Response(null, { status: 400 }) }
  if (!payload || !matches(uuid, payload.visitor) || !Array.isArray(payload.events)
    || payload.events.length < 1 || payload.events.length > 12) return new Response(null, { status: 400 })
  const rows = payload.events.map(event => {
    const parsed = fields(event)
    return parsed && [event.id, payload.visitor, event.day, event.type, ...parsed]
  })
  if (rows.includes(null)) return new Response(null, { status: 400 })

  try {
    const database = env.RULEBREAKER_ANALYTICS
    await database.batch(rows.map(row => database.prepare(
      'INSERT OR IGNORE INTO events (id, visitor, day, type, puzzle, category, difficulty, correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(...row)))
    return new Response(null, { status: 204 })
  } catch { return new Response(null, { status: 503 }) }
}
