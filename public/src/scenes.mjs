import { workshopScenes } from './workshop-scenes.mjs'

const colors = {
  violet: ['#6444c2', '#ede6fc', 1],
  teal: ['#13746c', '#dff5ee', 2],
  amber: ['#985900', '#fff0cb', 3],
}

const outlines = {
  circle: '<circle cx="0" cy="0" r="19"/>',
  square: '<rect x="-18" y="-18" width="36" height="36" rx="4"/>',
  triangle: '<path d="M0-21 21 17H-21Z" stroke-linejoin="round"/>',
  diamond: '<path d="M0-21 19 0 0 21-19 0Z" stroke-linejoin="round"/>',
  star: '<path d="m0-21 6.2 13 14.3 2.1L10.2 4l2.4 14.3L0 11.6l-12.6 6.7L-10.2 4-20.5-5.9-6.2-8Z" stroke-linejoin="round"/>',
}

const pips = [
  [], [[0, 0]], [[-5, 0], [5, 0]], [[-5, 3], [5, 3], [0, -5]],
  [[-4, -4], [4, -4], [-5, 5], [5, 5]], [[-5, -5], [5, -5], [0, 0], [-6, 6], [6, 6]],
]

function form(shape, x, y, scale, fill, stroke) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}" stroke="${stroke}" stroke-width="2.8">${outlines[shape]}</g>`
}

function dot(x, y, radius, fill) {
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}"/>`
}

function symbol(scene) {
  const [ink, fill, bars] = colors[scene.color]
  const y = scene.shape === 'triangle' ? 27 : 25
  const pipMarks = pips[scene.dots].map(([dx, dy]) => dot(32 + dx, y + dy, 2.15, ink)).join('')
  const colorMarks = Array.from({ length: bars }, (_, i) => {
    const x = 32 + (i - (bars - 1) / 2) * 5
    return `<path d="M${x} 51v4" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`
  }).join('')
  const name = `${scene.color} ${scene.shape}, ${scene.dots} ${scene.dots === 1 ? 'dot' : 'dots'}`
  return ['0 0 64 62', form(scene.shape, 32, 25, 1, fill, ink) + pipMarks + colorMarks, name]
}

function arrow(scene) {
  const side = scene.flag === -1 ? 'left' : 'right'
  const marks = `<g transform="translate(32 31) rotate(${scene.direction * 90})">
    <path d="M0-21 13-5H5.5v21h-11V-5H-13Z" fill="#ede6fc" stroke="#6444c2" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M${scene.flag * 5.5} 5h${scene.flag * 10}v8h${scene.flag * -10}" fill="#6444c2" stroke="#6444c2" stroke-width="1.6" stroke-linejoin="round"/>
  </g>`
  return ['0 0 64 62', marks, `Arrow pointing ${['up', 'right', 'down', 'left'][scene.direction]}, flag on its ${side} relative to its direction`]
}

function count(scene) {
  if (scene.value === 0) return ['0 0 76 62', '<circle cx="38" cy="31" r="9" fill="none" stroke="#a19ab1" stroke-width="2" stroke-dasharray="3 3"/>', 'No dots']
  const columns = Math.min(scene.value, 6)
  const rows = Math.ceil(scene.value / columns)
  const marks = Array.from({ length: scene.value }, (_, i) => {
    const row = Math.floor(i / columns)
    const rowLength = Math.min(columns, scene.value - row * columns)
    return dot(38 + ((i % columns) - (rowLength - 1) / 2) * 10, 31 + (row - (rows - 1) / 2) * 10, 3.35, '#6444c2')
  }).join('')
  return ['0 0 76 62', marks, `${scene.value} ${scene.value === 1 ? 'dot' : 'dots'}`]
}

const tokenColors = { circle: 'teal', square: 'violet', triangle: 'amber', diamond: 'teal', star: 'violet' }

function row(scene) {
  const marks = scene.items.map((item, i) => {
    const [ink, fill] = colors[tokenColors[item]]
    return form(item, 12 + i * 22, 18, 0.39, fill, ink)
  }).join('')
  return [`0 0 ${scene.items.length * 22 + 2} 36`, marks, `From left to right: ${scene.items.join(', ')}`]
}

function grid(scene) {
  const cell = ([x, y]) => [12 + x * 20, 12 + y * 20]
  const position = ([x, y]) => `row ${y + 1}, column ${x + 1}`
  const frame = '<rect x="2" y="2" width="60" height="60" rx="4" fill="white" fill-opacity=".64"/><path d="M22 2v60M42 2v60M2 22h60M2 42h60" stroke="#d8d2e8"/><rect x="2" y="2" width="60" height="60" rx="4" fill="none" stroke="#aca2c1" stroke-width="1.5"/>'
  const marks = form('diamond', ...cell(scene.diamond), 0.32, '#e8defa', '#6444c2')
    + form('circle', ...cell(scene.circle), 0.32, '#fff0cb', '#985900')
  return ['0 0 64 64', frame + marks, `Diamond at ${position(scene.diamond)}. Circle at ${position(scene.circle)}.`]
}

function badge(scene) {
  const [ink, fill] = colors[scene.color]
  const letter = { circle: 'A', square: 'B', triangle: 'C' }[scene.shape]
  const label = scene.color.toUpperCase()
  const marks = `<rect x="1" y="4" width="76" height="44" rx="8" fill="${fill}" stroke="${ink}"/>
    <path d="M6 38H72" stroke="${ink}" stroke-opacity=".32"/>
    <text x="39" y="31" text-anchor="middle" fill="${ink}" font-size="24" font-weight="800">${letter}${scene.dots}</text>
    <text x="39" y="45" text-anchor="middle" fill="${ink}" font-size="8" font-weight="800" letter-spacing=".8">${label}</text>`
  return ['0 0 78 52', marks, `${scene.color} badge, letter ${letter}, number ${scene.dots}`]
}

function letters(scene) {
  const symbols = scene.items.map(item => ({ circle: 'A', square: 'B', triangle: 'C', diamond: 'D', star: 'E' })[item])
  const marks = symbols.map((letter, i) => `<g transform="translate(${i * 24 + 1} 0)">
    <rect x="0" y="5" width="21" height="24" rx="3" fill="#e9f1ee" stroke="#6a9087"/>
    <text x="10.5" y="21.5" text-anchor="middle" fill="#214e48" font-size="13" font-weight="800">${letter}</text>
  </g>`).join('')
  return [`0 0 ${symbols.length * 24} 34`, marks, `Letter tiles from left to right: ${symbols.join(', ')}`]
}

function blocks(scene) {
  const marks = Array.from({ length: 18 }, (_, i) => {
    const x = 3 + Math.floor(i / 6) * 24
    const y = 50 - (i % 6) * 8
    const filled = i < scene.value
    return `<rect x="${x}" y="${y}" width="21" height="7" rx="1.5" fill="${filled ? '#237a77' : '#e3edea'}"/>`
  }).join('')
  return ['0 0 77 62', marks, `${scene.value} ${scene.value === 1 ? 'block' : 'blocks'}`]
}

const coinColors = ['blue', 'red', 'gold']

function equation(scene) {
  const groups = scene.tokens.map((total, index) => {
    if (!total) return null
    const color = coinColors[index]
    const chips = `<span class="coin coin--${color}">${color[0].toUpperCase()}</span>`.repeat(total)
    return { label: `${total} ${color} ${total === 1 ? 'token' : 'tokens'}`, chips: `<span class="coin-group">${chips}</span>` }
  }).filter(Boolean)
  const chips = groups.map(group => group.chips).join('<span class="equation-plus">+</span>')
  return [null, `<span class="equation-expression" aria-hidden="true">${chips}</span>`, groups.map(group => group.label).join(' plus ')]
}

function number(scene) {
  return [null, `<span class="equation-number" aria-hidden="true">${scene.value}</span>`, String(scene.value)]
}

const renderers = { symbol, arrow, count, row, grid, badge, letters, blocks, equation, number, ...workshopScenes }

export function sceneView(scene, presentation = scene.kind) {
  const [box, marks, label] = renderers[presentation](scene)
  const element = document.createElement('span')
  element.className = `scene scene--${presentation}`
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', label)
  element.innerHTML = box ? `<svg viewBox="${box}" aria-hidden="true" focusable="false">${marks}</svg>` : marks
  return element
}
