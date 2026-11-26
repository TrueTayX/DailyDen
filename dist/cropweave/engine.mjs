import { versions, categories } from './config.mjs'

export const EMPTY = -1, ROCK = -2, WATER = -3, VOID = -4
const [WHEAT,CARROT,SUNFLOWER,HIVE,WELL,SCARECROW,BARN,CABBAGE,LAVENDER,COOP,PEAR,CORN,POND,MILL,MARKET] =
  versions['1.0'].tiles.keys()
const crops = (1<<WHEAT)|(1<<CARROT)|(1<<CABBAGE)|(1<<PEAR)|(1<<CORN)
const flowers = (1<<SUNFLOWER)|(1<<LAVENDER)
const isCrop = t => t>=0 && Boolean(crops&(1<<t))
const isFlower = t => t>=0 && Boolean(flowers&(1<<t))
const bitCount = n => {
  let count=0
  for (;n;n&=n-1) count++
  return count
}

export function compile(puzzle) {
  const config = versions[puzzle.rulesVersion]
  if (!config || !config.cards[puzzle.ruleCard]) throw new Error('Unknown CropWeave rules')
  const {size,shape,rocks=[],river=null,fixed=[]} = puzzle.plot
  const at = ([row,col])=>row*size+col
  const positions = Array.from({length:size*size},(_,i)=>[Math.floor(i/size),i%size])
  const ground = positions.map(([r,c]) => {
    if (shape==='l' && r<Math.floor(size/2) && c>=Math.ceil(size/2)) return VOID
    if (shape==='plus' && (r===0||r===size-1) && (c===0||c===size-1)) return VOID
    return EMPTY
  })
  const byId = Object.fromEntries(config.tiles.map(({id},i)=>[id,i]))
  const origin=ground.slice()
  const permanent=new Set()
  for (const [i,value] of [
    ...rocks.map(p=>[at(p),ROCK]),
    ...(river ? river.cells.map(p=>[at(p),WATER]) : []),
    ...fixed.map(({cell,tile})=>[at(cell),byId[tile]])
  ]) {
    if (origin[i]!==EMPTY || value===undefined) throw new Error('Overlapping or invalid terrain')
    origin[i]=value
    permanent.add(i)
  }
  const open=positions.flatMap((_,i)=>origin[i]===EMPTY ? [i] : [])
  const neighbors=positions.map(([r,c],i)=>{
    const side=[],diagonal=[],area=[],line=[],row=[]
    for (const [j,[rr,cc]] of positions.entries()) {
      if (i===j || ground[j]===VOID) continue
      const dr=Math.abs(rr-r),dc=Math.abs(cc-c)
      if (dr+dc===1) side.push(j)
      if (dr===1&&dc===1) diagonal.push(j)
      if (dr<=1&&dc<=1) area.push(j)
      if (!dr||!dc) line.push(j)
      if (!dr) row.push(j)
    }
    const edge = side.length<4
    const corner = edge && side.length<=2 && side.some(j=>positions[j][0]===r) && side.some(j=>positions[j][1]===c)
    return {side,diagonal,area,line,row,edge,corner}
  })
  return {puzzle,config,values:{...config.values,...config.cards[puzzle.ruleCard].changes},
    size,positions,origin,permanent,open,neighbors,byId,
    hand:config.tiles.map(({id})=>puzzle.hand[id]??0)}
}

export function legal(plot,index,type) {
  return plot.origin[index]===EMPTY && (type!==POND || plot.neighbors[index].edge)
}

export function score(plot, board, detail=false) {
  const {values:v, neighbors:n}=plot
  const totals=detail ? categories.map(()=>0) : null
  const tiles=detail ? board.map(()=>null) : null
  let coins=0
  for (let i=0;i<board.length;i++) {
    const t=board[i]
    if (t<0) continue
    const {side,diagonal,area,row,line,corner}=n[i]
    let base=0, pattern=0, animal=0, pollen=0, water=0, shield=0, building=0
    const edge=corner ? v.corners : 0
    if (isCrop(t)) {
      base=t===WHEAT?v.wheat:t===CARROT?v.carrot:t===CABBAGE?v.cabbage:t===PEAR?v['pear-tree']:v.corn
      let basket=0
      for (const j of side) {
        const other=board[j]
        if (other===WELL || other===WATER) water=v.water
        if (other===HIVE) pollen=v.pollination
        if (t===WHEAT && other===WHEAT) pattern+=v.wheatNeighbor
        if (t===CABBAGE && other!==t && isCrop(other)) basket|=1<<other
      }
      for (const j of area) {
        const other=board[j]
        if (other===POND) water=v.water
        if (other===SCARECROW) shield=v.protection
      }
      if (v.crow && !shield) base=0
      if (t===CABBAGE) pattern+=bitCount(basket)*v.cabbageVariety
      if (t===CORN) for (const j of row) if (board[j]===CORN) pattern+=v.corn
    } else if (t===SUNFLOWER || t===LAVENDER) {
      base=t===SUNFLOWER?v.sunflower:v.lavender
      if (t===LAVENDER) for (const j of side) if (board[j]===HIVE) animal+=v.lavenderHive
    } else if (t===HIVE) {
      for (const j of side) if (isFlower(board[j])) animal+=v.hive
    } else if (t===COOP) {
      base=v['chicken-coop']
      let basket=0
      for (const j of side) if (isCrop(board[j])) basket|=1<<board[j]
      if (bitCount(basket)>=2) animal=v.coopVariety-base
    } else if (t===BARN || t===MILL) {
      for (const j of t===BARN ? line : diagonal) if (isCrop(board[j])) building+=t===BARN?v.barn:v.windmill
    } else if (t===MARKET) {
      let basket=0
      for (const j of area) if (board[j]>=0) basket|=1<<board[j]
      building=bitCount(basket)*v['market-stall']
    }
    const total=base+pattern+animal+pollen+water+shield+building+edge
    coins+=total
    if (detail) {
      const parts=[base,pattern,animal,pollen,water,shield,building,edge]
      tiles[i]={total,parts}
      for (let k=0;k<parts.length;k++) totals[k]+=parts[k]
    }
  }
  return detail ? {coins,totals,tiles} : coins
}

export function thresholds(best) {
  if (!Number.isInteger(best) || best<3) throw new Error('Star thresholds need a score of at least 3')
  const third=Math.min(best,Math.ceil(best*95/100))
  const second=Math.min(third-1,Math.ceil(best*80/100))
  return [Math.min(second-1,Math.ceil(best*60/100)),second,third]
}

export function rating(puzzle,coins) {
  return {coins,stars:puzzle.stars.filter(target=>coins>=target).length,
    percent:Math.round(100*coins/puzzle.bestKnown.score),golden:coins>=puzzle.bestKnown.score}
}

export function validLayout(plot,board) {
  if (!Array.isArray(board) || board.length!==plot.origin.length) return false
  const tally=plot.hand.map(()=>0)
  for (const [i,t] of board.entries()) {
    if (!Number.isInteger(t)) return false
    if (plot.origin[i]!==EMPTY) {
      if (plot.origin[i]!==t) return false
    } else if (t!==EMPTY) {
      if (!(t>=0&&t<tally.length&&legal(plot,i,t)) || ++tally[t]>plot.hand[t]) return false
    }
  }
  return tally.every((n,i)=>n===plot.hand[i])
}

// Allocate each earned coin once. Where multiple helpers supply the same
// bonus, share that bonus evenly between its sources.
export function contributions(plot,board) {
  const {tiles}=score(plot,board,true)
  const amounts=plot.hand.map(()=>0)
  for (const [i,tile] of tiles.entries()) {
    if (!tile) continue
    const {parts:p,total}=tile
    amounts[board[i]]+=total-p[3]-p[4]-p[5]
    const {side,area}=plot.neighbors[i]
    // Both tiles enable the flower bonus, so allocate half of each pair's
    // bonus to the flower. This is only for offline balance analysis.
    if (board[i]===HIVE && p[2]) {
      const nearby=side.filter(j=>isFlower(board[j]))
      amounts[HIVE]-=p[2]/2
      for (const j of nearby) amounts[board[j]]+=p[2]/(2*nearby.length)
    }
    const sources=[
      side.filter(j=>board[j]===HIVE),
      [...side.filter(j=>board[j]===WELL||board[j]===WATER),...area.filter(j=>board[j]===POND)],
      area.filter(j=>board[j]===SCARECROW)
    ]
    for (const [k,cells] of sources.entries()) {
      for (const j of cells) if (board[j]>=0) amounts[board[j]]+=p[k+3]/cells.length
    }
  }
  return amounts
}
