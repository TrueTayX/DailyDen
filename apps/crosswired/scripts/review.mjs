import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dayKey } from '../../../packages/game/daily.mjs'
import { GAME_ID, GAME_NAME, TIME_ZONE } from '../public/config.mjs'
import { publicCalendar } from './publication.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const app = fileURLToPath(new URL('../', import.meta.url))
const archive = JSON.parse(await readFile(join(app, 'content/calendar.json'), 'utf8'))
const tomorrow = new Date(dayKey(new Date(), TIME_ZONE) + 'T00:00:00Z')
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
const start = process.argv[2] ?? tomorrow.toISOString().slice(0, 10)
const calendar = archive.calendar.filter(day => day.date >= start).slice(0, 14)
if (calendar.length === 0) throw new Error('No review days found')
const pool = archive.pool.filter(puzzle => calendar.some(day => day.number === puzzle.day))
const output = join(root, 'reports', GAME_ID)
const game = join(output, GAME_ID)
await mkdir(join(output, 'assets'), { recursive: true })
await cp(join(root, 'packages/game/daily.mjs'), join(output, 'assets/game-daily.mjs'))
await cp(join(app, 'public'), game, { recursive: true })
const index = join(game, 'index.html')
await writeFile(index, (await readFile(index, 'utf8')).replace('<html lang="en">', '<html lang="en" data-review="true">'))
await writeFile(join(game, 'calendar.json'), JSON.stringify(publicCalendar({ calendar }, calendar.at(-1).date)))
const metrics = calendar.flatMap(day => day.puzzles.map(puzzle => ({ date: day.date, ...puzzle })))
await writeFile(join(output, 'metrics.json'), JSON.stringify({ puzzles: metrics, reserves: pool }, null, 2))
const lines = metrics.map(p => `<tr><td><a href="./${GAME_ID}/?date=${p.date}">${p.date}</a></td><td>${p.index} · ${p.tier}</td><td>${p.stamps.A.name}${p.stamps.B ? ' + ' + p.stamps.B.name : ''}</td><td>${p.goal.name}</td><td>${p.par}</td><td>${p.metrics.probe}</td><td>${[p.metrics.symmetry ? 'Symmetry' : '', p.metrics.parGap ? 'Par gap ' + p.metrics.parGap : ''].filter(Boolean).join(', ') || '—'}</td></tr>`)
await writeFile(join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${GAME_NAME} review</title><style>body{font:16px system-ui;margin:2rem}table{border-collapse:collapse}th,td{padding:.45rem;border-bottom:1px solid #ccc;text-align:left}</style><h1>${GAME_NAME} review</h1><p><a href="metrics.json">Download metrics and eligible reserves</a></p><table><thead><tr><th>Day</th><th>Puzzle</th><th>Stamps</th><th>Goal</th><th>Par</th><th>Probe</th><th>Flags</th></tr></thead><tbody>${lines.join('')}</tbody></table></html>`)
console.log('Serve ' + output + ' to review ' + calendar.length + ' days.')
