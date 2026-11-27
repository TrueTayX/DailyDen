import { GAME_NAME,GAME_URL } from './config.mjs'

export function puzzleForDay(days,date) {
  if (Object.hasOwn(days,date)) return days[date]
  const latest=Object.keys(days).filter(day=>day<=date).sort().at(-1)
  return latest ? days[latest] : null
}

export const starText = stars => '★'.repeat(stars)+'☆'.repeat(3-stars)

export function shareText(puzzle,result,rule) {
  return `${GAME_NAME} #${puzzle.day} ${starText(result.stars)} · ${result.coins} coins (${result.percent}% of best)\n${rule}\n${GAME_URL}/?ref=share`
}

export function summarized(records) {
  const results=Object.entries(records).flatMap(([date,record])=>record?.result ? [{date,...record.result}] : [])
  const distribution=[0,0,0,0]
  for (const result of results) distribution[result.stars]++
  return {dates:results.map(r=>r.date),days:results.length,
    average:results.length?Math.round(results.reduce((n,r)=>n+r.percent,0)/results.length):null,
    distribution,best:results.reduce((a,b)=>!a||b.percent>a.percent?b:a,null)}
}
