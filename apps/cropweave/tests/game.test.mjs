import assert from 'node:assert/strict'
import {test} from 'node:test'
import {compile,score,thresholds,rating,legal,validLayout,contributions,VOID,ROCK,WATER,EMPTY} from '../public/engine.mjs'
import {puzzleForDay,shareText,summarized} from '../public/daily.mjs'
import {getPuzzleDate,gameStorage} from '../../../packages/game/daily.mjs'
import {anneal,beam,prove,rng} from '../scripts/solver.mjs'
import {audit,candidate,ruleMatters,validateSequence} from '../scripts/calendar.mjs'
import {publicCalendar} from '../scripts/publication.mjs'

const fixture=(ruleCard='standard', hand={}, plot={})=>({
  date:'2026-11-26',day:1,rulesVersion:'1.0',ruleCard,hand,
  plot:{size:5,shape:'square',rocks:[],river:null,fixed:[],...plot}
})
function game(tiles,rule='standard',terrain={}) {
  const plot=compile(fixture(rule,{},terrain))
  const board=plot.origin.slice()
  for (const [i,id] of tiles) board[i]=plot.byId[id]
  return [plot,board,score(plot,board,true)]
}
const tile=(at,layout,rule,terrain)=>game(layout,rule,terrain)[2].tiles[at]
const placementTests=[
  ['Wheat adjacency',6,[[6,'wheat'],[7,'wheat'],[12,'wheat']],2],
  ['Carrot base',6,[[6,'carrot']],2],
  ['Cabbage only counts different crop types',6,[[6,'cabbage'],[5,'wheat'],[7,'wheat'],[11,'carrot'],[1,'cabbage']],3],
  ['Corn includes itself and scores its row',6,[[6,'corn'],[8,'corn'],[11,'corn']],2],
  ['Pear Tree base',6,[[6,'pear-tree']],3],
  ['Sunflower base',6,[[6,'sunflower']],1],
  ['Lavender scores neighboring Beehives',6,[[6,'lavender'],[5,'beehive'],[7,'beehive']],3],
  ['Beehive scores both kinds of flowers',6,[[6,'beehive'],[5,'sunflower'],[7,'lavender']],4],
  ['Chicken Coop scores varied crops',6,[[6,'chicken-coop'],[5,'wheat'],[7,'carrot']],3],
  ['Chicken Coop base with matching crops',6,[[6,'chicken-coop'],[5,'wheat'],[7,'wheat']],1],
  ['Well has no direct score',6,[[6,'well'],[7,'carrot']],0],
  ['Pond has no direct score',1,[[1,'pond'],[7,'carrot']],0],
  ['Scarecrow has no direct score',6,[[6,'scarecrow'],[7,'carrot']],0],
  ['Barn scores its row and column',6,[[6,'barn'],[21,'wheat'],[9,'carrot'],[7,'sunflower']],2],
  ['Windmill scores diagonal crops',6,[[6,'windmill'],[0,'carrot'],[12,'corn'],[7,'carrot']],4],
  ['Market Stall counts different nearby tiles',6,[[6,'market-stall'],[0,'carrot'],[5,'carrot'],[12,'scarecrow'],[7,'sunflower']],3]
]
for (const [name,index,layout,expected] of placementTests) test(name,()=>assert.equal(tile(index,layout).total,expected))

test('bonuses apply once per crop, including diagonal Pond and Scarecrow',()=>{
  const layout=[[6,'carrot'],[1,'well'],[5,'well'],[0,'pond'],[7,'beehive'],[11,'beehive'],[10,'scarecrow'],[12,'scarecrow']]
  assert.deepEqual(tile(6,layout).parts,[2,0,0,1,1,1,0,0])
  const [plot,board,bench]=game(layout)
  assert.ok(Math.abs(contributions(plot,board).reduce((a,b)=>a+b,0)-bench.coins)<1e-9)
  assert.ok(legal(plot,0,plot.byId.pond))
  assert.ok(!legal(plot,6,plot.byId.pond))
})

const cardTests=[
  ['standard',6,[[6,'carrot']],2],
  ['dry-season',6,[[6,'carrot'],[7,'well']],4],
  ['bee-festival',6,[[6,'beehive'],[7,'lavender']],3],
  ['crow-day',6,[[6,'wheat'],[7,'wheat']],1],
  ['crow-day',6,[[6,'wheat'],[7,'wheat'],[0,'scarecrow']],3],
  ['bumper-wheat',6,[[6,'wheat']],2],
  ['cozy-corners',0,[[0,'well']],2],
  ['cozy-corners',6,[[6,'well']],0],
  ['market-day',6,[[6,'barn'],[7,'carrot']],2],
  ['orchard-season',6,[[6,'pear-tree']],5],
  ['free-range',6,[[6,'chicken-coop'],[5,'wheat'],[7,'carrot']],5],
  ['windy-day',6,[[6,'windmill'],[0,'carrot']],4],
]
for (const [card,index,layout,expected] of cardTests) {
  test(card+' scoring '+index+' '+expected,()=>assert.equal(tile(index,layout,card).total,expected))
}

test('rocks, river, fixed pieces, irregular edges',()=>{
  const p=compile(fixture('dry-season',{},{
    shape:'l',rocks:[[1,0]],river:{axis:'column',cells:[[1,1],[2,1]]},fixed:[{cell:[0,2],tile:'carrot'}]}))
  assert.equal(p.origin[3],VOID)
  assert.equal(p.origin[5],ROCK)
  assert.equal(p.origin[6],WATER)
  assert.equal(p.origin[2],p.byId.carrot)
  assert.ok(!legal(p,2,p.byId.well))
  assert.equal(tile(7,[[7,'carrot']],'dry-season',{river:{axis:'column',cells:[[1,1]]}}).total,4)
  assert.equal(compile(fixture('standard',{}, {shape:'plus'})).origin[0],VOID)
})

test('independent search, determinism, and a small proven optimum',()=>{
  const p=compile(fixture('standard',{wheat:2},{rocks:[[0,0],[0,1],[0,2]]}))
  const a=anneal(p,918273,3,250)[0], b=beam(p,91809,20,8)[0]
  const proof=prove(p)
  assert.deepEqual(a,anneal(p,918273,3,250)[0])
  assert.ok(validLayout(p,a.layout))
  assert.equal(proof.proven,true)
  assert.equal(a.score,b.score)
  assert.equal(b.score,proof.score)
  assert.equal(proof.score,4)
  assert.equal(prove(p,5).proven,false)
  assert.deepEqual(candidate(1,918273),candidate(1,918273))
  const random=rng(9)
  assert.equal(random(),rng(9)())
})

test('strict star thresholds and spoiler-free sharing',()=>{
  for (let i=3;i<200;i++) {
    const [a,b,c]=thresholds(i)
    assert.ok(a>=1&&a<b&&b<c&&c<=i)
  }
  const p={day:12,stars:[37,49,58],bestKnown:{score:61,layout:['SECRET-LAYOUT']},board:'SECRET-PLACEMENTS'}
  const result=rating(p,54)
  const share=shareText(p,{...result,moves:'SECRET-MOVES'},'Dry Season')
  assert.equal(share,'CropWeave #12 ★★☆ · 54 coins (89% of best)\nDry Season\nhttps://dailyden.games/cropweave/?ref=share')
  assert.doesNotMatch(share,/SECRET|layout|board|placement|moves/i)
  assert.equal(rating(p,62).golden,true)
})

test('Pacific dates across both daylight-saving changes and missing files',()=>{
  const moments={
    '2027-03-14T07:59:59Z':'2027-03-13','2027-03-14T08:00:00Z':'2027-03-14',
    '2027-03-15T06:59:59Z':'2027-03-14','2027-03-15T07:00:00Z':'2027-03-15',
    '2027-11-07T06:59:59Z':'2027-11-06','2027-11-07T07:00:00Z':'2027-11-07',
    '2027-11-08T07:59:59Z':'2027-11-07','2027-11-08T08:00:00Z':'2027-11-08'
  }
  for (const [time,date] of Object.entries(moments)) assert.equal(getPuzzleDate(new Date(time)),date)
  const days={'2027-03-14':{id:14},'2027-03-16':{id:16}}
  assert.equal(puzzleForDay(days,'2027-03-13'),null)
  assert.equal(puzzleForDay(days,'2027-03-15').id,14)
  assert.equal(puzzleForDay(days,'2027-03-17').id,16)
  const archive={calendar:[{date:'2027-03-14',metrics:{},alternatives:['reserved']},{date:'2027-03-16',metrics:{}}]}
  const release=publicCalendar(archive,'2027-03-14')
  assert.deepEqual(Object.keys(release.days),['2027-03-14'])
  assert.doesNotMatch(JSON.stringify(release),/reserved|2027-03-16/)
  assert.ok(validateSequence([]))
})

test('storage failure keeps the current tab playable and practice cannot count toward stats',()=>{
  const broken={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}
  const store=gameStorage('cropweave',broken)
  assert.deepEqual(store.read('progress',{}),{})
  const data={'2026-11-26':{result:{coins:24,stars:2,percent:81}},'2026-11-27':{board:[EMPTY]}}
  store.write('progress',data)
  assert.deepEqual(store.read('progress',{}),data)
  assert.equal(store.persistent,false)
  assert.equal(summarized(data).days,1)
  assert.deepEqual(summarized(data).distribution,[0,0,1,0])
})

test('analytics whitelists fields and rejects invalid score events and oversized batches',async()=>{
  const {eventBatch}=await import('../../../functions/cropweave/api/events.js')
  const example={name:'puzzle_finished',env:'beta',puzzle:'cw-0012',date:'2026-12-07',weekday:1,
    coins:29,stars:2,percent:81,time:64,undos:1,pickups:1,preview:true,beatBest:false}
  assert.deepEqual(eventBatch([{...example,placements:[1,2,3],identifier:'person'}]),[example])
  assert.deepEqual(eventBatch([{...example,stars:4}]),[])
  assert.deepEqual(eventBatch(Array(13).fill(example)),[])
})


test('rule and contribution gates reject unused scoring effects',()=>{
  const inactive=fixture('windy-day',{carrot:1})
  const p=compile(inactive)
  const layout=p.origin.slice()
  layout[0]=p.byId.carrot
  assert.equal(ruleMatters(inactive,layout,2),false)
  const active={...inactive,ruleCard:'cozy-corners'}
  assert.equal(ruleMatters(active,layout,4),true)
  const withWell=fixture('standard',{carrot:1,well:1})
  const plot=compile(withWell)
  layout[24]=plot.byId.well
  const solution={plot,top:[{layout,score:2}],first:[{score:2}],second:[]}
  assert.equal(audit(withWell,solution,true).gates.contributed,false)
  layout[24]=EMPTY
  layout[1]=plot.byId.well
  solution.top[0].score=3
  solution.first[0].score=3
  assert.equal(audit(withWell,solution,true).gates.contributed,true)
})
