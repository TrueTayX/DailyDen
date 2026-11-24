import { challengeForDay, challengeForPlaytest, countdown, formatDay, localDay, nextLocalMidnight } from './calendar.mjs'
import { createStore, score, shareText } from './progress.mjs'
import { playerProfile } from './profile.mjs'
import { createAnalytics } from './analytics.mjs'
import { sceneView } from './scenes.mjs'
import { games } from './games.mjs'

const icons = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  bulb: '<path d="M9 18h6m-5 3h4m-5-6c0-2-3-3-3-7a6 6 0 0 1 12 0c0 4-3 5-3 7"/>',
  ranking: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8m-8 4h6m-6 4h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
}

function node(tag, className, text) {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function icon(name) {
  const element = node('span', 'icon')
  element.setAttribute('aria-hidden', 'true')
  element.innerHTML = `<svg viewBox="0 0 24 24" focusable="false">${icons[name]}</svg>`
  return element
}

function button(text, className, action) {
  const element = node('button', className, text)
  element.type = 'button'
  element.addEventListener('click', action)
  return element
}

const board = document.querySelector('#board')
const status = document.querySelector('#announcement')
const dayTime = document.querySelector('#date')
const clock = document.querySelector('#countdown')
const dailyFooter = document.querySelector('#daily-footer')
const nextChallengeTimer = document.querySelector('#next-challenge-timer')
const progressRegion = document.querySelector('#progress')
const daySwitch = document.querySelector('#day-switch')
const storageNotice = document.querySelector('#storage-notice')
const helpDialog = document.querySelector('#help')
const playtestCalendar = document.querySelector('#playtest-calendar')
const playtestDate = document.querySelector('#playtest-date')
const introKey = 'rulebreaker.intro.v1'
const requestedPlaytest = new URLSearchParams(location.search).get('playtest')
const playtestNames = new Map([
  ['variety', 'Puzzle formats playtest'], ['workshop', 'Workshop playtest'],
  ['routes', 'Routes playtest'], ['first-month', 'First-month playtest'],
])
const playtestEnabled = document.documentElement.dataset.playtest === 'true'
  || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
const playtest = playtestEnabled && playtestNames.has(requestedPlaytest) ? requestedPlaytest : null

let storage
try { storage = window.localStorage } catch { /* browser disabled storage */ }
const store = createStore(storage, navigator.locks, playtest ? `${playtest}-playtest` : 'daily')
const analytics = createAnalytics(storage, !playtestEnabled)
let introSeen = false
let introOpenedAutomatically = false
try { introSeen = storage?.getItem(introKey) === 'seen' } catch { /* keep this session usable */ }

if (playtest) {
  document.querySelector('#mode-label').textContent = playtestNames.get(playtest)
  document.querySelector('[data-dialog="stats"]').hidden = true
  dailyFooter.hidden = true
  document.querySelector('#playtest-footer').hidden = false
}

let catalog, active, progress
let today = localDay()
let pending = false
let recordedVisit = false

const hasStarted = record => record.rounds.some(round => round.hinted || round.result || round.attempts.length)
const requestedPlaytestDay = () => new URLSearchParams(location.search).get('date')

function playtestUrl(day) {
  const link = new URL('./', location.href)
  link.searchParams.set('playtest', playtest)
  if (playtest === 'first-month' && day !== catalog.season.startsOn) link.searchParams.set('date', day)
  return link
}

if (playtest === 'first-month') {
  playtestCalendar.addEventListener('submit', event => {
    event.preventDefault()
    const day = playtestDate.value
    if (day === active.day) return
    history.pushState(null, '', playtestUrl(day))
    selectDay(day)
    board.querySelector('h2')?.focus()
  })
  window.addEventListener('popstate', () => {
    if (catalog?.season) selectDay(requestedPlaytestDay())
  })
}

function rememberIntro() {
  introSeen = true
  try { storage?.setItem(introKey, 'seen') } catch { /* keep this session usable */ }
}

function showFirstVisitHelp() {
  if (!active || introSeen || document.querySelector('dialog[open]')) return
  if (store.records().length) {
    rememberIntro()
    return
  }
  introOpenedAutomatically = true
  helpDialog.showModal()
}

helpDialog.addEventListener('close', () => {
  rememberIntro()
  if (introOpenedAutomatically) {
    introOpenedAutomatically = false
    board.querySelector('.examples-panel h2')?.focus({ preventScroll: true })
  }
})

const helpExample = document.querySelector('#help-example')
for (const direction of [0, 2]) {
  const example = node('div', 'help-example-row')
  example.append(sceneBox({ kind: 'arrow', direction, flag: -1 }),
    node('span', 'screen-reader', 'becomes'), icon('arrow'),
    sceneBox({ kind: 'arrow', direction: direction + 1, flag: -1 }))
  helpExample.append(example)
}

function gameLink(game) {
  const link = node('a', 'game-link')
  link.href = game.url
  link.addEventListener('click', () => analytics.record('game_open', active?.day ?? localDay()))
  const mark = node('span', 'game-mark')
  mark.append(icon('ranking'))
  const copy = node('span', 'game-copy')
  copy.append(node('strong', '', game.title), node('span', '', game.description))
  link.append(mark, copy)
  return link
}

document.querySelector('#games-list').replaceChildren(...games.map(gameLink))
document.querySelectorAll('[data-dialog]').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const dialog = document.getElementById(trigger.dataset.dialog)
    if (dialog.id === 'stats') updateStats()
    dialog.showModal()
  })
})

function updateStats() {
  const profile = playerProfile(store.records(), localDay())
  const percent = amount => amount === null ? '—' : `${amount}%`
  const metrics = [
    ['Day streak', profile.streak], ['Best streak', profile.longest], ['Daily sets finished', profile.finished],
    ['Puzzles solved', profile.solved], ['Guess accuracy', percent(profile.accuracy)], ['First-try solves', percent(profile.firstTryRate)],
    ['Hints used', profile.hints], ['Best daily score', `${profile.bestScore}/10`],
  ]
  document.querySelector('#stats-data').replaceChildren(...metrics.map(([label, value]) => metric(label, value)))
  const earnedCount = profile.achievements.filter(badge => badge.earned).length
  document.querySelector('#achievement-count').textContent = `${earnedCount} of ${profile.achievements.length} earned`
  const badges = profile.achievements.map(badge => {
    const item = node('li', `achievement${badge.earned ? ' achievement--earned' : ''}`)
    const badgeIcon = node('span', 'achievement-icon', badge.icon)
    badgeIcon.setAttribute('aria-hidden', 'true')
    const state = badge.earned ? 'Earned' : badge.target > 1 ? `${badge.progress} of ${badge.target}` : 'Locked'
    item.append(badgeIcon, node('strong', '', badge.title),
      node('span', 'achievement-description', badge.description), node('span', 'achievement-state', state))
    return item
  })
  document.querySelector('#achievements').replaceChildren(...badges)
}

function metric(label, value) {
  const element = node('div', 'metric')
  element.append(node('dt', '', label), node('dd', '', value))
  return element
}

function selectDay(day) {
  active = playtest ? challengeForPlaytest(catalog, playtest, day) : challengeForDay(catalog, day)
  status.textContent = ''
  if (!active) {
    if (playtest) throw new Error('Playtest set is unavailable')
    progress = null
    showDate(day)
    progressRegion.hidden = true
    renderDaySwitch()
    const message = node('section', 'panel results')
    message.append(panelTitle('Today’s challenge is unavailable'), node('p', 'panel-description', 'Check back after more challenges are scheduled.'),
      button('Check again', 'text-button', load))
    board.replaceChildren(message)
    return
  }
  if (playtest === 'first-month') {
    showDate(active.day)
    playtestDate.value = active.day
  }
  progress = store.get(active)
  render()
  recordPuzzleOpen()
}

function showDate(day) {
  dayTime.dateTime = day
  dayTime.textContent = formatDay(day)
  dayTime.hidden = false
}

function recordPuzzleOpen() {
  if (!progress.rounds[progress.cursor]?.result) {
    const puzzle = active.puzzles[progress.cursor]
    if (puzzle) analytics.record('puzzle_open', active.day, puzzle)
  }
}

function tick() {
  const now = new Date()
  clock.textContent = countdown(now)
  const current = localDay(now)
  if (today !== current) {
    today = current
    if (!catalog) return
    nextChallengeTimer.hidden = !challengeForDay(catalog, localDay(nextLocalMidnight(now)))
    if (!pending && (!active || !hasStarted(progress))) selectDay(today)
    else renderDaySwitch()
  }
}

function renderDaySwitch() {
  daySwitch.hidden = true
  if (playtest) return
  if (active && active.day !== today) {
    daySwitch.replaceChildren(
      node('span', '', `You’re playing the ${formatDay(active.day)} challenge.`),
      button('Play today’s challenge', 'text-button', () => {
        selectDay(today)
        board.querySelector('h2')?.focus()
      }),
    )
    daySwitch.hidden = false
    return
  }
  const previous = store.records().filter(record => record.day < today && !record.completedOn)
    .sort((a, b) => b.day.localeCompare(a.day))
    .find(record => {
      const challenge = challengeForDay(catalog, record.day)
      return challenge && hasStarted(store.get(challenge))
    })
  if (!previous) return
  daySwitch.replaceChildren(
    node('span', '', `Unfinished challenge from ${formatDay(previous.day)}`),
    button('Resume', 'text-button', () => {
      selectDay(previous.day)
      board.querySelector('h2')?.focus()
    }),
  )
  daySwitch.hidden = false
}

function progressStrip() {
  const total = active.puzzles.length
  const label = node('div', 'progress-text', `Puzzle ${progress.cursor + 1} of ${total}`)
  const strip = node('div', 'progress-strip')
  strip.setAttribute('aria-hidden', 'true')
  for (let index = 0; index < total; index += 1) {
    const round = progress.rounds[index]
    const state = round.result ?? (index === progress.cursor ? 'current' : 'upcoming')
    strip.append(node('span', `segment segment--${state}`))
  }
  progressRegion.replaceChildren(label, strip)
}

function panelTitle(title, extra) {
  const header = node('div', 'panel-heading')
  const heading = node('h2', '', title)
  heading.tabIndex = -1
  header.append(heading)
  if (extra) header.append(extra)
  return header
}

function sceneBox(scene, presentation) {
  const box = node('div', 'scene-box')
  box.append(sceneView(scene, presentation))
  return box
}

function connector(isEquation) {
  if (!isEquation) return icon('arrow')
  const equals = node('span', 'equation-equals', '=')
  equals.setAttribute('aria-hidden', 'true')
  return equals
}

const wideScenes = new Set(['path', 'overlay'])

function sceneClass(name, kind) {
  return `${name} ${name}--${kind}${wideScenes.has(kind) ? ` ${name}--wide` : ''}`
}

function examplesPanel(puzzle) {
  const { kind } = puzzle.input
  const isEquation = kind === 'equation'
  const section = node('section', 'panel examples-panel')
  section.append(panelTitle('Examples', node('span', 'difficulty', puzzle.difficulty)))
  if (isEquation) section.append(node('p', 'panel-description', 'Each color has a fixed value.'))

  const labels = node('div', sceneClass('example-labels', kind))
  labels.setAttribute('aria-hidden', 'true')
  labels.append(node('span', '', isEquation ? 'Tokens' : 'Input'), node('span', '', isEquation ? 'Total' : 'Output'))
  section.append(labels)
  const examples = node('ol', 'examples-list')
  for (const { input, output } of puzzle.examples) {
    const pair = node('li', sceneClass('pair', kind))
    const before = sceneBox(input, puzzle.presentation)
    before.prepend(node('span', 'screen-reader', isEquation ? 'Tokens: ' : 'Input: '))
    const after = sceneBox(output, puzzle.presentation)
    after.prepend(node('span', 'screen-reader', isEquation ? 'Total: ' : 'Output: '))
    pair.append(before, connector(isEquation), after)
    examples.append(pair)
  }
  section.append(examples)
  return section
}

function challengePreview(puzzle) {
  const isEquation = puzzle.input.kind === 'equation'
  const preview = node('div', sceneClass('challenge-preview', puzzle.input.kind))
  const inputBox = sceneBox(puzzle.input, puzzle.presentation)
  inputBox.prepend(node('span', 'screen-reader', isEquation ? 'Challenge tokens: ' : 'Challenge input: '))
  const missing = node('span', 'question', '?')
  missing.setAttribute('aria-label', isEquation ? 'Unknown total' : 'Unknown output')
  missing.setAttribute('role', 'img')
  preview.append(inputBox, connector(isEquation), missing)
  return preview
}

function answerCard(option, puzzle, round, selected) {
  const card = node('label', 'option')
  const input = node('input', 'screen-reader')
  input.type = 'radio'
  input.name = 'choice'
  input.value = option.id
  const drawn = sceneView(option.scene, puzzle.presentation)
  const previous = round.attempts.includes(option.id)
  const correct = Boolean(round.result) && puzzle.correct === option.id
  const wrong = previous && !correct
  const suffix = correct ? ', correct answer' : wrong ? ', incorrect' : ''
  input.setAttribute('aria-label', `${option.id}: ${drawn.getAttribute('aria-label')}${suffix}`)
  input.disabled = Boolean(round.result) || previous
  input.checked = !input.disabled && selected === option.id
  card.classList.toggle('option--correct', correct)
  card.classList.toggle('option--wrong', wrong)
  const letter = node('span', 'letter', option.id)
  letter.setAttribute('aria-hidden', 'true')
  drawn.setAttribute('aria-hidden', 'true')
  card.append(input, letter, drawn)
  if (correct || wrong) {
    const marker = node('span', 'choice-mark', wrong ? '×' : '')
    if (correct) marker.append(icon('check'))
    marker.setAttribute('aria-hidden', 'true')
    card.append(marker)
  }
  return card
}

function answerForm(puzzle, round, selected) {
  const form = node('form', 'answers')
  const compact = puzzle.choices.length === 4 ? ' options--four' : ''
  const choices = node('fieldset', `options options--${puzzle.presentation ?? puzzle.input.kind}${compact}`)
  const label = round.result ? 'Answer choices' : 'Choose an answer'
  choices.append(node('legend', 'choices-label', label))
  for (const option of puzzle.choices) choices.append(answerCard(option, puzzle, round, selected))

  if (round.hinted) {
    const hint = node('p', 'hint', puzzle.hint)
    hint.tabIndex = -1
    form.append(hint)
  }
  form.append(choices)
  if (round.result) {
    const solved = round.result === 'solved'
    const answer = puzzle.choices.find(option => option.id === puzzle.correct)
    const feedback = node('div', `feedback ${solved ? 'feedback--solved' : ''}`)
    const heading = node('h3', '', solved ? `Correct · ${score(round)} ${score(round) === 1 ? 'point' : 'points'}` : `The answer is ${answer.id}`)
    heading.tabIndex = -1
    feedback.append(heading, node('p', '', puzzle.explanation))
    form.append(feedback)
  } else if (round.attempts.length) {
    form.append(node('p', 'retry', 'Incorrect. One try left.'))
  }

  const controls = node('div', 'puzzle-actions')
  if (round.result) {
    const last = progress.cursor === active.puzzles.length - 1
    controls.append(button(last ? 'See results' : 'Next puzzle', 'primary', () => act({ type: 'next' })))
  } else {
    const secondary = node('div', 'secondary-actions')
    if (!round.hinted) {
      const hintButton = button('Hint', 'hint-button', () => act({ type: 'hint' }))
      hintButton.prepend(icon('bulb'))
      secondary.append(hintButton)
    }
    secondary.append(button('Reveal', 'text-button', () => act({ type: 'reveal' })))
    const submit = node('button', 'primary', 'Check answer')
    submit.type = 'submit'
    submit.disabled = !choices.querySelector('input:checked')
    controls.append(secondary, submit)
    form.addEventListener('change', () => { submit.disabled = false })
    form.addEventListener('submit', event => {
      event.preventDefault()
      const choice = new FormData(form).get('choice')
      if (choice) act({ type: 'submit', choice })
    })
  }
  form.append(controls)
  return form
}

function renderPuzzle(selected) {
  const puzzle = active.puzzles[progress.cursor]
  const round = progress.rounds[progress.cursor]
  const layout = node('div', 'puzzle-layout')
  const challenge = node('section', 'panel challenge-panel')
  let heading = 'Challenge'
  if (puzzle.input.kind === 'equation') {
    const tokenCount = puzzle.input.tokens.reduce((sum, count) => sum + count, 0)
    heading = tokenCount === 1 ? 'What is this token worth?' : 'Find the total'
  }
  if (puzzle.input.kind === 'path') heading = 'Find the exit'
  challenge.append(panelTitle(heading))
  if (puzzle.input.kind === 'path') challenge.append(node('p', 'panel-description', 'Start at the arrow.'))
  challenge.append(challengePreview(puzzle), answerForm(puzzle, round, selected))
  layout.append(examplesPanel(puzzle), challenge)
  board.replaceChildren(layout)
}

function renderResults() {
  const finished = node('section', 'panel results')
  const solved = progress.rounds.filter(round => round.result === 'solved').length
  const points = progress.rounds.reduce((sum, round) => sum + score(round), 0)
  const total = active.puzzles.length
  const heading = panelTitle(playtest ? 'Playtest complete' : 'Daily challenge complete')
  const tiles = node('ol', 'result-tiles')
  const outcomes = ['Revealed', 'Solved', 'First-try solve']
  for (const [index, round] of progress.rounds.entries()) {
    const value = score(round)
    const tile = node('li', `result-tile result-tile--${value}`)
    tile.append(node('span', '', `Puzzle ${index + 1}`), node('strong', '', outcomes[value]))
    tiles.append(tile)
  }
  const resultsActions = node('div', 'results-actions')
  resultsActions.append(button('Share result', 'primary', () => share(resultsActions)))
  if (!playtest) resultsActions.append(button('View progress', 'text-button', () => {
    updateStats()
    document.querySelector('#stats').showModal()
  }))
  const more = node('aside', 'next-game')
  more.setAttribute('aria-label', 'More games')
  more.append(gameLink(games[0]))
  finished.append(
    heading,
    node('p', 'result-score', `${solved}/${total} solved · ${points}/${total * 2} points`),
    tiles,
    resultsActions,
    more,
  )
  board.replaceChildren(finished)
}

function render(selected) {
  if (!playtest) showDate(active.day)
  const finished = progress.cursor === active.puzzles.length
  progressRegion.hidden = finished
  storageNotice.hidden = store.persistent
  renderDaySwitch()
  if (finished) renderResults()
  else {
    progressStrip()
    renderPuzzle(selected)
  }
}

async function share(actions) {
  const link = playtest ? playtestUrl(active.day) : new URL('./?ref=share', location.href)
  const text = shareText(active, progress, link.href)
  try {
    if (navigator.share) {
      await navigator.share({ text })
      analytics.record('share', active.day)
      status.textContent = 'Result shared.'
      return
    }
    await navigator.clipboard.writeText(text)
    analytics.record('share', active.day)
    actions.querySelector('.share-status')?.remove()
    actions.append(node('p', 'share-status', 'Result copied.'))
    status.textContent = 'Result copied.'
  } catch (error) {
    if (error.name === 'AbortError') return
    const manual = actions.querySelector('textarea') ?? node('textarea', 'share-text')
    manual.readOnly = true
    manual.setAttribute('aria-label', 'Copy your result')
    manual.value = text
    actions.append(manual)
    manual.select()
    status.textContent = 'Select and copy your result.'
  }
}

async function act(action) {
  if (pending) return
  const editing = active
  const before = progress
  const selected = action.type === 'hint' ? board.querySelector('.option input:checked')?.value : undefined
  action.cursor = progress.cursor
  pending = true
  try {
    const saved = await store.update(editing, action, localDay())
    if (active !== editing) return
    const puzzle = editing.puzzles[action.cursor]
    const roundBefore = before.rounds[action.cursor]
    const roundAfter = saved.rounds[action.cursor]
    if (!hasStarted(before) && hasStarted(saved)) analytics.record('daily_start', editing.day)
    if (!before.completedOn && saved.completedOn) analytics.record('daily_complete', editing.day)
    if (action.type === 'submit' && roundAfter.attempts.length > roundBefore.attempts.length) {
      analytics.record('attempt', editing.day, puzzle, action.choice === puzzle.correct)
    }
    if (action.type === 'hint' && !roundBefore.hinted && roundAfter.hinted) analytics.record('hint', editing.day, puzzle)
    if (action.type === 'reveal' && !roundBefore.result && roundAfter.result === 'revealed') analytics.record('reveal', editing.day, puzzle)
    progress = saved
    render(selected)
    if (action.type === 'next') {
      if (saved.cursor !== before.cursor) recordPuzzleOpen()
      board.querySelector('.challenge-panel h2, .results h2')?.focus()
      return
    }
    if (action.type === 'hint') {
      board.querySelector('.hint')?.focus()
      return
    }
    const explanation = board.querySelector('.feedback h3')
    if (explanation) explanation.focus()
    else {
      status.textContent = 'Incorrect. One try left.'
      board.querySelector('.option input:not(:disabled)')?.focus()
    }
  } catch {
    status.textContent = 'The answer could not be saved. Please try again.'
  } finally { pending = false }
}

window.addEventListener('storage', () => {
  if (!active || pending) return
  const latest = store.get(active)
  if (JSON.stringify(latest) !== JSON.stringify(progress)) {
    progress = latest
    render()
  } else renderDaySwitch()
})

async function load() {
  try {
    const response = await fetch(new URL('../content/daily.json', import.meta.url))
    if (!response.ok) throw new Error('Daily catalog failed to load')
    catalog = await response.json()
    if (catalog.schema !== 1 || !catalog.sets?.length) {
      throw new Error('Invalid catalog')
    }
    if (!playtest) nextChallengeTimer.hidden = !challengeForDay(catalog, localDay(nextLocalMidnight()))
    if (!recordedVisit) {
      analytics.record('visit', localDay())
      if (new URLSearchParams(location.search).get('ref') === 'share') analytics.record('shared_visit', localDay())
      recordedVisit = true
    }
    if (playtest === 'first-month' && catalog.season) {
      const options = Object.keys(catalog.season.days).sort().map(day => new Option(formatDay(day), day))
      playtestDate.replaceChildren(...options)
    }
    selectDay(playtest ? requestedPlaytestDay() : localDay())
    playtestCalendar.hidden = playtest !== 'first-month'
    showFirstVisitHelp()
  } catch {
    board.replaceChildren(
      node('p', 'notice', 'Today’s challenge couldn’t load.'),
      button('Try again', 'primary', load),
    )
  } finally { board.setAttribute('aria-busy', 'false') }
}

if (!playtest) {
  tick()
  window.setInterval(tick, 1000)
  document.addEventListener('visibilitychange', tick)
}
load()
