import {compile, EMPTY, legal, score} from '../public/engine.mjs'

export function rng(seed) {
  let state=seed>>>0 || 0x47e90cd1
  return limit=>{
    state^=state<<13
    state^=state>>>17
    state^=state<<5
    const value=(state>>>0)/4294967296
    return limit===undefined ? value : Math.floor(value*limit)
  }
}

export const inventory = plot => plot.hand.flatMap((n,i)=>Array(n).fill(i))
const pond = plot => plot.byId.pond
function shuffled(array,rand) {
  const result=[...array]
  for (let i=result.length-1;i>0;i--) {
    const j=rand(i+1)
    ;[result[i],result[j]]=[result[j],result[i]]
  }
  return result
}

export function randomLayout(plot,rand,stock=inventory(plot)) {
  const board=plot.origin.slice()
  const cells=shuffled(plot.open,rand)
  const constrained=stock.filter(t=>t===pond(plot))
  const unconstrained=stock.filter(t=>t!==pond(plot))
  for (const type of [...constrained,...unconstrained]) {
    const index=type===pond(plot) ? cells.findIndex(i=>legal(plot,i,type)) : cells.length-1
    if (index<0) throw new Error('Hand cannot be placed')
    board[cells[index]]=type
    cells[index]=cells.at(-1)
    cells.pop()
  }
  return board
}

function movable(plot, board, a,b) {
  const x=board[a],y=board[b]
  return x!==y && (x!==pond(plot)||legal(plot,b,x)) && (y!==pond(plot)||legal(plot,a,y))
}
function swap(board,a,b) {
  const before=board[a]
  board[a]=board[b]
  board[b]=before
}

export function greedy(plot) {
  const board=plot.origin.slice()
  const stock=inventory(plot).sort((a,b)=>Number(b===pond(plot))-Number(a===pond(plot)))
  for (const tile of stock) {
    let high=-1,cell
    for (const i of plot.open) {
      if (board[i]!==EMPTY || !legal(plot,i,tile)) continue
      board[i]=tile
      const coins=score(plot,board)
      board[i]=EMPTY
      if (coins>high) {high=coins;cell=i}
    }
    if (cell===undefined) throw Error('Greedy could not place the hand')
    board[cell]=tile
  }
  return score(plot,board)
}

function record(top,board,coins) {
  if (top.length===4&&coins<top.at(-1).score) return
  const key=board.join(',')
  if (top.some(item=>item.key===key)) return
  top.push({key,score:coins,layout:[...board]})
  top.sort((a,b)=>b.score-a.score||a.key.localeCompare(b.key))
  if (top.length>4) top.pop()
}

export function anneal(plot,seed, restarts=12, steps=2200) {
  const random=rng(seed)
  const top=[]
  const cells=plot.open
  const stock=inventory(plot)
  for (let r=0;r<restarts;r++) {
    const board=randomLayout(plot,random,stock)
    let coins=score(plot,board)
    let best=coins
    record(top,board,coins)
    for (let s=0;s<steps;s++) {
      const a=cells[random(cells.length)],b=cells[random(cells.length)]
      if (!movable(plot,board,a,b)) continue
      swap(board,a,b)
      const next=score(plot,board)
      const temperature=2.7 * Math.exp(-4.5*s/steps)
      if (next>=coins || random()<Math.exp((next-coins)/temperature)) {
        coins=next
        if (next>best) {
          best=next
          record(top,board,coins)
        }
      } else swap(board,a,b)
    }
    record(top,board,coins)
  }
  return top
}

// Independent beam. Expand the best boards by single swaps plus seeded
// two-swap branches, retaining only distinct configurations at each depth.
export function beam(plot,seed,rounds=130,width=14) {
  const random=rng(seed), cells=plot.open
  let frontier=Array.from({length:width},()=>randomLayout(plot,random))
  let best=[]
  for (let round=0;round<rounds;round++) {
    const next=new Map()
    const keep = (board,coins) => {
      const key=board.join(',')
      if (!next.has(key)) next.set(key,{board,coins})
    }
    for (const parent of frontier) {
      keep(parent,score(plot,parent))
      for (let i=0;i<28;i++) {
        const a=cells[random(cells.length)],b=cells[random(cells.length)]
        if (!movable(plot,parent,a,b)) continue
        swap(parent,a,b)
        if (i<20) keep(parent.slice(),score(plot,parent))
        else {
          const c=cells[random(cells.length)],d=cells[random(cells.length)]
          if (movable(plot,parent,c,d)) {
            swap(parent,c,d)
            keep(parent.slice(),score(plot,parent))
            swap(parent,c,d)
          }
        }
        swap(parent,a,b)
      }
    }
    const ranked=[...next.values()].sort((a,b)=>b.coins-a.coins)
    for (const item of ranked.slice(0,4)) record(best,item.board,item.coins)
    frontier=ranked.slice(0,width-3).map(item=>item.board)
    while (frontier.length<width) frontier.push(randomLayout(plot,random))
  }
  return best
}

// Exhaustion is bounded. A stopped run never claims proof.
export function prove(plot,budget=6000) {
  const board=plot.origin.slice()
  const stock=inventory(plot).sort((a,b)=>Number(b===pond(plot))-Number(a===pond(plot))||a-b)
  let visited=0,high=-1
  function visit(depth,start) {
    if (++visited>budget) return false
    if (depth===stock.length) {
      high=Math.max(high,score(plot,board))
      return true
    }
    const type=stock[depth]
    for (let slot=start;slot<plot.open.length;slot++) {
      const i=plot.open[slot]
      if (board[i]!==EMPTY || !legal(plot,i,type)) continue
      board[i]=type
      const complete=visit(depth+1,type===stock[depth+1]?slot+1:0)
      board[i]=EMPTY
      if (!complete) return false
    }
    return true
  }
  return {proven:visit(0,0),score:high,visited}
}

export function removalImpact(plot, layout,index,best) {
  const before=layout[index]
  layout[index]=EMPTY
  const difference=best-score(plot,layout)
  layout[index]=before
  return difference
}

export function estimate(puzzle,effort=0) {
  const plot=compile(puzzle)
  const first=anneal(plot,puzzle.seed,effort?14:3,effort?2450:1100)
  const second=effort ? beam(plot,puzzle.seed^0x7e59dd13) : []
  const top=[]
  for (const p of [...first,...second]) record(top,p.layout,p.score)
  return {plot,first,second,top}
}
