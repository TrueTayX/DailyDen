import { dayIndex } from './calendar.mjs'
import { score, summarize } from './progress.mjs'

const achievements = [
  { title: 'First solve', description: 'Solve a daily puzzle.', earned: profile => profile.solved > 0 },
  { title: 'Perfect day', description: 'Finish a daily set with 10 points.', earned: profile => profile.bestScore === 10 },
  { title: 'Seven-day streak', description: 'Finish seven daily sets in a row.', earned: profile => profile.longest >= 7 },
  { title: 'Thirty-day streak', description: 'Finish thirty daily sets in a row.', earned: profile => profile.longest >= 30 },
  { title: '100 puzzles solved', description: 'Solve 100 daily puzzles.', earned: profile => profile.solved >= 100 },
  { title: 'Master of the day', description: 'Solve ten master puzzles.', earned: profile => profile.masterSolved >= 10 },
]

export function playerProfile(records, today) {
  const profile = { ...summarize(records, today), longest: 0, bestScore: 0, attempts: 0, hints: 0, firstTries: 0, attemptedPuzzles: 0, masterSolved: 0 }
  const onTime = new Set()
  for (const record of records) {
    const rounds = record.rounds.filter(Boolean)
    if (record.completedOn && record.completedOn === record.day) onTime.add(dayIndex(record.day))
    if (record.completedOn && rounds.length === 5) {
      profile.bestScore = Math.max(profile.bestScore, rounds.reduce((total, round) => total + score(round), 0))
    }
    for (const round of rounds) {
      const count = round.attempts?.length ?? 0
      profile.attempts += count
      profile.attemptedPuzzles += Number(count > 0)
      profile.firstTries += Number(round.result === 'solved' && count === 1)
      profile.hints += Number(round.hinted === true)
    }
    profile.masterSolved += Number(record.rounds[4]?.result === 'solved')
  }
  let previous = -Infinity
  let length = 0
  for (const day of [...onTime].sort((a, b) => a - b)) {
    length = day === previous + 1 ? length + 1 : 1
    profile.longest = Math.max(length, profile.longest)
    previous = day
  }
  profile.accuracy = profile.attempts ? Math.round(profile.solved / profile.attempts * 100) : null
  profile.firstTryRate = profile.attemptedPuzzles ? Math.round(profile.firstTries / profile.attemptedPuzzles * 100) : null
  profile.achievements = achievements.map(({ title, description, earned }) => ({ title, description, earned: earned(profile) }))
  return profile
}
