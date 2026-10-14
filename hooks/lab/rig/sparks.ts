// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The `sparks` driver: small lights that leave a point of the pet where the
// pose has put it (a wand's tip as it sweeps), fly a short way under gravity
// and drag, twinkle and go out; or that gather, each landing exactly on a
// point of a shape (a heart in the air), hold there, and scatter.
//
// A spark leaves when a clip it watches reaches one of its `emit` times. Its
// origin is the rig anchor `from` where the stages before this one have put
// it, read through `frame.anchorAt` on the first step at or past that time
// and carried back along the anchor's own last step to the exact moment (a
// tip sweeping steadily is caught where it was), or a fixed point. From
// there it is a pure function of its age, so it is the same at any frame
// rate: with drag d and gravity g (down), from velocity v0,
//
//   p(u) = p0 + w u + (v0 - w)(1 - exp(-d u)) / d,   w = (0, g / d)
//
// (p0 + v0 u + g u^2 / 2 down, without drag). Its size rises to its peak over
// `grow` of its life, holds, shrinks to nothing over `fade` of it, and
// twinkles by `1 + depth sin(2 pi hertz u + phase)`. A gathering spark (a
// watch's `gather`) flies the same way but is drawn to its point of the
// shape by `smoothstep(u / time)`, so it lands exactly there at `time`; it
// holds `hold` seconds at full size, then flies off outward from the shape's
// centre at `burst` and lives out a `life`, fading.
//
// Each spark's chances come from the hash of the watch's seed (an arg, so
// each act's instance has its own), its index in its instance and the salt.
// Sparks outlive the instance that sent them, until each goes out. They
// start over (no spark in the air) on a first step, a step back in time and
// after a gap (`frame.gap`), as the particle driver does.
//
// Its def (data; nothing in it is named for one pet):
//
//   watch    [{ lane?, clips, emit: [[clip time, count]...], seed?,
//            gather? }]: the clips that send sparks, when and how many. A
//            gather is { at: [x, y], points: [[dx, dy]...], leave, time,
//            hold, burst? }: at clip time `leave` one spark a point leaves,
//            spark k for point k, each landing on `at` plus its point
//            `time` seconds later.
//   from     an anchor, `layer#name`, or a point [x, y] in root units
//   home     [x, y]: the outputs are a spark's place less this, so a spark
//            drawn at its home in a space moved by them sits there at rest
//   speed    units a second, a number or [lo, hi] (0); angle [centre,
//            spread]: it leaves at the centre's angle (radians, 0 along +x,
//            pi/2 down) give or take the spread (0, 0)
//   gravity  units a second squared, down (0); drag, a second (0)
//   life     seconds, a number or [lo, hi] (1); size, its peak (1); grow
//            (0.15) and fade (0.4), shares of its life; twinkle [hertz,
//            depth] (none)
//   salt     the hash's salt (0x5a9)
//   out      { each: prefix, count }: spark k writes `prefix.(k mod
//            count).x`, `.y`, `.size` and `.on` (1) while it is lit; a later
//            spark in a set overwrites an earlier one
//
// Outputs that are params are held to their ranges. Pure: imports nothing at
// run time but motion.ts's hash.
import { hash } from '../motion'
import type { DriverFrame, DriverType } from './registry'
import type { AnchorRef, DriverDef, Instance, Pt, Timeline, Values } from './schema'

/** A number drawn by a spark's hash: fixed, or in [lo, hi]. */
export type Drawn = number | readonly [lo: number, hi: number]

/** A number from an instance: fixed, or its arg as `scale * arg + add` (the arg `default` when it leaves it out). */
export type FromArg = number | { readonly arg: string; readonly scale?: number; readonly add?: number; readonly default?: number }

/** A shape the sparks of one emission gather into. */
export type Gather = { readonly at: Pt; readonly points: readonly Pt[]; readonly leave: number; readonly time: number; readonly hold: number; readonly burst?: Drawn }

/** The clip instances that send sparks, and when. */
export type SparkWatch = {
  readonly lane?: string
  readonly clips: readonly string[]
  readonly emit?: readonly (readonly [at: number, count: number])[]
  readonly seed?: FromArg
  readonly gather?: Gather
}

/** A `sparks` driver's def (the file's header says what each field does). */
export type SparksDef = DriverDef & {
  readonly watch: readonly SparkWatch[]
  readonly from: AnchorRef | Pt
  readonly home: Pt
  readonly speed?: Drawn
  readonly angle?: readonly [centre: number, spread: number]
  readonly gravity?: number
  readonly drag?: number
  readonly life?: Drawn
  readonly size?: Drawn
  readonly grow?: number
  readonly fade?: number
  readonly twinkle?: readonly [hertz: number, depth: number]
  readonly salt?: number
  readonly out: { readonly each: string; readonly count: number }
}

const SALT = 0x5a9
const GROW = 0.15
const FADE = 0.4

/** One spark, from when it left. */
export type Spark = {
  /** Its index in its instance, and the set of outputs it writes. */
  readonly index: number
  readonly slot: number
  /** The timeline's time it left, and where from, how fast. */
  readonly start: number
  readonly x: number
  readonly y: number
  readonly vx: number
  readonly vy: number
  readonly life: number
  readonly peak: number
  readonly phase: number
  /** A gathering spark's point, when it lands (seconds after leaving), how long it holds, and its velocity flying off. */
  readonly gather?: { readonly x: number; readonly y: number; readonly time: number; readonly hold: number; readonly vx: number; readonly vy: number }
}

/** The driver's state: the sparks in the air, the emissions already sent (by key), and the anchor's last place. */
type SparksState = { readonly sparks: readonly Spark[]; readonly sent: ReadonlySet<string>; readonly last?: { readonly t: number; readonly x: number; readonly y: number } }

const drawn = (value: Drawn | undefined, r: number, fallback: number): number => (value === undefined ? fallback : typeof value === 'number' ? value : value[0] + (value[1] - value[0]) * r)

const fromArg = (value: FromArg | undefined, args: Values, fallback: number): number => {
  if (value === undefined) return fallback
  if (typeof value === 'number') return value
  const arg = args[value.arg] ?? value.default ?? 0
  return arg * (value.scale ?? 1) + (value.add ?? 0)
}

/** Where a free spark is `u` seconds after leaving (x, y) at (vx, vy), under the def's gravity and drag. */
export function flown(def: SparksDef, x: number, y: number, vx: number, vy: number, u: number): [number, number] {
  const g = def.gravity ?? 0
  const d = def.drag ?? 0
  if (d > 0) {
    const w = g / d
    const k = (1 - Math.exp(-d * u)) / d
    return [x + vx * k, y + w * u + (vy - w) * k]
  }
  return [x + vx * u, y + vy * u + (g * u * u) / 2]
}

/** 0 at 0, 1 at 1, smooth at both. */
const smoothstep = (s: number): number => s * s * (3 - 2 * s)

/** A spark's size at age `u` over a life of `life`: rising over `grow`, held, shrinking over `fade`. */
function envelope(def: SparksDef, u: number, life: number, rising: boolean): number {
  const grow = (def.grow ?? GROW) * life
  const fade = (def.fade ?? FADE) * life
  if (rising && u < grow) return grow > 0 ? u / grow : 1
  if (u > life - fade) return fade > 0 ? Math.max(0, (life - u) / fade) : 0
  return 1
}

/** Where spark `s` is at timeline time `t`, its size and whether it is lit; undefined once it has gone out. */
export function sparkAt(def: SparksDef, s: Spark, t: number): { readonly x: number; readonly y: number; readonly size: number } | undefined {
  const u = t - s.start
  if (u < 0) return undefined
  const twinkle = def.twinkle === undefined ? 1 : 1 + def.twinkle[1] * Math.sin(2 * Math.PI * def.twinkle[0] * u + s.phase)
  const g = s.gather
  if (g === undefined) {
    if (u >= s.life) return undefined
    const [x, y] = flown(def, s.x, s.y, s.vx, s.vy, u)
    return { x, y, size: s.peak * envelope(def, u, s.life, true) * twinkle }
  }
  if (u < g.time) {
    const [fx, fy] = flown(def, s.x, s.y, s.vx, s.vy, u)
    const e = smoothstep(u / g.time)
    const grow = (def.grow ?? GROW) * g.time
    return { x: fx + (g.x - fx) * e, y: fy + (g.y - fy) * e, size: s.peak * (grow > 0 ? Math.min(1, u / grow) : 1) * twinkle }
  }
  if (u < g.time + g.hold) return { x: g.x, y: g.y, size: s.peak * twinkle }
  const v = u - g.time - g.hold
  if (v >= s.life) return undefined
  const [x, y] = flown(def, g.x, g.y, g.vx, g.vy, v)
  return { x, y, size: s.peak * envelope(def, v, s.life, false) * twinkle }
}

/** The latest a spark of an emission at `at` may still be lit. */
const reachOf = (def: SparksDef, watch: SparkWatch, at: number): number => {
  const life = def.life === undefined ? 1 : typeof def.life === 'number' ? def.life : def.life[1]
  return at + life + (watch.gather !== undefined ? watch.gather.time + watch.gather.hold : 0)
}

const keyOf = (lane: string, instance: Instance, emission: number): string => `${lane}\u0000${instance.clip}\u0000${instance.at}\u0000${emission}`

/** The instances `watch` sees in `timeline` by `t`, with their lanes. */
function* watched(watch: SparkWatch, timeline: Timeline, t: number): Generator<readonly [string, Instance]> {
  const lanes = watch.lane !== undefined ? [watch.lane] : Object.keys(timeline)
  for (const lane of lanes) for (const instance of timeline[lane] ?? []) if (instance.at <= t && watch.clips.includes(instance.clip)) yield [lane, instance]
}

/** Where the def's sparks leave from now, in root units. */
function originOf(def: SparksDef, frame: DriverFrame): readonly [number, number] {
  const from = def.from
  if (typeof from !== 'string') return from
  if (frame.anchorAt === undefined) return frame.anchor(from)
  return frame.anchorAt(from)
}

function stepSparks(def: SparksDef, state: unknown, frame: DriverFrame): SparksState {
  const t = frame.t
  const prior = frame.gap ? undefined : (state as SparksState | undefined)
  const sent = new Set(prior?.sent ?? [])
  const sparks: Spark[] = (prior?.sparks ?? []).filter(s => sparkAt(def, s, t) !== undefined)
  const salt = def.salt ?? SALT
  const count = Math.max(0, def.out.count)
  // Where the origin is now, and how fast it moved over the last step (to carry a spark back to the moment it left).
  let here: readonly [number, number] | undefined
  const now = (): readonly [number, number] => (here ??= originOf(def, frame))
  // While a clip it watches is on the timeline, it follows the origin every step, to carry a spark back to the moment it left.
  let isWatching = false
  for (const watch of def.watch) {
    for (const [lane, instance] of watched(watch, frame.timeline, t)) {
      isWatching = true
      const args = instance.args ?? {}
      const seed = Math.floor(fromArg(watch.seed, args, 0))
      const emissions: (readonly [at: number, count: number, gather: boolean])[] = [...(watch.emit ?? []).map(([at, n]) => [at, n, false] as const), ...(watch.gather !== undefined ? [[watch.gather.leave, watch.gather.points.length, true] as const] : [])]
      let index = 0
      emissions.forEach(([at, n, isGather], e) => {
        const first = index
        index += n
        const leave = instance.at + at
        const key = keyOf(lane, instance, e)
        if (leave > t || sent.has(key)) return
        sent.add(key)
        if (t >= reachOf(def, watch, leave)) return
        const [ox, oy] = now()
        const last = prior?.last
        const back = t - leave
        const [x, y] = last !== undefined && typeof def.from === 'string' && t > last.t && back > 0 ? [ox - ((ox - last.x) / (t - last.t)) * back, oy - ((oy - last.y) / (t - last.t)) * back] : [ox, oy]
        for (let j = 0; j < n; j++) {
          const k = first + j
          const r = (c: number) => hash(seed, k, salt + c)
          const speed = drawn(def.speed, r(1), 0)
          const [centre, spread] = def.angle ?? [0, 0]
          const angle = centre + spread * (2 * r(2) - 1)
          let gather: Spark['gather']
          if (isGather) {
            const g = watch.gather!
            const point = g.points[j]!
            const gx = g.at[0] + point[0]
            const gy = g.at[1] + point[1]
            const away = Math.atan2(point[1], point[0]) + 0.3 * (2 * r(6) - 1)
            const burst = drawn(g.burst, r(7), 0)
            gather = { x: gx, y: gy, time: g.time, hold: g.hold, vx: Math.cos(away) * burst, vy: Math.sin(away) * burst }
          }
          sparks.push({
            index: k,
            slot: count > 0 ? k % count : 0,
            start: leave,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: drawn(def.life, r(3), 1),
            peak: drawn(def.size, r(4), 1),
            phase: r(5) * Math.PI * 2,
            ...(gather !== undefined ? { gather } : {}),
          })
        }
      })
    }
  }
  // Sent keys of emissions whose sparks have all gone out are kept while their instance may still be on the timeline: forgetting them would send them again.
  const values = frame.values
  const write = (id: string, value: number) => {
    const range = frame.rangeOf(id)
    values[id] = range === undefined ? value : Math.max(range[0], Math.min(range[1], value))
  }
  const [hx, hy] = def.home
  const lit = sparks.map(s => ({ s, at: sparkAt(def, s, t) })).filter(one => one.at !== undefined)
  lit.sort((a, b) => a.s.start - b.s.start || a.s.index - b.s.index)
  for (const { s, at } of lit) {
    if (count === 0) break
    const p = `${def.out.each}.${s.slot}`
    write(`${p}.x`, at!.x - hx)
    write(`${p}.y`, at!.y - hy)
    write(`${p}.size`, at!.size)
    write(`${p}.on`, 1)
  }
  const anchor = typeof def.from === 'string' && isWatching ? now() : undefined
  return { sparks: lit.map(one => one.s), sent: pruned(sent, frame.timeline, t), ...(anchor !== undefined ? { last: { t, x: anchor[0], y: anchor[1] } } : {}) }
}

/** The sent keys whose instance is still on the timeline at `t` (any lane): the rest can't be sent again. */
function pruned(sent: ReadonlySet<string>, timeline: Timeline, t: number): ReadonlySet<string> {
  if (sent.size === 0) return sent
  const live = new Set<string>()
  for (const [lane, instances] of Object.entries(timeline)) for (const instance of instances) if (instance.at <= t) live.add(`${lane}\u0000${instance.clip}\u0000${instance.at}`)
  const out = new Set<string>()
  for (const key of sent) if (live.has(key.slice(0, key.lastIndexOf('\u0000')))) out.add(key)
  return out
}

/** Each output channel a sparks def writes, set by set. */
export function channelsOf(def: SparksDef): string[] {
  const out: string[] = []
  for (let k = 0; k < def.out.count; k++) for (const end of ['x', 'y', 'size', 'on']) out.push(`${def.out.each}.${k}.${end}`)
  return out
}

export const SPARKS: readonly DriverType[] = [
  {
    id: 'sparks',
    step: (def, state, frame) => stepSparks(def as SparksDef, state, frame),
  },
]
