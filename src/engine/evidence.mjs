import { apply, colors, matchesCondition, shapes } from './rules.mjs'
import { rotateMask, tracePath } from './workshop.mjs'

function requireExample(supported, description) {
  if (!supported) throw new Error(`Missing example evidence: ${description}`)
}

function sameSymbolContext(a, b) {
  return a.color === b.color && a.shape === b.shape
}

function wrapAxes(scene, markers, dx, dy) {
  const offsets = [dx, dy]
  return offsets.map((offset, axis) =>
    markers.some(marker => scene[marker][axis] + offset < 0 || scene[marker][axis] + offset > 2))
}

function layerStates(scene, leftTurns, rightTurns) {
  const left = rotateMask(scene.left, leftTurns)
  const right = rotateMask(scene.right, rightTurns)
  return Array.from({ length: 16 }, (_, index) => ((left >> index) & 1) * 2 + ((right >> index) & 1))
}

function independentWeights(samples, input) {
  const active = input.tokens.map((count, index) => [count, index])
    .filter(([count, index]) => count || samples.some(sample => sample.tokens[index]))
    .map(([, index]) => index)
  const matrix = samples.map(sample => active.map(index => sample.tokens[index]))
  let rank = 0
  for (let column = 0; column < active.length; column += 1) {
    const pivot = matrix.findIndex((row, i) => i >= rank && Math.abs(row[column]) > 1e-9)
    if (pivot === -1) continue
    const pivotRow = matrix[pivot]
    matrix[pivot] = matrix[rank]
    matrix[rank] = pivotRow
    for (let i = rank + 1; i < matrix.length; i += 1) {
      const factor = matrix[i][column] / matrix[rank][column]
      matrix[i] = matrix[i].map((value, j) => value - matrix[rank][j] * factor)
    }
    rank += 1
  }
  return rank === active.length
}

function checkStep(samples, input, { op, args }) {
  const [a, b, c, d] = args
  switch (op) {
    case 'then':
      checkStep(samples, input, a)
      checkStep(samples.map(sample => apply(sample, a)), input && apply(input, a), b)
      break
    case 'if': {
      const yes = samples.filter(sample => matchesCondition(sample, a))
      const no = samples.filter(sample => !matchesCondition(sample, a))
      requireExample(yes.length && no.length, 'show both sides of the condition')
      const branch = input && matchesCondition(input, a)
      if (input?.kind === 'symbol') {
        requireExample((branch ? yes : no).some(sample => sameSymbolContext(sample, input)),
          'show the challenge color and shape in its branch')
      }
      if (samples[0]?.kind === 'symbol' && a[0] === 'even') {
        const paired = input ? (branch ? no : yes).some(sample => sameSymbolContext(sample, input))
          : yes.some(left => no.some(right => sameSymbolContext(left, right)))
        requireExample(paired,
          'show the same color and shape with both an even and an odd number')
      }
      checkStep(yes, branch ? input : null, b)
      checkStep(no, branch ? null : input, c)
      break
    }
    case 'color':
    case 'shape': {
      const palette = op === 'color' ? colors : shapes
      const shown = new Set(samples.map(sample => sample[op]))
      const missing = palette.filter(value => !shown.has(value))
      requireExample(!missing.length, `show every step of the ${op} cycle, including ${missing.join(', ')}`)
      break
    }
    case 'move':
    case 'moveOne': {
      const [markers, dx, dy, edge] = op === 'move' ? [['diamond', 'circle'], a, b, c] : [[a], b, c, d]
      if (!input || edge !== 'wrap') break
      const target = wrapAxes(input, markers, dx, dy)
      const witnessed = samples.map(sample => wrapAxes(sample, markers, dx, dy))
      requireExample(target.every((crosses, axis) => !crosses || witnessed.some(axes => axes[axis])),
        'show how a marker crosses the same board edge as the challenge')
      break
    }
    case 'followSignals': {
      if (!input) break
      const trace = scene => tracePath(scene.signals, [a, b], c).encountered
      const seen = samples.map(trace)
      requireExample(trace(input).every((signal, junction) => seen.some(example => example[junction] === signal)),
        'show each signal the challenge reaches at that depth on the route')
      break
    }
    case 'recolorBeads':
      if (input) {
        requireExample(input.items.every((color, index) => {
          const relevant = (c & (1 << index)) || color === a || color === b
          return !relevant || samples.some(sample => sample.items[index] === color)
        }), 'show the relevant bead colors in those positions after the shift')
      }
      break
    case 'combineLayers':
      if (input) {
        const seen = new Set(samples.flatMap(sample => layerStates(sample, b, c)))
        requireExample(layerStates(input, b, c).every(state => seen.has(state)),
          'show each layer overlap or gap that is used in the challenge')
      }
      break
    case 'weights':
      if (input) requireExample(independentWeights(samples, input), 'use enough independent sums to determine the token values')
      break
  }
}

export function validateEvidence(examples, input, rule) {
  checkStep(examples.map(example => example.input), input, rule)
}
