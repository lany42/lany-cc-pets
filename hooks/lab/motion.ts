// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// What every director and behavior times its moves with: keyframes eased
// between, and chance drawn from a hash of its seed and a counter (never
// Math.random), so the same seed gives the same moments in a studio render as
// on the person's screen. Shared by the rig engine (rig/behavior.ts,
// rig/particle.ts) and the pixel pets' directors, so it sits beside util.ts,
// in neither kind. Pure: imports nothing.

/** Keyframes [seconds, value], eased smoothly between; held before the first and after the last. */
export function keys(frames: readonly (readonly [number, number])[], t: number): number {
  if (t <= frames[0]![0]) return frames[0]![1]
  for (let k = 1; k < frames.length; k++) {
    const [tb, vb] = frames[k]!
    if (t <= tb) {
      const [ta, va] = frames[k - 1]!
      const u = (t - ta) / (tb - ta)
      return va + (vb - va) * u * u * (3 - 2 * u)
    }
  }
  return frames[frames.length - 1]![1]
}

/** A stable hash of integers to [0, 1). */
export function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae35)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
