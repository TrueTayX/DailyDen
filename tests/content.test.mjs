import assert from 'node:assert/strict'
import test from 'node:test'
import { authoredSets, variedSets } from '../content/authored.mjs'
import { workshopSets } from '../content/workshop.mjs'
import { compileCatalog, validateAnswer } from '../src/engine/compile.mjs'
import { apply, sceneKey } from '../src/engine/rules.mjs'

const r = (op, ...args) => ({ op, args })
const symbol = (shape, color, dots) => ({ kind: 'symbol', shape, color, dots })
const arrow = (direction, flag) => ({ kind: 'arrow', direction, flag })
const equation = (blue, red, gold = 0) => ({ kind: 'equation', tokens: [blue, red, gold] })
const pairs = (inputs, rule) => inputs.map(input => ({ input, output: apply(input, rule) }))

test('each set has five puzzles with unique choices and a matching answer', () => {
  const sets = compileCatalog(authoredSets)
  assert.equal(sets.length, 4)
  assert.equal(new Set(sets.flatMap(set => set.puzzles.map(puzzle => puzzle.category))).size, 6)
  for (const [setIndex, set] of sets.entries()) {
    assert.equal(set.puzzles.length, 5)
    for (const [index, puzzle] of set.puzzles.entries()) {
      const { choices, correct, input } = puzzle
      assert.equal(choices.length, index < 3 ? 6 : 9)
      assert.equal(new Set(choices.map(choice => sceneKey(choice.scene))).size, choices.length)
      const expected = apply(input, authoredSets[setIndex].puzzles[index].rule)
      assert.equal(choices.filter(choice => sceneKey(choice.scene) === sceneKey(expected)).length, 1)
      assert.equal(sceneKey(choices.find(choice => choice.id === correct).scene), sceneKey(expected))
    }
  }
})

test('alternative interpretations are rejected before choices are generated', () => {
  const rule = r('if', ['even'], r('color', 1), r('dots', 1))
  const input = symbol('circle', 'amber', 3)
  const ambiguous = [symbol('circle', 'violet', 2), symbol('triangle', 'teal', 1), symbol('circle', 'teal', 4)]
  assert.throws(() => validateAnswer({ examples: pairs(ambiguous, rule), input, rule }), /Ambiguous challenge/)
  const corrected = [...ambiguous, symbol('circle', 'violet', 3)]
  assert.deepEqual(validateAnswer({ examples: pairs(corrected, rule), input, rule }), symbol('circle', 'amber', 4))
})

test('different rules can be accepted when their predictions agree', () => {
  const mirror = r('mirrorArrow', 0)
  const equivalent = r('then', r('turn', 2), r('mirrorArrow', 2))
  const examples = pairs([arrow(0, 1), arrow(1, -1), arrow(2, 1)], mirror)
  assert.deepEqual(validateAnswer({ examples, input: arrow(3, 1), rule: mirror }, [mirror, equivalent]), arrow(1, -1))
})

test('new daily sets have five distinct visual formats', () => {
  const sets = compileCatalog(variedSets, { requireVariety: true })
  for (const set of sets) {
    assert.equal(new Set(set.puzzles.map(puzzle => puzzle.presentation ?? puzzle.input.kind)).size, 5)
  }
  assert.throws(() => compileCatalog(authoredSets, { requireVariety: true }), /Repeated visual format/)
  const sample = sets[0].puzzles[2]
  assert.deepEqual(sample.examples[0], { input: equation(1, 3), output: { kind: 'number', value: 7 } })
  assert.deepEqual(sample.choices.find(choice => choice.id === sample.correct).scene, { kind: 'number', value: 4 })
})

test('weighted totals reject examples that leave different challenge answers', () => {
  const rule = r('weights', [4, 1, 0], 0)
  const inputs = [equation(1, 1), equation(2, 2), equation(3, 3)]
  assert.throws(() => validateAnswer({ examples: pairs(inputs, rule), input: equation(2, 1), rule }), /Ambiguous challenge/)
})

test('workshop and routes expand the rotation to twelve puzzle types with distinct daily formats', () => {
  const sets = compileCatalog([...workshopSets, ...variedSets], { requireVariety: true })
  assert.equal(new Set(sets.flatMap(set => set.puzzles.map(puzzle => puzzle.category))).size, 12)
  for (const set of sets) {
    assert.equal(new Set(set.puzzles.map(puzzle => puzzle.presentation ?? puzzle.input.kind)).size, 5)
  }
  const answers = set => set.puzzles.map(puzzle => puzzle.choices.find(choice => choice.id === puzzle.correct).scene)
  assert.deepEqual(answers(sets[0]).slice(1), [
    { kind: 'towers', items: [1, 2, 3, 4] },
    { kind: 'strip', length: 8, seam: 4 },
    { kind: 'mosaic', mask: 0x853a },
    { kind: 'beads', items: ['red', 'gold', 'green'] },
  ])
  assert.deepEqual(answers(sets[1])[1], { kind: 'exit', index: 6 })
  assert.deepEqual(answers(sets[1])[3], { kind: 'towers', items: [2, 1, 3, 4] })
})

test('the master bead puzzle can distinguish the two operations in reverse order', () => {
  const puzzle = workshopSets[0].puzzles[4]
  const [first, second] = puzzle.rule.args
  const reversed = r('then', second, first)
  assert.notDeepEqual(apply(puzzle.input, puzzle.rule), apply(puzzle.input, reversed))
  assert.ok(puzzle.inputs.some(input => sceneKey(apply(input, puzzle.rule)) !== sceneKey(apply(input, reversed))))
})

test('overlay examples must distinguish canceling a shared tile from keeping it', () => {
  const overlay = (left, right) => ({ kind: 'overlay', left, right })
  const rule = r('combineLayers', 'exclusive', 0, 0)
  const disjoint = [overlay(0b0001, 0b0010), overlay(0b0100, 0b0001), overlay(0b0011, 0b1100)]
  assert.throws(() => validateAnswer({ examples: pairs(disjoint, rule), input: overlay(0b0011, 0b0101), rule }), /Ambiguous challenge/)
})
