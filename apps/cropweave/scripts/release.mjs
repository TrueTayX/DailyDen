import {readFile,writeFile} from 'node:fs/promises'
import {getPuzzleDate} from '../../../packages/game/daily.mjs'
import {validateSequence} from './calendar.mjs'

const stored=new URL('../content/published-through.txt',import.meta.url)
const before=(await readFile(stored,'utf8')).trim()
const archive=JSON.parse(await readFile(new URL('../content/archive.json',import.meta.url),'utf8'))
if (!validateSequence(archive.calendar)) throw Error('CropWeave calendar validation failed')
const today=getPuzzleDate()
const latest=archive.calendar.filter(p=>p.date<=today).at(-1)
if (latest&&latest.date>before) {
  await writeFile(stored,latest.date+'\n')
  console.log('Publishing CropWeave through '+latest.date)
} else console.log('CropWeave release is current through '+before)
