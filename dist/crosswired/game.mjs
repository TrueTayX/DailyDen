import { HINT_COST, RATINGS, RATING_THRESHOLDS } from './config.mjs'
import { asMask, asBits } from './engine.mjs'

export const freshRound = puzzle => ({
  id: puzzle.id, bits: puzzle.start, presses: 0, restarts: 0, hints: 0, assisted: false, recent: [],
})

export function restoreRound(puzzle, round) {
  if (round?.id !== puzzle.id || !new RegExp(`^[01]{${puzzle.size ** 2}}$`).test(round.bits)
    || !['presses', 'restarts', 'hints'].every(key => Number.isSafeInteger(round[key]) && round[key] >= 0)
    || typeof round.assisted !== 'boolean' || !Array.isArray(round.recent)
    || round.recent.length > 3
    || !round.recent.every(cell => Number.isInteger(cell) && cell >= 0 && cell < puzzle.size ** 2)) return freshRound(puzzle)
  return round
}

export function applyMove(round, puzzle, columns, type, cell) {
  if (round.bits === puzzle.goal.bits) return round
  if (type === 'restart') return { ...round, bits: puzzle.start, restarts: round.restarts + 1 }
  const flip = columns[cell]
  if (flip === null || flip === undefined) return round
  if (type === 'hint') return { ...round, presses: round.presses + HINT_COST, hints: round.hints + 1 }
  if (type !== 'press') return round
  return {
    ...round, bits: asBits(asMask(round.bits) ^ flip, puzzle.size), presses: round.presses + 1,
    recent: [cell, ...round.recent].slice(0, 3),
  }
}

export function rating(round, puzzle) {
  const index = RATING_THRESHOLDS[puzzle.tier].findIndex(limit => round.presses - puzzle.par <= limit)
  return index === -1 ? RATINGS.at(-1) : RATINGS[index]
}

export function shareResult(name, day, rounds, url) {
  const tiles = ['🟩', '🟨', '🟧', '⬜']
  const marks = rounds.map((round, index) => tiles[RATINGS.indexOf(rating(round, day.puzzles[index]))]).join('')
  const total = rounds.reduce((sum, round) => sum + round.presses, 0)
  const par = day.puzzles.reduce((sum, puzzle) => sum + puzzle.par, 0)
  return [`${name} #${day.number}`, marks, `Presses ${total} (par ${par})`, url].join('\n')
}
