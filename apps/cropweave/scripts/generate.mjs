import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {candidate,dateFor,judge,signature,validateSequence} from './calendar.mjs'
import {estimate} from './solver.mjs'
import {contributions} from '../public/engine.mjs'
import {versions,RULES_VERSION} from '../public/config.mjs'

const [mode='calendar', countArg='70',path='apps/cropweave/content/archive.json']=process.argv.slice(2)
const count=Number(countArg)
if (!Number.isSafeInteger(count)||count<1) throw Error('Provide a positive puzzle count.')
const write = data => {
  const tmp=path+'.tmp'
  writeFileSync(tmp,JSON.stringify(data)+'\n')
  renameSync(tmp,path)
}
const seedFor = (day,attempt,salt=0) => (Math.imul(day+salt,73856093)^Math.imul(attempt+1,19349663)^0xc0ffee)>>>0

if (mode==='balance') {
  const summary=Object.fromEntries(versions[RULES_VERSION].tiles.map(({id})=>[id,{hands:0,layouts:0,share:0}]))
  let tested=0, sample=0
  const patterns={}
  while (tested<count) {
    const day=1+sample%92
    const p=candidate(day,seedFor(day,sample++,901))
    if (!p) continue
    const {plot,top}=estimate(p)
    const {score,layout}=top[0]
    const attributed=contributions(plot,layout)
    for (const id of Object.keys(p.hand)) summary[id].hands++
    for (const [type, amount] of attributed.entries()) {
      const entry=summary[plot.config.tiles[type].id]
      if (layout.includes(type)) {
        entry.layouts++
        entry.share+=amount/score
      }
    }
    const occupied=plot.open.filter(i=>layout[i]>=0)
    const edges=occupied.filter(i=>plot.neighbors[i].edge).length/occupied.length
    const pattern=edges>=.65?'edge-heavy':edges<=.25?'interior-heavy':'mixed'
    patterns[pattern]=(patterns[pattern]??0)+1
    tested++
  }
  for (const s of Object.values(summary)) {
    s.share=s.layouts ? s.share/s.layouts : 0
    s.flag=s.share<.05||s.share>.25
  }
  write({samples:tested,method:'annealing; mean allocated coin share when present',tiles:summary,patterns})
  console.log('Recorded balance metrics for '+tested+' puzzles.')
} else if (mode==='calendar') {
  let archive={calendar:[],reserves:[]}
  try { archive=JSON.parse(readFileSync(path,'utf8')) } catch (error) {if (error.code!=='ENOENT') throw error}
  const {calendar,reserves}=archive
  if (!validateSequence(calendar)) throw Error('Invalid starting calendar.')
  const seen=new Set([...calendar,...reserves].map(signature))
  const floor=calendar.length, attempts=new Map()
  for (let retreats=0;calendar.length<count;) {
    const day=calendar.length+1
    let chosen
    let i=attempts.get(day)??0
    const budget=i+140
    for (;i<budget&&!chosen;i++) {
      const p=candidate(day,seedFor(day,i),calendar)
      if (!p||seen.has(signature(p))) continue
      chosen=judge(p)
    }
    attempts.set(day,i)
    if (!chosen) {
      if (calendar.length<=floor || ++retreats>1200) throw Error('Cannot satisfy the gates for '+dateFor(day))
      const back=Math.min(calendar.length-floor, 1+Math.floor(i/140)%3)
      for (let n=0;n<back;n++) seen.delete(signature(calendar.pop()))
      console.log('Retrying from '+dateFor(calendar.length+1)+' after competing requirements for '+dateFor(day))
      continue
    }
    seen.add(signature(chosen))
    calendar.push(chosen)
    console.log(`${chosen.date} #${day} ${chosen.ruleCard} ${chosen.deck} ${chosen.bestKnown.score}`)
    write(archive)
  }
  for (const p of calendar) {
    if (reserves.length>=Math.ceil(count*.5)) break
    if (reserves.some(x=>x.date===p.date)) continue
    for (let i=0;i<70;i++) {
      const reserve=candidate(p.day,seedFor(p.day,i,230021),calendar.slice(0,p.day-1),p)
      if (!reserve||seen.has(signature(reserve))) continue
      const judged=judge(reserve)
      if (!judged) continue
      reserves.push(judged)
      seen.add(signature(judged))
      write(archive)
      break
    }
  }
  console.log('Calendar: '+calendar.length+' days, '+reserves.length+' reserves.')
} else throw Error('Usage: generate.mjs calendar|balance [count] [output]')
