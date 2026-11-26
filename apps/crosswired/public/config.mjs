export const GAME_ID = 'crosswired'
export const GAME_NAME = 'SwitchLight'
export const TIME_ZONE = 'America/Los_Angeles'
export const EPOCH = '2026-11-23'
export const GENERATOR = '1.0.0'
export const TIERS = ['warm-up', 'standard', 'challenge', 'finale']
export const PAR_RANGES = [[2, 3], [3, 5], [4, 7], [5, 9]]
export const PROBE_LIMITS = [1, 2, 2, 3]
export const RATINGS = ['Perfect', 'Great', 'Good', 'Solved']
export const RATING_THRESHOLDS = Object.fromEntries(TIERS.map(tier => [tier, [0, 2, 5]]))
export const HINT_COST = 2
