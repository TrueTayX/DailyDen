// Each family is a union of data-defined components. The self flag wins even if a component includes the center.
const offsets = (...offsets) => ({ type: 'offsets', offsets })
const line = line => ({ type: 'line', line })
const mirror = mirror => ({ type: 'mirror', mirror })
const cross = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const knights = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const ring = [...cross, ...diagonals]
const twice = points => points.map(([r, c]) => [r * 2, c * 2])
const family = (name, tag, self, ...components) => ({ name, tag: tag[0], giveaway: tag.includes('G'), self, components })

export const STAMPS = [
  family('self-only', 'E', true),
  family('domino-right', 'E', true, offsets([0, 1])),
  family('domino-down', 'E', true, offsets([1, 0])),
  family('horizontal-trio', 'E', true, offsets([0, -1], [0, 1])),
  family('vertical-trio', 'E', true, offsets([-1, 0], [1, 0])),
  family('diagonal-pair', 'S', true, offsets([1, 1])),
  family('l-shape', 'S', true, offsets([1, 0], [1, 1])),
  family('right-and-below', 'S', true, offsets([0, 1], [1, 0])),
  family('up-and-right', 'S', true, offsets([-1, 0], [0, 1])),
  family('plus', 'E', true, offsets(...cross)),
  family('hollow-plus', 'S', false, offsets(...cross)),
  family('x-diagonals', 'S', true, offsets(...diagonals)),
  family('hollow-x', 'S', false, offsets(...diagonals)),
  family('square', 'S', true, offsets(...ring)),
  family('ring', 'A', false, offsets(...ring)),
  family('skip-2-plus', 'S', true, offsets(...twice(cross))),
  family('skip-2-x', 'S', true, offsets(...twice(diagonals))),
  family('knight-with-self', 'A', true, offsets(...knights)),
  family('knight-only', 'A', false, offsets(...knights)),
  family('distance-2-diamond', 'A', true, offsets(...twice(cross), ...diagonals)),
  family('row', 'EG', true, line('row')),
  family('column', 'EG', true, line('col')),
  family('row-without-self', 'SG', false, line('row')),
  family('full-cross', 'SG', true, line('row'), line('col')),
  family('diagonal-line', 'S', true, line('diag')),
  family('anti-diagonal-line', 'S', true, line('anti')),
  family('both-diagonals', 'A', true, line('diag'), line('anti')),
  family('mirror-180', 'SG', true, mirror('rot180')),
  family('mirror-horizontal', 'SG', true, mirror('horizontal')),
  family('mirror-vertical', 'SG', true, mirror('vertical')),
  family('transpose-partner', 'AG', true, mirror('transpose')),
  family('quad-mirror', 'AG', true, mirror('quad')),
  family('rotation-group', 'AG', true, mirror('rot90group')),
]
