import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { challengeForDay, challengeForPlaytest, dayIndex } from '../public/src/calendar.mjs'
import { playerProfile } from '../public/src/profile.mjs'
import { onRequestPost } from '../functions/api/events.js'

const catalog = JSON.parse(readFileSync(new URL('../public/content/daily.json', import.meta.url)))

test('all 30 dates resolve to unique pre-set challenges across all 12 puzzle types', () => {
  const { startsOn, days } = catalog.season
  const dates = Object.keys(days)
  const uniquePuzzleIds = new Set()
  const types = new Set()
  assert.ok(dates.length >= 30)
  assert.equal(dayIndex(dates.at(-1)) - dayIndex(startsOn), dates.length - 1)
  for (const day of dates) {
    const selected = challengeForDay(catalog, day)
    assert.equal(selected.id, days[day].id)
    assert.equal(selected.puzzles.length, 5)
    assert.equal(new Set(selected.puzzles.map(puzzle => puzzle.presentation ?? puzzle.input.kind)).size, 5)
    for (const puzzle of selected.puzzles) {
      uniquePuzzleIds.add(puzzle.id)
      types.add(puzzle.category)
      assert.equal(puzzle.choices.filter(choice => choice.id === puzzle.correct).length, 1)
    }
  }
  assert.equal(uniquePuzzleIds.size, dates.length * 5)
  assert.equal(types.size, 12)
  const afterLast = new Date((dayIndex(dates.at(-1)) + 1) * 86_400_000).toISOString().slice(0, 10)
  assert.equal(challengeForDay(catalog, afterLast), null)
  assert.equal(challengeForPlaytest(catalog, 'first-month').id, days[startsOn].id)
})

test('all previously published playtest rotations retain the same payloads', () => {
  const { epoch, sets, variety, workshop } = catalog
  const digest = createHash('sha256').update(JSON.stringify({ epoch, sets, variety, workshop })).digest('hex')
  assert.equal(digest, '1de71134c795bba13fbd66968576d61f9af45369650f17e2ec3fba2a70863f47')
})

const solved = (attempts = 1, hinted = false) => ({
  result: 'solved', hinted, attempts: Array.from({ length: attempts }, (_, index) => String(index)),
})
const day = (date, completedOn = date, rounds = Array.from({ length: 5 }, () => solved())) => ({ day: date, completedOn, rounds })

test('a player profile derives accuracy, history, streaks, and achievements from daily saves', () => {
  const past = Array.from({ length: 7 }, (_, index) => day(`2026-12-0${index + 1}`))
  const late = day('2026-12-08', '2026-12-09', [
    solved(2, true), solved(), solved(), solved(), { result: 'revealed', hinted: false, attempts: [] },
  ])
  const stats = playerProfile([late, ...past], '2026-12-10')
  assert.equal(stats.streak, 0)
  assert.equal(stats.longest, 7)
  assert.equal(stats.finished, 8)
  assert.equal(stats.solved, 39)
  assert.equal(stats.accuracy, 98)
  assert.equal(stats.firstTryRate, 97)
  assert.equal(stats.hints, 1)
  assert.equal(stats.bestScore, 10)
  assert.deepEqual(stats.achievements.filter(item => item.earned).map(item => item.title),
    ['First solve', 'Perfect day', 'Seven-day streak'])
})

test('analytics respects privacy signals and persists only allowlisted gameplay fields', async () => {
  const bound = []
  const env = { RULEBREAKER_ANALYTICS: {
    prepare: () => ({ bind: (...params) => params }),
    batch: rows => bound.push(...rows),
  } }
  const visitor = '11111111-1111-1111-1111-111111111111'
  const event = { id: '22222222-2222-2222-2222-222222222222', day: '2026-12-02', type: 'attempt',
    puzzle: 'daily-2026-12-02-1', category: 'Objects', difficulty: 'Warm-up', correct: true, choice: 'F', email: 'extra' }
  const request = (headers = {}, events = [event]) => new Request('https://game.example/api/events', {
    method: 'POST',
    headers: { origin: 'https://game.example', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ visitor, events }),
  })
  assert.equal((await onRequestPost({ request: request({ 'Sec-GPC': '1' }), env })).status, 204)
  assert.equal((await onRequestPost({ request: request({ origin: 'https://other.example' }), env })).status, 403)
  assert.equal((await onRequestPost({ request: request({}, [{ ...event, category: undefined }]), env })).status, 400)
  assert.deepEqual(bound, [])
  assert.equal((await onRequestPost({ request: request(), env })).status, 204)
  assert.deepEqual(bound, [[event.id, visitor, event.day, event.type, event.puzzle, event.category, event.difficulty, 1]])
})
