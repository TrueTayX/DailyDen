import assert from 'node:assert/strict'
import test from 'node:test'
import { bit, applyPresses, asBits, asMask, flipSets, stampMask } from '../public/engine.mjs'
import { STAMPS } from '../public/stamps.mjs'
import { applyMove, freshRound, rating, restoreRound, shareResult } from '../public/game.mjs'
import { generateCalendar } from '../scripts/calendar.mjs'
import { independentPar, solve } from '../scripts/solver.mjs'
import { dayKey, dayStreak, gameStorage } from '../../../packages/game/daily.mjs'

const named = name => STAMPS.find(stamp => stamp.name === name)
const puzzle = {
  id: 'example', index: 1, size: 6, tier: 'standard', wrap: false, par: 3, blocked: [[0, 0]],
  split: { partition: 'random', marked: [[0, 1]] },
  stamps: { A: named('self-only'), B: named('domino-right') },
  start: asBits(bit(35) | bit(2) | bit(1) | bit(9), 6),
  goal: { name: 'target', bits: asBits(bit(3), 6) },
}

test('stamps clip and wrap, split uses the selected family, and locked cells stay in the light system', () => {
  assert.equal(stampMask(named('domino-right'), 6, 35), bit(35))
  assert.equal(stampMask(named('domino-right'), 6, 35, true), bit(35) | bit(30))
  assert.equal(stampMask(named('mirror-180'), 5, 12), bit(12))
  const effects = flipSets(puzzle)
  assert.equal(effects[0], null)
  assert.equal(effects[1], bit(1) | bit(2))
  assert.equal(effects[35], bit(35))
  const cross = { ...puzzle, blocked: [[0, 1]], split: null, stamps: { A: named('domino-right'), B: null } }
  assert.equal(flipSets(cross)[1], null)
  assert.ok(flipSets(cross)[0] & bit(1))
})

test('the solver and independent verifier agree on a 36-cell board with a target picture', () => {
  const columns = flipSets(puzzle)
  const difference = asMask(puzzle.start) ^ asMask(puzzle.goal.bits)
  const result = solve(columns, difference)
  assert.equal(result.par, 4)
  assert.equal(applyPresses(columns, result.presses), difference)
  assert.equal(independentPar(columns, difference, result.par), result.par)
  assert.equal(solve(columns, bit(0)), null)
})

test('repeated presses cancel, while hints and restart keep cumulative scoring', () => {
  const effects = flipSets(puzzle)
  const start = freshRound(puzzle)
  const next = applyMove(start, puzzle, effects, 'press', 35)
  const twice = applyMove(next, puzzle, effects, 'press', 35)
  assert.equal(twice.bits, puzzle.start)
  assert.equal(twice.presses, 2)
  assert.equal(applyMove(twice, puzzle, effects, 'press', 0), twice)
  const hint = applyMove(twice, puzzle, effects, 'hint', 1)
  assert.equal(hint.presses, 4)
  assert.equal(hint.bits, puzzle.start)
  assert.equal(rating(hint, puzzle), 'Great')
  assert.equal(rating({ presses: 7 }, puzzle), 'Good')
  assert.equal(rating({ presses: 10 }, puzzle), 'Solved')
  const restart = applyMove(hint, puzzle, effects, 'restart')
  assert.equal(restart.restarts, 1)
  assert.equal(restart.presses, 4)
  assert.deepEqual(restoreRound(puzzle, restart), restart)
  assert.match(shareResult('Crosswired', { number: 1, puzzles: [puzzle] }, [restart], 'https://dailyden.games/crosswired/'),
    /^Crosswired #1\n🟨\nPresses 4 \(par 3\)\nhttps:\/\/dailyden.games\/crosswired\/$/)
})

test('calendar generation is reproducible on a small fixture', () => {
  assert.deepEqual(generateCalendar(2, 6109321), generateCalendar(2, 6109321))
})

test('Pacific rollover handles both offsets and storage failure falls back to memory', () => {
  const zone = 'America/Los_Angeles'
  assert.equal(dayKey(new Date('2026-11-24T07:59:59Z'), zone), '2026-11-23')
  assert.equal(dayKey(new Date('2026-11-24T08:00:00Z'), zone), '2026-11-24')
  assert.equal(dayKey(new Date('2027-07-01T07:00:00Z'), zone), '2027-07-01')
  assert.equal(dayStreak(['2026-11-23', '2026-11-24'], '2026-11-25'), 2)
  const store = gameStorage('crosswired', { getItem() { throw new Error('denied') } })
  assert.equal(store.read('key', 0), 0)
  store.write('key', 3)
  assert.equal(store.read('key', 0), 3)
  assert.equal(store.persistent, false)
})
