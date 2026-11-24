import { EPOCH } from '../public/config.mjs'
import { STAMPS } from '../public/stamps.mjs'
import { goalKey, makePuzzle, PARTITIONS, rng, shuffle, signature } from './puzzles.mjs'

export const CALENDAR_SEED = 6109321
export const STAMP_COOLDOWN = 10
export const GOAL_COOLDOWN = 10
export const FAMILY_RELEASES = {
  'knight-only': 15, 'distance-2-diamond': 29, 'transpose-partner': 43,
  'quad-mirror': 57, 'rotation-group': 71,
}
const dayMs = 86_400_000
export const dateFor = number => new Date(Date.parse(EPOCH) + (number - 1) * dayMs).toISOString().slice(0, 10)
export const familyNames = puzzles => [...new Set(puzzles.flatMap(puzzle =>
  [puzzle.stamps.A.name, ...(puzzle.stamps.B ? [puzzle.stamps.B.name] : [])]))]

export function serializeArchive({ seed, calendar, pool }) {
  const lines = entries => entries.map(entry => '    ' + JSON.stringify(entry)).join(',\n')
  return `{\n  "seed": ${seed},\n  "calendar": [\n${lines(calendar)}\n  ],\n  "pool": [\n${lines(pool)}\n  ]\n}\n`
}

// These families always produce symmetric differences when used alone.
const standaloneLate = stamp => !stamp.giveaway && !['diagonal-line', 'anti-diagonal-line'].includes(stamp.name)

function optionsForDay(day, number, a, b, c, random) {
  const hard = day === 5 || day === 6
  const gentle = day === 1 || day === 2
  const showcase = day === 0
  const deep = number % 29 === 0 && standaloneLate(a)
  const challenge = c && standaloneLate(c) ? c : standaloneLate(a) ? a : b
  const specs = [
    { a, b: null, size: 4, mode: null },
    { a: deep ? a : b, b: null, size: 5, mode: deep ? 'wrap' : b.giveaway ? 'blocked' : gentle ? null : [null, 'wrap', 'blocked'][number % 3] },
    { a: deep ? a : challenge, b: null, size: 5, mode: deep || challenge.giveaway ? 'blocked' : number % 2 ? 'wrap' : 'blocked' },
    { a, b: c && !standaloneLate(c) ? c : b, size: hard ? 6 : 5, mode: number % 4 === 0 ? 'blocked' : number % 5 === 0 ? 'wrap' : null,
      partition: PARTITIONS[(number + random(2)) % PARTITIONS.length] },
  ]
  return specs.map((puzzle, index) => ({ ...puzzle, day: number, index: index + 1, hard, showcase }))
}

export function generateCalendar(days = 800, seed = CALENDAR_SEED, progress = () => {}) {
  const random = rng(seed)
  const used = new Map()
  const last = new Map()
  const goals = new Map()
  const signatures = new Set()
  const calendar = []
  const pool = []
  function sorted(stamps, day, role) {
    const gentle = day === 1 || day === 2
    const hard = day === 5 || day === 6
    const rank = stamp => {
      const usage = used.get(stamp.name) ?? 0
      const tuning = role === 'warm-up' ? Number(stamp.tag === 'S') * (gentle ? 3 : 1)
        : gentle ? Number(stamp.tag === 'A') * 2 : hard ? Number(stamp.tag !== 'A') * 2 : 0
      return usage * 3 + tuning + Number(stamp.name === 'plus') * 3
    }
    return shuffle(stamps, random).sort((a, b) => rank(a) - rank(b))
  }

  for (let number = 1; number <= days; number += 1) {
    progress(number)
    const date = dateFor(number)
    const weekday = new Date(date).getUTCDay()
    const available = STAMPS.filter(stamp => number >= (FAMILY_RELEASES[stamp.name] ?? 1)
      && number - (last.get(stamp.name) ?? -Infinity) > STAMP_COOLDOWN)
    const warm = sorted(available.filter(stamp => stamp.tag !== 'A' && stamp.name !== 'self-only'), weekday, 'warm-up')
    const other = sorted(available, weekday)
    let chosen
    for (const a of warm) {
      const warmupSpec = { a, b: null, size: 4, mode: null, day: number, index: 1,
        hard: false, showcase: weekday === 0 }
      const warmup = makePuzzle(warmupSpec, random(0x100000000), p => signatures.has(signature(p)))
      if (!warmup) continue
      for (const b of other) {
        if (a === b || !standaloneLate(b)) continue
        const reserveThird = other.filter(c => c !== a && c !== b)
        const thirds = number % 7 === 0 && number % 29 !== 0 ? [...reserveThird.slice(0, 4), null] : [null]
        for (const c of thirds) {
          for (let attempt = 0; attempt < 4 && !chosen; attempt += 1) {
            const specs = optionsForDay(weekday, number, a, b, c, random)
            if (attempt) {
              specs[3].partition = PARTITIONS[(PARTITIONS.indexOf(specs[3].partition) + attempt) % PARTITIONS.length]
              const changed = specs[2]
              if (!changed.a.giveaway && attempt % 2) changed.mode = changed.mode === 'wrap' ? 'blocked' : 'wrap'
            }
            const puzzles = [warmup]
            for (const spec of specs.slice(1)) {
              const puzzle = makePuzzle(spec, random(0x100000000), p =>
                signatures.has(signature(p)) || puzzles.some(old => old.start === p.start || goalKey(old) === goalKey(p)) ||
                (p.index !== 1 && number - (goals.get(goalKey(p)) ?? -Infinity) <= GOAL_COOLDOWN))
              if (!puzzle) break
              puzzles.push(puzzle)
            }
            if (puzzles.length === 4) chosen = { puzzles, specs }
          }
          if (chosen) break
        }
        if (chosen) break
      }
      if (chosen) break
    }
    if (!chosen) throw new Error(`No eligible set on day ${number} (${date}); available: ${available.map(stamp => stamp.name)}`)
    for (const name of familyNames(chosen.puzzles)) {
      last.set(name, number)
      used.set(name, (used.get(name) ?? 0) + 1)
    }
    for (const puzzle of chosen.puzzles) {
      signatures.add(signature(puzzle))
      if (puzzle.index !== 1) goals.set(goalKey(puzzle), number)
    }
    calendar.push({ date, number, puzzles: chosen.puzzles })
    // Two same-slot replacements per day keep the reserve pool 50% larger than the schedule.
    for (const spec of shuffle(chosen.specs, random)) {
      if (pool.length >= number * 2) break
      const replacement = makePuzzle({ ...spec, goal: chosen.puzzles[spec.index - 1].goal }, random(0x100000000), p => signatures.has(signature(p))
        || chosen.puzzles.some(old => old.start === p.start
          || (p.index === old.index ? goalKey(old) !== goalKey(p) : goalKey(old) === goalKey(p))))
      if (replacement) {
        replacement.id += '-reserve'
        signatures.add(signature(replacement))
        pool.push(replacement)
      }
    }
  }
  return { seed, calendar, pool }
}
