// The rig's space types (registry.ts's `SpaceType`): a space maps its
// children's units into its parent's, and a layer's transform is its space's
// chain to the root, each space's own `then` its parent's (evaluate.ts).
//
// `transform` composes with the kit's own `then`, `rotateAbout`, `translate`
// and `scale` (pen.ts): scale (sx, sy) about the pivot when either is
// given, then `rotateAbout(rotate, px, py)` when `rotate` is given, then
// `translate(x ?? 0, y ?? 0)` when either is given, composed with `then` from
// the first part present. An absent part is skipped, never composed as an
// identity (which would round differently); with none, the identity. So
//
//     { pivot: [50, 80], rotate: tilt, x: shift, y: bob }
//         = then(rotateAbout(tilt, 50, 80), translate(shift, bob))
//
// is Momiji's `head` space before `m`, and `{ y: chest }` her `body`'s
// `translate(0, chest)`. A missing pivot is (0, 0); a missing scale axis is
// 1. Registered in registry.ts. Pure: imports nothing at run time but the
// kit's pen and the shared scalar checks.
import type { Affine } from './kit/pen'
import { IDENTITY, rotateAbout, scale, then, translate } from './kit/pen'
import { checkScalar, paramsIn } from './interp'
import type { SpaceType } from './registry'
import type { Problem } from './schema'

/** A problem at `path` (registry.ts's `problem`; not imported, so this module loads before the registry that lists it). */
const problem = (path: string, message: string): Problem => ({ path, message, level: 'error' })

/** The transform's scalar fields, in the order they compose. */
const SCALARS = ['sx', 'sy', 'rotate', 'x', 'y'] as const

/** A scale of (sx, sy) about (x, y): the kit's `scale` moved to the pivot. */
const scaleAbout = (sx: number, sy: number, x: number, y: number): Affine => [sx, 0, 0, sy, x - sx * x, y - sy * y]

const transform: SpaceType = {
  id: 'transform',
  inputs: def => [...paramsIn(SCALARS.map(field => def[field]))],
  check(def, path, ctx) {
    const problems: Problem[] = []
    const pivot = def.pivot as unknown
    if (pivot !== undefined && !(Array.isArray(pivot) && pivot.length === 2 && pivot.every(Number.isFinite))) problems.push(problem(`${path}.pivot`, 'is [x, y], finite'))
    for (const field of SCALARS) if (def[field] !== undefined) problems.push(...checkScalar(def[field], `${path}.${field}`, ctx))
    return problems
  },
  local(def, scalar) {
    const sx = scalar(def.sx)
    const sy = scalar(def.sy)
    const angle = scalar(def.rotate)
    const x = scalar(def.x)
    const y = scalar(def.y)
    let m: Affine | undefined
    if (sx !== undefined || sy !== undefined) m = def.pivot === undefined ? scale(sx ?? 1, sy ?? 1) : scaleAbout(sx ?? 1, sy ?? 1, def.pivot[0], def.pivot[1])
    if (angle !== undefined) {
      const turn = rotateAbout(angle, def.pivot?.[0] ?? 0, def.pivot?.[1] ?? 0)
      m = m === undefined ? turn : then(m, turn)
    }
    if (x !== undefined || y !== undefined) {
      const move = translate(x ?? 0, y ?? 0)
      m = m === undefined ? move : then(m, move)
    }
    return m ?? IDENTITY
  },
}

/** The space types, by id: `transform`. */
export const SPACES: readonly SpaceType[] = [transform]
