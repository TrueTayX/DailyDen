import { getPuzzleDate,dayStreak,gameStorage,copyText } from '../assets/game-daily.mjs'
import { categories,sprite } from './config.mjs'
import { compile,score,rating,legal,EMPTY,ROCK,WATER,VOID } from './engine.mjs'
import { puzzleForDay,shareText,starText,summarized } from './daily.mjs'
import { telemetry } from './telemetry.mjs'

const $=id=>document.getElementById(id)
const element=(tag,text,className)=>{
  const node=document.createElement(tag)
  if (text!==undefined) node.textContent=text
  if (className) node.className=className
  return node
}
const object=data=>data&&typeof data==='object'&&!Array.isArray(data)?data:{}
const close=id=>$(id).close()
let storage
try {storage=window.localStorage} catch { /* proceed with a tab-local save */ }
const store=gameStorage('cropweave',storage)
const shared=gameStorage('dailyden',storage)
let settings=object(shared.read('settings',{}))
const progress=object(store.read('progress',{}))
const today=getPuzzleDate()
const review=new URLSearchParams(location.search).get('review')
let plot,puzzle,official,run,events
let practice=false,selected=null,inspected=null,recent=null,hovered=null,focusType=null,category=null,prediction=null
let roving=0,hold,skipClick=false,deltaTimer,details
const cells=[],trayButtons=[], scoreButtons=[]

function attempt() {
  return {board:plot.origin.slice(),history:[],started:null,pickups:0,undos:0,preview:false,result:null}
}
function save() {
  if (!practice&&!review) {
    progress[puzzle.date]=official
    store.write('progress',progress)
  }
}
function hydrate(saved) {
  if (!Array.isArray(saved?.board)||saved.board.length!==plot.origin.length) return attempt()
  const remaining=[...plot.hand]
  for (const [i,t] of saved.board.entries()) {
    if (plot.origin[i]!==EMPTY) {
      if (t!==plot.origin[i]) return attempt()
    } else if (t!==EMPTY && (!Number.isInteger(t)||t<0||t>=remaining.length||!legal(plot,i,t)||--remaining[t]<0)) return attempt()
  }
  if (saved.result&&remaining.some(Boolean)) return attempt()
  return {...attempt(),...saved,history:Array.isArray(saved.history)?saved.history:[]}
}
function paintSettings() {
  document.documentElement.classList.toggle('contrast',Boolean(settings.highContrast))
  document.documentElement.classList.toggle('reduced',Boolean(settings.reduceMotion))
  $('contrast').checked=Boolean(settings.highContrast)
  $('motion').checked=Boolean(settings.reduceMotion)
  $('preview-enabled').checked=Boolean(settings.cropweavePreview)
}
function updateSetting(key,value) {
  settings={...object(shared.read('settings',{})),[key]:value}
  shared.write('settings',settings)
  paintSettings()
}
for (const [id,key] of [['contrast','highContrast'],['motion','reduceMotion'],['preview-enabled','cropweavePreview']]) {
  $(id).addEventListener('change',e=>updateSetting(key,e.target.checked))
}
paintSettings()

function picture(type) {
  const img=element('img')
  img.src=sprite[plot.config.tiles[type].id]
  img.alt=''
  img.draggable=false
  return img
}
function tipFor(type) {
  const tile=plot.config.tiles[type]
  const v=plot.values
  return tile.tip(v)+(v.crow&&tile.group==='crop'?' Base coins need protection.':'')+
    (v.corners?' +'+v.corners+' in a corner.':'')
}
function diagram(type) {
  const relation=plot.config.tiles[type]?.relation
  const side=[1,3,5,7], diagonal=[0,2,6,8]
  const positions=relation==='area'||relation==='variety'&&plot.config.tiles[type].id==='market-stall'?[...side,...diagonal]:
    relation==='diagonal'?diagonal:relation==='line'&&plot.config.tiles[type]?.id==='corn'?[3,5]:
    ['line','variety','adjacent'].includes(relation)?side:[]
  $('diagram').replaceChildren(...Array.from({length:9},(_,i)=>element('span',i===4?'•':'',i===4?'center':positions.includes(i)?'affects':'')))
}
function updateTip() {
  const type=hovered??focusType??(inspected===null?null:run.board[inspected])??selected??recent
  const visible=Number.isInteger(type)&&type>=0
  const cell=inspected!==null && type===run.board[inspected] ? details.tiles[inspected] : null
  $('tip-name').textContent=visible?plot.config.tiles[type].name+(cell?' · '+cell.total+' coins':''):'Piece scoring'
  $('tip-text').textContent=cell ? (cell.parts.flatMap((n,i)=>n?[n+' '+categories[i].name.toLowerCase()]:[]).join(' · ')||'No coins from this position.') :
    visible ? tipFor(type) : 'Choose a tile to see how it scores.'
  $('tip-text').setAttribute('aria-live',inspected!==null?'polite':'off')
  $('pickup').hidden=!cell||plot.permanent.has(inspected)||Boolean(run.result)
  diagram(visible?type:null)
  if (visible&&!practice&&!review) events.event('tip_shown',{tile:plot.config.tiles[type].id})
}
function amounts() {
  const counts=[...plot.hand]
  for (const i of plot.open) if (run.board[i]>=0) counts[run.board[i]]--
  return counts
}
const mark=(label,name)=>element('span',label,name)

function cellLabel(i,type,data,fixed) {
  const [row,col]=plot.positions[i]
  const label=type>=0?`${fixed?'fixed ':''}${plot.config.tiles[type].name}, ${data.total} ${data.total===1?'coin':'coins'}`:
    type===ROCK?'rock':type===WATER?'river':type===VOID?'outside the plot':'empty'
  return `Row ${row+1}, column ${col+1}, ${label}`
}
function drawCell(node,board,i,scoreData,earlier=null,interactive=true) {
  const type=board[i], data=scoreData.tiles[i], fixed=plot.permanent.has(i)
  node.className='cell'
  node.setAttribute('aria-label',cellLabel(i,type,data,fixed))
  node.classList.toggle('void',type===VOID)
  if (interactive) {
    node.tabIndex=type!==VOID&&i===roving?0:-1
    node.setAttribute('aria-hidden',String(type===VOID))
    node.setAttribute('aria-disabled',String(type===VOID || type===ROCK || type===WATER ||
      (type===EMPTY&&(Boolean(run.result)||selected!==null&&!legal(plot,i,selected)))))
  }
  node.replaceChildren()
  if (type>=0) {
    node.classList.add('occupied')
    node.append(picture(type))
    if (data.total) node.append(mark(data.total,'tile-value'))
    if (fixed) {node.classList.add('fixed');node.append(mark('◆','fixed-mark'))}
    if (interactive) node.setAttribute('aria-description',tipFor(type))
  } else {
    node.removeAttribute('aria-description')
    if (type===WATER||type===ROCK) {
      node.classList.add(type===WATER?'river':'rock')
      if (type===ROCK) {
        const rock=element('img')
        rock.src='./art/rock.png'
        rock.alt=''
        node.append(rock)
      }
    }
  }
  if (!interactive) {node.setAttribute('role','img');return}
  node.classList.toggle('inspected',inspected===i)
  node.classList.toggle('highlight',category!==null&&Boolean(data?.parts[category]))
  if (selected!==null&&plot.config.tiles[selected].id==='pond'&&type===EMPTY&&!run.result) {
    node.classList.add(legal(plot,i,selected)?'legal-edge':'ineligible')
  }
  if (earlier&&data) {
    const changed=data.total-(earlier.tiles[i]?.total??0)
    if (changed>0) {
      const icons=[3,4,5].filter(k=>data.parts[k]>(earlier.tiles[i]?.parts[k]??0)).map(k=>categories[k].icon).join('')
      const delta=mark(icons+' +'+changed,'delta')
      delta.setAttribute('aria-hidden','true')
      node.append(delta)
    }
  }
  if (prediction?.index===i) node.append(mark((prediction.coins>=0?'+':'')+prediction.coins+' coins','prediction'))
}
function setCategory(next) {
  category=category===next?null:next
  render()
  if ($('score-detail').open) close('score-detail')
  $('message').textContent=category===null?'Highlight cleared.':categories[category].name+' highlighted.'
}
function createUI() {
  $('board').style.setProperty('--size',plot.size)
  for (let i=0;i<plot.origin.length;i++) {
    const button=element('button',undefined,'cell')
    button.type='button'
    button.dataset.index=i
    cells.push(button)
    $('board').append(button)
  }
  for (const [type,n] of plot.hand.entries()) {
    if (!n) continue
    const tile=plot.config.tiles[type]
    const button=element('button',undefined,'tile')
    button.type='button'
    button.dataset.type=type
    const count=mark(n,'count')
    button.append(picture(type),element('small',tile.name.length>10?tile.name.split(' ').at(-1):tile.name),count)
    if (type>=7&&puzzle.day-tile.unlock<14) button.append(mark('New','new'))
    button.setAttribute('aria-description',tipFor(type))
    button.addEventListener('click',()=>{
      if (run.result||!amounts()[type]) return
      selected=selected===type?null:type
      recent=type
      inspected=null
      prediction=null
      $('message').textContent=selected===null?'':tile.name+' selected.'
      render()
    })
    $('tray').append(button)
    trayButtons.push({button,count,type})
  }
  for (const threshold of puzzle.stars) {
    const tick=element('i')
    tick.style.left=(threshold/puzzle.bestKnown.score*100)+'%'
    $('milestones').append(tick)
  }
  for (const id of ['desktop-scores','mobile-scores']) {
    for (const [i,c] of categories.entries()) {
      const button=element('button'), coins=element('strong','0')
      button.type='button'
      const label=element('span',c.name)
      const symbol=element('span',['●','▦','✿','⬡','≈','✥','⌂','◇'][i],'category-symbol')
      symbol.setAttribute('aria-hidden','true')
      button.append(symbol,label,coins)
      button.addEventListener('click',()=>setCategory(i))
      $(id).append(button)
      scoreButtons.push({button,coins,i})
    }
  }
  for (const [i,tile] of plot.config.tiles.entries()) {
    if (tile.unlock>puzzle.day) continue
    const row=element('li'), text=element('div')
    text.append(element('strong',tile.name),element('div',tipFor(i)))
    row.append(picture(i),text)
    $('roster').append(row)
  }
}
function render(earlier=null) {
  details=score(plot,run.board,true)
  const counts=amounts(), left=counts.reduce((a,b)=>a+b,0), total=plot.hand.reduce((a,b)=>a+b,0)
  const was=$('coins').textContent
  $('coins').textContent=details.coins
  if (was!==String(details.coins)) $('coins').setAttribute('aria-label',details.coins+' coins')
  $('harvest-fill').style.width=Math.min(100,details.coins/puzzle.bestKnown.score*100)+'%'
  const result=rating(puzzle,details.coins)
  $('stars').textContent=starText(result.stars)
  $('stars').setAttribute('aria-label',result.stars+' of 3 stars')
  $('target').textContent=practice?'Practice farm':result.golden?'Golden farm':
    run.result?result.percent+'% of best':(puzzle.stars[result.stars]??puzzle.bestKnown.score)+' coins for '+(puzzle.stars[result.stars]?'next star':'Golden farm')
  $('placed').textContent=(total-left)+'/'+total+' placed'
  for (const {button,count,type} of trayButtons) {
    const n=counts[type]
    count.textContent=n
    button.setAttribute('aria-pressed',String(type===selected))
    button.setAttribute('aria-label',plot.config.tiles[type].name+', '+n+' remaining')
    button.setAttribute('aria-disabled',String(Boolean(run.result)||!n))
  }
  for (const [i,cell] of cells.entries()) drawCell(cell,run.board,i,details,earlier)
  for (const {button,coins,i} of scoreButtons) {
    coins.textContent=details.totals[i]
    button.setAttribute('aria-pressed',String(category===i))
  }
  clearTimeout(deltaTimer)
  if (earlier) deltaTimer=setTimeout(()=>document.querySelectorAll('.delta').forEach(node=>node.remove()),830)
  $('undo').disabled=Boolean(run.result)||!run.history.length
  $('finish').hidden=Boolean(run.result)
  $('finish').disabled=Boolean(run.result)||left!==0
  $('finish').textContent=practice?'Finish practice':'Finish farm'
  $('results').hidden=!run.result||practice
  $('return').hidden=!practice
  updateTip()
}
$('coins').setAttribute('aria-live','polite')

function act(index) {
  const t=run.board[index]
  if (t===VOID||t===ROCK||t===WATER) return
  roving=index
  prediction=null
  if (t>=0) {
    inspected=index
    recent=t
    hovered=focusType=null
    render()
    return
  }
  inspected=null
  if (selected===null||run.result) {render();return}
  if (!legal(plot,index,selected)) {
    $('message').textContent='Ponds can only go on the edge of the plot.'
    render()
    return
  }
  if (!run.started) {
    run.started=Date.now()
    if (!practice&&!review) events.event('puzzle_started')
  }
  const tile=selected
  run.history.push({index,before:EMPTY,selected})
  run.board[index]=tile
  recent=tile
  if (!amounts()[tile]) selected=null
  $('message').textContent=''
  render(details)
  save()
}
$('pickup').addEventListener('click',()=>{
  if (inspected===null||plot.permanent.has(inspected)||run.result) return
  const index=inspected, type=run.board[index]
  run.history.push({index,before:type,selected})
  run.board[index]=EMPTY
  run.pickups++
  inspected=hovered=focusType=null
  recent=selected=type
  render()
  cells[index].focus()
  save()
})
$('undo').addEventListener('click',()=>{
  if (run.result) return
  const move=run.history.pop()
  if (!move) return
  run.undos++
  run.board[move.index]=move.before
  selected=move.selected
  inspected=prediction=hovered=focusType=null
  render()
  save()
})

const board=$('board')
const targetIndex=target=>Number(target?.closest?.('[data-index]')?.dataset.index)
const hoveredType=target=>{
  const index=targetIndex(target)
  const type=Number.isInteger(index)?run.board[index]:Number(target?.closest?.('[data-type]')?.dataset.type)
  return type>=0?type:null
}
for (const surface of [board,$('tray')]) {
  surface.addEventListener('pointerover',e=>{if(e.pointerType!=='touch'){hovered=hoveredType(e.target);updateTip()}})
  surface.addEventListener('pointerleave',()=>{hovered=null;updateTip()})
  surface.addEventListener('focusin',e=>{focusType=hoveredType(e.target);updateTip()})
  surface.addEventListener('focusout',e=>{focusType=hoveredType(e.relatedTarget);updateTip()})
}
function canPreview(index) {
  return settings.cropweavePreview&&selected!==null&&!run.result&&run.board[index]===EMPTY&&legal(plot,index,selected)
}
function preview(index) {
  const next=run.board.slice()
  next[index]=selected
  const coins=score(plot,next)-details.coins
  prediction={index,coins}
  run.preview=true
  $('message').textContent=(coins>=0?'+':'')+coins+' coins if placed here.'
  render()
  save()
}
board.addEventListener('pointerdown',e=>{
  clearTimeout(hold)
  skipClick=false
  const index=targetIndex(e.target)
  if (e.button!==0||!canPreview(index)) return
  const controller=new AbortController()
  hold=setTimeout(()=>{if(canPreview(index)){skipClick=true;preview(index)}},420)
  for (const name of ['pointerup','pointercancel']) window.addEventListener(name,()=>{
    clearTimeout(hold)
    controller.abort()
  },{once:true,signal:controller.signal})
  window.addEventListener('pointermove',move=>{
    if (Math.hypot(move.clientX-e.clientX,move.clientY-e.clientY)>10) clearTimeout(hold)
  },{signal:controller.signal})
})
board.addEventListener('contextmenu',e=>{if(canPreview(targetIndex(e.target)))e.preventDefault()})
board.addEventListener('click',e=>{
  if (skipClick&&e.detail) {skipClick=false;return}
  const index=targetIndex(e.target)
  if (Number.isInteger(index)) act(index)
})
board.addEventListener('keydown',e=>{
  const index=targetIndex(e.target)
  if (!Number.isInteger(index)) return
  if (e.key.toLowerCase()==='p'&&canPreview(index)) {e.preventDefault();preview(index);return}
  const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-plot.size,ArrowDown:plot.size}[e.key]
  if (!step) return
  e.preventDefault()
  for (let i=index+step;i>=0&&i<cells.length;i+=step) {
    if (Math.abs(step)===1&&plot.positions[i][0]!==plot.positions[index][0]) break
    if (plot.origin[i]===VOID) continue
    cells[roving].tabIndex=-1
    roving=i
    cells[i].tabIndex=0
    cells[i].focus()
    break
  }
})
function outcome() {
  const result=official.result
  if (!result) return
  $('result-score').textContent=result.coins+' coins · '+starText(result.stars)
  $('result-meta').textContent=result.percent+'% of best · '+plot.config.cards[puzzle.ruleCard].name+(result.golden?' · Golden farm':'')
  $('feedback').href='mailto:feedback@dailyden.games?subject='+encodeURIComponent('CropWeave Beta feedback '+puzzle.id+' · rules '+puzzle.rulesVersion)+
    '&body='+encodeURIComponent('Puzzle '+puzzle.id+' ('+puzzle.date+')\nRules '+puzzle.rulesVersion+' · Generator '+puzzle.generator+'\n\n')
  $('copied').textContent=''
  $('share-fallback').hidden=true
  $('outcome').showModal()
}
$('finish').addEventListener('click',()=>{
  if (run.result||amounts().some(Boolean)) return
  run.result=rating(puzzle,score(plot,run.board))
  if (practice) $('message').textContent='Practice complete · '+run.result.coins+' coins.'
  if (!practice&&!review) {
    events.event('puzzle_finished',{...run.result,time:Math.min(86400000,Date.now()-run.started),undos:run.undos,
      pickups:run.pickups,preview:run.preview,beatBest:run.result.coins>puzzle.bestKnown.score})
    events.flush()
  }
  save()
  render()
  if (!practice) outcome()
})
$('results').addEventListener('click',outcome)
$('share').addEventListener('click',async()=>{
  if (!review) events.event('share_clicked')
  const text=shareText(puzzle,official.result,plot.config.cards[puzzle.ruleCard].name)
  if (await copyText(text)) $('copied').textContent='Spoiler-free result copied.'
  else {
    $('share-fallback').hidden=false
    $('share-fallback').value=text
    $('share-fallback').select()
  }
})
$('practice').addEventListener('click',()=>{
  close('outcome')
  practice=true
  run=attempt()
  resetBoard()
})
$('return').addEventListener('click',()=>{
  practice=false
  run=official
  resetBoard()
  outcome()
})
function resetBoard() {
  selected=inspected=recent=hovered=focusType=category=prediction=null
  $('message').textContent=''
  render()
}
$('reveal').addEventListener('click',()=>{
  close('outcome')
  $('solution-board').hidden=true
  $('show-solution').hidden=false
  $('solution').showModal()
})
$('show-solution').addEventListener('click',()=>{
  const layout=puzzle.bestKnown.layout, display=score(plot,layout,true)
  $('solution-board').style.setProperty('--size',plot.size)
  $('solution-board').replaceChildren(...layout.map((_,i)=>{
    const node=element('div')
    drawCell(node,layout,i,display,null,false)
    if (layout[i]===VOID) node.setAttribute('aria-hidden','true')
    return node
  }))
  $('solution-board').hidden=false
  $('show-solution').hidden=true
  $('solution').querySelector('button').focus()
})
$('scores-button').addEventListener('click',()=>$('score-detail').showModal())
$('settings-button').addEventListener('click',()=>$('settings').showModal())
$('help-button').addEventListener('click',()=>$('help').showModal())
$('stats-button').addEventListener('click',()=>{
  close('settings')
  const result=summarized(progress)
  const rows=[['Days played',result.days],['Current streak',dayStreak(result.dates,today)],
    ['Average percent of best',result.average===null?'—':result.average+'%'],
    ['Best day',result.best?result.best.date+' · '+result.best.percent+'%':'—'],
    ...result.distribution.map((n,i)=>[starText(i),n])]
  $('stats-body').replaceChildren(...rows.map(([title,value])=>{
    const row=element('div')
    row.append(element('dt',title),element('dd',value))
    return row
  }))
  $('stats').showModal()
})
const slides=[
  ['Plant every tile','Choose a tile in your hand, then an empty plot square. Place all the tiles in your hand to finish.'],
  ['Read the tile tips','Hover, focus, or tap a tile for the scoring rule and a map of where it applies.'],
  ['Rearrange your farm','Tap a placed tile to inspect its coin breakdown. Use Pick up or Undo to change the layout.'],
  ['Make helpers count','Wells irrigate and Scarecrows protect. Select a scoring category to highlight where its coins came from.'],
  ['Check the rule card','Each plot has a rule card that can change how a familiar tile scores.']
]
let slide=0
function drawSlide() {
  const [title,text]=slides[slide]
  $('tour-step').textContent='Field guide · '+(slide+1)+' of '+slides.length
  $('tour-piece').src=sprite[['wheat','sunflower','barn','scarecrow','well'][slide]]
  $('tour-title').textContent=title
  $('tour-text').textContent=text
  $('tour-back').disabled=slide===0
  $('tour-next').textContent=slide===slides.length-1?'Play':'Next'
}
function tour() {
  slide=0
  drawSlide()
  $('tutorial').showModal()
}
$('tutorial').addEventListener('close',()=>store.write('tour',true))
$('tour-back').addEventListener('click',()=>{if(slide>0){slide--;drawSlide()}})
$('tour-next').addEventListener('click',()=>{if(++slide===slides.length)close('tutorial');else drawSlide()})
$('tour-again').addEventListener('click',()=>{close('help');tour()})
$('reset-tips').addEventListener('click',()=>{close('settings');tour()})

async function load() {
  const response=await fetch(review?'./review.json':'./calendar.json',{cache:'no-cache'})
  if (!response.ok) throw Error('Calendar unavailable')
  const {days}=await response.json()
  puzzle=review ? days[review] : puzzleForDay(days,today)
  if (!puzzle) {
    $('availability').textContent='CropWeave Beta opens when its first daily plot is released.'
    return
  }
  plot=compile(puzzle)
  official=hydrate(review?null:progress[puzzle.date])
  run=official
  roving=plot.open[0]
  events=telemetry(store,puzzle,document.querySelector('meta[name="cropweave-analytics"]')?.content)
  const rule=plot.config.cards[puzzle.ruleCard]
  const ruleArt={'dry-season':'well','bee-festival':'beehive','crow-day':'scarecrow','market-day':'barn','orchard-season':'pear-tree','free-range':'chicken-coop','windy-day':'windmill','cozy-corners':'sunflower'}
  $('rule-art').src=sprite[ruleArt[puzzle.ruleCard]??'wheat']
  $('rule-name').textContent=rule.name
  $('rule-text').textContent=rule.text
  $('puzzle-id').textContent='#'+puzzle.day
  $('date').textContent=new Date(puzzle.date+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})
  createUI()
  render()
  $('availability').hidden=true
  $('farm').hidden=false
  if (!review&&!store.read('tour',false)) tour()
  window.addEventListener('pagehide',()=>{
    if (!review&&!official.result&&official.started) events.event('puzzle_abandoned')
    events.flush()
  })
}
load().catch(()=>{$('availability').textContent='The daily plot couldn’t load. Refresh to try again.'})
