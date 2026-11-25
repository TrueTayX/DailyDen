import { dayKey, dayStreak, gameStorage, copyText } from '../assets/game-daily.mjs'
import { GAME_ID, GAME_NAME, TIME_ZONE, HINT_COST, RATINGS } from './config.mjs'
import { asMask, cellCoordinates, cellsIn, countBits, flipSets, hasBit } from './engine.mjs'
import { applyMove, freshRound, rating, restoreRound, shareResult } from './game.mjs'
import { lightShapes } from './lights.mjs'

const byId = id => document.getElementById(id)
const board = byId('board')
const heading = byId('puzzle')
const announcement = byId('announcement')
const restart = byId('restart')
const hint = byId('hint')
const next = byId('next')
const result = byId('result')
const assist = byId('assist')
const contrast = byId('contrast')
const settingsDialog = byId('settings-dialog')
const help = byId('help')
const mechanicTip = byId('mechanic-tip')
const viewTip = byId('view-tip')
const tipList = byId('mechanic-tip-list')
const tipAnnouncement = byId('tip-announcement')
const mechanics = [
  { id: 'locked', target: '.blocked', text: "Locked cells can't be pressed. They can still light up or go dark when other presses flip them." },
  { id: 'split', target: '[data-shape="square"]',
    text: 'Square lights follow a different hidden pattern from round lights.',
    help: 'Square lights follow a different pattern from round lights.' },
  { id: 'wrap', target: null, text: 'Edges wrap around: a pattern that runs off one side comes back on the opposite side.' },
]
const review = document.documentElement.dataset.review === 'true'
const requestedDate = review ? new URLSearchParams(location.search).get('date') : null
let storage
try { if (!review) storage = window.localStorage } catch { /* play in this tab */ }
const store = gameStorage(GAME_ID, storage)
const today = () => dayKey(new Date(), TIME_ZONE)
const safeObject = value => value && !Array.isArray(value) && typeof value === 'object' ? value : {}
let settings = safeObject(store.read('settings', {}))
let day, rounds, index, columns, cells, flashTimer, selected = 0, pending = false
let abandoned = false
let replaying = false
let boardMechanics = []
let visibleTips = []

function node(tag, className, text) {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}

function readRounds() {
  const saved = store.read('day:' + day.date, [])
  return day.puzzles.map((puzzle, i) => restoreRound(puzzle, saved?.[i]))
}

function record(event, detail = {}) {
  if (review || replaying) return
  const previous = store.read('events', [])
  store.write('events', [...(Array.isArray(previous) ? previous.slice(-249) : []), { event, day: day.date, ...detail }])
}

function fields(round, puzzle) {
  return { index: puzzle.index, presses: round.presses, par: puzzle.par, restarts: round.restarts,
    hintUsed: round.hints > 0, assistUsed: round.assisted }
}

function renderMechanicTips() {
  tipList.replaceChildren(...visibleTips.map(({ text }) => node('li', '', text)))
  mechanicTip.hidden = visibleTips.length === 0
  viewTip.hidden = mechanicTip.hidden
  board.querySelectorAll('.tip-target').forEach(cell => cell.classList.remove('tip-target'))
  board.classList.toggle('tip-edge', visibleTips.some(({ id }) => id === 'wrap'))
  for (const { target } of visibleTips) {
    if (target) board.querySelector(target)?.classList.add('tip-target')
  }
}

function showMechanicTips() {
  const round = rounds[index]
  const puzzle = day.puzzles[index]
  visibleTips = round.bits === puzzle.goal.bits ? []
    : boardMechanics.filter(({ id }) => !store.read('seen:' + id, false))
  renderMechanicTips()
  tipAnnouncement.textContent = visibleTips.map(({ text }) => text).join(' ')
  for (const { id } of visibleTips) {
    store.write('seen:' + id, true)
    record('tip_shown', { mechanic: id, index: puzzle.index })
  }
}

function dismissMechanicTips(reason) {
  if (!visibleTips.length) return
  const restoreFocus = document.activeElement === viewTip || mechanicTip.contains(document.activeElement)
  for (const { id } of visibleTips) {
    record('tip_dismissed', { mechanic: id, index: day.puzzles[index].index, reason })
  }
  visibleTips = []
  renderMechanicTips()
  tipAnnouncement.textContent = ''
  if (restoreFocus) cells[selected]?.focus({ preventScroll: true })
}

function miniature(mask, size, { current, shapes } = {}) {
  const diagram = node('div', 'mini')
  diagram.style.setProperty('--size', size)
  diagram.setAttribute('aria-hidden', 'true')
  for (const cell of cellsIn(size)) {
    const tile = node('span', hasBit(mask, cell) ? 'flip' : '')
    tile.classList.toggle('pressed', cell === current)
    if (shapes) tile.dataset.shape = shapes[cell]
    diagram.append(tile)
  }
  return diagram
}

const position = (cell, size) => {
  const [r, c] = cellCoordinates(cell, size)
  return `row ${r + 1}, column ${c + 1}`
}

function flash(mask, message, size) {
  clearTimeout(flashTimer)
  for (const button of cells) button.classList.remove('flipped')
  void board.offsetWidth
  const changes = []
  cells.forEach((button, cell) => {
    if (hasBit(mask, cell)) {
      button.classList.add('flipped')
      changes.push(position(cell, size))
    }
  })
  flashTimer = setTimeout(() => cells.forEach(button => button.classList.remove('flipped')), 600)
  announcement.textContent = changes.length ? `${message} ${changes.join('; ')}.` : `${message} No lights.`
}

function refreshBoard() {
  const puzzle = day.puzzles[index]
  const round = rounds[index]
  const solved = round.bits === puzzle.goal.bits
  const currentRating = solved ? rating(round, puzzle) : ''
  const suggestion = solved ? null : round.suggestion
  cells.forEach((button, cell) => {
    const on = round.bits[cell] === '1'
    const blocked = columns[cell] === null
    button.classList.toggle('on', on)
    button.classList.toggle('suggested', cell === suggestion)
    button.classList.toggle('differs', assist.checked && round.bits[cell] !== puzzle.goal.bits[cell])
    button.tabIndex = cell === selected && !solved ? 0 : -1
    button.disabled = solved
    button.setAttribute('aria-disabled', String(blocked || solved))
    button.setAttribute('aria-label', [
      position(cell, puzzle.size), `${button.dataset.shape} light`, on ? 'on' : 'off', blocked ? 'locked' : '',
      cell === suggestion ? 'suggested move' : '',
      assist.checked && round.bits[cell] !== puzzle.goal.bits[cell] ? 'differs from goal' : '',
    ].filter(Boolean).join(', '))
  })
  byId('presses').textContent = round.presses
  byId('restarts').textContent = round.restarts
  result.textContent = solved ? `Solved in ${round.presses} (par ${puzzle.par}) · ${currentRating}`
    : suggestion != null ? `Try ${position(suggestion, puzzle.size)}. Hint added ${HINT_COST} presses.` : ''
  result.hidden = !result.textContent
  result.classList.toggle('result--hint', suggestion != null)
  result.parentElement.classList.toggle('action-dock--solved', solved)
  hint.hidden = solved
  hint.disabled = suggestion != null
  restart.hidden = solved
  next.hidden = !solved
  next.textContent = index === day.puzzles.length - 1 ? 'See results' : 'Next puzzle'
  byId('empty-history').hidden = round.recent.length > 0
  byId('history').replaceChildren(...round.recent.map(cell => {
    const row = node('li')
    const mask = columns[cell] ?? 0n
    const flipped = cellsIn(puzzle.size).filter(i => hasBit(mask, i))
    const [r, c] = cellCoordinates(cell, puzzle.size)
    const label = node('span', 'history-label', `R${r + 1} C${c + 1}`)
    label.setAttribute('aria-hidden', 'true')
    row.append(miniature(mask, puzzle.size, { current: cell }), label,
      node('span', 'sr-only', `Pressed ${position(cell, puzzle.size)}. Flipped ` + (flipped.map(i => position(i, puzzle.size)).join('; ') || 'no lights')))
    return row
  }))
}

function renderPuzzle() {
  if (index >= day.puzzles.length) {
    renderResults()
    return
  }
  const puzzle = day.puzzles[index]
  const size = puzzle.size
  const shapes = lightShapes(puzzle)
  const round = rounds[index]
  columns = flipSets(puzzle)
  selected = round.suggestion ?? columns.findIndex(column => column !== null)
  abandoned = false
  clearTimeout(flashTimer)
  byId('complete').hidden = true
  byId('play').hidden = false
  heading.textContent = `Puzzle ${index + 1} of ${day.puzzles.length}`
  byId('tier').textContent = puzzle.tier
  byId('daily-tip').hidden = index !== 0
  byId('par').textContent = puzzle.par
  byId('goal-name').textContent = ['fourfold pattern', 'mirror pattern'].includes(puzzle.goal.name)
    ? 'symmetric pattern' : puzzle.goal.name
  const goal = miniature(asMask(puzzle.goal.bits), size, { shapes })
  goal.classList.add('goal')
  goal.removeAttribute('aria-hidden')
  goal.setAttribute('role', 'img')
  const lit = cellsIn(size).filter(cell => puzzle.goal.bits[cell] === '1')
  goal.setAttribute('aria-label', 'Goal lights on: ' + (lit.length
    ? lit.map(cell => `${position(cell, size)}, ${shapes[cell]} light`).join('; ') : 'none'))
  byId('goal').replaceChildren(goal)
  board.style.setProperty('--size', size)
  board.classList.toggle('wrap', puzzle.wrap)
  board.setAttribute('aria-label', `${size} by ${size} light board. Use arrow keys to move and Space to press.`)
  cells = cellsIn(size).map(cell => {
    const button = node('button', 'light')
    button.type = 'button'
    button.dataset.shape = shapes[cell]
    button.append(node('span', 'bulb'))
    const blocked = columns[cell] === null
    button.classList.toggle('blocked', blocked)
    if (blocked) {
      const badge = node('span', 'lock-badge')
      badge.setAttribute('aria-hidden', 'true')
      button.append(badge)
    }
    button.addEventListener('click', () => {
      if (columns[cell] === null) return
      selected = cell
      void perform('press', cell)
    })
    button.addEventListener('keydown', event => {
      const [r, c] = cellCoordinates(cell, size)
      const arrows = { ArrowUp: [r - 1, c], ArrowDown: [r + 1, c], ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1] }
      const to = arrows[event.key]
      if (!to) return
      event.preventDefault()
      if (to.some(i => i < 0 || i >= size)) return
      cells[selected].tabIndex = -1
      selected = to[0] * size + to[1]
      cells[selected].tabIndex = 0
      cells[selected].focus({ preventScroll: true })
    })
    return button
  })
  board.replaceChildren(...cells)
  boardMechanics = mechanics.filter(({ target }) => target ? board.querySelector(target) : puzzle.wrap)
  showMechanicTips()
  if (assist.checked && !round.assisted && round.bits !== puzzle.goal.bits) void perform('assist')
  refreshBoard()
}

async function perform(type, cell) {
  if (pending || !day?.puzzles[index]) return
  pending = true
  const puzzle = day.puzzles[index]
  const write = () => {
    if (!replaying) rounds = readRounds()
    const before = rounds[index]
    if (before.bits === puzzle.goal.bits) {
      refreshBoard()
      return
    }
    const after = type === 'assist' ? { ...before, assisted: true } : applyMove(before, puzzle, columns, type, cell)
    if (after === before) {
      refreshBoard()
      if (type === 'hint' && before.suggestion == null) announcement.textContent = 'No hint is available for this board.'
      return
    }
    rounds[index] = after
    if (!replaying) store.write('day:' + day.date, rounds)
    if (type === 'hint') selected = after.suggestion
    refreshBoard()
    if (type === 'restart') announcement.textContent = 'Board restored. Press count kept.'
    if (type === 'press') {
      dismissMechanicTips('press')
      flash(columns[cell], 'Flipped:', puzzle.size)
    }
    if (type === 'hint') {
      flash(columns[selected], `Hint added ${HINT_COST} presses. Try ${position(selected, puzzle.size)}. Would flip:`, puzzle.size)
      cells[selected].focus({ preventScroll: true })
    }
    if (after.bits === puzzle.goal.bits) {
      record('puzzle_completed', { ...fields(after, puzzle), rating: rating(after, puzzle) })
      if (!replaying && rounds.every((round, i) => round.bits === day.puzzles[i].goal.bits)) {
        const stats = safeObject(store.read('stats', {}))
        const completed = safeObject(stats.completed)
        if (!completed[day.date]) {
          completed[day.date] = { perfect: rounds.every((round, i) => RATINGS.indexOf(rating(round, day.puzzles[i])) <= 1) }
          store.write('stats', { completed })
          record('day_completed')
        }
      }
      announcement.textContent += ' ' + result.textContent
      next.focus({ preventScroll: true })
    }
  }
  try {
    if (navigator.locks && !review && !replaying) await navigator.locks.request(`${GAME_ID}:v1:play`, write)
    else write()
  } finally { pending = false }
}

function renderResults() {
  byId('play').hidden = true
  byId('complete').hidden = false
  byId('summary').textContent = `Presses ${rounds.reduce((sum, round) => sum + round.presses, 0)} (par ${day.puzzles.reduce((sum, puzzle) => sum + puzzle.par, 0)})`
  byId('ratings').replaceChildren(...rounds.map((round, i) =>
    node('li', '', `Puzzle ${i + 1} · ${rating(round, day.puzzles[i])} · ${round.presses} presses`)))
  const completed = safeObject(store.read('stats', {})?.completed)
  const streak = dayStreak(Object.keys(completed), today())
  byId('complete-heading').textContent = replaying ? 'Practice replay complete' : 'Daily set complete'
  byId('streak').textContent = `${streak}-day streak`
  byId('streak').hidden = replaying
  byId('perfect').hidden = replaying || !completed[day.date]?.perfect
  byId('share').hidden = replaying
  byId('export').hidden = replaying
  byId('complete-heading').focus()
}

function setReplay(active) {
  replaying = active
  byId('replay-mode').hidden = !active
  byId('exit-replay').hidden = !active
  byId('manual-copy').hidden = true
  byId('share-status').textContent = ''
}

async function exportText(text, success, share = false) {
  const status = byId('share-status')
  const manual = byId('manual-copy')
  if (share && navigator.share) {
    try {
      await navigator.share({ text })
      manual.hidden = true
      status.textContent = 'Result shared.'
      return
    } catch (error) { if (error.name === 'AbortError') return }
  }
  if (await copyText(text)) {
    manual.hidden = true
    status.textContent = success
  } else {
    manual.hidden = false
    manual.value = text
    manual.focus()
    manual.select()
    status.textContent = 'Select and copy the text.'
  }
}

async function load() {
  byId('loading').hidden = false
  byId('loading').textContent = 'Loading today’s puzzles…'
  try {
    const response = await fetch('./calendar.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error('Calendar fetch failed')
    const calendar = await response.json()
    const requested = requestedDate ?? today()
    const selectedDay = calendar.days[requested]
    if (!selectedDay) {
      byId('loading').textContent = 'Today’s puzzles haven’t been published yet.'
      byId('rollover').hidden = false
      byId('open-today').textContent = 'Check again'
      return
    }
    day = selectedDay
    setReplay(false)
    rounds = readRounds()
    index = rounds.findIndex((round, i) => round.bits !== day.puzzles[i].goal.bits)
    if (index < 0) index = day.puzzles.length
    byId('loading').hidden = true
    byId('rollover').hidden = true
    byId('open-today').textContent = 'Open today’s puzzles'
    const label = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(day.date))
    byId('day-number').textContent = `#${day.number}`
    byId('day-label').textContent = label
    renderPuzzle()
    if (!settings.introSeen && index === 0 && !review) help.showModal()
  } catch {
    byId('loading').textContent = 'The puzzles couldn’t load.'
    byId('rollover').hidden = false
    byId('open-today').textContent = 'Check again'
  }
}

function noteAbandonment() {
  if (replaying || !day || index >= day.puzzles.length || abandoned) return
  const round = rounds[index]
  const puzzle = day.puzzles[index]
  if (round.bits === puzzle.goal.bits || !(round.presses || round.restarts)) return
  abandoned = true
  record('puzzle_abandoned', fields(round, puzzle))
}

restart.addEventListener('click', () => { void perform('restart') })
byId('hint-cost').textContent = `· costs ${HINT_COST} presses`
hint.addEventListener('click', () => { void perform('hint') })
next.addEventListener('click', () => {
  index += 1
  renderPuzzle()
  if (index < day.puzzles.length) heading.focus()
})
assist.checked = settings.assist === true
contrast.checked = settings.contrast === true
document.documentElement.classList.toggle('high-contrast', contrast.checked)
assist.addEventListener('change', () => {
  settings = { ...settings, assist: assist.checked }
  store.write('settings', settings)
  if (!day?.puzzles[index]) return
  if (assist.checked) void perform('assist')
  else refreshBoard()
})
contrast.addEventListener('change', () => {
  settings = { ...settings, contrast: contrast.checked }
  store.write('settings', settings)
  document.documentElement.classList.toggle('high-contrast', contrast.checked)
})
byId('dismiss-tip').addEventListener('click', () => dismissMechanicTips('got_it'))
viewTip.addEventListener('click', () => {
  mechanicTip.scrollIntoView({ block: 'nearest' })
  byId('dismiss-tip').focus({ preventScroll: true })
})
byId('play').addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !visibleTips.length) return
  event.preventDefault()
  dismissMechanicTips('escape')
})
byId('reset-tips').addEventListener('click', () => {
  for (const { id } of mechanics) store.remove('seen:' + id)
  settingsDialog.close()
  if (!day?.puzzles[index]) return
  dismissMechanicTips('reset')
  showMechanicTips()
})
byId('settings-button').addEventListener('click', () => settingsDialog.showModal())
byId('help-mechanics').replaceChildren(...mechanics.map(mechanic => node('li', '', mechanic.help ?? mechanic.text)))
byId('help-button').addEventListener('click', () => help.showModal())
help.addEventListener('close', () => {
  settings = { ...settings, introSeen: true }
  store.write('settings', settings)
})
byId('share').addEventListener('click', () => {
  record('share_clicked')
  const url = new URL(`/${GAME_ID}/`, 'https://dailyden.games').href
  void exportText(shareResult(GAME_NAME, day, rounds, url), 'Result copied.', true)
})
byId('replay').addEventListener('click', () => {
  if (pending) return
  setReplay(true)
  rounds = day.puzzles.map(freshRound)
  index = 0
  renderPuzzle()
  heading.focus()
})
byId('exit-replay').addEventListener('click', () => {
  if (pending) return
  settingsDialog.close()
  setReplay(false)
  rounds = readRounds()
  index = day.puzzles.length
  renderResults()
})
byId('export').addEventListener('click', () => {
  void exportText(JSON.stringify(store.read('events', []), null, 2), 'Events copied.')
})
byId('open-today').addEventListener('click', () => {
  if (pending) return
  noteAbandonment()
  void load()
})
window.addEventListener('pagehide', noteAbandonment)
function checkRollover() {
  if (!review && day && day.date !== today()) byId('rollover').hidden = false
}
document.addEventListener('visibilitychange', checkRollover)
setInterval(checkRollover, 30_000)
void load()
