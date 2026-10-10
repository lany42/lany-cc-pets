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
// Also here, since every rig-side family checks them and this module loads
// before the registry that lists them: the checks of a scalar (a number, a
// binding, keyforms) and of a block's axes, and the params a scalar reads.
// Registered in registry.ts. Pure: imports nothing at run time.
import type { Interpolator, RigContext } from './registry'
import type { BlockAxes, Problem } from './schema'

/** A problem at `path` (registry.ts's `problem`; not imported, so this module loads before the registry that lists it). */
const problem = (path: string, message: string): Problem => ({ path, message, level: 'error' })

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

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

// ---------------------------------------------------------------- checks the rig-side families share

/**
 * Checks a block's `on` and `axes` (and its `interp`): one to three params or
 * derived params, each axis strictly increasing, finite and inside its
 * param's range. Returns the problems and the grid's size (the product of the
 * axes' lengths; 0 when they don't hold).
 */
export function checkAxes(block: BlockAxes, path: string, ctx: RigContext): { readonly problems: Problem[]; readonly size: number } {
  const problems: Problem[] = []
  if (!Array.isArray(block.on) || block.on.length < 1 || block.on.length > 3) return { problems: [problem(`${path}.on`, 'names one to three params')], size: 0 }
  if (!Array.isArray(block.axes) || block.axes.length !== block.on.length) return { problems: [problem(`${path}.axes`, `holds one axis per param of "on" (${block.on.length})`)], size: 0 }
  let size = 1
  block.on.forEach((id, k) => {
    const at = `${path}.on[${k}]`
    if (typeof id !== 'string' || !ctx.isValue(id)) problems.push(problem(at, `"${String(id)}" is not a param or derived param`))
    const axis = block.axes[k]
    if (!Array.isArray(axis) || axis.length < 1 || !axis.every(isNumber)) {
      problems.push(problem(`${path}.axes[${k}]`, 'is not a list of finite numbers'))
      size = 0
      return
    }
    for (let j = 1; j < axis.length; j++) if (!(axis[j]! > axis[j - 1]!)) problems.push(problem(`${path}.axes[${k}][${j}]`, 'axes are strictly increasing'))
    const range = typeof id === 'string' ? ctx.rangeOf(id) : undefined
    if (range !== undefined && (axis[0]! < range[0] || axis[axis.length - 1]! > range[1])) problems.push(problem(`${path}.axes[${k}]`, `lies outside ${id}'s range [${range[0]}, ${range[1]}]`))
    size *= axis.length
  })
  if (block.interp !== undefined && !INTERPOLATORS.some(one => one.id === block.interp)) problems.push(problem(`${path}.interp`, `"${String(block.interp)}" is not an interpolator (${INTERPOLATORS.map(one => one.id).join(', ')})`))
  return { problems, size }
}

/** Checks a scalar: a finite number, a binding `{ param, scale?, offset? }` to a param or derived param, or keyforms `{ base, keyforms }` whose blocks hold one number a grid point. */
export function checkScalar(value: unknown, path: string, ctx: RigContext): Problem[] {
  if (typeof value === 'number') return Number.isFinite(value) ? [] : [problem(path, 'is not a finite number')]
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [problem(path, 'is a number, a binding { param, scale, offset } or keyforms { base, keyforms }')]
  const one = value as Record<string, unknown>
  if ('param' in one) {
    const problems: Problem[] = []
    if (typeof one.param !== 'string' || !ctx.isValue(one.param)) problems.push(problem(`${path}.param`, `"${String(one.param)}" is not a param or derived param`))
    for (const field of ['scale', 'offset']) if (one[field] !== undefined && !isNumber(one[field])) problems.push(problem(`${path}.${field}`, 'is not a finite number'))
    return problems
  }
  if ('base' in one || 'keyforms' in one) {
    const problems: Problem[] = []
    if (!isNumber(one.base)) problems.push(problem(`${path}.base`, 'is not a finite number'))
    if (!Array.isArray(one.keyforms)) return [...problems, problem(`${path}.keyforms`, 'is not a list of blocks')]
    for (let k = 0; k < one.keyforms.length; k++) {
      const block: unknown = one.keyforms[k]
      const at = `${path}.keyforms[${k}]`
      if (block === null || typeof block !== 'object') {
        problems.push(problem(at, 'is not a block'))
        continue
      }
      const { problems: axes, size } = checkAxes(block as BlockAxes, at, ctx)
      problems.push(...axes)
      const values = (block as { values?: unknown }).values
      if (!Array.isArray(values) || !values.every(isNumber)) problems.push(problem(`${at}.values`, 'is not a list of finite numbers'))
      else if (size > 0 && values.length !== size) problems.push(problem(`${at}.values`, `holds ${values.length} values for a grid of ${size}`))
    }
    return problems
  }
  return [problem(path, 'is a number, a binding { param, scale, offset } or keyforms { base, keyforms }')]
}

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
