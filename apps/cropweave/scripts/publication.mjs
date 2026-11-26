import { GAME_ID,GAME_NAME,BETA } from '../public/config.mjs'
import { PUZZLE_TIME_ZONE } from '../../../packages/game/daily.mjs'

export function publicPuzzle({alternatives,metrics,seed,deck,...puzzle}) {
  return {...puzzle,seed,metrics:{randomAvg:metrics.randomAvg,greedy:metrics.greedy,density:metrics.density}}
}

export function publicCalendar(archive,through) {
  return {game:GAME_ID,name:GAME_NAME,beta:BETA,timeZone:PUZZLE_TIME_ZONE,publishedThrough:through,
    days:Object.fromEntries(archive.calendar.filter(p=>p.date<=through).map(p=>[p.date,publicPuzzle(p)]))}
}
