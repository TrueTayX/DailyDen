const rule = (op, ...args) => ({ op, args })
const symbol = (shape, color, dots) => ({ kind: 'symbol', shape, color, dots })
const towers = (...items) => ({ kind: 'towers', items })
const beads = (...items) => ({ kind: 'beads', items })
const splice = (left, right) => ({ kind: 'splice', left, right })
const route = signals => ({ kind: 'path', signals: [...signals].map(Number) })
const equation = (blue, red) => ({ kind: 'equation', tokens: [blue, red, 0] })
const grid = (dx, dy, cx, cy) => ({ kind: 'grid', diamond: [dx, dy], circle: [cx, cy] })

function bits(pattern) {
  if (!/^[.#]{4}(\/[.#]{4}){3}$/.test(pattern)) throw new Error(`Invalid 4×4 layer: ${pattern}`)
  return [...pattern.replaceAll('/', '')].reduce((mask, cell, index) => cell === '#' ? mask | (1 << index) : mask, 0)
}

const overlay = (left, right) => ({ kind: 'overlay', left: bits(left), right: bits(right) })

export const workshopSets = [
  {
    id: 'workshop', puzzles: [
      {
        category: 'Objects',
        rule: rule('then', rule('color', 1), rule('dots', 1)),
        inputs: [symbol('square', 'teal', 0), symbol('circle', 'amber', 2), symbol('triangle', 'violet', 1)],
        input: symbol('triangle', 'amber', 3), correctSlot: 1,
        hint: 'The outline stays the same. Track both the color bars and the dots.',
        explanation: 'Cycle the colors from violet to teal to amber and back to violet, and add one dot. The amber triangle becomes violet with four dots.',
      },
      {
        category: 'Hidden sorting',
        rule: rule('sortHeight', 1),
        inputs: [towers(3, 1, 4, 2), towers(2, 4, 3, 1), towers(4, 2, 1, 3)],
        input: towers(3, 4, 1, 2), correctSlot: 2,
        hint: 'Compare the heights of the towers in each output.',
        explanation: 'Order the towers by height, from the shortest on the left to the tallest on the right.',
      },
      {
        category: 'Combining objects',
        rule: rule('joinStrips', 'sum', -1, 'left', 0),
        inputs: [splice(2, 4), splice(4, 2), splice(3, 5)],
        input: splice(4, 5), correctSlot: 4,
        hint: 'In the outputs, the crosshatched tile is shared by both strips. Count it only once.',
        explanation: 'Put the teal strip first, then slide the violet strip over its last tile. That shared tile is crosshatched. A four-tile strip and a five-tile strip make eight tiles, with the join at tile four.',
      },
      {
        category: 'Overlay and subtraction',
        rule: rule('combineLayers', 'exclusive', 0, 0),
        inputs: [
          overlay('#.../##../...#/....', '.#.#/#.../...#/..#.'),
          overlay('.#../..##/..#./#...', '#.../..#./.##./.##.'),
          overlay('##../..#./...#/#.#.', '#.#./.##./...#/.##.'),
        ],
        input: overlay('.##./#..#/..#./.#..', '..##/.#.#/#.../.#.#'), correctSlot: 7,
        hint: 'Pick a tile that is filled on both layers. Is it still filled in the output?',
        explanation: 'Line up the two layers without turning them. Fill a tile when exactly one layer has it filled. Tiles filled on both layers cancel out, as do the empty tiles.',
      },
      {
        category: 'Multi-stage transformations',
        rule: rule('then', rule('shiftItems', 1), rule('recolorBeads', 'red', 'blue', 0b011)),
        inputs: [beads('red', 'green', 'gold'), beads('blue', 'gold', 'red'), beads('green', 'red', 'blue'), beads('gold', 'green', 'red')],
        input: beads('gold', 'green', 'blue'), correctSlot: 3,
        hint: 'Follow which bead takes the first position. Then see where red and blue change.',
        explanation: 'Move the last bead to the front. Then swap red and blue in the first two positions only. Gold, green, blue becomes red, gold, green.',
      },
    ],
  },
  {
    id: 'routes', puzzles: [
      {
        category: 'Objects',
        rule: rule('shape', -1),
        inputs: [symbol('circle', 'amber', 3), symbol('square', 'teal', 0), symbol('triangle', 'violet', 2)],
        input: symbol('circle', 'violet', 4), correctSlot: 2,
        hint: 'The colors and numbers stay put. Follow the outlines.',
        explanation: 'Circle becomes triangle, triangle becomes square, and square becomes circle. The violet circle becomes a violet triangle and keeps all four dots.',
      },
      {
        category: 'Path tracing',
        rule: rule('followSignals', 0, 1, 0),
        inputs: [route('0110101'), route('1001010'), route('0011100'), route('1100111')],
        input: route('1011010'), correctSlot: 0,
        hint: 'Start at the arrow on the left. Compare which branch the violet diamond and amber cross send you down.',
        explanation: 'At a violet diamond, take the upper branch. At an amber cross, take the lower branch. The challenge goes lower, lower, then upper, so it reaches exit G.',
      },
      {
        category: 'Counting',
        rule: rule('weights', [2, 1, 0], 0),
        inputs: [equation(2, 1), equation(1, 3), equation(3, 2), equation(2, 3)],
        input: equation(4, 1), correctSlot: 5,
        hint: 'Compare the two equations with two blue tokens.',
        explanation: 'Changing from one red to three red adds two to the total, so red is worth one. Two blue and one red total five, so blue is worth two. Four blue and one red total nine.',
      },
      {
        category: 'Relationships',
        rule: rule('then', rule('swapHeights', 1, 4), rule('shiftItems', 1)),
        inputs: [towers(1, 2, 4, 3), towers(3, 4, 2, 1), towers(2, 1, 3, 4)],
        input: towers(4, 3, 1, 2), correctSlot: 6,
        hint: 'Mentally move the output’s first tower to the end. Which heights have traded places?',
        explanation: 'The shortest and tallest towers trade positions. Then move the last tower to the front. From left to right, the new heights are 2, 1, 3, and 4.',
      },
      {
        category: 'Grid movement',
        rule: rule('then', rule('turnGrid', 2), rule('moveOne', 'circle', 0, 1, 'wrap')),
        inputs: [grid(0, 0, 1, 0), grid(1, 2, 2, 1), grid(2, 0, 0, 1), grid(1, 1, 2, 2)],
        input: grid(0, 2, 2, 0), correctSlot: 3,
        hint: 'Use the diamond to work out what the whole board does first.',
        explanation: 'Turn the whole board halfway around, then move only the circle one row down. If it passes the bottom edge, it wraps to the top of the same column.',
      },
    ],
  },
]
