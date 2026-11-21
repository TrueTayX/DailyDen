// Generate authoring candidates offline, then review and commit the resulting data.
import { writeFile } from 'node:fs/promises'
import { compilePuzzle } from '../src/engine/compile.mjs'
import { apply, colors, sceneKey, shapes } from '../src/engine/rules.mjs'

const rule = (op, ...args) => ({ op, args })
const dates = 30
const start = Date.UTC(2026, 11, 2)
let state = 20261202
function random(max) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return Math.floor(state / 4294967296 * max)
}
const pick = choices => choices[random(choices.length)]
const range = (n, first = 0) => Array.from({ length: n }, (_, i) => i + first)
const scene = (kind, props) => ({ kind, ...props })
const digits = n => range(n).map(() => random(2))
const tone = ['blue', 'red', 'gold']
const beadTones = ['red', 'blue', 'green', 'gold']
const letters = ['circle', 'square', 'triangle', 'diamond', 'star']

function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const kinds = {
  symbol: () => scene('symbol', { shape: pick(shapes), color: pick(colors), dots: random(6) }),
  arrow: () => scene('arrow', { direction: random(4), flag: pick([-1, 1]) }),
  towers: () => scene('towers', { items: shuffle(range(4, 1)) }),
  equation: expert => scene('equation', { tokens: [random(5), random(5), expert ? random(4) : 0] }),
  splice: () => scene('splice', { left: 1 + random(6), right: 1 + random(6) }),
  path: () => scene('path', { signals: digits(7) }),
  overlay: () => {
    const mask = () => range(16).reduce((bits, index) => random(3) === 0 ? bits | (1 << index) : bits, 0)
    return scene('overlay', { left: mask(), right: mask() })
  },
  grid: () => {
    const diamond = random(9)
    const circle = (diamond + 1 + random(8)) % 9
    const cell = value => [value % 3, Math.floor(value / 3)]
    return scene('grid', { diamond: cell(diamond), circle: cell(circle) })
  },
  row: () => scene('row', { items: shuffle(letters) }),
  count: () => scene('count', { value: random(16) }),
  beads: () => scene('beads', { items: shuffle(beadTones).slice(0, 3) }),
}

function pattern(category, kind, operation, hint, explanation, options = {}) {
  return { category, kind, operation, hint, explanation, ...options }
}

const turnText = { 1: 'a quarter turn clockwise', 2: 'halfway around', 3: 'a quarter turn counterclockwise' }
const moveText = ([x, y]) => x ? `one column ${x === 1 ? 'right' : 'left'}` : `one row ${y === 1 ? 'down' : 'up'}`
const moveOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const colorCycle = n => n === 1 ? 'violet → teal → amber → violet' : 'violet → amber → teal → violet'
const shapeCycle = n => n === 1 ? 'circle → square → triangle → circle' : 'circle → triangle → square → circle'

const families = {
  object(day) {
    const operation = ['dots', 'color', 'shape'][day % 3]
    const step = day % 2 ? -1 : 1
    const fixedShape = pick(shapes)
    const fixedColor = pick(colors)
    const parity = random(2)
    const subject = { color: 'color', dots: 'dot count', shape: 'outline' }[operation]
    const phrase = operation === 'color' ? `Advance the color through this cycle: ${colorCycle(step)}.`
      : operation === 'shape' ? `Advance the outline through this cycle: ${shapeCycle(step)}.`
        : `${step === 1 ? 'Add' : 'Remove'} one dot.`
    return pattern('Objects', 'symbol', rule(operation, step), `Compare the ${subject} in each pair.`,
      () => `${phrase} The other properties stay the same.`, {
        examples: 3, choiceCount: 4,
        draw: () => scene('symbol', {
          shape: operation === 'shape' ? pick(shapes) : fixedShape,
          color: operation === 'color' ? pick(colors) : fixedColor,
          dots: operation === 'dots' ? random(6) : pick([parity, parity + 2, parity + 4]),
        }),
      })
  },
  arrow() {
    const turn = pick([1, 2, 3])
    return pattern('Geometry', 'arrow', rule('turn', turn), 'Watch the direction of both the arrow and its flag.',
      () => `Turn the whole arrow ${turnText[turn]}, including its flag.`, { examples: 3 })
  },
  sort() {
    const direction = pick([-1, 1])
    const operation = rule('sortHeight', direction)
    return pattern('Hidden sorting', 'towers', operation, 'Compare the output towers by height.',
      () => `Sort the towers ${direction === 1 ? 'from shortest to tallest' : 'from tallest to shortest'}, reading left to right.`, {
        draw: () => scene('towers', { items: shuffle(range(6, 1)).slice(0, 4) }),
        accept: (examples, input) => {
          const outputs = [...examples, input].map(sample => sceneKey(apply(sample, operation)))
          return new Set(outputs).size === outputs.length
        },
      })
  },
  path() {
    const violet = random(2)
    const branch = ['upper', 'lower']
    return pattern('Path tracing', 'path', rule('followSignals', violet, 1 - violet, 0),
      'Compare what happens at a violet diamond and an amber cross.',
      (_, output) => `From the starting arrow, take the ${branch[violet]} branch at each violet diamond and the ${branch[1 - violet]} branch at each amber cross. The challenge reaches exit ${String.fromCharCode(65 + output.index)}.`)
  },
  weights(day, expert = false) {
    const values = [1 + random(5), 1 + random(5), expert ? 1 + random(5) : 0]
    return pattern('Counting', 'equation', rule('weights', values, 0),
      'Compare examples that share some tokens. Any difference in their totals comes from the tokens that changed.',
      (input, output) => `The examples fix the values at ${values.slice(0, expert ? 3 : 2).map((value, i) => `${tone[i]} = ${value}`).join(', ')}. The challenge adds up to ${input.tokens.map((n, i) => n ? `${n} × ${values[i]}` : '').filter(Boolean).join(' + ')} = ${output.value}.`,
      { draw: () => kinds.equation(expert), examples: expert ? 5 : 4 })
  },
  splice() {
    return pattern('Combining objects', 'splice', rule('joinStrips', 'sum', -1, 'left', 0),
      'Look at the tile shared by the two strips and count it once.',
      (input, output) => `Lay the violet strip over the last teal tile. The crosshatched tile belongs to both, so ${input.left} + ${input.right} − 1 gives ${output.length} tiles, with the join at tile ${output.seam}.`)
  },
  gridStep() {
    const offset = pick(moveOffsets)
    return pattern('Grid movement', 'grid', rule('move', ...offset, 'wrap'), 'Look at what happens to markers along the edge.',
      () => `Move both markers ${moveText(offset)}. A marker that passes an edge reappears on the opposite edge.`)
  },
  gridMaster() {
    const turn = pick([1, 2, 3])
    const offset = pick(moveOffsets)
    const marker = pick(['circle', 'diamond'])
    return pattern('Grid movement', 'grid', rule('then', rule('turnGrid', turn), rule('moveOne', marker, ...offset, 'wrap')),
      'Use the marker that only turns with the board to work out the first step.',
      () => `Turn the board ${turnText[turn]}, then move just the ${marker} ${moveText(offset)}. If it passes an edge, wrap to the opposite edge.`)
  },
  row(day, master = false) {
    const step = pick([-2, -1, 1, 2])
    const positions = shuffle(range(5)).slice(0, 2).sort((a, b) => a - b)
    const shift = rule('shift', step)
    const direction = `${Math.abs(step)} ${Math.abs(step) === 1 ? 'place' : 'places'} ${step > 0 ? 'right' : 'left'}`
    return pattern('Sequences', 'row', master ? rule('then', rule('swap', ...positions), shift) : shift,
      master ? 'Look for the pair of tiles that trade places before the entire row moves.' : 'Watch where the end tiles reappear.',
      () => `${master ? `Exchange the tiles in positions ${positions[0] + 1} and ${positions[1] + 1}, then shift` : 'Shift'} the row ${direction}, wrapping tiles that pass an end.`, { presentation: 'letters' })
  },
  blocks() {
    const adjustment = pick([-1, 1, 2])
    return pattern('Counting', 'count', rule('then', rule('multiply', 2), rule('add', adjustment)),
      'Compare how much the output changes when the input increases by one.',
      (input, output) => `Double the number of blocks, then ${adjustment > 0 ? 'add' : 'subtract'} ${Math.abs(adjustment)}. That takes ${input.value} blocks to ${output.value}.`,
      { presentation: 'blocks' })
  },
  badge() {
    const colorStep = pick([-1, 1])
    const numberStep = pick([-1, 1])
    const evenColor = random(2) === 0
    const shape = pick(shapes)
    const operations = [rule('color', colorStep), rule('dots', numberStep)]
    return pattern('Conditions', 'symbol', rule('if', ['even'], ...evenColor ? operations : [...operations].reverse()),
      'Separate the examples into even numbers and odd numbers and compare the outputs.',
      () => `For ${evenColor ? 'even' : 'odd'} numbers, move through the color cycle ${colorCycle(colorStep)}. For ${evenColor ? 'odd' : 'even'} numbers, ${numberStep > 0 ? 'add one to' : 'subtract one from'} the number. The letter always stays the same.`,
      { presentation: 'badge', examples: 5, draw: () => ({ ...kinds.symbol(), shape }) })
  },
  overlay() {
    const [mode, text] = pick([
      ['exclusive', 'Keep the tiles filled in exactly one layer. Shared tiles disappear.'],
      ['overlap', 'Keep only the tiles filled in both layers.'],
      ['leftOnly', 'Keep the tiles filled in layer A unless layer B also fills them.'],
      ['rightOnly', 'Keep the tiles filled in layer B unless layer A also fills them.'],
    ])
    const turn = pick([0, 0, 1])
    return pattern('Overlay and subtraction', 'overlay', rule('combineLayers', mode, turn, 0),
      turn ? 'Line up the layers after turning layer A a quarter turn clockwise. Look at where their filled tiles meet.'
        : 'Compare positions that are filled on both layers with positions filled on just one.',
      () => `${turn ? 'Turn layer A a quarter turn clockwise. ' : ''}${text}`)
  },
  relation() {
    const step = pick([-1, 1])
    return pattern('Relationships', 'towers', rule('then', rule('swapHeights', 1, 4), rule('shiftItems', step)),
      'First undo the row shift in each output. Which relative heights have traded places?',
      () => `Trade the positions of the shortest and tallest towers. Then shift the row one place ${step === 1 ? 'right' : 'left'}, wrapping the end tower.`)
  },
  beads() {
    const [a, b] = shuffle(beadTones).slice(0, 2).sort((a, b) => beadTones.indexOf(a) - beadTones.indexOf(b))
    const step = pick([-1, 1])
    const before = rule('shiftItems', step)
    const after = rule('recolorBeads', a, b, 0b011)
    const operation = rule('then', before, after)
    return pattern('Multi-stage transformations', 'beads', operation, 'Track where the end bead moves, then look for color changes.',
      () => `Shift the row one place ${step === 1 ? 'right' : 'left'}, wrapping at the end. Then swap ${a} and ${b} in the first two positions only.`,
      { challenge: input => sceneKey(apply(input, operation)) !== sceneKey(apply(input, rule('then', after, before))) })
  },
  weightsExpert(day) { return families.weights(day, true) },
  rowMaster(day) { return families.row(day, true) },
}

const menus = [
  ['object', 'arrow', 'weights', 'badge', 'gridMaster'],
  ['object', 'sort', 'splice', 'overlay', 'beads'],
  ['object', 'path', 'weights', 'relation', 'rowMaster'],
  ['object', 'gridStep', 'blocks', 'badge', 'beads'],
  ['object', 'row', 'splice', 'overlay', 'weightsExpert'],
  ['object', 'arrow', 'blocks', 'relation', 'rowMaster'],
]

const used = new Set()
function draftPuzzle(family, day, index, id) {
  for (let attempt = 0; attempt < 180; attempt++) {
    const p = families[family](day)
    const draw = p.draw ?? kinds[p.kind]
    const take = p.examples ?? 4
    const candidates = new Map()
    for (let n = 0; n < 120 && candidates.size <= take; n++) {
      const input = draw()
      const output = apply(input, p.operation)
      if (!output || (input.kind === 'equation' && !input.tokens.some(Boolean))) continue
      candidates.set(sceneKey(input), input)
    }
    if (candidates.size <= take) continue
    const [input, ...inputs] = candidates.values()
    const output = apply(input, p.operation)
    if (sceneKey(input) === sceneKey(output)) continue
    if (p.accept && !p.accept(inputs, input)) continue
    if (p.challenge && !p.challenge(input)) continue
    const fingerprint = JSON.stringify([p.operation, sceneKey(input)])
    if (used.has(fingerprint)) continue
    const source = { category: p.category, rule: p.operation, inputs, input,
      correctSlot: random(p.choiceCount ?? (index < 3 ? 6 : 9)), hint: p.hint, explanation: p.explanation(input, output),
      ...(p.choiceCount ? { choiceCount: p.choiceCount } : {}),
      ...(p.presentation ? { presentation: p.presentation } : {}) }
    try {
      compilePuzzle(source, id, index, { requireEvidence: true })
      used.add(fingerprint)
      return source
    } catch (error) {
      if (!/Ambiguous challenge|Too few distinct distractors|Missing example evidence/.test(error.message)) throw new Error(`${id}: ${JSON.stringify(p.operation)}: ${error.message}`, { cause: error })
    }
  }
  throw new Error(`Could not draft a puzzle for ${id} (${family})`)
}

const season = Array.from({ length: dates }, (_, day) => {
  const date = new Date(start + day * 86_400_000).toISOString().slice(0, 10)
  const id = 'daily-' + date
  return { date, id, puzzles: menus[day % menus.length].map((family, index) => draftPuzzle(family, day, index, `${id}-${index + 1}`)) }
})
const content = season.map(({ date, id, puzzles }) =>
  `  { "date": "${date}", "id": "${id}", "puzzles": [\n${puzzles.map(puzzle => '    ' + JSON.stringify(puzzle)).join(',\n')}\n  ] }`).join(',\n')
await writeFile(new URL('../content/season-one.json', import.meta.url), `[\n${content}\n]\n`, { flag: 'wx' })
console.log(`Drafted ${season.length} dated sets for editorial review.`)
