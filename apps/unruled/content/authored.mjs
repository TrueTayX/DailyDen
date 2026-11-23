const r = (op, ...args) => ({ op, args })
const symbol = (shape, color, dots) => ({ kind: 'symbol', shape, color, dots })
const arrow = (direction, flag) => ({ kind: 'arrow', direction, flag })
const count = value => ({ kind: 'count', value })
const row = (...items) => ({ kind: 'row', items: items.map(item => ({ o: 'circle', q: 'square', t: 'triangle', d: 'diamond', s: 'star' })[item]) })
const grid = (dx, dy, cx, cy) => ({ kind: 'grid', diamond: [dx, dy], circle: [cx, cy] })

function puzzle(category, rule, inputs, input, correctSlot, hint, explanation) {
  return { category, rule, inputs, input, correctSlot, hint, explanation }
}

export const authoredSets = [
  {
    id: 'first-light', puzzles: [
      puzzle('Objects', r('color', 1),
        [symbol('circle', 'violet', 1), symbol('triangle', 'teal', 3), symbol('square', 'amber', 2)],
        symbol('square', 'violet', 2), 4,
        'Watch the color markers. The outline and dot count stay the same.',
        'The colors cycle from violet to teal to amber and back to violet. The outline and dots stay the same.'),
      puzzle('Geometry', r('turn', 1),
        [arrow(0, -1), arrow(1, 1), arrow(2, -1)],
        arrow(3, 1), 1,
        'Follow the small flag as well as the direction of the arrow.',
        'The entire arrow turns a quarter turn clockwise, including its flag. The left-pointing arrow ends up pointing up.'),
      puzzle('Counting', r('then', r('multiply', 2), r('add', 1)),
        [count(1), count(3), count(5)],
        count(4), 5,
        'Compare how fast the outputs grow. Then account for the extra dot.',
        'Double the input count and add one. Four dots become nine.'),
      puzzle('Conditions', r('if', ['even'], r('color', 1), r('dots', 1)),
        [symbol('circle', 'violet', 2), symbol('circle', 'teal', 1), symbol('triangle', 'teal', 4), symbol('triangle', 'violet', 3)],
        symbol('square', 'amber', 3), 7,
        'Split the examples into groups based on their dot counts.',
        'Even counts advance one color in the cycle. Odd counts gain one dot and keep their color. Three is odd, so the amber square gains a fourth dot.'),
      puzzle('Grid movement', r('then', r('turnGrid', 1), r('move', 1, 0, 'wrap')),
        [grid(0, 0, 1, 1), grid(2, 0, 2, 2), grid(0, 2, 1, 0), grid(2, 1, 1, 2)],
        grid(0, 1, 2, 0), 2,
        'First rotate the whole board. Track what happens when the next move reaches an edge.',
        'Rotate the board a quarter turn clockwise, then move both markers one column right. Markers that pass the right edge reappear in the left column.'),
    ],
  },
  {
    id: 'turning-point', puzzles: [
      puzzle('Objects', r('dots', 1),
        [symbol('triangle', 'teal', 0), symbol('circle', 'amber', 2), symbol('square', 'violet', 3)],
        symbol('circle', 'violet', 1), 0,
        'Count the dots before and after.',
        'Each token gains exactly one dot. The outline and color stay the same.'),
      puzzle('Grid movement', r('move', 0, -1, 'wrap'),
        [grid(1, 0, 2, 2), grid(0, 2, 1, 1), grid(2, 0, 0, 1)],
        grid(0, 0, 2, 1), 5,
        'Track markers that start in the top row.',
        'Both markers move up one row. A marker that starts at the top wraps to the bottom of the same column.'),
      puzzle('Sequences', r('then', r('reverse'), r('swap', 0, 2)),
        [row('t', 'q', 'o', 's', 'd'), row('s', 'o', 'q', 'd', 't'), row('d', 'q', 's', 's', 't')],
        row('o', 't', 'q', 'd', 's'), 2,
        'Start by reading the input from right to left.',
        'Reverse the row, then swap the first and third symbols from the left.'),
      puzzle('Conditions', r('if', ['shape', 'triangle'], r('dots', -1), r('color', -1)),
        [symbol('triangle', 'teal', 2), symbol('circle', 'teal', 2), symbol('triangle', 'amber', 3), symbol('square', 'violet', 3)],
        symbol('triangle', 'violet', 4), 4,
        'Compare tokens with the same number of dots but different outlines.',
        'Triangles lose a dot. Other outlines step back one color in the cycle. The violet triangle loses a dot and keeps its color.'),
      puzzle('Grid movement', r('then', r('moveOne', 'diamond', 0, -1, 'wrap'), r('mirrorGrid', 0)),
        [grid(0, 0, 1, 0), grid(2, 1, 0, 2), grid(1, 2, 2, 2), grid(1, 0, 0, 1)],
        grid(2, 0, 0, 2), 8,
        'The diamond takes an extra step. Then both markers have something in common.',
        'Move the diamond up one row, wrapping from top to bottom. Then mirror the board left to right, keeping each marker in its row.'),
    ],
  },
  {
    id: 'inside-out', puzzles: [
      puzzle('Objects', r('shape', 1),
        [symbol('circle', 'teal', 2), symbol('square', 'violet', 1), symbol('triangle', 'amber', 3)],
        symbol('square', 'amber', 2), 3,
        'Follow the outer outline through all three examples.',
        'The outline cycles from circle to square to triangle and back to circle. Color and dot count stay the same.'),
      puzzle('Geometry', r('mirrorArrow', 0),
        [arrow(0, 1), arrow(1, -1), arrow(2, 1)],
        arrow(3, -1), 4,
        'Imagine folding the card along a vertical line through its center.',
        'Mirror the whole arrow left to right. Up and down stay facing the same direction, while left and right trade places. The flag flips sides.'),
      puzzle('Counting', r('then', r('add', -1), r('multiply', 3)),
        [count(2), count(4), count(6)],
        count(3), 0,
        'Think about taking away one dot before making copies.',
        'Take away one dot, then triple the remaining count. Three becomes two, and two triples to six.'),
      puzzle('Conditions', r('if', ['color', 'teal'], r('shape', 1), r('dots', 1)),
        [symbol('triangle', 'teal', 2), symbol('triangle', 'violet', 1), symbol('circle', 'teal', 3), symbol('square', 'amber', 4)],
        symbol('square', 'teal', 4), 1,
        'Sort the examples by the color marker below each token.',
        'Teal tokens advance their outline from circle to square to triangle to circle. All other colors gain a dot. The teal square becomes a triangle with four dots.'),
      puzzle('Sequences', r('then', r('swap', 1, 4), r('shift', 2)),
        [row('q', 't', 'o', 'd', 's'), row('s', 'o', 'd', 'q', 't'), row('o', 'd', 'o', 's', 't')],
        row('t', 's', 'q', 'o', 'd'), 6,
        'Find the two positions that trade places before the whole row shifts.',
        'Swap the second and fifth positions, then shift the whole row two spaces right. Symbols that pass the end wrap to the front.'),
    ],
  },
  {
    id: 'second-look', puzzles: [
      puzzle('Objects', r('color', -1),
        [symbol('square', 'teal', 3), symbol('triangle', 'violet', 1), symbol('circle', 'amber', 2)],
        symbol('triangle', 'amber', 2), 2,
        'Follow the color of each pair and look for a repeating cycle.',
        'The colors cycle from amber to teal to violet and back to amber. The outline and dots stay the same.'),
      puzzle('Sequences', r('shift', -1),
        [row('o', 'q', 't', 'd'), row('d', 's', 'q', 'o'), row('s', 's', 't', 'q')],
        row('t', 'o', 's', 'q'), 3,
        'Watch where the first symbol goes in each pair.',
        'Shift the row one position left. The first symbol wraps around to the last position.'),
      puzzle('Geometry', r('then', r('turn', 1), r('flipFlag')),
        [arrow(0, 1), arrow(1, 1), arrow(3, -1)],
        arrow(2, 1), 1,
        'Track the direction first. Then check which side of the arrow holds its flag.',
        'Turn the arrow a quarter turn clockwise, then switch the flag to the other side of the arrow. Down becomes left and the flag switches sides.'),
      puzzle('Conditions', r('if', ['even'], r('half'), r('add', 3)),
        [count(2), count(3), count(6), count(5)],
        count(8), 6,
        'Look separately at the inputs that pair up evenly and those with a dot left over.',
        'Even counts are cut in half. Odd counts gain three dots. Eight is even, so the answer has four dots.'),
      puzzle('Grid movement', r('then', r('turnGrid', 3), r('moveOne', 'circle', 1, 0, 'wrap')),
        [grid(0, 0, 2, 1), grid(2, 2, 0, 2), grid(1, 0, 2, 2), grid(1, 1, 0, 0)],
        grid(2, 0, 1, 2), 3,
        'Compare both markers after a turn. Only one marker moves again.',
        'Turn the whole board a quarter turn counterclockwise. Then shift only the circle one column right, wrapping it to the left if it passes the edge.'),
    ],
  },
]

const equation = (blue, red, gold = 0) => ({ kind: 'equation', tokens: [blue, red, gold] })
const letterTiles = puzzle => ({ ...puzzle, presentation: 'letters' })
const blockStacks = puzzle => ({
  ...puzzle, presentation: 'blocks',
  hint: puzzle.hint.replaceAll('dot', 'block'), explanation: puzzle.explanation.replaceAll('dot', 'block'),
})
const codeBadge = (puzzle, hint, explanation) => ({ ...puzzle, presentation: 'badge', hint, explanation })

const [firstLight, turningPoint, insideOut, secondLook] = authoredSets.map(set => set.puzzles)

export const variedSets = [
  {
    id: 'variety-first-light', puzzles: [
      firstLight[0],
      firstLight[1],
      puzzle('Counting', r('weights', [4, 1, 0], 0),
        [equation(1, 3), equation(2, 1), equation(1, 1)],
        equation(1, 0), 5,
        'Compare the two equations that each have one blue token.',
        'One blue and three red tokens total 7. One blue and one red total 5. The two extra red tokens are worth 2, so each red is worth 1. That leaves 4 for one blue token.'),
      codeBadge(firstLight[3],
        'Split the badges into groups based on whether the number is even or odd.',
        'Even numbers advance one color in the Violet → Teal → Amber cycle. Odd numbers increase by one. The amber B badge changes from 3 to 4.'),
      firstLight[4],
    ],
  },
  {
    id: 'variety-turning-point', puzzles: [
      turningPoint[0],
      turningPoint[1],
      letterTiles(turningPoint[2]),
      codeBadge(turningPoint[3],
        'Compare badges with the same number but different letters.',
        'C badges lose one. All other badges move one color backward in the Violet → Teal → Amber cycle. The violet C goes from 4 to 3 and keeps its color.'),
      puzzle('Counting', r('weights', [4, 2, 5], 0),
        [equation(1, 2), equation(2, 1), equation(0, 1, 2), equation(1, 1, 1)],
        equation(2, 3, 1), 8,
        'Add the two equations with blue and red tokens only. How many of each token are in that sum?',
        'The first two equations together give three blue and three red for 18, so blue plus red is 6. The mixed equation then gives gold as 5. The two gold tokens and one red total 12, so red is 2 and blue is 4. Two blue, three red, and one gold total 19.'),
    ],
  },
  {
    id: 'variety-inside-out', puzzles: [
      insideOut[0],
      insideOut[1],
      blockStacks(insideOut[2]),
      codeBadge(insideOut[3],
        'Sort the badges by their color labels.',
        'Teal badges cycle their letter from A to B to C and back to A. Badges of other colors increase their number by one. Teal B4 becomes teal C4.'),
      letterTiles(insideOut[4]),
    ],
  },
  {
    id: 'variety-second-look', puzzles: [
      secondLook[0],
      letterTiles(secondLook[1]),
      secondLook[2],
      blockStacks(secondLook[3]),
      secondLook[4],
    ],
  },
]
