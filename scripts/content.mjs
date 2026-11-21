import { readFile, writeFile } from 'node:fs/promises'
import { authoredSets, variedSets } from '../content/authored.mjs'
import { workshopSets } from '../content/workshop.mjs'
import { compileCatalog, ruleLibraryVersion } from '../src/engine/compile.mjs'

const sets = compileCatalog(authoredSets)
const varied = compileCatalog(variedSets, { requireVariety: true })
const workshop = compileCatalog(workshopSets, { requireVariety: true })
const dated = JSON.parse(await readFile(new URL('../content/season-one.json', import.meta.url), 'utf8'))
const dates = dated.map(set => set.date)
const timestamps = dates.map(date => Date.parse(`${date}T00:00:00Z`))
if (dates.length < 30 || timestamps.some((time, index) => !Number.isFinite(time)
  || new Date(time).toISOString().slice(0, 10) !== dates[index]
  || (index > 0 && time - timestamps[index - 1] !== 86_400_000))) {
  throw new Error('The first season needs at least 30 consecutive dates in YYYY-MM-DD format')
}
const scheduled = compileCatalog(dated, { requireVariety: true })
const catalog = {
  schema: 1, ruleLibraryVersion, epoch: '2026-11-20', sets,
  variety: { epoch: '2026-11-22', sets: varied },
  workshop: { epoch: '2026-11-26', sets: workshop },
  season: { startsOn: dates[0], days: Object.fromEntries(dates.map((date, index) => [date, scheduled[index]])) },
}
const text = JSON.stringify(catalog) + '\n'
const path = new URL('../public/content/daily.json', import.meta.url)

if (process.argv.includes('--check')) {
  if (text !== await readFile(path, 'utf8')) throw new Error('Daily content is stale. Run npm run content.')
} else {
  await writeFile(path, text)
}
const allSets = [...sets, ...varied, ...workshop, ...scheduled]
console.log(`Validated ${allSets.flatMap(set => set.puzzles).length} puzzles across ${allSets.length} sets.`)
