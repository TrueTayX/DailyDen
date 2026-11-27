const $ = id => document.getElementById(id)
const endpoint = '/api/home-analytics/events'
const dayMs = 86400000
const number = new Intl.NumberFormat()
const labels = {
  direct: 'Direct / unknown', 'daily-den': 'Other Daily Den pages', lineup: 'Lineup',
  switchlight: 'SwitchLight', unruled: 'Unruled', cropweave: 'CropWeave',
  sponsor: 'Sponsor', contact: 'Contact', privacy: 'Privacy'
}
const name = value => labels[value] ?? value.replace(/^web:/, '')
let report
let busy = false

async function api(action, params = {}, data = {}) {
  const query = new URLSearchParams({ action, ...params })
  const response = await fetch(endpoint + '?' + query, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data), cache: 'no-store'
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(body.error || 'Analytics is unavailable. Try again shortly.'), { status: response.status })
  return body
}

function table(id, headers, rows) {
  const container = $(id)
  if (!rows.length) {
    container.textContent = 'No activity in this date range.'
    return
  }
  const wrapper = document.createElement('div')
  wrapper.className = 'table-wrap'
  const table = document.createElement('table')
  const head = table.createTHead().insertRow()
  for (const title of headers) {
    const cell = document.createElement('th')
    cell.scope = 'col'
    cell.textContent = title
    head.append(cell)
  }
  const body = table.createTBody()
  for (const row of rows) {
    const tr = body.insertRow()
    for (const value of row) tr.insertCell().textContent = typeof value === 'number' ? number.format(value) : value
  }
  wrapper.append(table)
  container.replaceChildren(wrapper)
}

function trend(days) {
  const canvas = $('trend')
  const ratio = devicePixelRatio || 1
  const width = canvas.clientWidth
  if (!width) return
  const height = canvas.clientHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)
  ctx.font = '12px system-ui'
  const top = 15, bottom = height - 27, left = 46, right = width - 12
  const max = Math.max(1, ...days.map(row => row.unique_browsers))
  for (const count of new Set([max, Math.round(max / 2), 0])) {
    const y = bottom - count / max * (bottom - top)
    ctx.fillStyle = '#53665b'
    ctx.fillText(number.format(count), 0, y + 4, left - 4)
    ctx.strokeStyle = '#e4dfd0'
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()
  }
  const step = (right - left) / days.length
  ctx.fillStyle = '#3a6856'
  days.forEach((row, i) => {
    const bar = row.unique_browsers / max * (bottom - top)
    ctx.fillRect(left + i * step, bottom - bar, Math.max(1, step - 2), bar)
  })
  ctx.fillStyle = '#53665b'
  ctx.fillText(days[0].day, left, height - 6)
  if (days.length > 1) {
    ctx.textAlign = 'right'
    ctx.fillText(days.at(-1).day, right, height - 6)
  }
}

function fullDays(data) {
  const totals = new Map(data.daily.map(row => [row.day, row]))
  const clickers = new Map(data.dailyClickers.map(row => [row.day, row.unique_clickers]))
  const days = []
  for (let time = Date.parse(data.from); time <= Date.parse(data.to); time += dayMs) {
    const day = new Date(time).toISOString().slice(0, 10)
    days.push({ day, unique_browsers: 0, page_views: 0, ...totals.get(day), unique_clickers: clickers.get(day) ?? 0 })
  }
  return days
}

function render(data) {
  const days = fullDays(data)
  const sum = key => days.reduce((total, row) => total + row[key], 0)
  const today = days.find(row => row.day === data.today)
  const clicks = new Map()
  for (const row of data.clicks) clicks.set(row.target, (clicks.get(row.target) ?? 0) + row.clicks)
  $('summary').replaceChildren(...[
    ['Latest day’s unique browsers', (today ?? days.at(-1)).unique_browsers],
    ['Average daily unique browsers', Math.round(sum('unique_browsers') / days.length)],
    ['Homepage views', sum('page_views')],
    ['Total clicks', [...clicks.values()].reduce((total, count) => total + count, 0)]
  ].map(([label, value]) => {
    const card = document.createElement('div')
    card.className = 'metric'
    const count = document.createElement('strong')
    count.textContent = number.format(value)
    const caption = document.createElement('span')
    caption.textContent = label
    card.append(count, caption)
    return card
  }))
  table('daily', ['Pacific day', 'Unique browsers', 'Views', 'Unique clickers'],
    days.slice().reverse().map(row => [row.day, row.unique_browsers, row.page_views, row.unique_clickers]))
  table('referrals', ['Source', 'Views', 'Daily visitor totals'],
    data.referrals.map(row => [name(row.source), row.page_views, row.browser_days]))
  table('clicks', ['Tile or action', 'Clicks'], [...clicks].sort((a, b) => b[1] - a[1]).map(([target, count]) => [name(target), count]))
  table('daily-clicks', ['Pacific day', 'Tile or action', 'Clicks', 'Unique clickers'],
    data.clicks.map(row => [row.day, name(row.target), row.clicks, row.unique_clickers]))
  $('report').hidden = false
  trend(days)
}

function showLogin(message) {
  report = null
  $('report').hidden = true
  $('logout').hidden = true
  $('login').hidden = false
  $('status').textContent = message
}

async function load(params) {
  try {
    const data = await api('report', params)
    report = data
    $('from').value = data.from
    $('to').value = data.to
    $('from').max = $('to').max = data.today
    $('login').hidden = true
    $('logout').hidden = false
    $('status').textContent = ''
    render(data)
  } catch (error) {
    if (error.status === 401) showLogin('')
    else if (!report) showLogin(error.message)
    else $('status').textContent = error.message
  }
}

$('login').addEventListener('submit', async event => {
  event.preventDefault()
  const button = event.submitter
  button.disabled = true
  try {
    await api('login', {}, { password: $('password').value })
    $('login').reset()
    await load()
  } catch (error) {
    $('status').textContent = error.message
  } finally {
    button.disabled = false
  }
})
$('filters').addEventListener('submit', async event => {
  event.preventDefault()
  if (busy) return
  busy = true
  try { await load({ from: $('from').value, to: $('to').value }) }
  finally { busy = false }
})
$('logout').addEventListener('click', async () => {
  try { await api('logout'); showLogin('Signed out.') }
  catch (error) { $('status').textContent = error.message }
})
$('export').addEventListener('click', () => {
  if (!report) return
  const rows = [
    ['Report', 'Pacific day', 'Source or action', 'Views or clicks', 'Unique browsers or clickers'],
    ...fullDays(report).map(row => ['Daily visits', row.day, '', row.page_views, row.unique_browsers]),
    ...report.referrals.map(row => ['Referrals (one count per browser per source per day)', '', name(row.source), row.page_views, row.browser_days]),
    ...report.clicks.map(row => ['Daily clicks', row.day, name(row.target), row.clicks, row.unique_clickers])
  ]
  const csv = rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `dailyden-${report.from}-to-${report.to}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
})
new ResizeObserver(() => { if (report) trend(fullDays(report)) }).observe($('trend'))
load()
