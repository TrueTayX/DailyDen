import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { applyPresses, asMask, cellIndex, cellsIn, countBits, flipSets } from '../public/engine.mjs'
import { GAME_ID, PAR_RANGES, PROBE_LIMITS, TIERS } from '../public/config.mjs'
import { STAMPS } from '../public/stamps.mjs'
import { dateFor, familyNames, FAMILY_RELEASES, STAMP_COOLDOWN, GOAL_COOLDOWN } from './calendar.mjs'
import { goalKey, markedCells, probeNumber, signature, symmetryFlag } from './puzzles.mjs'
import { independentPar, solve } from './solver.mjs'

const content = new URL('../content/', import.meta.url)
const { calendar, pool } = JSON.parse(await readFile(new URL('calendar.json', content), 'utf8'))
const through = (await readFile(new URL('published-through.txt', content), 'utf8')).trim()
const released = JSON.parse(await readFile(new URL(`../../../dist/${GAME_ID}/calendar.json`, import.meta.url), 'utf8'))
assert.ok(calendar.length >= 800)
assert.equal(released.publishedThrough, through)
assert.deepEqual(Object.keys(released.days), calendar.filter(day => day.date <= through).map(day => day.date))
const base = process.env.CROSSWIRED_BASE
if (/^[a-f0-9]{40}$/.test(base ?? '') && !/^0+$/.test(base)) {
  const prior = spawnSync('git', ['show', `${base}:dist/${GAME_ID}/calendar.json`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (prior.status === 0) {
    for (const [date, day] of Object.entries(JSON.parse(prior.stdout).days)) {
      assert.deepEqual(released.days[date], day, `Published day ${date} changed or was removed`)
    }
  }
}
const signatures = new Set()
const lastFamily = new Map()
const lastGoal = new Map()
const usage = new Map()
const modifierCounts = {}
let independentlyChecked = 0

function verifyPuzzle(puzzle, independent) {
  const { size, start, goal, index, par, seededPresses, blocked, split } = puzzle
  assert.equal(puzzle.tier, TIERS[index - 1], puzzle.id)
  assert.match(start, new RegExp(`^[01]{${size ** 2}}$`))
  assert.match(goal.bits, new RegExp(`^[01]{${size ** 2}}$`))
  assert.ok(size >= 4 && size <= 6)
  const columns = flipSets(puzzle)
  if (blocked.length) {
    assert.ok(blocked.length >= 3 && blocked.length <= 5)
    assert.equal(new Set(blocked.map(pos => cellIndex(pos, size))).size, blocked.length)
    for (const cell of blocked) assert.equal(columns[cellIndex(cell, size)], null)
  }
  if (split) {
    const marked = split.marked.map(pos => cellIndex(pos, size))
    assert.equal(new Set(marked).size, marked.length)
    assert.ok(marked.length > 0 && marked.length < cellsIn(size).length)
    if (split.partition !== 'random') assert.deepEqual(split.marked, markedCells(size, split.partition))
  }
  const difference = asMask(start) ^ asMask(goal.bits)
  const found = solve(columns, difference)
  assert.ok(found && found.par === par, puzzle.id)
  assert.equal(applyPresses(columns, found.presses), difference, puzzle.id)
  assert.ok(par >= PAR_RANGES[index - 1][0] && par <= PAR_RANGES[index - 1][1], puzzle.id)
  assert.ok(seededPresses >= par && seededPresses - par < 2 && countBits(difference) >= 4, puzzle.id)
  if (index !== 1) assert.equal(symmetryFlag(difference, size), false, puzzle.id)
  const probe = probeNumber(puzzle, columns)
  assert.equal(probe, puzzle.metrics.probe, puzzle.id)
  assert.ok(probe >= 1 && probe <= PROBE_LIMITS[index - 1], puzzle.id)
  const key = signature(puzzle)
  assert.ok(!signatures.has(key), puzzle.id)
  signatures.add(key)
  if (independent) {
    assert.equal(independentPar(columns, difference, par), par, puzzle.id)
    independentlyChecked += 1
  }
}

for (const [i, day] of calendar.entries()) {
  assert.equal(day.number, i + 1)
  assert.equal(day.date, dateFor(i + 1))
  assert.deepEqual(day.puzzles.map(p => p.index), [1, 2, 3, 4])
  assert.equal(new Set(day.puzzles.map(p => p.start)).size, 4)
  assert.equal(new Set(day.puzzles.map(goalKey)).size, 4)
  const names = familyNames(day.puzzles)
  assert.ok(names.length === 2 || names.length === 3)
  for (const name of names) {
    assert.ok(day.number >= (FAMILY_RELEASES[name] ?? 1), name)
    assert.ok(day.number - (lastFamily.get(name) ?? -Infinity) > STAMP_COOLDOWN, name)
    lastFamily.set(name, day.number)
    usage.set(name, (usage.get(name) ?? 0) + 1)
  }
  for (const puzzle of day.puzzles) {
    if (puzzle.index > 1) {
      assert.ok(day.number - (lastGoal.get(goalKey(puzzle)) ?? -Infinity) > GOAL_COOLDOWN, puzzle.id)
      lastGoal.set(goalKey(puzzle), day.number)
    }
    if (puzzle.index === 1) assert.ok(puzzle.size === 4 && !puzzle.split && !puzzle.wrap && !puzzle.blocked.length)
    if (puzzle.index === 4) assert.ok(puzzle.split && puzzle.size === ([5, 6].includes(new Date(day.date).getUTCDay()) ? 6 : 5))
    for (const mod of ['wrap', 'blocked', 'split']) {
      if (mod === 'blocked' ? puzzle.blocked.length : puzzle[mod]) modifierCounts[mod] = (modifierCounts[mod] ?? 0) + 1
    }
    verifyPuzzle(puzzle, i === 0 || i % 13 === (puzzle.index * 3) % 13)
  }
}
for (const [i, puzzle] of pool.entries()) verifyPuzzle(puzzle, i % 47 === 0)

console.log(JSON.stringify({ days: calendar.length, scheduled: calendar.length * 4, reserves: pool.length,
  independentlyChecked, modifiers: modifierCounts, families: Object.fromEntries(STAMPS.map(stamp => [stamp.name, usage.get(stamp.name) ?? 0])) }, null, 2))
