// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The rig's deformers (registry.ts's `DeformerType`). A deformer moves the
// nodes of the layers that name it (a layer's `deform`: one id, or a list
// applied in order), in the layer's own units, after its keyforms and before
// its space's transform: so a layer's anchors and curves move with its
// shapes, and every box measured from the fill (the runtime's repaint parts)
// is the deformed fill's. At rest a deformer hands back nothing and the nodes
// stay exactly as they were: a rig whose deformers rest draws, bit for bit,
// what it would draw without them.
//
//   bones  { joints: [[x, y], ...] (two or more), turns: [scalar, ...] (one a
//          segment), blend? (0.25), absolute? (false), radius? }
//          A chain. Segment k runs from joint k to joint k + 1 and turns by
//          turns[k] radians (clockwise on screen, as a space's `rotate`)
//          relative to segment k - 1, or by turns[k] itself with `absolute`,
//          about its joint where the segments before it carried it (forward
//          kinematics): T_k(p) = P_k + R(A_k)(p - J_k), with P_0 = J_0 and
//          P_(k+1) = T_k(J_(k+1)), A_k the segment's whole turn. Each node
//          belongs to the segment nearest it in the layer's base (its bind
//          pose, measured once, as the rig compiles), at its place along the
//          chain. Within `blend` of the shorter neighbour's length either
//          side of an inner joint, it mixes the two segments' transforms by a
//          smoothstep of that place, so a bend is smooth; anywhere else it
//          turns exactly with its segment. With a `radius`, a node further
//          than it from the chain (in the base) moves less, by a smoothstep
//          of (2 radius - its distance) / radius, and one twice as far not at
//          all: a wide shape bends only near its chain (a curtain of hair
//          whose middle stays, a panel whose far side stays). A segment whose
//          turn is 0 holds what lies along it still: a chain's first segment,
//          kept at 0, anchors a lock's root. With every turn at 0 it rests.
//   turn   { centre: [x, y], radius: [rx, ry], yaw?: scalar, pitch?: scalar,
//          depth? (1), reach? (1) }
//          A head turning in depth. A node at (u, v) = ((x - cx) / rx,
//          (y - cy) / ry), inside the ellipse, sits on a cap over it at depth
//          z = depth * (1 - u^2 - v^2), highest at the centre and meeting the
//          ellipse at a slope of 2 depth, so for any turn whose tangent is
//          under 1 / (2 depth) the map keeps its order and nothing folds; it
//          turns by `yaw` radians about the vertical axis (+ toward the
//          viewer's right), then by `pitch` about the horizontal (+ the chin
//          up): u' = u cos(yaw) + z sin(yaw), z' = z cos(yaw) - u sin(yaw),
//          v' = v cos(pitch) - z' sin(pitch), and lands at (cx + rx u', cy +
//          ry v'). A node outside the ellipse, r = sqrt(u^2 + v^2) from its
//          centre, moves as its rim point (u, v) / r does, times (1 - s)^2
//          for s = (r - 1) / reach, and not at all past r = 1 + reach. A rim
//          point is at depth 0, so a yaw barely moves it (by u (cos(yaw) -
//          1)) and a pitch slides it up or down a little: what lies past a
//          head's rim stays nearly where it is, and the features inside do
//          the turning. Over 1, `depth` sits in front of the face (a fringe);
//          under 0, behind it (back hair, which moves against the turn). With
//          yaw and pitch at 0 it rests.
//
// Registered in registry.ts. Pure: imports nothing at run time.
import type { DeformerType } from './registry'
import type { DeformerDef, Pt, Scalar } from './schema'

// ---------------------------------------------------------------- turn

/** A `turn` deformer's fields. */
export type TurnDef = DeformerDef & {
  readonly centre: Pt
  readonly radius: readonly [rx: number, ry: number]
  readonly yaw?: Scalar
  readonly pitch?: Scalar
  /** The surface's depth at the centre, in radii: 1 the face, over 1 in front of it, under 0 behind. */
  readonly depth?: number
  /** How far past the ellipse, in radii, a node still moves (faded). */
  readonly reach?: number
}

/**
 * Where a node turns to: (x, y) in, the turned point out, for an ellipse at
 * (cx, cy) of radii (rx, ry), depth, reach and the turn's sines and cosines.
 * Pure: the tests read it.
 */
export function turnPoint(x: number, y: number, cx: number, cy: number, rx: number, ry: number, depth: number, reach: number, cosYaw: number, sinYaw: number, cosPitch: number, sinPitch: number): [number, number] {
  let u = (x - cx) / rx
  let v = (y - cy) / ry
  const r2 = u * u + v * v
  let fade = 1
  let z = 0
  if (r2 <= 1) z = depth * (1 - r2)
  else {
    const r = Math.sqrt(r2)
    const s = (r - 1) / reach
    if (s >= 1) return [x, y]
    fade = (1 - s) * (1 - s)
    u /= r
    v /= r
  }
  const u1 = u * cosYaw + z * sinYaw
  const z1 = z * cosYaw - u * sinYaw
  const v1 = v * cosPitch - z1 * sinPitch
  if (fade === 1) return [cx + rx * u1, cy + ry * v1]
  return [x + rx * (u1 - u) * fade, y + ry * (v1 - v) * fade]
}

const turn: DeformerType = {
  id: 'turn',
  bind: () => undefined,
  apply(def, _bound, nodes, scalar) {
    const head = def as TurnDef
    const yaw = head.yaw === undefined ? 0 : scalar(head.yaw)
    const pitch = head.pitch === undefined ? 0 : scalar(head.pitch)
    if (yaw === 0 && pitch === 0) return undefined
    const [cx, cy] = head.centre
    const [rx, ry] = head.radius
    const depth = head.depth ?? 1
    const reach = head.reach ?? 1
    const [cosYaw, sinYaw, cosPitch, sinPitch] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)]
    const out = new Float64Array(nodes.length)
    for (let i = 0; i < nodes.length; i += 2) {
      const [x, y] = turnPoint(nodes[i]!, nodes[i + 1]!, cx, cy, rx, ry, depth, reach, cosYaw, sinYaw, cosPitch, sinPitch)
      out[i] = x
      out[i + 1] = y
    }
    return out
  },
}

// ---------------------------------------------------------------- bones

/** A `bones` deformer's fields. */
export type BonesDef = DeformerDef & {
  readonly joints: readonly Pt[]
  readonly turns: readonly Scalar[]
  /** Each inner joint's mixing zone, either side of it, as a share of the shorter segment beside it (0 to 0.5). */
  readonly blend?: number
  /** Whether each turn is its segment's own angle rather than its turn from the segment before. */
  readonly absolute?: boolean
  /** How far from the chain a node moves wholly; twice as far, not at all (none: every node moves wholly). */
  readonly radius?: number
}

/** The share of a segment either side of an inner joint over which two segments mix, when a def doesn't say. */
export const BLEND = 0.25

/** A layer bound to a chain: per node, the segment it turns with, the weight it gives the next one (0: none), and how much of its move it makes (undefined: all, every node). */
export type BonesBound = { readonly bone: Int32Array; readonly weight: Float64Array; readonly share: Float64Array | undefined }

/** 0 at 0, 1 at 1, smooth at both. */
const smoothstep = (s: number): number => s * s * (3 - 2 * s)

/**
 * Where each base node sits on the chain: the segment nearest it, and its
 * weight to the next segment where it lies in a joint's zone. Pure: the
 * tests read it.
 */
export function bindBones(def: BonesDef, base: Float64Array): BonesBound {
  const joints = def.joints
  const n = joints.length - 1
  const lengths: number[] = []
  const starts: number[] = [0]
  for (let k = 0; k < n; k++) {
    const [ax, ay] = joints[k]!
    const [bx, by] = joints[k + 1]!
    lengths.push(Math.hypot(bx - ax, by - ay))
    starts.push(starts[k]! + lengths[k]!)
  }
  const blend = def.blend ?? BLEND
  const count = base.length / 2
  const bone = new Int32Array(count)
  const weight = new Float64Array(count)
  const radius = def.radius
  const share = radius === undefined ? undefined : new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const x = base[i * 2]!
    const y = base[i * 2 + 1]!
    // The nearest segment, and how far along it (clamped to its ends).
    let best = 0
    let bestDist = Infinity
    let bestU = 0
    for (let k = 0; k < n; k++) {
      const [ax, ay] = joints[k]!
      const [bx, by] = joints[k + 1]!
      const dx = bx - ax
      const dy = by - ay
      const length2 = dx * dx + dy * dy
      const u = length2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2)) : 0
      const dist = Math.hypot(x - (ax + u * dx), y - (ay + u * dy))
      if (dist < bestDist) {
        bestDist = dist
        best = k
        bestU = u
      }
    }
    if (share !== undefined) share[i] = bestDist <= radius! ? 1 : bestDist >= 2 * radius! ? 0 : smoothstep((2 * radius! - bestDist) / radius!)
    // Its place along the chain, and the inner joint whose zone holds it, if one does.
    const place = starts[best]! + bestU * lengths[best]!
    bone[i] = best
    for (let j = 1; j < n; j++) {
      const half = blend * Math.min(lengths[j - 1]!, lengths[j]!)
      if (half > 0 && Math.abs(place - starts[j]!) < half) {
        bone[i] = j - 1
        weight[i] = smoothstep((place - (starts[j]! - half)) / (2 * half))
        break
      }
    }
  }
  return { bone, weight, share }
}

const bones: DeformerType = {
  id: 'bones',
  bind: (def, base) => bindBones(def as BonesDef, base),
  apply(def, bound, nodes, scalar) {
    const chain = def as BonesDef
    const joints = chain.joints
    const n = joints.length - 1
    // Each segment's whole turn; at rest, nothing to do.
    const angles = new Float64Array(n)
    let moved = false
    let angle = 0
    for (let k = 0; k < n; k++) {
      const turn = scalar(chain.turns[k]!)
      angle = chain.absolute === true ? turn : angle + turn
      angles[k] = angle
      if (angle !== 0) moved = true
    }
    if (!moved) return undefined
    // Each segment's transform: rotate about its rest joint by its angle, then carry it where the chain put that joint.
    const cos = new Float64Array(n)
    const sin = new Float64Array(n)
    const px = new Float64Array(n)
    const py = new Float64Array(n)
    let x = joints[0]![0]
    let y = joints[0]![1]
    for (let k = 0; k < n; k++) {
      cos[k] = Math.cos(angles[k]!)
      sin[k] = Math.sin(angles[k]!)
      px[k] = x
      py[k] = y
      const dx = joints[k + 1]![0] - joints[k]![0]
      const dy = joints[k + 1]![1] - joints[k]![1]
      x += cos[k]! * dx - sin[k]! * dy
      y += sin[k]! * dx + cos[k]! * dy
    }
    const { bone, weight, share } = bound as BonesBound
    const out = new Float64Array(nodes.length)
    for (let i = 0; i < bone.length; i++) {
      const b = bone[i]!
      const nx = nodes[i * 2]!
      const ny = nodes[i * 2 + 1]!
      const dx = nx - joints[b]![0]
      const dy = ny - joints[b]![1]
      let ox = px[b]! + cos[b]! * dx - sin[b]! * dy
      let oy = py[b]! + sin[b]! * dx + cos[b]! * dy
      const w = weight[i]!
      if (w > 0) {
        const c = b + 1
        const ex = nx - joints[c]![0]
        const ey = ny - joints[c]![1]
        ox += (px[c]! + cos[c]! * ex - sin[c]! * ey - ox) * w
        oy += (py[c]! + sin[c]! * ex + cos[c]! * ey - oy) * w
      }
      const f = share === undefined ? 1 : share[i]!
      if (f === 1) {
        out[i * 2] = ox
        out[i * 2 + 1] = oy
      } else {
        out[i * 2] = nx + (ox - nx) * f
        out[i * 2 + 1] = ny + (oy - ny) * f
      }
    }
    return out
  },
}

/** The deformer types, by id: `bones`, `turn`. */
export const DEFORMERS: readonly DeformerType[] = [bones, turn]
