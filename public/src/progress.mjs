import { dayIndex } from './calendar.mjs'

export function start(challenge) {
  return {
    day: challenge.day, setId: challenge.id, revision: challenge.revision, cursor: 0, completedOn: null,
    rounds: challenge.puzzles.map(puzzle => ({
      puzzleId: puzzle.id, revision: puzzle.revision, attempts: [], hinted: false, result: null,
    })),
  }
}

export function transition(progress, challenge, action, today) {
  if (progress.cursor !== action.cursor) return progress
  const round = progress.rounds[progress.cursor]
  const puzzle = challenge.puzzles[progress.cursor]
  if (!round) return progress
  if (action.type === 'next' && round.result) return { ...progress, cursor: progress.cursor + 1 }
  if (round.result) return progress

  let update
  switch (action.type) {
    case 'hint':
      if (round.hinted) return progress
      update = { ...round, hinted: true }
      break
    case 'submit': {
      const { choice } = action
      if (!puzzle.choices.some(option => option.id === choice) || round.attempts.includes(choice)) return progress
      const attempts = [...round.attempts, choice]
      const result = choice === puzzle.correct ? 'solved' : attempts.length === 2 ? 'revealed' : null
      update = { ...round, attempts, result }
      break
    }
    case 'reveal':
      update = { ...round, result: 'revealed' }
      break
    default:
      return progress
  }

  const rounds = [...progress.rounds]
  rounds[progress.cursor] = update
  const completedOn = progress.completedOn ?? (rounds.every(entry => entry.result) ? today : null)
  return { ...progress, rounds, completedOn }
}

function validRound(round) {
  return round && typeof round.hinted === 'boolean' && [null, 'solved', 'revealed'].includes(round.result)
    && Array.isArray(round.attempts) && round.attempts.length <= 2
    && (round.result !== 'solved' || round.attempts.length > 0)
}

function matches(record, challenge) {
  return record?.day === challenge.day && record?.setId === challenge.id && record?.revision === challenge.revision
    && Array.isArray(record.rounds) && record.rounds.length === challenge.puzzles.length
    && Number.isInteger(record.cursor) && record.cursor >= 0 && record.cursor <= record.rounds.length
    && record.rounds.every((round, i) => {
      const puzzle = challenge.puzzles[i]
      return validRound(round) && round.puzzleId === puzzle.id && round.revision === puzzle.revision
        && round.attempts.every(id => puzzle.choices.some(choice => choice.id === id))
    })
}

export function createStore(storage, locks, scope = 'daily') {
  const prefix = `rulebreaker.${scope}.v1.`
  const memory = new Map()
  let persistent = Boolean(storage)

  function read(key) {
    if (persistent) {
      try { return JSON.parse(storage.getItem(key)) ?? memory.get(key) }
      catch (error) {
        if (error instanceof SyntaxError) return memory.get(key)
        persistent = false
      }
    }
    return memory.get(key)
  }

  function get(challenge) {
    const key = prefix + challenge.day
    const record = read(key)
    return matches(record, challenge) ? record : start(challenge)
  }

  function update(challenge, action, today) {
    const key = prefix + challenge.day
    const write = () => {
      const before = get(challenge)
      const after = transition(before, challenge, action, today)
      if (before === after) return before
      memory.set(key, after)
      if (persistent) {
        try { storage.setItem(key, JSON.stringify(after)) }
        catch { persistent = false }
      }
      return after
    }
    return locks ? locks.request(key, write) : Promise.resolve(write())
  }

  function records() {
    const keys = new Set(memory.keys())
    if (persistent) {
      try {
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i)
          if (key?.startsWith(prefix)) keys.add(key)
        }
      } catch { persistent = false }
    }
    return [...keys].map(read).filter(record => Array.isArray(record?.rounds) && record.rounds.length === 5
      && record.rounds.every(validRound) && /^\d{4}-\d{2}-\d{2}$/.test(record.day))
  }

  return { get, update, records, get persistent() { return persistent } }
}

export function score(round) {
  if (round.result !== 'solved') return 0
  return round.hinted || round.attempts.length > 1 ? 1 : 2
}

export function summarize(records, today) {
  const finished = records.filter(record => record.completedOn)
  const days = new Set(finished.filter(record => record.completedOn === record.day).map(record => dayIndex(record.day)))
  const current = dayIndex(today)
  let streak = 0
  for (let day = days.has(current) ? current : current - 1; days.has(day); day -= 1) streak += 1
  return {
    finished: finished.length,
    solved: records.reduce((count, record) => count + record.rounds.filter(round => round?.result === 'solved').length, 0),
    streak,
  }
}

export function shareText(challenge, progress, url) {
  const tiles = ['⬜', '🟨', '🟪']
  const solved = progress.rounds.filter(round => round.result === 'solved').length
  const points = progress.rounds.reduce((sum, round) => sum + score(round), 0)
  return [
    challenge.playtest ? 'Rulebreaker playtest' : `Rulebreaker #${challenge.number}`,
    progress.rounds.map(round => tiles[score(round)]).join(''),
    `${solved}/${challenge.puzzles.length} solved · ${points}/${challenge.puzzles.length * 2} points`,
    url,
  ].join('\n')
}
