import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { challengeForDay, challengeForPlaytest, countdown, localDay, nextLocalMidnight } from '../public/src/calendar.mjs'
import { createStore, score, shareText, start, summarize, transition } from '../public/src/progress.mjs'

process.env.TZ = 'America/Los_Angeles'
const catalog = JSON.parse(readFileSync(new URL('../public/content/daily.json', import.meta.url)))
const day = catalog.epoch
const set = challengeForDay(catalog, day)
const today = '2026-11-21'
const apply = (progress, type, extra = {}, date = day) => transition(progress, set, { type, cursor: progress.cursor, ...extra }, date)

test('puzzle date advances at local midnight, even across a DST change', () => {
  const before = new Date('2026-03-08T07:59:59Z')
  const after = new Date('2026-03-08T08:00:00Z')
  assert.equal(localDay(before), '2026-03-07')
  assert.equal(localDay(after), '2026-03-08')
  assert.equal(countdown(before), '00:00:01')
  assert.equal(nextLocalMidnight(after).toISOString(), '2026-03-09T07:00:00.000Z')
  assert.equal(countdown(after), '23:00:00')
  assert.notEqual(challengeForDay(catalog, localDay(before)).id, challengeForDay(catalog, localDay(after)).id)
  assert.deepEqual(challengeForDay(catalog, day), challengeForDay(catalog, day))
})

test('two distinct guesses, hints, completion and scoring', () => {
  const puzzle = set.puzzles[0]
  const wrong = puzzle.choices.filter(choice => choice.id !== puzzle.correct)
  let progress = start(set)
  assert.equal(apply(progress, 'next'), progress)
  progress = apply(progress, 'submit', { choice: wrong[0].id })
  assert.equal(progress.rounds[0].result, null)
  assert.equal(apply(progress, 'submit', { choice: wrong[0].id }), progress)
  progress = apply(apply(progress, 'hint'), 'submit', { choice: puzzle.correct })
  assert.equal(score(progress.rounds[0]), 1)
  assert.equal(apply(progress, 'submit', { choice: wrong[1].id }), progress)
  progress = apply(progress, 'next')
  progress = apply(progress, 'submit', { choice: set.puzzles[1].correct })
  assert.equal(score(progress.rounds[1]), 2)
  progress = apply(progress, 'next')
  const nextWrong = set.puzzles[2].choices.filter(choice => choice.id !== set.puzzles[2].correct)
  progress = apply(apply(progress, 'submit', { choice: nextWrong[0].id }), 'submit', { choice: nextWrong[1].id })
  assert.equal(progress.rounds[2].result, 'revealed')
  for (let i = 3; i < 5; i += 1) progress = apply(apply(progress, 'next'), 'reveal')
  assert.equal(progress.completedOn, day)
  assert.equal(apply(progress, 'next').cursor, 5)
  assert.match(shareText(set, progress, 'https://example.com/'), /2\/5 solved · 3\/10 points/)
})

class Storage {
  values = new Map()
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, value) }
}

test('daily records restore across reload while the next date gets a clean board', async () => {
  const storage = new Storage()
  const first = createStore(storage)
  await first.update(set, { type: 'hint', cursor: 0 }, day)
  const reloaded = createStore(storage)
  assert.equal(reloaded.get(set).rounds[0].hinted, true)
  const newer = challengeForDay(catalog, today)
  assert.equal(reloaded.get(newer).rounds[0].hinted, false)
  for (let cursor = 0; cursor < 5; cursor += 1) {
    await reloaded.update(set, { type: 'submit', cursor, choice: set.puzzles[cursor].correct }, today)
    await reloaded.update(set, { type: 'next', cursor }, today)
  }
  assert.deepEqual(summarize(reloaded.records(), today), { finished: 1, solved: 5, streak: 0 })
  assert.equal(reloaded.get(set).cursor, 5)
  assert.equal(reloaded.get(newer).cursor, 0)
})

test('the new rotation preserves previously served dates and playtest saves are separate', async () => {
  const before = challengeForDay(catalog, '2026-11-21')
  const after = challengeForDay(catalog, '2026-11-22')
  assert.equal(before.id, catalog.sets[1].id)
  assert.equal(after.id, catalog.variety.sets[0].id)
  assert.equal(after.number, before.number + 1)

  const storage = new Storage()
  const daily = createStore(storage)
  const preview = createStore(storage, null, 'variety-playtest')
  await preview.update(after, { type: 'hint', cursor: 0 }, after.day)
  assert.equal(preview.get(after).rounds[0].hinted, true)
  assert.equal(daily.get(after).rounds[0].hinted, false)
  assert.deepEqual(daily.records(), [])
})

test('workshop dates begin after the full variety rotation and preview links stay pinned', () => {
  assert.equal(challengeForDay(catalog, '2026-11-25').id, 'variety-second-look')
  assert.equal(challengeForDay(catalog, '2026-11-26').id, 'workshop')
  assert.equal(challengeForDay(catalog, '2026-11-27').id, 'routes')
  assert.equal(challengeForDay(catalog, '2026-11-28').id, 'variety-first-light')
  assert.equal(challengeForPlaytest(catalog, 'variety').id, 'variety-first-light')
  assert.equal(challengeForPlaytest(catalog, 'workshop').id, 'workshop')
  assert.equal(challengeForPlaytest(catalog, 'routes').id, 'routes')
  assert.equal(challengeForPlaytest(catalog, 'missing'), null)
})

test('a second tab cannot advance a round twice', async () => {
  const storage = new Storage()
  let queue = Promise.resolve()
  const locks = { request(_key, callback) { return queue = queue.then(callback) } }
  const a = createStore(storage, locks)
  const b = createStore(storage, locks)
  await a.update(set, { type: 'submit', cursor: 0, choice: set.puzzles[0].correct }, day)
  await Promise.all([a, b].map(store => store.update(set, { type: 'next', cursor: 0 }, day)))
  assert.equal(a.get(set).cursor, 1)
  assert.equal(b.get(set).cursor, 1)
})

test('storage failure keeps the current game usable in memory', async () => {
  const storage = new Storage()
  storage.setItem = () => { throw new Error('Full') }
  const store = createStore(storage)
  await store.update(set, { type: 'hint', cursor: 0 }, day)
  assert.equal(store.persistent, false)
  assert.equal(store.get(set).rounds[0].hinted, true)
})
