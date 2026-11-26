import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {compile,score,thresholds,validLayout} from '../public/engine.mjs'
import {candidate,signature,tileRules,validateSequence,audit} from './calendar.mjs'
import {estimate} from './solver.mjs'
import {publicCalendar} from './publication.mjs'

const load = async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'))
const archive=await load('../content/archive.json')
const balance=await load('../content/balance.json')
const released=await load('../../../dist/cropweave/calendar.json')
const through=(await readFile(new URL('../content/published-through.txt',import.meta.url),'utf8')).trim()
assert.ok(archive.calendar.length>=60)
assert.ok(archive.reserves.length>=Math.ceil(archive.calendar.length*.5))
assert.ok(balance.samples>=2000)
assert.ok(Object.values(balance.tiles).every(tile=>!tile.flag), 'Tile balance has unresolved flags')
assert.ok(validateSequence(archive.calendar))
assert.deepEqual(released,publicCalendar(archive,through))
const keys=new Set()
for (const p of [...archive.calendar,...archive.reserves]) {
  const plot=compile(p), best=p.bestKnown.score, key=signature(p)
  assert.ok(!keys.has(key))
  keys.add(key)
  assert.ok(tileRules(p),p.date)
  const prior=archive.calendar.slice(0,p.day-1)
  const versions=[candidate(p.day,p.seed,prior),candidate(p.day,p.seed,prior,p)].filter(Boolean)
  assert.ok(versions.some(v=>signature(v)===key),p.date+' could not be regenerated')
  assert.ok(validLayout(plot,p.bestKnown.layout))
  assert.equal(score(plot,p.bestKnown.layout),best)
  assert.deepEqual(p.stars,thresholds(best))
  for (const other of p.alternatives) {
    assert.ok(validLayout(plot,other.layout))
    assert.equal(score(plot,other.layout),other.score)
    assert.ok(other.score<=best)
  }
  const gateNames=['hand','density','skill','bonus','contributed','agreement','rule','rocks','river']
  assert.ok(gateNames.every(gate=>p.metrics.gates[gate]===true),p.date)
  assert.ok(p.metrics.randomAvg/best<=.45&&p.metrics.greedy/best<=.85&&p.metrics.bonusShare>=.4)
  assert.ok(Math.abs(p.metrics.annealing-p.metrics.beam)/best<=(p.plot.size===7?.03:.02))
  const observed=audit(p,{plot,top:[p.bestKnown],first:[{score:p.metrics.annealing}],second:[{score:p.metrics.beam}]})
  assert.deepEqual(observed,p.metrics,`Stored metrics differ from a gate rerun for ${p.date}`)
  if (p.day%13===1 && archive.calendar.includes(p)) {
    const independent=estimate(p,1)
    assert.ok(independent.second[0].score/best>=.9,p.date+' beam audit')
    const reviewed=audit(p,{...independent,top:[p.bestKnown]},true)
    assert.ok(reviewed.gates.bonus&&reviewed.gates.contributed)
  }
}
const base=process.env.CROPWEAVE_BASE
if (/^[a-f0-9]{40}$/.test(base??'')&&!/^0+$/.test(base)) {
  const before=spawnSync('git',['show',base+':dist/cropweave/calendar.json'],{encoding:'utf8',maxBuffer:16*1024*1024})
  if (before.status===0) {
    for (const [date,puzzle] of Object.entries(JSON.parse(before.stdout).days)) {
      assert.deepEqual(released.days[date],puzzle,'Published CropWeave puzzle changed or was removed on '+date)
    }
  }
}
console.log(`CropWeave calendar verified with ${archive.calendar.length} days, ${archive.reserves.length} reserves, and ${balance.samples} balance samples.`)
