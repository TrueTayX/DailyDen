import { dayIndex } from './calendar.mjs'
import { score, summarize } from './progress.mjs'

const achievements = [
  { icon: '🧩', title: 'First Crack', description: 'Solve your first puzzle.', stat: 'solved', target: 1 },
  { icon: '📋', title: 'In the Books', description: 'Finish your first daily set.', stat: 'finished', target: 1 },
  { icon: '🔥', title: 'On a Roll', description: 'Finish 3 daily sets in a row.', stat: 'longest', target: 3 },
  { icon: '⚡', title: 'Week Warrior', description: 'Finish 7 daily sets in a row.', stat: 'longest', target: 7 },
  { icon: '🗓️', title: 'Monthly Regular', description: 'Finish 30 daily sets in a row.', stat: 'longest', target: 30 },
  { icon: '✅', title: 'Clean Sweep', description: 'Solve all five puzzles in a daily set.', stat: 'sweeps', target: 1 },
  { icon: '🧠', title: 'No Lifelines', description: 'Solve all five without using a hint.', stat: 'unaidedSweeps', target: 1 },
  { icon: '💎', title: 'Perfect Day', description: 'Solve all five on the first try without hints.', stat: 'perfectDays', target: 1 },
  { icon: '✨', title: 'Flawless Week', description: 'Solve all five puzzles on each of seven consecutive days.', stat: 'longestSolved', target: 7 },
  { icon: '🎯', title: 'Second Shot', description: 'Solve a puzzle on your second guess.', stat: 'secondShots', target: 1 },
  { icon: '🔓', title: 'Master Key', description: 'Solve the fifth puzzle on 10 different days.', stat: 'masterSolved', target: 10 },
  { icon: '💯', title: 'Centurion', description: 'Solve 100 puzzles total.', stat: 'solved', target: 100 },
]

function longestRun(days) {
  let previous = -Infinity
  let length = 0
  let longest = 0
  for (const day of [...days].sort((a, b) => a - b)) {
    length = day === previous + 1 ? length + 1 : 1
    longest = Math.max(length, longest)
    previous = day
  }
  return longest
}

export function playerProfile(records, today) {
  const profile = {
    ...summarize(records, today), bestScore: 0, attempts: 0, hints: 0, firstTries: 0, attemptedPuzzles: 0,
    masterSolved: 0, sweeps: 0, unaidedSweeps: 0, perfectDays: 0, secondShots: 0,
  }
  const onTime = new Set()
  const solvedOnTime = new Set()
  for (const record of records) {
    const rounds = record.rounds.filter(Boolean)
    const finishedOnTime = record.completedOn === record.day
    if (finishedOnTime) onTime.add(dayIndex(record.day))
    if (record.completedOn && rounds.length === 5) {
      const points = rounds.reduce((total, round) => total + score(round), 0)
      profile.bestScore = Math.max(profile.bestScore, points)
      if (rounds.every(round => round.result === 'solved')) {
        profile.sweeps += 1
        profile.unaidedSweeps += Number(rounds.every(round => !round.hinted))
        profile.perfectDays += Number(points === 10)
        if (finishedOnTime) solvedOnTime.add(dayIndex(record.day))
      }
    }
    for (const round of rounds) {
      const count = round.attempts?.length ?? 0
      profile.attempts += count
      profile.attemptedPuzzles += Number(count > 0)
      profile.firstTries += Number(round.result === 'solved' && count === 1)
      profile.secondShots += Number(round.result === 'solved' && count === 2)
      profile.hints += Number(round.hinted === true)
    }
    profile.masterSolved += Number(record.rounds[4]?.result === 'solved')
  }
  profile.longest = longestRun(onTime)
  profile.longestSolved = longestRun(solvedOnTime)
  profile.accuracy = profile.attempts ? Math.round(profile.solved / profile.attempts * 100) : null
  profile.firstTryRate = profile.attemptedPuzzles ? Math.round(profile.firstTries / profile.attemptedPuzzles * 100) : null
  profile.achievements = achievements.map(({ icon, title, description, stat, target }) => ({
    icon, title, description, target, progress: Math.min(profile[stat], target), earned: profile[stat] >= target,
  }))
  return profile
}
