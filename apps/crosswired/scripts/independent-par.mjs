// Independent meet-in-the-middle search through reachable states, bounded by the recorded par.
export function independentPar(columns, target, limit) {
  const effects = [...new Set(columns.filter(effect => effect))]
  function distances(start, depth) {
    const seen = new Map([[start, 0]])
    let layer = [start]
    for (let step = 1; step <= depth; step += 1) {
      const next = []
      for (const state of layer) {
        for (const effect of effects) {
          const reached = state ^ effect
          if (seen.has(reached)) continue
          seen.set(reached, step)
          next.push(reached)
        }
      }
      layer = next
    }
    return seen
  }
  const left = distances(0n, Math.floor(limit / 2))
  const right = distances(target, Math.ceil(limit / 2))
  let best = Infinity
  for (const [state, distance] of left) {
    if (right.has(state)) best = Math.min(best, distance + right.get(state))
  }
  return best
}
