import { bit, hasBit, countBits } from './engine.mjs'

export function solve(columns, target, maxNullity = Infinity) {
  const n = columns.length
  const rhs = bit(n)
  const rows = columns.map((_, row) => columns.reduce((mask, col, index) =>
    col !== null && hasBit(col, row) ? mask | bit(index) : mask, hasBit(target, row) ? rhs : 0n))
  const pivots = []
  const free = []
  for (let col = 0; col < n; col += 1) {
    if (columns[col] === null) continue
    const rank = pivots.length
    const pivot = rows.findIndex((row, i) => i >= rank && hasBit(row, col))
    if (pivot === -1) {
      free.push(col)
      continue
    }
    const row = rows[pivot]
    rows[pivot] = rows[rank]
    rows[rank] = row
    for (let i = 0; i < n; i += 1) {
      if (i !== rank && hasBit(rows[i], col)) rows[i] ^= row
    }
    pivots.push(col)
  }
  if (rows.slice(pivots.length).includes(rhs)) return null
  if (free.length > maxNullity) return null
  const base = pivots.reduce((mask, col, row) => rows[row] & rhs ? mask | bit(col) : mask, 0n)
  const basis = free.map(col => pivots.reduce((mask, pivot, i) =>
    hasBit(rows[i], col) ? mask | bit(pivot) : mask, bit(col)))
  let presses = base
  let par = countBits(base)
  function visit(i, vector) {
    if (par === 0) return
    if (i === basis.length) {
      const weight = countBits(vector)
      if (weight < par) {
        par = weight
        presses = vector
      }
      return
    }
    visit(i + 1, vector)
    visit(i + 1, vector ^ basis[i])
  }
  visit(0, base)
  return { presses, par, nullity: free.length }
}
