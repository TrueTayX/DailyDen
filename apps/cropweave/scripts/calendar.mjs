import { versions,RULES_VERSION,GENERATOR_VERSION } from '../public/config.mjs'
import { compile, EMPTY, score, thresholds, validLayout, legal } from '../public/engine.mjs'
import { anneal, beam, rng, randomLayout, greedy, removalImpact, estimate, prove } from './solver.mjs'

export const LAUNCH = '2026-11-26'
const makeDate = n => new Date(Date.parse(LAUNCH+'T00:00:00Z')+86400000*(n-1))
export const dateFor = n => makeDate(n).toISOString().slice(0,10)
const v=versions[RULES_VERSION]
export const templates = [
  [7,20,8,9,2,2,6],[5,10,6,6,0,1,3],[5,11,6,6,0,1,3],
  [6,14,6,7,1,1,4],[6,15,7,7,1,1,4],[6,16,7,8,1,2,5],[7,18,8,9,2,2,6]
]
export const decks=['balanced','crop-heavy','bee-heavy','wheat-heavy','support-heavy','animal-heavy']
const shapes=['square','plus','l']
const distinct = hand => Object.keys(hand).filter(k=>hand[k]>0)
const isCrop=tile=>tile.group==='crop'
export const requiredDayTiles=day=>v.tiles.filter(t=>t.unlock===day&&day!==1).map(t=>t.id)
export const dayTemplate=date=>templates[new Date(date+'T00:00:00Z').getUTCDay()]
export const signature=p=>JSON.stringify([p.plot,p.ruleCard,Object.entries(p.hand).sort()])
export function tileRules(p) {
  const ids=distinct(p.hand), tiles=ids.map(id=>v.tiles.find(t=>t.id===id))
  if (tiles.some(t=>!t || t.unlock>p.day || p.hand[t.id]>t.limit || !Number.isInteger(p.hand[t.id]))) return false
  const c=tiles.filter(isCrop), f=tiles.filter(t=>t.group==='flower')
  const num=t=>p.hand[t]??0, total=ids.reduce((n,id)=>n+num(id),0)
  const crops=c.reduce((n,t)=>n+num(t.id),0)
  const helpers=tiles.filter(t=>t.group==='helper').reduce((n,t)=>n+num(t.id),0)
  const [size,n,min,max,minMods,maxMods,kindMax]=dayTemplate(p.date)
  const kinds=new Set(tiles.map(t=>t.relation).filter(Boolean))
  const modifiers=Number(p.plot.rocks.length>0)+Number(Boolean(p.plot.river))+Number(p.plot.fixed.length>0)
  if (size!==p.plot.size||total!==n||ids.length<min||ids.length>max||modifiers<minMods||modifiers>maxMods||kinds.size>kindMax) return false
  if (ids.some(id=>!(num(id)>0))||crops<3||helpers*5>total*2||
    (num('wheat')&&num('wheat')<3)||(num('corn')&&num('corn')<2)||
    (num('cabbage')&&c.length<3)||(num('barn')&&crops<4)||
    (num('beehive')&&f.reduce((a,t)=>a+num(t.id),0)<2)||
    (num('chicken-coop')&&c.length<2)||(num('market-stall')&&ids.length<5)) return false
  if (num('beehive')&&num('chicken-coop')&&(crops<5||kindMax===3)) return false
  if (!v.cards[p.ruleCard]||v.cards[p.ruleCard].needs&&!num(v.cards[p.ruleCard].needs)) return false
  return requiredDayTiles(p.day).every(id=>num(id))
}

function choose(array,random) {return array[random(array.length)]}
function take(array,random) {return array.splice(random(array.length),1)[0]}
function weight(tile,deck,card) {
  let w=2
  if (deck==='bee-heavy'&&(tile.group==='flower'||tile.id==='beehive')) w+=5
  if (deck==='support-heavy'&&tile.group==='helper') w+=4
  if (deck==='crop-heavy'&&tile.group==='crop') w+=4
  if (deck==='wheat-heavy'&&tile.id==='wheat') w+=9
  if (deck==='animal-heavy'&&tile.group==='animal') w+=5
  if (card==='market-day'&&(tile.group==='crop'||tile.id==='barn')) w+=3
  if (card==='bee-festival'&&(tile.group==='flower'||tile.id==='beehive')) w+=5
  if (card==='crow-day'&&tile.id==='scarecrow') w+=3
  return w
}

export function candidate(day,seed,prior=[],locked=null) {
  const date=dateFor(day), [size,length,min,max,minMods,maxMods,maxKinds]=dayTemplate(date)
  const random=rng(seed), previous=prior.at(-1), required=requiredDayTiles(day)
  const eligible=v.tiles.filter(t=>t.unlock<=day)
  const cards=Object.keys(v.cards).filter(card=>prior.slice(-13).filter(p=>p.ruleCard===card).length<2&&
    (!v.cards[card].needs||eligible.some(tile=>tile.id===v.cards[card].needs)))
  if (!cards.length) return null
  const deck=locked?.deck??choose(decks.filter(d=>d!==previous?.deck),random)
  const shape=locked?.plot.shape??choose(shapes.filter(s=>s!==previous?.plot.shape),random)
  const ruleCard=locked?.ruleCard??choose(cards,random)
  const minCopy=id=>id==='wheat'?3:id==='corn'?2:1
  for (let guess=0;guess<70;guess++) {
    const p={id:`cw-${String(day).padStart(4,'0')}`,day,date,rulesVersion:RULES_VERSION,generator:GENERATOR_VERSION,
      seed,deck,ruleCard,plot:{size,shape,rocks:[],river:null,fixed:[]},hand:{}}
    const needed=[...new Set([...required,...(v.cards[ruleCard].needs?[v.cards[ruleCard].needs]:[])])]
    if (ruleCard==='bee-festival') needed.push('sunflower','lavender')
    if (ruleCard==='crow-day') needed.push('scarecrow')
    const hand=p.hand
    for (const id of new Set(needed)) hand[id]=minCopy(id)
    const typeCount=min+random(max-min+1)
    const weights=new Map(eligible.map(t=>[t.id,weight(t,deck,ruleCard)]))
    let remaining=length-Object.values(hand).reduce((a,b)=>a+b,0)
    for (;Object.keys(hand).length<typeCount && remaining>0;) {
      const entries=eligible.filter(t=>!(t.id in hand)&&minCopy(t.id)<=remaining).flatMap(t=>Array(weights.get(t.id)).fill(t))
      if (!entries.length) break
      const tile=choose(entries,random)
      hand[tile.id]=minCopy(tile.id)
      remaining-=hand[tile.id]
    }
    const boost=Math.floor(length*.4)
    while (remaining>0) {
      const helpers=eligible.filter(t=>t.group==='helper').reduce((n,t)=>n+(hand[t.id]??0),0)
      const choices=eligible.filter(t=>hand[t.id]&&hand[t.id]<t.limit&&(t.group!=='helper'||helpers<boost))
        .flatMap(t=>Array(weights.get(t.id)).fill(t))
      if (!choices.length) break
      hand[choose(choices,random).id]++
      remaining--
    }
    if (remaining) continue
    const plot=compile(p)
    const cells=plot.open.slice()
    const options=['rocks','river','fixed']
    for (let m=minMods+random(maxMods-minMods+1);m>0;m--) {
      const mod=take(options,random)
      if (mod==='rocks') {
        const count=2+random(3)
        p.plot.rocks=Array.from({length:count},()=>plot.positions[take(cells,random)]).sort()
      } else if (mod==='river') {
        const axis=choose([0,1],random)
        const lines=Array.from({length:size-2},(_,i)=>cells.filter(j=>plot.positions[j][axis]===i+1))
          .filter(x=>x.length>=Math.ceil(size/2))
        if (!lines.length) continue
        const line=choose(lines,random)
        p.plot.river={axis:axis?'column':'row',cells:line.map(i=>plot.positions[i])}
        for (const i of line) cells.splice(cells.indexOf(i),1)
      } else {
        p.plot.fixed=[{cell:plot.positions[take(cells,random)],tile:choose(eligible.filter(t=>isCrop(t)||t.id==='barn'),random).id}]
      }
    }
    if (tileRules(p)) return p
  }
  return null
}

function densityRange(size) { return size===5 ? [.38,.68] : size===6 ? [.37,.64] : [.36,.62] }
const limit = (p,best)=>p.plot.size===7 ? .03*best : .02*best
function affected(p,layout,scoreWith,change) {
  const base=compile(change), before=compile(p)
  const translate=(board,target,source)=>Array.from(board,(tile,i)=>target.origin[i]!==EMPTY
    ?target.origin[i]:(source.origin[i]===EMPTY?tile:EMPTY))
  const alt=anneal(base,p.seed^0xfdbc239,3,1300)[0]
  const translated=translate(layout,base,before)
  const reverse=translate(alt.layout,before,base)
  const displaced=alt.layout.some((tile,i)=>tile>=0&&base.origin[i]===EMPTY&&before.origin[i]!==EMPTY)
  return displaced || alt.score>score(base,translated) || scoreWith>score(before,reverse)
}

export function ruleMatters(p,layout,best) {
  if (p.ruleCard==='standard') return true
  const without={...p,ruleCard:'standard'}
  return score(compile(without),layout)<=.9*best || affected(p,layout,best,without)
}

export function audit(p,solution,quick=false) {
  const {plot,first,second,top}=solution
  const best=top[0], random=rng(p.seed^0xcae74169)
  if (!validLayout(plot,best.layout)) throw Error('Invalid solver result')
  const samples=quick?80:600
  let total=0
  for (let i=0;i<samples;i++) total+=score(plot,randomLayout(plot,random))
  const randomAvg=total/samples, greedyScore=greedy(plot)
  const density=plot.hand.reduce((a,b)=>a+b,0)/plot.open.length
  const [low,high]=densityRange(plot.size)
  const parts=score(plot,best.layout,true)
  const bonusShare=(best.score-parts.totals[0])/best.score
  const impacts={}
  for (const i of plot.open) {
    const type=best.layout[i]
    if (type<0) continue
    const id=plot.config.tiles[type].id
    impacts[id]=Math.max(impacts[id]??0,removalImpact(plot,best.layout,i,best.score))
  }
  const gates={hand:tileRules(p),density:density>=low&&density<=high,
    skill:randomAvg<=.45*best.score&&greedyScore<=.85*best.score,bonus:bonusShare>=.4,
    contributed:Object.keys(p.hand).every(id=>impacts[id]>=1)}
  if (!quick&&Object.values(gates).every(Boolean)) {
    gates.agreement=second.length>0&&Math.abs(first[0].score-second[0].score)<=limit(p,best.score)
    gates.rule=ruleMatters(p,best.layout,best.score)
    gates.rocks=!p.plot.rocks.length||affected(p,best.layout,best.score,{...p,plot:{...p.plot,rocks:[]}})
    gates.river=!p.plot.river||affected(p,best.layout,best.score,{...p,plot:{...p.plot,river:null}})
  }
  return {gates,randomAvg,greedy:greedyScore,density,bonusShare,impacts,annealing:first[0].score,beam:second[0]?.score}
}

export function judge(p) {
  const fast=estimate(p)
  const early=audit(p,fast,true)
  // Only deprioritize clearly weak candidates before the two full searches.
  if (!early.gates.hand || !early.gates.density || !early.gates.contributed ||
      early.randomAvg>.51*fast.top[0].score || early.greedy>.92*fast.top[0].score) return null
  let solution=estimate(p,1)
  let metrics=audit(p,solution)
  if (metrics.gates.agreement===false&&Object.entries(metrics.gates).every(([k,ok])=>k==='agreement'||ok)) {
    const plot=solution.plot
    const first=anneal(plot,p.seed^0x13abf0,36,3300)
    const second=beam(plot,p.seed^0x66a3512,350,24)
    const top=[...solution.top,...first,...second].sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key))
    solution={plot,first:first[0].score>solution.first[0].score?first:solution.first,
      second:second[0].score>solution.second[0].score?second:solution.second,
      top:[...new Map(top.map(p=>[p.key,p])).values()].slice(0,4)}
    metrics=audit(p,solution)
  }
  if (!Object.values(metrics.gates).every(Boolean)) return null
  const best=solution.top[0]
  const proof=p.plot.size===5 ? prove(solution.plot) : {proven:false}
  if (proof.proven && proof.score!==best.score) throw Error('Solver disagreed with exact proof')
  return {...p,bestKnown:{score:best.score,status:proof.proven?'proven':'best-known',layout:best.layout},
    alternatives:solution.top.slice(1).map(x=>({score:x.score,layout:x.layout})),stars:thresholds(best.score),metrics}
}

export function validateSequence(calendar) {
  const keys=new Set()
  for (const [i,p] of calendar.entries()) {
    if (p.day!==i+1||p.date!==dateFor(i+1)||!tileRules(p)||keys.has(signature(p))) return false
    const previous=calendar[i-1]
    if (previous?.deck===p.deck||previous?.plot.shape===p.plot.shape||
        calendar.slice(Math.max(0,i-13),i).filter(day=>day.ruleCard===p.ruleCard).length>=2) return false
    keys.add(signature(p))
  }
  return true
}
