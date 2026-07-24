// Seeded, serializable RNG (mulberry32). State is a single integer kept in GameState,
// so shuffles are deterministic and reproducible from a seed.

export function rngNext(state: number): { value: number; state: number } {
  let a = (state + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, state: a }
}

/** Fisher–Yates shuffle using the seeded RNG. Returns a new array and the advanced RNG state. */
export function shuffle<T>(input: readonly T[], state: number): { result: T[]; state: number } {
  const result = input.slice()
  let s = state
  for (let i = result.length - 1; i > 0; i--) {
    const r = rngNext(s)
    s = r.state
    const j = Math.floor(r.value * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return { result, state: s }
}
