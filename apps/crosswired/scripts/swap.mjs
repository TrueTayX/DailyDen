import { readFile, writeFile } from 'node:fs/promises'
import { dayKey } from '../../../packages/game/daily.mjs'
import { TIME_ZONE } from '../public/config.mjs'
import { serializeArchive } from './calendar.mjs'

const [reserveId] = process.argv.slice(2)
const content = new URL('../content/', import.meta.url)
const source = new URL('calendar.json', content)
const archive = JSON.parse(await readFile(source, 'utf8'))
const reserveIndex = archive.pool.findIndex(puzzle => puzzle.id === reserveId)
if (reserveIndex < 0) throw new Error('Provide a reserve puzzle ID from the review report')
const chosen = archive.pool[reserveIndex]
const day = archive.calendar[chosen.day - 1]
const released = (await readFile(new URL('published-through.txt', content), 'utf8')).trim()
if (day.date <= released || day.date <= dayKey(new Date(), TIME_ZONE)) throw new Error('Published and current puzzles are immutable')
const old = day.puzzles[chosen.index - 1]
if (day.puzzles.some(puzzle => puzzle.start === chosen.start)) throw new Error('Replacement start is already used that day')
day.puzzles[chosen.index - 1] = { ...chosen, id: old.id }
archive.pool.splice(reserveIndex, 1)
await writeFile(source, serializeArchive(archive))
console.log(`Replaced ${old.id} on ${day.date}.`)
