import { applyWorkshop, isWorkshopScene, workshopCandidates, workshopSceneKey } from './workshop.mjs'

export const shapes = ['circle', 'square', 'triangle']
export const colors = ['violet', 'teal', 'amber']
export const tokens = ['circle', 'square', 'triangle', 'diamond', 'star']
export const wrap = (value, size) => ((value % size) + size) % size

const rule = (op, ...args) => ({ op, args })
const integers = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => min + i)
const offsets = [-2, -1, 1, 2]
const identity = rule('identity')

const swaps = []
for (let a = 0; a < 4; a += 1) {
  for (let b = a + 1; b < 5; b += 1) swaps.push(rule('swap', a, b))
}

const moves = []
for (const dy of [-1, 0, 1]) {
  for (const dx of [-1, 0, 1]) {
    if (!dx && !dy) continue
    for (const edge of ['wrap', 'clamp']) {
      moves.push(rule('move', dx, dy, edge))
      for (const marker of ['diamond', 'circle']) moves.push(rule('moveOne', marker, dx, dy, edge))
    }
  }
}

const turns = integers(1, 3)
const primitives = {
  symbol: [
    ...[1, -1].flatMap(step => [rule('color', step), rule('shape', step)]),
    ...offsets.map(step => rule('dots', step)),
  ],
  arrow: [
    ...turns.map(step => rule('turn', step)),
    ...integers(0, 3).map(axis => rule('mirrorArrow', axis)),
    rule('flipFlag'),
  ],
  count: [
    ...[-4, -3, ...offsets, 3, 4].map(step => rule('add', step)),
    ...[2, 3].map(factor => rule('multiply', factor)),
    rule('half'),
  ],
  row: [...offsets.map(step => rule('shift', step)), rule('reverse'), ...swaps],
  grid: [
    ...moves,
    ...turns.map(step => rule('turnGrid', step)),
    ...integers(0, 3).map(axis => rule('mirrorGrid', axis)),
    rule('swapMarkers'),
  ],
}

function conditionalRules(actions, predicates) {
  return predicates.flatMap(test => actions.flatMap(yes => actions
    .filter(no => yes !== no)
    .map(no => rule('if', test, yes, no))))
}

export function candidates(kind) {
  if (kind === 'equation') {
    const values = integers(0, 6)
    return values.flatMap(blue => values.flatMap(red => values.flatMap(gold =>
      integers(-2, 2).map(offset => rule('weights', [blue, red, gold], offset)))))
  }
  const specialized = workshopCandidates(kind)
  if (specialized) return specialized
  const actions = primitives[kind]
  const simple = [identity, ...actions]
  const tests = kind === 'symbol'
    ? [['even'], ...shapes.map(shape => ['shape', shape]), ...colors.map(color => ['color', color])]
    : kind === 'count' ? [['even'], ...[4, 6, 8].map(count => ['atLeast', count])] : []
  return [
    ...simple,
    ...actions.flatMap(first => actions.map(second => rule('then', first, second))),
    ...conditionalRules(simple, tests),
  ]
}

export function matchesCondition(input, [property, value]) {
  if (property === 'even') return (input.dots ?? input.value) % 2 === 0
  if (property === 'atLeast') return input.value >= value
  return input[property] === value
}

function stepCell([x, y], dx, dy, edge) {
  const limit = edge === 'wrap' ? value => wrap(value, 3) : value => Math.max(0, Math.min(2, value))
  return [limit(x + dx), limit(y + dy)]
}

const mirrorCell = [
  ([x, y]) => [2 - x, y],
  ([x, y]) => [2 - y, 2 - x],
  ([x, y]) => [x, 2 - y],
  ([x, y]) => [y, x],
]

function grid(input, map) {
  const diamond = map(input.diamond, 'diamond')
  const circle = map(input.circle, 'circle')
  return diamond.join() === circle.join() ? null : { kind: 'grid', diamond, circle }
}

function turnCell(cell, turns) {
  return turns ? turnCell([2 - cell[1], cell[0]], turns - 1) : cell
}

export function apply(input, { op, args }) {
  if (!input) return null
  const [a, b, c, d] = args
  switch (op) {
    case 'identity': return input
    case 'then': return apply(apply(input, a), b)
    case 'if': return apply(input, matchesCondition(input, a) ? b : c)
    case 'color': return { ...input, color: colors[wrap(colors.indexOf(input.color) + a, colors.length)] }
    case 'shape': return { ...input, shape: shapes[wrap(shapes.indexOf(input.shape) + a, shapes.length)] }
    case 'dots': return input.dots + a < 0 || input.dots + a > 5 ? null : { ...input, dots: input.dots + a }
    case 'turn': return { ...input, direction: wrap(input.direction + a, 4) }
    case 'mirrorArrow': return { ...input, direction: wrap(a - input.direction, 4), flag: -input.flag }
    case 'flipFlag': return { ...input, flag: -input.flag }
    case 'add': return count(input.value + a)
    case 'multiply': return count(input.value * a)
    case 'half': return count(input.value / 2)
    case 'weights': {
      const value = input.tokens.reduce((sum, count, index) => sum + count * a[index], b)
      return value >= 0 && value <= 60 ? { kind: 'number', value } : null
    }
    case 'shift': return { ...input, items: input.items.map((_, i, items) => items[wrap(i - a, items.length)]) }
    case 'reverse': return { ...input, items: [...input.items].reverse() }
    case 'swap': {
      if (b >= input.items.length) return null
      const items = [...input.items]
      items[a] = input.items[b]
      items[b] = input.items[a]
      return { ...input, items }
    }
    case 'move': return grid(input, cell => stepCell(cell, a, b, c))
    case 'moveOne': return grid(input, (cell, marker) => marker === a ? stepCell(cell, b, c, d) : cell)
    case 'turnGrid': return grid(input, cell => turnCell(cell, a))
    case 'mirrorGrid': return grid(input, mirrorCell[a])
    case 'swapMarkers': return { kind: 'grid', diamond: input.circle, circle: input.diamond }
    default: return applyWorkshop(input, op, args)
  }
}

function count(value) {
  return Number.isInteger(value) && value >= 0 && value <= 18 ? { kind: 'count', value } : null
}

export function sceneKey(scene) {
  if (!scene) return ''
  switch (scene.kind) {
    case 'symbol': return ['symbol', scene.shape, scene.color, scene.dots].join('|')
    case 'arrow': return ['arrow', scene.direction, scene.flag].join('|')
    case 'count': return `count|${scene.value}`
    case 'equation': return ['equation', ...scene.tokens].join('|')
    case 'number': return `number|${scene.value}`
    case 'row': return ['row', ...scene.items].join('|')
    case 'grid': return ['grid', ...scene.diamond, ...scene.circle].join('|')
    default: return workshopSceneKey(scene)
  }
}

export function isValidScene(scene, kind) {
  if (!scene || scene.kind !== kind) return false
  const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
  const validCell = cell => Array.isArray(cell) && cell.length === 2 && cell.every(value => inRange(value, 0, 2))
  switch (kind) {
    case 'symbol': return shapes.includes(scene.shape) && colors.includes(scene.color) && inRange(scene.dots, 0, 5)
    case 'arrow': return inRange(scene.direction, 0, 3) && [-1, 1].includes(scene.flag)
    case 'count': return inRange(scene.value, 0, 18)
    case 'equation': return Array.isArray(scene.tokens) && scene.tokens.length === 3
      && scene.tokens.every(value => inRange(value, 0, 4)) && scene.tokens.some(Boolean)
    case 'number': return inRange(scene.value, 0, 60)
    case 'row': return Array.isArray(scene.items) && inRange(scene.items.length, 4, 5) && scene.items.every(item => tokens.includes(item))
    case 'grid': return validCell(scene.diamond) && validCell(scene.circle) && scene.diamond.join() !== scene.circle.join()
    default: return isWorkshopScene(scene)
  }
}

export function matchingRules(examples, library) {
  return library.filter(candidate => examples.every(({ input, output }) => sceneKey(apply(input, candidate)) === sceneKey(output)))
}
