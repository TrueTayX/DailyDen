import { writeFile } from 'node:fs/promises'
import { CALENDAR_SEED, generateCalendar, serializeArchive } from './calendar.mjs'

const [daysArg = '802', output = 'apps/crosswired/content/calendar.json'] = process.argv.slice(2)
const days = Number(daysArg)
if (!Number.isSafeInteger(days) || days < 1) throw new Error('Enter a positive day count')
const archive = generateCalendar(days, CALENDAR_SEED, number => {
  if (number % 50 === 0) console.log(`Generating day ${number} of ${days}…`)
})
await writeFile(output, serializeArchive(archive), { flag: 'wx' })
console.log(`Generated ${archive.calendar.length} days and ${archive.pool.length} reserves in ${output}.`)
