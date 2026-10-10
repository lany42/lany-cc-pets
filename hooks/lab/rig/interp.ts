// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// How a keyform block reads between its positions: the interpolators
// (registry.ts's `Interpolator`), each the weights it puts on an axis's
// positions at a value, as `[index, weight]` pairs. The evaluator multiplies
// the weights of a block's axes together, left to right, and sums the grid's
// values by them (multilinear for `linear`), so a block over one param is a
// blend shape and one over two or three a grid, as Live2D's are.
//
//   linear  two weights, 1 - u and u, across the segment holding the value
//   step    weight 1 on the last position at or below it (the lash's width,
//           the shower's quarter turns)
//   cubic   Catmull-Rom as a cubic Hermite across the positions: each
//           position's tangent the central difference (v[k+1] - v[k-1]) /
//           (x[k+1] - x[k-1]), one-sided at the first and last; it passes
//           through every keyform (a rotation keyed at a few angles)
//
// Each holds outside its first and last position, and puts weight 1 on a
// position the value lands on exactly, so a keyform gives its own values.
//
// Also here, since spaces.ts and the evaluator share it and this module
// loads before the registry that lists it: the params a scalar reads.
// Registered in registry.ts. Pure: imports nothing at run time.
import type { Interpolator } from './registry'

/** The segment of `axis` holding `x` (strictly inside the first and last position): `k` with axis[k] <= x < axis[k + 1]. */
function segment(axis: readonly number[], x: number): number {
  let k = 0
  while (k < axis.length - 2 && axis[k + 1]! <= x) k++
  return k
}

/** Holding outside the axis, or landing on a position: that position alone; else undefined. */
function held(axis: readonly number[], x: number): readonly (readonly [number, number])[] | undefined {
  const last = axis.length - 1
  if (last <= 0 || x <= axis[0]!) return [[0, 1]]
  if (x >= axis[last]!) return [[last, 1]]
  const k = segment(axis, x)
  if (axis[k] === x) return [[k, 1]]
  return undefined
}

const linear: Interpolator = {
  id: 'linear',
  weights(axis, x) {
    const hold = held(axis, x)
    if (hold !== undefined) return hold
    const k = segment(axis, x)
    const u = (x - axis[k]!) / (axis[k + 1]! - axis[k]!)
    return [
      [k, 1 - u],
      [k + 1, u],
    ]
  },
}

const step: Interpolator = {
  id: 'step',
  weights(axis, x) {
    const hold = held(axis, x)
    if (hold !== undefined) return hold
    return [[segment(axis, x), 1]]
  },
}

const cubic: Interpolator = {
  id: 'cubic',
  weights(axis, x) {
    const hold = held(axis, x)
    if (hold !== undefined) return hold
    const last = axis.length - 1
    const k = segment(axis, x)
    const x0 = axis[k]!
    const h = axis[k + 1]! - x0
    const u = (x - x0) / h
    const u2 = u * u
    const u3 = u2 * u
    // Weights on positions k - 1 .. k + 2, at 0 .. 3.
    const w = [0, 0, 0, 0]
    w[1] = 2 * u3 - 3 * u2 + 1
    w[2] = -2 * u3 + 3 * u2
    /** Adds `c` times position j's tangent, as weights on the positions it is the difference of. */
    const tangent = (j: number, c: number): void => {
      const lo = j === 0 ? 0 : j - 1
      const hi = j === last ? last : j + 1
      const d = c / (axis[hi]! - axis[lo]!)
      w[hi - k + 1]! += d
      w[lo - k + 1]! -= d
    }
    tangent(k, h * (u3 - 2 * u2 + u))
    tangent(k + 1, h * (u3 - u2))
    const out: [number, number][] = []
    for (let at = 0; at < 4; at++) {
      const index = k - 1 + at
      if (index >= 0 && index <= last && w[at] !== 0) out.push([index, w[at]!])
    }
    return out
  },
}

/** The keyform interpolators, by id: `linear` (a block's default), `step`, `cubic`. */
export const INTERPOLATORS: readonly Interpolator[] = [linear, step, cubic]

/**
 * The params and derived params a value may read, found by walking it: every
 * binding's `param` and every keyform block's `on`, however deep (a space's
 * scalars, a shape's, a paint's). What the evaluator follows for `inputsOf`
 * beside a type's own `inputs`; a superset is harmless (a part repaints a
 * little more), a param left out never repaints.
 */
export function paramsIn(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const one of value) paramsIn(one, out)
    return out
  }
  if (value === null || typeof value !== 'object') return out
  const one = value as Record<string, unknown>
  if (typeof one.param === 'string') out.add(one.param)
  if (Array.isArray(one.on) && Array.isArray(one.axes)) for (const id of one.on) if (typeof id === 'string') out.add(id)
  for (const key in one) if (key !== 'param') paramsIn(one[key], out)
  return out
}
