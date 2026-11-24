import { readFile, writeFile } from 'node:fs/promises'
import { dayKey } from '../../../packages/game/daily.mjs'
import { TIME_ZONE } from '../public/config.mjs'

const content = new URL('../content/', import.meta.url)
const archive = JSON.parse(await readFile(new URL('calendar.json', content), 'utf8'))
const release = new URL('published-through.txt', content)
const current = (await readFile(release, 'utf8')).trim()
const today = dayKey(new Date(), TIME_ZONE)
const through = today < archive.calendar.at(-1).date ? today : archive.calendar.at(-1).date
if (through > current && archive.calendar.some(day => day.date === through)) {
  await writeFile(release, through + '\n')
  console.log('Publishing Crosswired through ' + through)
} else console.log('Crosswired release is current through ' + current)
