const beadColors = {
  red: ['R', '#9f2748', '#d84868', '#ffe3eb'],
  blue: ['B', '#204c97', '#417cce', '#dceeff'],
  green: ['G', '#176549', '#329873', '#ddf8e9'],
  gold: ['Y', '#966313', '#cc9028', '#ffefcd'],
}

function towers({ items }) {
  const marks = items.map((height, index) => {
    const x = 9 + index * 25
    const y = 52 - (height * 6.5 + 7)
    return `<path d="M${x} ${y}h13v${52 - y}H${x}Z" fill="#396980"/>
      <path d="M${x + 13} ${y}l5-4v${52 - y}l-5 4Z" fill="#23485d"/>
      <path d="M${x} ${y}l5-4h13l-5 4Z" fill="#8bb5c6"/>
      <path d="M${x + 3} ${y + 4}v${46 - y}" stroke="#b6d3df" stroke-opacity=".7" stroke-linecap="round"/>`
  }).join('')
  return ['0 0 110 61', '<path d="M5 53h100" stroke="#b9c3be" stroke-width="1.2" stroke-linecap="round"/>' + marks,
    `Tower heights from left to right: ${items.join(', ')} units`]
}

const stripColors = {
  teal: ['#316f69', '#dcf1ea'],
  violet: ['#6949a7', '#ede1f9'],
  seam: ['#8e5b0b', '#ffe0a1'],
}

function stripTiles(length, y, colorAt) {
  const tile = 13
  const left = (164 - length * tile) / 2
  return Array.from({ length }, (_, index) => {
    const x = left + index * tile
    const color = colorAt(index + 1)
    const [ink, fill] = stripColors[color]
    const seam = color === 'seam'
      ? `<path d="m${x + 2.5} ${y + 4} 7 8m0-8-7 8" stroke="${ink}" stroke-width="1.3" stroke-linecap="round"/>`
      : `<path d="M${x + 2} ${y + 3}h8" stroke="#fff" stroke-opacity=".8" stroke-linecap="round"/>`
    return `<rect x="${x}" y="${y}" width="12" height="16" rx="1.7" fill="${fill}" stroke="${ink}" stroke-width="1.1"/>${seam}`
  }).join('')
}

function splice({ left, right }) {
  const marks = stripTiles(left, 7, () => 'teal') + stripTiles(right, 34, () => 'violet')
  const units = total => `${total} ${total === 1 ? 'tile' : 'tiles'}`
  return ['0 0 164 57', marks, `Top teal strip: ${units(left)}. Bottom violet strip: ${units(right)}.`]
}

function strip({ length, seam }) {
  const marks = stripTiles(length, 20, index => index === seam ? 'seam' : index < seam ? 'teal' : 'violet')
  return ['0 0 164 57', marks, `Joined strip, ${length} ${length === 1 ? 'tile' : 'tiles'}. Crosshatched join at tile ${seam} from the left.`]
}

function drawTiles(mask, x, y, accent) {
  const frame = '<rect x="0" y="0" width="47" height="47" rx="4" fill="#e0e4ee" stroke="#9bacc2" stroke-width="1"/>'
  const tiles = Array.from({ length: 16 }, (_, index) => {
    const tx = 2 + (index % 4) * 11
    const ty = 2 + Math.floor(index / 4) * 11
    const filled = Boolean(mask & (1 << index))
    return `<rect x="${tx}" y="${ty}" width="10" height="10" rx="1.2" fill="${filled ? accent : '#f8f9fc'}"/>`
      + (filled ? `<path d="M${tx + 2} ${ty + 2}h5" stroke="#fff" stroke-opacity=".5" stroke-linecap="round"/>` : '')
  }).join('')
  return `<g transform="translate(${x} ${y})">${frame}${tiles}</g>`
}

function filledTiles(mask) {
  const labels = Array.from({ length: 16 }, (_, index) => mask & (1 << index)
    ? `row ${Math.floor(index / 4) + 1} column ${index % 4 + 1}` : null).filter(Boolean)
  return labels.length ? labels.join(', ') : 'none'
}

function overlay({ left, right }) {
  const labels = '<g fill="#435572" font-size="11" font-weight="750" text-anchor="middle"><text x="31" y="13">A</text><text x="94" y="13">B</text></g>'
  const marks = labels + drawTiles(left, 8, 18, '#5a5bb7') + drawTiles(right, 71, 18, '#a5692f')
  return ['0 0 126 69', marks, `Layer A filled tiles: ${filledTiles(left)}. Layer B filled tiles: ${filledTiles(right)}.`]
}

function mosaic({ mask }) {
  return ['0 0 53 53', drawTiles(mask, 3, 3, '#21766e'), `Filled tiles: ${filledTiles(mask)}.`]
}

const letter = index => String.fromCharCode(65 + index)
const branchX = [24, 61, 103, 149]
const branchHeights = [
  [54.5],
  [28.5, 80.5],
  [15.5, 41.5, 67.5, 93.5],
  [9, 22, 35, 48, 61, 74, 87, 100],
]

function routeTracks() {
  let paths = '<path d="M4 54.5h20m-15-4 4 4-4 4" />'
  for (const [level, from] of branchHeights.slice(0, -1).entries()) {
    const x = branchX[level]
    const nextX = branchX[level + 1]
    const middleX = (x + nextX) / 2
    for (const [index, y] of from.entries()) {
      const next = branchHeights[level + 1].slice(index * 2, index * 2 + 2)
      for (const nextY of next) paths += `<path d="M${x} ${y}C${middleX} ${y} ${middleX} ${nextY} ${nextX} ${nextY}"/>`
    }
  }
  return `<g stroke="#8297af" stroke-width="1.7" fill="none" stroke-linecap="round">${paths}</g>`
}

const trackArt = routeTracks()
const junctionPoints = branchHeights.slice(0, -1).flatMap((level, i) => level.map(y => [branchX[i], y]))

function path({ signals }) {
  const points = junctionPoints.map(([x, y], index) => signals[index]
    ? `<circle cx="${x}" cy="${y}" r="5.7" fill="#fff0d6" stroke="#9c580d" stroke-width="1.15"/><path d="M${x - 2.4} ${y}h4.8m-2.4-2.4v4.8" stroke="#9c580d" stroke-width="1.2" stroke-linecap="round"/>`
    : `<path d="M${x} ${y - 6}l6 6-6 6-6-6Z" fill="#6d54b9" stroke="#f5f1ff" stroke-width="1"/>`
  ).join('')
  const exits = branchHeights[3].map((y, i) => `<text x="157" y="${y + 3.6}">${letter(i)}</text>`).join('')
  const names = signals.map(signal => signal ? 'amber cross' : 'violet diamond')
  return ['0 0 172 109', trackArt + points + `<g fill="#2d425f" font-size="11" font-weight="790">${exits}</g>`,
    `Route from left to right with exits A through H. Start: ${names[0]}. Next column from top: ${names.slice(1, 3).join(', ')}. Final junctions from top: ${names.slice(3).join(', ')}.`]
}

function exit({ index }) {
  const name = letter(index)
  return ['0 0 52 48', `<rect x="3" y="4" width="46" height="40" rx="8" fill="#e9f1fa" stroke="#7b95b7"/>
    <path d="M9 12h34" stroke="#a5bad0" stroke-linecap="round"/>
    <text x="26" y="35" text-anchor="middle" fill="#284b75" font-size="24" font-weight="800">${name}</text>`, `Exit ${name}`]
}

function beads({ items }) {
  const rail = '<rect x="3" y="10" width="106" height="41" rx="20" fill="#f2ecdf" stroke="#e2d6c2"/>'
  const marks = items.map((color, index) => {
    const x = 21 + index * 35
    const [glyph, rim, face, shine] = beadColors[color]
    return `<circle cx="${x}" cy="31" r="12.7" fill="${rim}"/>
      <circle cx="${x}" cy="29" r="11.7" fill="${face}"/>
      <path d="M${x - 7} 25q3-5 8-5" fill="none" stroke="${shine}" stroke-width="1.2" stroke-opacity=".85" stroke-linecap="round"/>
      <text x="${x}" y="34" text-anchor="middle" fill="#fff" stroke="${rim}" stroke-width="1.2" paint-order="stroke" font-size="12" font-weight="800">${glyph}</text>`
  }).join('')
  return ['0 0 112 61', rail + marks, `Beads from left to right: ${items.join(', ')}`]
}

export const workshopScenes = { towers, splice, strip, overlay, mosaic, path, exit, beads }
