import { cellIndex, cellsIn } from './engine.mjs'

export function lightShapes({ size, split }) {
  const squares = new Set(split?.marked.map(position => cellIndex(position, size)))
  return cellsIn(size).map(cell => squares.has(cell) ? 'square' : 'round')
}
