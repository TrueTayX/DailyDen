import test from 'node:test'
import assert from 'node:assert/strict'
import { achievementProgress } from '../public/achievements.mjs'

function map(records, rules) {
  return Object.fromEntries(achievementProgress(records,rules).map(badge=>[badge.id,badge]))
}

test('achievements derive from completed production results, never legacy Beta or unfinished runs',()=>{
  const records={
    '2026-11-26':{result:{stars:3,golden:true}},
    '2026-11-27':{result:{beta:true,stars:3,golden:true}},
    '2026-11-28':{result:{beta:false,stars:3,golden:true,ruleCard:'standard'}},
    '2026-11-29':{result:null}
  }
  const badges=map(records,['standard','dry-season'])
  assert.equal(Object.keys(badges).length,18)
  for (const id of ['first-sprout','rising-star','bumper-crop','golden-farm','weekend-warrior']) assert.ok(badges[id].earned,id)
  assert.equal(badges['green-thumb'].count,1)
  assert.equal(badges['full-almanac'].count,1)
  assert.equal(badges['full-almanac'].goal,2)
  assert.ok(map(records,['standard'])['full-almanac'].earned)
})

test('historic streaks persist after gaps and a low-star farm breaks only the two-star streak',()=>{
  const records={}
  for (let i=1;i<=9;i++) records['2027-01-0'+i]={result:{beta:false,stars:i===2?1:2}}
  records['2027-01-12']={result:{beta:false,stars:3}}
  const badges=map(records)
  assert.equal(badges['green-thumb'].count,10)
  assert.equal(badges['monthly-harvest'].count,9)
  assert.equal(badges['steady-hand'].count,7)
  assert.ok(badges['steady-hand'].earned)
  assert.equal(badges['triple-threat'].count,1)
})
