const rule = (op, ...args) => ({ op, args })
const range = (size, start = 0) => Array.from({ length: size }, (_, index) => index + start)
const pairs = values => values.flatMap((first, index) => values.slice(index + 1).map(second => [first, second]))
const positions = range(4)
const beadColors = ['red', 'blue', 'green', 'gold']
const tileMask = 0xffff

function swaps(values, op) {
  return pairs(values).map(pair => rule(op, ...pair))
}

function shift(items, step) {
  return items.map((_, i) => items[(i - step + items.length) % items.length])
}

function exchange(items, a, b) {
  const moved = [...items]
  moved[a] = items[b]
  moved[b] = items[a]
  return moved
}

function composed(primitives) {
  return [rule('identity'), ...primitives, ...primitives.flatMap(first => primitives.map(second => rule('then', first, second)))]
}

function orderings(count) {
  const steps = count === 3 ? [-1, 1] : [-1, 1, 2]
  return [rule('reverseItems'), ...steps.map(step => rule('shiftItems', step)), ...swaps(range(count), 'swapItems')]
}

const towerRules = composed([
  ...orderings(4),
  ...swaps(range(4, 1), 'swapHeights'),
  rule('sortHeight', 1),
  rule('sortHeight', -1),
])

const beadRules = composed([
  ...orderings(3),
  ...pairs(beadColors).flatMap(([first, second]) =>
    [0b001, 0b010, 0b100, 0b011, 0b110, 0b101, 0b111].map(mask => rule('recolorBeads', first, second, mask))),
])

const spliceRules = ['sum', 'larger', 'smaller', 'difference'].flatMap(operation =>
  range(5, -2).flatMap(offset => ['left', 'right', 'middle'].flatMap(anchor =>
    [-1, 0, 1].map(adjust => rule('joinStrips', operation, offset, anchor, adjust)))))

const blendTiles = {
  union: (a, b) => a | b,
  overlap: (a, b) => a & b,
  exclusive: (a, b) => a ^ b,
  leftOnly: (a, b) => a & ~b,
  rightOnly: (a, b) => b & ~a,
  agreement: (a, b) => tileMask ^ (a ^ b),
}
const overlayRules = Object.keys(blendTiles).flatMap(operation =>
  positions.flatMap(left => positions.map(right => rule('combineLayers', operation, left, right))))

const pathRules = [
  ...range(8).map(exit => rule('fixedRoute', exit)),
  ...range(2).flatMap(violet => range(2).flatMap(amber =>
    range(8).map(reverseAt => rule('followSignals', violet, amber, reverseAt)))),
]

const workshopRules = {
  towers: towerRules,
  beads: beadRules,
  splice: spliceRules,
  overlay: overlayRules,
  path: pathRules,
}

export function workshopCandidates(kind) {
  return Object.hasOwn(workshopRules, kind) ? workshopRules[kind] : undefined
}

export const puzzleOutputKind = {
  splice: 'strip',
  overlay: 'mosaic',
  path: 'exit',
  equation: 'number',
}

function rotateMask(mask, turns) {
  for (let turn = 0; turn < turns; turn += 1) {
    let next = 0
    for (let from = 0; from < 16; from += 1) {
      if (mask & (1 << from)) {
        const row = Math.floor(from / 4)
        const column = from % 4
        next |= 1 << (4 * column + 3 - row)
      }
    }
    mask = next
  }
  return mask
}

function joinStrips(input, operation, offset, anchor, adjust) {
  const { left, right } = input
  const lengths = { sum: left + right, larger: Math.max(left, right), smaller: Math.min(left, right), difference: Math.abs(left - right) }
  const length = lengths[operation] + offset
  const seam = { left, right, middle: Math.ceil(length / 2) }[anchor] + adjust
  return length >= 1 && length <= 12 && seam >= 1 && seam <= length ? { kind: 'strip', length, seam } : null
}

function followSignals(signals, turns, reverseAt) {
  let junction = 0
  for (let level = 0; level < 3; level += 1) {
    const turn = turns[signals[junction]] ^ ((reverseAt >> level) & 1)
    junction = junction * 2 + 1 + turn
  }
  return { kind: 'exit', index: junction - 7 }
}

export function applyWorkshop(input, op, [a, b, c, d]) {
  switch (op) {
    case 'reverseItems': return { ...input, items: [...input.items].reverse() }
    case 'shiftItems': return { ...input, items: shift(input.items, a) }
    case 'swapItems': return { ...input, items: exchange(input.items, a, b) }
    case 'swapHeights': return { ...input, items: exchange(input.items, input.items.indexOf(a), input.items.indexOf(b)) }
    case 'sortHeight': return { ...input, items: [...input.items].sort((first, second) => a * (first - second)) }
    case 'recolorBeads': return { ...input, items: input.items.map((color, index) => {
      if (!(c & (1 << index))) return color
      return color === a ? b : color === b ? a : color
    }) }
    case 'joinStrips': return joinStrips(input, a, b, c, d)
    case 'combineLayers': return { kind: 'mosaic', mask: blendTiles[a](rotateMask(input.left, b), rotateMask(input.right, c)) }
    case 'fixedRoute': return { kind: 'exit', index: a }
    case 'followSignals': return followSignals(input.signals, [a, b], c)
    default: throw new Error(`Unknown rule: ${op}`)
  }
}

export function workshopSceneKey(scene) {
  switch (scene.kind) {
    case 'towers':
    case 'beads': return [scene.kind, ...scene.items].join('|')
    case 'splice':
    case 'overlay': return [scene.kind, scene.left, scene.right].join('|')
    case 'strip': return ['strip', scene.length, scene.seam].join('|')
    case 'mosaic': return `mosaic|${scene.mask}`
    case 'path': return ['path', ...scene.signals].join('|')
    case 'exit': return `exit|${scene.index}`
    default: throw new Error(`Unknown scene: ${scene.kind}`)
  }
}

export function isWorkshopScene(scene) {
  const inRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
  switch (scene.kind) {
    case 'towers': return Array.isArray(scene.items) && scene.items.length === 4
      && new Set(scene.items).size === 4 && scene.items.every(item => inRange(item, 1, 4))
    case 'beads': return Array.isArray(scene.items) && scene.items.length === 3 && scene.items.every(color => beadColors.includes(color))
    case 'splice': return inRange(scene.left, 1, 6) && inRange(scene.right, 1, 6)
    case 'strip': return inRange(scene.length, 1, 12) && inRange(scene.seam, 1, scene.length)
    case 'overlay': return inRange(scene.left, 0, tileMask) && inRange(scene.right, 0, tileMask)
    case 'mosaic': return inRange(scene.mask, 0, tileMask)
    case 'path': return Array.isArray(scene.signals) && scene.signals.length === 7 && scene.signals.every(signal => inRange(signal, 0, 1))
    case 'exit': return inRange(scene.index, 0, 7)
    default: return false
  }
}

export function workshopDistance(answer, option) {
  switch (answer.kind) {
    case 'towers':
    case 'beads': return answer.items.filter((item, i) => item !== option.items[i]).length
    case 'strip': return Math.abs(answer.length - option.length) + Math.abs(answer.seam - option.seam)
    case 'mosaic': return range(16).filter(index => (answer.mask ^ option.mask) & (1 << index)).length
    case 'exit': return Math.abs(answer.index - option.index)
    default: throw new Error(`Unsupported answer: ${answer.kind}`)
  }
}
