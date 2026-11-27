const buttons = {
  'help-button': 'How to play', 'settings-button': 'Settings', pickup: 'Pick up tile',
  'scores-button': 'Scoring breakdown', undo: 'Undo', finish: 'Finish farm', results: 'View result',
  return: 'Back to daily result', 'tour-again': 'Show the tour', contrast: 'High contrast',
  motion: 'Reduce motion', 'preview-enabled': 'Hold-to-preview', 'reset-tips': 'Show tips again',
  'stats-button': 'View stats', 'tour-back': 'Tour back', 'tour-next': 'Tour next / play',
  share: 'Copy result', practice: 'Practice this puzzle', reveal: 'See the best-known farm',
  'show-solution': 'Reveal layout', feedback: 'Send beta feedback', 'achievements-button': 'View achievements',
  home: 'Daily Den', switchlight: 'Play SwitchLight', sponsor: 'Sponsor', contact: 'Contact',
  privacy: 'Privacy', 'close-help': 'Close how to play', 'close-settings': 'Close settings',
  'close-tutorial': 'Skip tour', 'close-score-detail': 'Close scoring breakdown',
  'close-outcome': 'Close result', 'close-solution': 'Close solution', 'close-stats': 'Close stats',
  'close-achievements': 'Close achievements'
}
const scores = ['Base', 'Crop patterns', 'Flowers & animals', 'Pollination', 'Irrigation', 'Protection', 'Buildings', 'Corners']
const buttonName = id => buttons[id] || (id.startsWith('score-category-') ? 'Score: ' + scores[Number(id.slice(-1))] : id)
const fields = [
  ['Players', 'players'], ['New', 'new_players'], ['Returning', 'returning_players'],
  ['Starts', 'starts'], ['Finishes', 'finishes'], ['Start rate', 'start_rate'],
  ['Finish / start', 'finish_rate'], ['3-star farms', 'three_stars'], ['Avg. coins', 'average_coins'],
  ['Shares', 'shares'], ['Shared / copied', 'shared'], ['Share failures', 'share_failures'],
  ['Achievements', 'achievements'], ['Reopens', 'reopens'], ['Share visits', 'share_visits'],
  ['Practice runs', 'practices'], ['Reveals', 'reveals']
]
const rate = (numerator, denominator) => denominator ? Math.round(numerator / denominator * 100) + '%' : '—'
const dailyHeaders = ['Day', ...fields.map(([label]) => label)]
const buttonHeaders = ['Day', 'Button', 'Clicks', 'Unique browsers']
const $ = id => document.getElementById(id)
const format = new Intl.NumberFormat()
const buttonTotals = data => data.reduce((total, row) => total + row.clicks, 0)

function dailyRows(data, days) {
  const totals = new Map(data.daily.map(row => [row.day, row]))
  return days.map(({ day }) => {
    const row = totals.get(day) || { day }
    return [day, ...fields.map(([, key]) => {
      if (key === 'start_rate') return rate(row.starts, row.players)
      if (key === 'finish_rate') return rate(row.finishes, row.starts)
      if (key === 'average_coins') return row[key] ?? '—'
      return row[key] ?? 0
    })]
  }).reverse()
}

export function cropCSV(data, days, clickDay) {
  if (clickDay === undefined) return [dailyHeaders, ...dailyRows(data, days)]
  return [buttonHeaders, ...data.buttons.filter(row => !clickDay || row.day === clickDay)
    .map(row => [row.day, buttonName(row.button), row.clicks, row.browsers])]
}

export function renderButtons(data, table) {
  const selected = $('button-day').value
  const rows = data.buttons.filter(row => !selected || row.day === selected)
  const totals = new Map()
  for (const row of rows) totals.set(row.button, (totals.get(row.button) ?? 0) + row.clicks)
  table('crop-buttons', ['Button', 'Clicks'], [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([button, clicks]) => [buttonName(button), clicks]))
}

export function renderCrop(data, days, table, cards) {
  const reach = new Map(data.funnel.map(row => [row.kind, row.browsers]))
  const sum = key => data.daily.reduce((total, day) => total + (day[key] ?? 0), 0)
  cards([
    ['Unique browsers', reach.get('visit') ?? 0], ['Puzzles started', sum('starts')],
    ['Puzzles finished', sum('finishes')], ['Share attempts', sum('shares')],
    ['Achievements earned', sum('achievements')], ['Button clicks', buttonTotals(data.buttons)]
  ])

  const stages = [['visit', 'Visited'], ['start', 'Started'], ['finish', 'Finished']]
  const max = Math.max(1, ...reach.values())
  $('crop-funnel').replaceChildren(...stages.map(([key, label]) => {
    const count = reach.get(key) ?? 0
    const stage = document.createElement('div')
    const line = document.createElement('p')
    const value = document.createElement('strong')
    value.textContent = format.format(count)
    line.append(label, value)
    const bar = document.createElement('progress')
    bar.max = max
    bar.value = count
    bar.setAttribute('aria-label', label)
    stage.append(line, bar)
    return stage
  }))
  const tracking = data.trackingSince ? 'Tracking since ' + data.trackingSince + '. ' : 'No visits recorded yet. '
  $('crop-tracking').textContent = tracking + format.format(sum('reopens')) + ' completed puzzles reopened.'
  const select = $('button-day')
  const selected = select.value
  select.replaceChildren(new Option('Entire date range', ''), ...days.slice().reverse()
    .map(({ day }) => new Option(day, day)))
  if ([...select.options].some(option => option.value === selected)) select.value = selected
  table('crop-daily', dailyHeaders, dailyRows(data, days), day => {
    select.value = day
    renderButtons(data, table)
    select.scrollIntoView({ block: 'nearest' })
    select.focus({ preventScroll: true })
  })
  renderButtons(data, table)
}
