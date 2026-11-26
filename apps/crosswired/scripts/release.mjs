import { readFile, writeFile } from 'node:fs/promises'
import { getPuzzleDate } from '../../../packages/game/daily.mjs'

const content = new URL('../content/', import.meta.url)
const archive = JSON.parse(await readFile(new URL('calendar.json', content), 'utf8'))
const release = new URL('published-through.txt', content)
const current = (await readFile(release, 'utf8')).trim()
const today = getPuzzleDate()
const through = today < archive.calendar.at(-1).date ? today : archive.calendar.at(-1).date
if (through > current && archive.calendar.some(day => day.date === through)) {
  await writeFile(release, through + '\n')
  console.log('Publishing SwitchLight through ' + through)
} else console.log('SwitchLight release is current through ' + current)
