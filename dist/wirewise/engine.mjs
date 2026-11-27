const bits = Array.from({ length: 37 }, (_, index) => 1n << BigInt(index))
export const bit = cell => bits[cell]
export const hasBit = (mask, cell) => (mask & bit(cell)) !== 0n
export const cellIndex = ([row, col], size) => row * size + col
export const cellCoordinates = (index, size) => [Math.floor(index / size), index % size]
export const cellsIn = size => Array.from({ length: size ** 2 }, (_, cell) => cell)
export const asBits = (mask, size) => cellsIn(size).map(cell => hasBit(mask, cell) ? '1' : '0').join('')
export const asMask = bits => BigInt('0b' + [...bits].reverse().join(''))

const lines = {
  row: (i, r) => [r, i],
  col: (i, r, c) => [i, c],
  diag: (i, r, c) => [i, c + i - r],
  anti: (i, r, c) => [i, c - i + r],
}
const mirrors = {
  rot180: (r, c, m) => [[m - r, m - c]],
  horizontal: (r, c, m) => [[r, m - c]],
  vertical: (r, c, m) => [[m - r, c]],
  transpose: (r, c) => [[c, r]],
  quad: (r, c, m) => [[r, m - c], [m - r, c], [m - r, m - c]],
  rot90group: (r, c, m) => [[c, m - r], [m - r, m - c], [m - c, r]],
}

const footprints = new WeakMap()
export function stampMask(stamp, size, cell, wrap = false) {
  let cached = footprints.get(stamp)
  if (!cached) {
    cached = new Map()
    footprints.set(stamp, cached)
  }
  const key = size * 2 + Number(wrap)
  if (!cached.has(key)) cached.set(key, [])
  const masks = cached.get(key)
  if (masks[cell] !== undefined) return masks[cell]
  const [r, c] = cellCoordinates(cell, size)
  let mask = 0n
  const add = (row, col) => {
    if (wrap) {
      row = (row % size + size) % size
      col = (col % size + size) % size
    }
    if (row >= 0 && row < size && col >= 0 && col < size) mask |= bit(row * size + col)
  }
  for (const component of stamp.components) {
    if (component.type === 'offsets') {
      for (const [dr, dc] of component.offsets) add(r + dr, c + dc)
    } else if (component.type === 'line') {
      for (let i = 0; i < size; i += 1) add(...lines[component.line](i, r, c))
    } else {
      for (const [row, col] of mirrors[component.mirror](r, c, size - 1)) add(row, col)
    }
  }
  masks[cell] = stamp.self ? mask | bit(cell) : mask & ~bit(cell)
  return masks[cell]
}

export function flipSets(puzzle) {
  const blocked = new Set(puzzle.blocked.map(pos => cellIndex(pos, puzzle.size)))
  const marked = new Set(puzzle.split?.marked.map(pos => cellIndex(pos, puzzle.size)))
  return cellsIn(puzzle.size).map(cell => blocked.has(cell) ? null :
    stampMask(marked.has(cell) ? puzzle.stamps.B : puzzle.stamps.A, puzzle.size, cell, puzzle.wrap))
}

function countWord(word) {
  word -= (word >>> 1) & 0x55555555
  word = (word & 0x33333333) + ((word >>> 2) & 0x33333333)
  return Math.imul((word + (word >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24
}
export const countBits = mask => countWord(Number(mask & 0xffffffffn)) + countWord(Number(mask >> 32n))

export function applyPresses(columns, presses) {
  return columns.reduce((state, mask, cell) => mask !== null && hasBit(presses, cell) ? state ^ mask : state, 0n)
}
