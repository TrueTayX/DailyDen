import { STAMPS } from '../public/stamps.mjs'
import { applyPresses, asBits, asMask, bit, cellCoordinates, cellIndex, cellsIn, countBits, flipSets, hasBit, stampMask } from '../public/engine.mjs'
import { GENERATOR, PAR_RANGES, PROBE_LIMITS, TIERS } from '../public/config.mjs'
import { solve } from './solver.mjs'

export function rng(seed) {
  let state = seed >>> 0
  return limit => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return Math.floor(state / 0x100000000 * limit)
  }
}
export function shuffle(items, random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = random(i + 1)
    const swap = copy[i]
    copy[i] = copy[j]
    copy[j] = swap
  }
  return copy
}

export const PARTITIONS = ['checkerboard', 'left-right', 'top-bottom', 'border-inner', 'random']
export function markedCells(size, partition, random) {
  const indexes = cellsIn(size)
  if (partition === 'random') return shuffle(indexes, random).slice(0, 3 + random(size)).sort((a, b) => a - b)
    .map(cell => cellCoordinates(cell, size))
  return indexes.map(cell => cellCoordinates(cell, size)).filter(([r, c]) => {
    if (partition === 'checkerboard') return (r + c) % 2 === 1
    if (partition === 'left-right') return c >= Math.ceil(size / 2)
    if (partition === 'top-bottom') return r >= Math.ceil(size / 2)
    return r === 0 || c === 0 || r === size - 1 || c === size - 1
  })
}

export const GOALS = [
  ['checkerboard', (r, c) => (r + c) % 2 === 0],
  ['border ring', (r, c, m) => !r || !c || r === m || c === m],
  ['center plus', (r, c, m) => r === Math.floor(m / 2) || c === Math.floor(m / 2)],
  ['horizontal stripes', r => r % 2 === 0],
  ['vertical stripes', (r, c) => c % 2 === 0],
  ['diagonal line', (r, c) => r === c],
  ['L', (r, c, m) => c === 0 || r === m],
  ['T', (r, c, m) => r === 0 || c === Math.floor(m / 2)],
  ['X', (r, c, m) => r === c || r + c === m],
  ['frame', (r, c, m) => (r === 1 || c === 1 || r === m - 1 || c === m - 1)
    && r >= 1 && c >= 1 && r <= m - 1 && c <= m - 1],
  ['diamond', (r, c, m) => Math.abs(2 * r - m) + Math.abs(2 * c - m) === 2 * Math.floor(m / 2)],
  ['corners only', (r, c, m) => (r === 0 || r === m) && (c === 0 || c === m)],
]
function goalMask(size, choice, random) {
  if (choice < 0) return choice === -1 ? ['all off', 0n] : ['all on', bit(size ** 2) - 1n]
  if (choice < GOALS.length) {
    const [name, rule] = GOALS[choice]
    return [name, cellsIn(size).reduce((mask, cell) =>
      rule(...cellCoordinates(cell, size), size - 1) ? mask | bit(cell) : mask, 0n)]
  }
  const fourfold = choice % 3 === 0
  let mask = 0n
  const density = 2 + random(5)
  for (const cell of cellsIn(size)) {
    const [r, c] = cellCoordinates(cell, size)
    const last = size - 1
    const orbit = [cell, last * size + last - cell]
    if (fourfold) orbit.push(c * size + last - r, (last - c) * size + r)
    if (cell === Math.min(...orbit) && random(10) < density) {
      for (const position of orbit) mask |= bit(position)
    }
  }
  return [fourfold ? 'fourfold pattern' : 'mirror pattern', mask]
}

const footprints = new Map()
function candidateColumns(size, wrap) {
  const key = `${size}:${wrap}`
  if (!footprints.has(key)) {
    footprints.set(key, cellsIn(size).map(cell => {
      const outcomes = new Map()
      for (const [index, stamp] of STAMPS.entries()) {
        const mask = stampMask(stamp, size, cell, wrap)
        outcomes.set(mask, (outcomes.get(mask) ?? 0n) | bit(index))
      }
      return outcomes
    }))
  }
  return footprints.get(key)
}

export function probeNumber(puzzle, columns = flipSets(puzzle), limit = PROBE_LIMITS[TIERS.indexOf(puzzle.tier)]) {
  const marked = new Set(puzzle.split?.marked.map(pos => cellIndex(pos, puzzle.size)))
  const candidates = candidateColumns(puzzle.size, puzzle.wrap)
  const all = bit(STAMPS.length) - 1n
  function search(masks, remaining, start, possible) {
    if (possible === 0n) return true
    if (!remaining) return false
    for (let i = start; i < masks.length; i += 1) {
      if (search(masks, remaining - 1, i + 1, possible & masks[i])) return true
    }
    return false
  }
  let total = 0
  for (const group of puzzle.split ? [false, true] : [false]) {
    const target = STAMPS.findIndex(stamp => stamp.name === puzzle.stamps[group ? 'B' : 'A'].name)
    const alternatives = all & ~bit(target)
    const masks = [...new Set(columns.flatMap((effect, cell) =>
      effect === null || marked.has(cell) !== group ? [] :
        [candidates[cell].get(effect) & alternatives]))]
    let probes = 1
    while (total + probes <= limit && !search(masks, probes, 0, alternatives)) probes += 1
    total += probes
    if (total > limit) return Infinity
  }
  return total
}

export function symmetryFlag(mask, size) {
  const cells = cellsIn(size)
  const last = size - 1
  const transforms = [
    (r, c) => [last - r, last - c], (r, c) => [r, last - c],
    (r, c) => [last - r, c], (r, c) => [c, r],
  ]
  return transforms.some(transform => cells.every(cell =>
    hasBit(mask, cell) === hasBit(mask, cellIndex(transform(...cellCoordinates(cell, size)), size))))
    || cells.every(cell => hasBit(mask, cell) === hasBit(mask, Math.floor(cell / size) * size))
    || cells.every(cell => hasBit(mask, cell) === hasBit(mask, cell % size))
}

export const signature = puzzle => JSON.stringify([
  puzzle.size, puzzle.wrap, puzzle.blocked, puzzle.split?.marked, puzzle.stamps.A.name, puzzle.stamps.B?.name,
  puzzle.goal.bits, puzzle.start,
])
export const goalKey = puzzle => `${puzzle.size}:${puzzle.goal.bits}`

export function makePuzzle(spec, seed, reject) {
  const { day, index, a, b, size, mode, partition, hard, showcase } = spec
  const tier = TIERS[index - 1]
  const min = PAR_RANGES[index - 1][0]
  const max = PAR_RANGES[index - 1][1]
  const random = rng(seed)
  for (let trial = 0; trial < 48; trial += 1) {
    const blocked = mode === 'blocked'
      ? shuffle(cellsIn(size), random).slice(0, 3 + random(3)).sort((a, b) => a - b).map(cell => cellCoordinates(cell, size))
      : []
    const split = b ? { partition, marked: markedCells(size, partition, random) } : null
    const puzzle = { id: `cw-${String(day).padStart(4, '0')}-${index}`, day, index, tier, size,
      wrap: mode === 'wrap', blocked, split, stamps: { A: a, B: b }, seed, generator: GENERATOR }
    const columns = flipSets(puzzle)
    const probe = probeNumber(puzzle, columns)
    if (!Number.isFinite(probe)) {
      if (mode !== 'blocked' && partition !== 'random') return null
      continue
    }
    const [name, goal] = spec.goal ? [spec.goal.name, asMask(spec.goal.bits)] : goalMask(size, index === 1 ? -1 - random(2)
      : index === 2 ? random(GOALS.length + 6)
      : index === 3 ? 5 + random(GOALS.length + 4)
      : random(GOALS.length + 12), random)
    if (index > 1 && (countBits(goal) < 2 || goal === bit(size ** 2) - 1n)) continue
    const k = Math.max(a.name === 'self-only' ? 4 : 0, min + (hard && index > 1 ? Math.min(2, max - min) : showcase ? 0 : random(1 + Math.min(1, max - min))))
    const candidates = shuffle(cellsIn(size).filter(cell => columns[cell]), random)
    const basis = []
    let difference = 0n
    let taken = 0
    for (const cell of candidates) {
      let vector = columns[cell]
      for (const [pivot, entry] of basis) {
        if (vector & pivot) vector ^= entry
      }
      if (!vector) continue
      basis.push([bit(vector.toString(2).length - 1), vector])
      difference ^= columns[cell]
      taken += 1
      if (taken === k) break
    }
    if (taken < k || countBits(difference) < 4) continue
    const symmetry = symmetryFlag(difference, size)
    if (index > 1 && symmetry) continue
    const answer = solve(columns, difference, 18)
    if (!answer || answer.par < min || answer.par > max || k - answer.par >= 2) continue
    if (applyPresses(columns, answer.presses) !== difference) throw new Error('Solver failed for ' + puzzle.id)
    puzzle.goal = { name, bits: asBits(goal, size) }
    puzzle.start = asBits(goal ^ difference, size)
    puzzle.par = answer.par
    puzzle.seededPresses = k
    puzzle.metrics = { probe, nullity: answer.nullity, difficulty: answer.par * 5 + probe * 4 + size + Number(Boolean(mode || split)) * 3,
      symmetry, parGap: k - answer.par }
    if (!reject(puzzle)) return puzzle
  }
  return null
}
