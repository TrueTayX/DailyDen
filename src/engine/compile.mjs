import { apply, candidates, isValidScene, matchingRules, sceneKey } from './rules.mjs'
import { puzzleOutputKind, workshopDistance } from './workshop.mjs'
import { validateEvidence } from './evidence.mjs'

export const ruleLibraryVersion = 5

export function validateAnswer({ examples, input, rule }, library = candidates(input.kind)) {
  const kind = input.kind
  const outputKind = puzzleOutputKind[kind] ?? kind
  if (!isValidScene(input, kind) || examples.length < 3) throw new Error('Invalid challenge or too few examples')
  const exampleKeys = new Set(examples.map(example => sceneKey(example.input)))
  if (exampleKeys.size !== examples.length || exampleKeys.has(sceneKey(input))) {
    throw new Error('Example and challenge inputs must be distinct')
  }
  if (!library.some(candidate => JSON.stringify(candidate) === JSON.stringify(rule))) {
    throw new Error('Intended rule is outside the supported library')
  }
  for (const example of examples) {
    if (!isValidScene(example.input, kind) || !isValidScene(example.output, outputKind)
      || sceneKey(apply(example.input, rule)) !== sceneKey(example.output)) {
      throw new Error('An example does not match the intended rule')
    }
  }

  const expected = apply(input, rule)
  if (!isValidScene(expected, outputKind)) throw new Error('Intended rule has no legal challenge output')
  const expectedKey = sceneKey(expected)
  const matches = matchingRules(examples, library)
  for (const candidate of matches) {
    const alternate = apply(input, candidate)
    if (alternate && sceneKey(alternate) !== expectedKey) {
      throw new Error(`Ambiguous challenge: ${JSON.stringify(candidate)} gives ${sceneKey(alternate)}, expected ${expectedKey}`)
    }
  }
  return expected
}

function distance(a, b) {
  switch (a.kind) {
    case 'symbol': return Number(a.shape !== b.shape) + Number(a.color !== b.color) + Math.abs(a.dots - b.dots)
    case 'arrow': return Math.min(Math.abs(a.direction - b.direction), 4 - Math.abs(a.direction - b.direction)) + Number(a.flag !== b.flag)
    case 'number':
    case 'count': return Math.abs(a.value - b.value)
    case 'row': return a.items.filter((item, i) => item !== b.items[i]).length
    case 'grid': return Number(a.diamond.join() !== b.diamond.join()) + Number(a.circle.join() !== b.circle.join())
    default: return workshopDistance(a, b)
  }
}

function hash(value) {
  let result = 2166136261
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return result >>> 0
}

function distractors(input, answer, library, id, total) {
  const options = new Map()
  const answerKey = sceneKey(answer)
  const inputKey = sceneKey(input)
  for (const rule of library) {
    const option = apply(input, rule)
    const key = sceneKey(option)
    if (!option || key === answerKey || options.has(key)) continue
    options.set(key, { option, rank: distance(answer, option) + Number(key === inputKey) / 2, order: hash(id + key) })
  }
  if (options.size < total) throw new Error('Too few distinct distractors')
  return [...options.values()]
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .slice(0, total)
    .sort((a, b) => a.order - b.order)
    .map(item => item.option)
}

const difficulty = ['Warm-up', 'Observation', 'Reasoning', 'Advanced', 'Master puzzle']
const presentationKinds = { badge: 'symbol', letters: 'row', blocks: 'count' }

export function compilePuzzle(source, id, index, { requireEvidence = false } = {}) {
  const { category, input, inputs, rule, correctSlot, hint, explanation, presentation, revision = 1, choiceCount } = source
  if (!category?.trim() || !hint?.trim() || !explanation?.trim()) throw new Error('Missing puzzle copy')
  if (!Number.isInteger(revision) || revision < 1) throw new Error('Invalid puzzle revision')
  if (presentation && presentationKinds[presentation] !== input.kind) throw new Error('Invalid presentation')
  const examples = inputs.map(example => ({ input: example, output: apply(example, rule) }))
  const library = candidates(input.kind)
  const answer = validateAnswer({ examples, input, rule }, library)
  if (requireEvidence) validateEvidence(examples, input, rule)
  const total = choiceCount ?? (index < 3 ? 6 : 9)
  if (![4, 6, 9].includes(total)) throw new Error('Invalid answer choice count')
  if (!Number.isInteger(correctSlot) || correctSlot < 0 || correctSlot >= total) throw new Error('Invalid correct choice position')

  const options = distractors(input, answer, library, id, total - 1)
  options.splice(correctSlot, 0, answer)
  const choices = options.map((scene, index) => ({ id: String.fromCharCode(65 + index), scene }))
  return {
    id, revision, category, difficulty: difficulty[index], examples, input, choices,
    correct: choices[correctSlot].id, hint, explanation, ...(presentation ? { presentation } : {}),
  }
}

export function compileCatalog(sets, { requireVariety = false, requireEvidence = false } = {}) {
  const ids = new Set()
  return sets.map(({ id, puzzles, revision = 1 }) => {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) throw new Error(`Invalid or duplicate set ID: ${id}`)
    if (!Number.isInteger(revision) || revision < 1) throw new Error(`Invalid set revision in ${id}`)
    ids.add(id)
    if (puzzles.length !== 5 || new Set(puzzles.map(puzzle => puzzle.category)).size < 4) {
      throw new Error(`Expected five puzzles across at least four categories in ${id}`)
    }
    if (requireVariety && new Set(puzzles.map(puzzle => puzzle.presentation ?? puzzle.input.kind)).size !== puzzles.length) {
      throw new Error(`Repeated visual format in ${id}`)
    }
    return {
      id, revision,
      puzzles: puzzles.map((source, i) => {
        const puzzleId = `${id}-${i + 1}`
        try { return compilePuzzle(source, puzzleId, i, { requireEvidence }) }
        catch (error) { throw new Error(`${puzzleId}: ${error.message}`, { cause: error }) }
      }),
    }
  })
}
