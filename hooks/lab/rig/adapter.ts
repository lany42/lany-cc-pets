// The rig engine worn as a live look: a rig and its drivers as a painted pet
// (kit/pet.ts's `PaintedPet`), painted, repainted and encoded by the painted
// look's runtime (kit/look.ts), which makes it a lab look. Its director
// steps the drivers (drivers.ts) over the timeline a behavior writes each
// frame; its window form is `raster(evaluate(...))`; its band form, when it
// has one, is the look's `chibi`, a pixel pet posed from the rig's channels
// (rig-pets/<id>-band.ts). With none, the band shows its fallback sprite.
//
// Its repaint parts come from the rig itself. Every layer's inputs
// (`inputsOf`: the params that can change its fill) sort it into a part with
// every other layer of the same inputs, which names them as its keys. A
// part's box is the box its layers' fills cover at the very pose, in
// samples: its `space` maps a unit square onto it. So a part holds exactly
// what it draws at any pose, whatever its params reach, with no sampling and
// no margin; a part whose layers are all hidden at a pose sits on a point,
// the middle of its layers' nodes where its spaces put them at rest (a prop
// at its params' defaults). That costs an evaluation a pose, which its paint needs
// anyway: the last few poses' geometry is kept, and a repaint of a small
// rectangle replays only the fills that reach it (any other would paint
// nothing there: canvas.fill leaves a fill outside the clip alone), so a
// part's repaint costs what it covers. Its `snap` is the params' own.
//
// Pure: imports nothing at run time but the engine's modules and the kit's
// pen.
import type { Canvas } from './kit/canvas'
import type { Affine } from './kit/pen'
import { apply, IDENTITY, then } from './kit/pen'
import type { Channels, Cue, Directing, PaintedPet, Part } from './kit/pet'
import type { DriverState } from './drivers'
import { bindDrivers, step } from './drivers'
import type { Rig } from './evaluate'
import { baseNodesOf, compileRig, evaluate, inputsOf, valuesOf, viewOf } from './evaluate'
import type { RigPet } from './pets'
import { RIG_PETS } from './pets'
import { placeOf, raster } from './raster'
import { REGISTRY } from './registry'
import type { Geometry, RigDoc, Scalar, Timeline, Values } from './schema'
import { ROOT } from './schema'

/**
 * What places clip instances on the timeline: a pet's behavior, code on the
 * kit (behavior.ts; a pet's is rig-pets/<id>-behavior.ts). Stepped once a
 * frame with the runtime's cue, deterministic from its seed; its timeline
 * holds every instance that may still apply at `cue.t`.
 */
export type Behavior = { step(cue: Cue): { readonly timeline: Timeline } }

/** Who a rig pet is and how it is framed: a `PaintedPet`'s fields that the rig and drivers don't hold. */
export type RigPetIdentity = Pick<PaintedPet, 'id' | 'name' | 'persona' | 'blurb' | 'fallback' | 'bubble' | 'border' | 'chibi'> & {
  readonly window: Pick<PaintedPet['window'], 'crop' | 'faceLeft' | 'mouth'>
}

/** How a rig pet is worn: the pipeline its director plays (`physics`), and its rest over the rig's defaults (what its idle mood holds). */
export type PaintedRigOptions = { readonly pipeline?: string; readonly rest?: Channels }

/** A box in samples: x0, y0, x1, y1. */
type Box = [x0: number, y0: number, x1: number, y1: number]

/** A pose evaluated under a room's `m`: its geometry, each fill's box in samples, each part's (undefined: nothing of it drawn). */
type Shot = {
  readonly m: Affine
  readonly values: readonly number[]
  readonly geometry: Geometry
  readonly boxes: readonly (Box | undefined)[]
  readonly parts: readonly (Box | undefined)[]
}

/** How many evaluated poses a pet keeps: the last painted and the next, for each of two rooms at once (the window, and pet-control's preview of it). */
const KEEP = 4

/** Every param of `doc` at its default, overlaid with `over`'s values for params (anything else in it ignored). */
export function restOf(doc: RigDoc, over?: Channels): Channels {
  const rest: Channels = {}
  for (const param of doc.params) rest[param.id] = over?.[param.id] ?? param.default
  return rest
}

/** The `snap` of a rig's params that declare one. */
export function snapOf(doc: RigDoc): Readonly<Record<string, number>> {
  const snap: Record<string, number> = {}
  for (const param of doc.params) if (param.snap !== undefined) snap[param.id] = param.snap
  return snap
}

/** The box of a fill's commands (their points, a cubic's controls too, which hold its curve) under `M`, in samples; undefined when it has none. */
function boxOf(d: Geometry[number]['d'], M: Affine): Box | undefined {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = (x: number, y: number) => {
    const sx = M[0] * x + M[2] * y + M[4]
    const sy = M[1] * x + M[3] * y + M[5]
    if (sx < x0) x0 = sx
    if (sx > x1) x1 = sx
    if (sy < y0) y0 = sy
    if (sy > y1) y1 = sy
  }
  for (const c of d) {
    if (c[0] === 'M' || c[0] === 'L') add(c[1], c[2])
    else if (c[0] === 'C') {
      add(c[1], c[2])
      add(c[3], c[4])
      add(c[5], c[6])
    }
  }
  return x0 <= x1 ? [x0, y0, x1, y1] : undefined
}

/**
 * Every space's chain to the root at `rest`, near enough to place a point
 * (keyed scalars at their base): where a part with nothing showing sits.
 */
function chainsAtRest(rig: Rig, rest: Channels): (space: string) => Affine {
  const values = valuesOf(rig, rest)
  const scalar = (value: Scalar | undefined): number | undefined => {
    if (value === undefined || typeof value === 'number') return value
    if ('param' in value) return (value.scale ?? 1) * (values[value.param] ?? 0) + (value.offset ?? 0)
    return value.base
  }
  const byId = new Map((rig.doc.spaces ?? []).map(def => [def.id, def]))
  const chains = new Map<string, Affine>()
  const chainOf = (id: string, depth = 0): Affine => {
    const known = chains.get(id)
    if (known !== undefined) return known
    const def = byId.get(id)
    const local: Affine = def === undefined ? IDENTITY : (REGISTRY.spaces.get(def.type)?.local(def, scalar) ?? IDENTITY)
    const chain = def === undefined || def.parent === ROOT || depth > 32 ? local : then(local, chainOf(def.parent, depth + 1))
    chains.set(id, chain)
    return chain
  }
  return space => (space === ROOT ? IDENTITY : chainOf(space))
}

/**
 * The repaint parts of a rig: its layers grouped by their inputs (each group
 * a part, its inputs its keys), and one more for any param no layer reads, so
 * every param is named. Each part's layer ids, keys, and its point when
 * nothing of it shows, in root units at `rest` (the rig's defaults).
 */
export function groupsOf(rig: Rig, rest: Channels = {}): { readonly layers: readonly string[]; readonly keys: readonly string[]; readonly home: readonly [number, number] }[] {
  const doc = rig.doc
  const inputs = inputsOf(rig)
  const chainOf = chainsAtRest(rig, rest)
  const params = new Set(doc.params.map(param => param.id))
  const groups = new Map<string, { layers: string[]; keys: string[]; nodes: (readonly [number, number])[] }>()
  for (const layer of doc.layers) {
    const keys = [...(inputs.get(layer.id) ?? [])].filter(id => params.has(id)).sort()
    const id = keys.join('\u0000')
    let group = groups.get(id)
    if (group === undefined) {
      group = { layers: [], keys, nodes: [] }
      groups.set(id, group)
    }
    group.layers.push(layer.id)
    const chain = chainOf(layer.space)
    for (const [x, y] of baseNodesOf(layer)) group.nodes.push(apply(chain, x, y))
  }
  const named = new Set([...groups.values()].flatMap(group => group.keys))
  const unread = doc.params.map(param => param.id).filter(id => !named.has(id))
  const middle = [doc.units.width / 2, doc.units.height / 2] as const
  const out = [...groups.values()].map(group => {
    if (group.nodes.length === 0) return { layers: group.layers, keys: group.keys, home: middle }
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, y] of group.nodes) {
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
    return { layers: group.layers, keys: group.keys, home: [(x0 + x1) / 2, (y0 + y1) / 2] as const }
  })
  // A part with no keys never repaints (its layers never change); the unread params get their own, on a point.
  if (unread.length > 0) out.push({ layers: [], keys: unread, home: middle })
  return out.filter(group => group.keys.length > 0)
}

/**
 * `pet` worn as a painted pet: its rig evaluated and rastered, its drivers
 * (`options.pipeline`, `physics` by default; `keyed` for the studio and the
 * evals) stepped over `behavior`'s timeline, under `identity`'s name, words
 * and band form (if any), at rest at the rig's defaults overlaid with `options.rest`.
 */
export function paintedRigPet(identity: RigPetIdentity, pet: RigPet, behavior: (seed: number) => Behavior, options: PaintedRigOptions = {}): PaintedPet {
  const doc = pet.rig
  const rig = compileRig(doc)
  const program = bindDrivers(rig, pet.drivers)
  const pipeline = options.pipeline ?? 'physics'
  const ids = doc.params.map(param => param.id)
  const defaults = doc.params.map(param => param.default)
  const rest = restOf(doc, options.rest)
  const groups = groupsOf(rig, rest)
  const partOf = new Map<string, number>()
  groups.forEach((group, k) => group.layers.forEach(id => partOf.set(id, k)))

  // ---- the last few poses, evaluated
  let shots: Shot[] = []
  const shotOf = (pose: Values, m: Affine): Shot => {
    const at = shots.findIndex(shot => shot.m.every((v, k) => v === m[k]) && shot.values.every((v, k) => v === (pose[ids[k]!] ?? defaults[k])))
    if (at >= 0) {
      const shot = shots[at]!
      if (at > 0) shots = [shot, ...shots.slice(0, at), ...shots.slice(at + 1)]
      return shot
    }
    const geometry = evaluate(rig, pose, viewOf(m))
    const boxes = geometry.map(one => boxOf(one.d, placeOf(one.transform, m)))
    const parts: (Box | undefined)[] = groups.map(() => undefined)
    geometry.forEach((one, k) => {
      const part = partOf.get(one.id)
      const box = boxes[k]
      if (part === undefined || box === undefined) return
      const was = parts[part]
      parts[part] = was === undefined ? box : [Math.min(was[0], box[0]), Math.min(was[1], box[1]), Math.max(was[2], box[2]), Math.max(was[3], box[3])]
    })
    const shot: Shot = { m, values: ids.map((id, k) => pose[id] ?? defaults[k]!), geometry, boxes, parts }
    shots = [shot, ...shots.slice(0, KEEP - 1)]
    return shot
  }

  const parts: Part<Channels>[] = groups.map((group, k) => ({
    // Its units: a unit square, laid over what its layers cover at the pose.
    box: [0, 0, 1, 1],
    keys: group.keys,
    space(pose: Channels, m: Affine): Affine {
      const box = shotOf(pose, m).parts[k]
      if (box === undefined) {
        const [x, y] = apply(m, group.home[0], group.home[1])
        return [0, 0, 0, 0, x, y]
      }
      return [box[2] - box[0], 0, 0, box[3] - box[1], box[0], box[1]]
    },
  }))

  return {
    id: identity.id,
    name: identity.name,
    persona: identity.persona,
    blurb: identity.blurb,
    fallback: identity.fallback,
    bubble: identity.bubble,
    border: identity.border,
    rest,
    director(seed: number): Directing<Channels> {
      const play = behavior(seed)
      let state: DriverState | undefined
      return {
        pose(cue: Cue): Channels {
          const next = step(program, pipeline, state, play.step(cue).timeline, cue.t)
          state = next.state
          return { ...next.params }
        },
      }
    },
    window: {
      width: doc.units.width,
      height: doc.units.height,
      crop: identity.window.crop,
      faceLeft: identity.window.faceLeft,
      mouth: identity.window.mouth,
      paint(canvas: Canvas, pose: Channels, m: Affine): void {
        const shot = shotOf(pose, m)
        const { x0, y0, x1, y1 } = canvas.clip
        if (x0 <= 0 && y0 <= 0 && x1 >= canvas.w && y1 >= canvas.h) {
          raster(shot.geometry, canvas, m)
          return
        }
        // A clipped repaint: only the fills that reach the clip (a sample's margin round it).
        raster(
          shot.geometry.filter((_, k) => {
            const box = shot.boxes[k]
            return box !== undefined && box[2] >= x0 - 1 && box[0] <= x1 + 1 && box[3] >= y0 - 1 && box[1] <= y1 + 1
          }),
          canvas,
          m,
        )
      },
      parts,
      snap: snapOf(doc),
    },
    chibi: identity.chibi,
  }
}

/** A rig pet by id from the generated `RIG_PETS`, or a clear throw naming what to build. */
export function rigPetById(id: string, pets: readonly RigPet[] = RIG_PETS): RigPet {
  const pet = pets.find(one => one.id === id)
  if (pet === undefined) throw new Error(`rig pet "${id}" is not built into RIG_PETS (hooks/lab/rig/pets.ts)`)
  return pet
}

/**
 * `paintedRigPet`, built on first use: its identity at once (all a lab look
 * reads to list it), its rig, drivers and parts only when first posed or
 * painted, so a pet missing from `RIG_PETS` throws then, by name, and never
 * as its module loads.
 */
export function lazyPaintedRigPet(identity: RigPetIdentity, pet: () => RigPet, behavior: (seed: number) => Behavior, options: PaintedRigOptions = {}): PaintedPet {
  let built: PaintedPet | undefined
  const real = (): PaintedPet => (built ??= paintedRigPet(identity, pet(), behavior, options))
  return {
    id: identity.id,
    name: identity.name,
    persona: identity.persona,
    blurb: identity.blurb,
    fallback: identity.fallback,
    bubble: identity.bubble,
    border: identity.border,
    get rest() {
      return real().rest
    },
    director: seed => real().director(seed),
    get window() {
      return real().window
    },
    chibi: identity.chibi,
  }
}
