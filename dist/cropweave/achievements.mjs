import { versions } from './config.mjs'

const catalog = {
  Play: [
    ['first-sprout', 'First sprout', 'Finish your first daily farm.', 'farms', 1],
    ['green-thumb', 'Green thumb', 'Finish 10 daily farms.', 'farms', 10],
    ['homesteader', 'Homesteader', 'Finish 50 daily farms.', 'farms', 50],
    ['century-farm', 'Century farm', 'Finish 100 daily farms.', 'farms', 100]
  ],
  Streak: [
    ['three-in-a-row', 'Three in a row', 'Finish 3 daily farms in a row.', 'streak', 3],
    ['week-on-the-farm', 'Week on the farm', 'Finish 7 daily farms in a row.', 'streak', 7],
    ['monthly-harvest', 'Monthly harvest', 'Finish 30 daily farms in a row.', 'streak', 30],
    ['year-of-cropweave', 'Year of CropWeave', 'Finish 365 daily farms in a row.', 'streak', 365]
  ],
  Stars: [
    ['rising-star', 'Rising star', 'Earn at least 2 stars on a daily farm.', 'twoStars', 1],
    ['bumper-crop', 'Bumper crop', 'Earn 3 stars on a daily farm.', 'threeStars', 1],
    ['triple-threat', 'Triple threat', 'Earn 3 stars on 10 daily farms.', 'threeStars', 10],
    ['harvest-festival', 'Harvest festival', 'Earn 3 stars on 50 daily farms.', 'threeStars', 50]
  ],
  Golden: [
    ['golden-farm', 'Golden farm', 'Match or beat a daily farm’s best-known score.', 'golden', 1],
    ['golden-touch', 'Golden touch', 'Finish 5 Golden farms.', 'golden', 5]
  ],
  Variety: [
    ['rule-collector', 'Rule collector', 'Finish farms under 5 different rule cards.', 'rules', 5],
    ['full-almanac', 'Full almanac', 'Finish a farm under every rule card.', 'rules', null],
    ['weekend-warrior', 'Weekend warrior', 'Earn 3 stars on a Saturday or Sunday farm.', 'weekends', 1],
    ['steady-hand', 'Steady hand', 'Earn at least 2 stars 7 days in a row.', 'twoStarStreak', 7]
  ]
}

function longestStreak(dates) {
  let previous = -Infinity, run = 0, best = 0
  for (const date of dates) {
    const day = Date.parse(date + 'T00:00:00Z')
    run = day - previous === 86400000 ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

export function achievementProgress(records, rules = Object.values(versions).flatMap(version => Object.keys(version.cards))) {
  const availableRules = new Set(rules)
  // Results from before this feature were all recorded during Beta.
  const daily = Object.entries(records).filter(([, record]) => record?.result?.beta === false)
    .sort(([first], [second]) => first.localeCompare(second))
  const twoStarResults = daily.filter(([, {result}]) => result.stars >= 2)
  const threeStarResults = daily.filter(([, {result}]) => result.stars === 3)
  const counts = {
    farms: daily.length,
    streak: longestStreak(daily.map(([date]) => date)),
    twoStars: twoStarResults.length,
    threeStars: threeStarResults.length,
    golden: daily.filter(([, {result}]) => result.golden).length,
    rules: new Set(daily.map(([, {result}]) => result.ruleCard).filter(rule => availableRules.has(rule))).size,
    weekends: threeStarResults.filter(([date, {result}]) =>
      [0, 6].includes(result.weekday ?? new Date(date + 'T00:00:00Z').getUTCDay())).length,
    twoStarStreak: longestStreak(twoStarResults.map(([date]) => date))
  }

  return Object.entries(catalog).flatMap(([category, entries]) => entries.map(([id, name, description, metric, target]) => {
    const goal = target ?? availableRules.size
    const count = counts[metric]
    return { id, category, name, description, count: Math.min(count, goal), goal, earned: goal > 0 && count >= goal }
  }))
}
