import {readFile,writeFile} from 'node:fs/promises'
import {validateSequence} from './calendar.mjs'

const [date]=process.argv.slice(2)
const content=new URL('../content/',import.meta.url)
const path=new URL('archive.json',content)
const through=(await readFile(new URL('published-through.txt',content),'utf8')).trim()
if (!/^\d{4}-\d{2}-\d{2}$/.test(date??'')||date<=through) throw Error('Choose an unpublished date.')
const archive=JSON.parse(await readFile(path,'utf8'))
const i=archive.calendar.findIndex(p=>p.date===date)
const backup=archive.reserves.findIndex(p=>p.date===date)
if (i<0||backup<0) throw Error('No compatible reserve for '+date)
;[archive.calendar[i],archive.reserves[backup]]=[archive.reserves[backup],archive.calendar[i]]
if (!validateSequence(archive.calendar)) throw Error('This swap breaks the calendar constraints.')
await writeFile(path,JSON.stringify(archive)+'\n')
