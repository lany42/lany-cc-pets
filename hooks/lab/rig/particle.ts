// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The `particle` driver: props flown by
// physics. A particle is a point with gravity, drag toward the wind and a
// falling leaf's side-glide with its turn, stepped in fixed sub-steps of
// 1/128 s. Particles belong to a clip instance: when one of the clips the
// driver watches first applies, it simulates that instance's particles whole
// (deterministic, from the instance alone, seeded by motion.ts's hash), so
// from then on each prop is a pure function of the clip's time, and a still
// of any moment of the act is what the clock shows. The flights live in the
// driver's state, so they go on after their instance ends, until each lands
// or leaves the box: a flight's length is its own, not its act's.
//
// A fated particle lands: a spring pulls it toward a target that slides from
// where it set off to a rig anchor (`frame.anchor`), firming up toward the
// end, and the physics' own offset from that target fades out over the last
// fifth of the flight, so it lands exactly there, exactly then: the hand-off
// to the prop's settled twin, which the rig draws. A free one flies until it
// leaves the box. Turns are rounded to `1 / quantum` radians: a tumbling prop
// in steps flips rather than spins and holds still between flips, as
// Sakura's petals do.
//
// Its def (data; nothing in it is named for one pet):
//
//   watch     [{ lane?, clips, ... }]: the clip instances that spawn
//             particles (in `lane`, or in any lane), and how. By fates:
//               fates     a fixed list of fate ids, a particle each; or
//                         { args: [...] }, a particle an arg, its value an
//                         index into `fates`, the list ending at the first
//                         arg absent or under 0; or { spell, after? }, the
//                         clip's id (past its last `after`) spelled letter
//                         by letter, `spell` mapping each letter to a fate
//                         (`gust.hpn` with { h: 'hair', p: 'past', n:
//                         'nose' } and `after` '.': three particles);
//               spacing   seconds between the particles' starts (0);
//               side      the side the wind blows from, -1 the left and 1
//                         the right;
//               seed      the integer the particles' hashes take (floored);
//               first     the first target a fate with several takes (0);
//             each a number or { arg, scale?, add?, default? } (an
//             instance's arg, `scale * arg + add`; the driver doesn't see the
//             clip's own defaults, so an arg it may leave out says its
//             `default` here). Or by a list:
//               particles [{ at, x, y, scale? }]: each sets off `at` seconds
//                         in from (x, y), its displacement from there scaled
//                         by `scale` (a nearer one: bigger, quicker);
//               seed      as above.
//             A watch may give its own `wind`.
//   fates     [{ id, targets?, time?, wind? }]: what becomes of a particle.
//             With `targets` ([{ anchor | at, turn? }]: a rig anchor,
//             `layer#anchor`, in the units the outputs are in, or a point;
//             the turn it lands at) and `time` (seconds from setting off to
//             landing), it lands on its next target in order from `first`
//             (the last when they run out); without, it flies free.
//   wind      { speed?, keys?, sway? }: blowing from its side at `speed` (a
//             number or [lo, hi], drawn by the hash), shaped over the flight
//             by `keys` ([[seconds, factor]...], eased as motion.ts's), plus
//             a sway across, [amplitude, hertz], at a hashed phase. A fate's
//             wind is used before its watch's, and that before the def's.
//   spawn     { x: [left, right], y, turn, launch, fall, spin }: where a
//             particle by fates sets off (x at the side its wind blows from;
//             y and turn a number or [lo, hi], drawn by one hash); a listed
//             one sets off at its own (x, y) with its turn so drawn. It
//             leaves at `launch` times the wind's velocity across (0) and
//             `fall` down (0), spinning at `spin` radians a second (a number
//             or [lo, hi], its own draw; 0).
//   air       { gravity, drag, glide, lift, spin, spinDrag }: the air. Each
//             sub-step: acceleration gravity down, `drag` times the velocity
//             relative to the wind, and the glide, `glide * sin(2 turn)`
//             across and `lift * glide * |sin(2 turn)|` up; the spin relaxes
//             toward `spin` times the wind across it at `spinDrag`.
//   guide     { k: [base, gain, power], d: [base, gain, power], ease, fade }:
//             a fated particle's spring (stiffness k and damping d of s, its
//             share of the flight, each `base + gain * s ** power`), its
//             target's slide (`1 - (1 - s) ** ease` of the way), and the share
//             of the flight its offset fades over.
//   box       [x0, y0, x1, y1]: a free particle ends once outside it.
//   most      the longest any flight lasts, seconds (10).
//   quantum   turns rounded to 1 / quantum radians (unrounded when absent).
//   salt      the hashes' salt (0x7a1).
//   out       { slots: [{ x, y, turn, on }...] }: a pool of channel sets;
//             particle k of its instance takes set k mod n while it is free,
//             else the first free one, and the newest n in the air show. Or
//             { each: prefix, count }: particle k in `prefix.k.x`, `.y`,
//             `.turn` and `.on`.
//   newest    { x, y, on }: channels (signals, for `lookAt`) the newest
//             particle in the air writes its place to.
//
// The flights start over (re-simulated from the timeline, so the same) on a
// first step, a step back in time, and the step after a gap (`frame.gap`):
// whatever left the timeline while the pet was away is gone with it.
//
// While a particle is in the air it writes its set's x, y, turn and `on` = 1;
// otherwise nothing, so they keep what the stages before them left (their
// defaults). Outputs that are params are held to their ranges. Pure: imports
// nothing at run time but motion.ts's hash and keys (the registry's types
// only, so the registry, which lists this module, can load it first or
// after).
import { hash, keys } from '../motion'
import type { DriverFrame, DriverType } from './registry'
import type { AnchorRef, DriverDef, Instance, Pt, Timeline, Values } from './schema'

/** Sub-steps a second. */
export const SUB = 128

// ---------------------------------------------------------------- the def

/** A number drawn by a particle's hash: fixed, or in [lo, hi]. */
export type Drawn = number | readonly [lo: number, hi: number]

/** A number from an instance: fixed, or its arg as `scale * arg + add` (the arg `default` when it leaves it out). */
export type FromArg = number | { readonly arg: string; readonly scale?: number; readonly add?: number; readonly default?: number }

/** The wind a particle flies in. */
export type Wind = { readonly speed?: Drawn; readonly keys?: readonly (readonly [number, number])[]; readonly sway?: readonly [amplitude: number, hertz: number] }

/** Where a fated particle may land: a rig anchor or a point, and its turn there. */
export type Target = { readonly anchor?: AnchorRef; readonly at?: Pt; readonly turn?: number }

/** What becomes of a particle: it lands on a target after `time` seconds, or (no targets) flies free. */
export type Fate = { readonly id: string; readonly targets?: readonly Target[]; readonly time?: number; readonly wind?: Wind }

/** A particle of a listed spawn. */
export type Listed = { readonly at: number; readonly x: number; readonly y: number; readonly scale?: number }

/** The clip instances that spawn particles, and how. */
export type Watch = {
  readonly lane?: string
  readonly clips: readonly string[]
  readonly fates?: readonly string[] | { readonly args: readonly string[] } | { readonly spell: Readonly<Record<string, string>>; readonly after?: string }
  readonly spacing?: number
  readonly side?: FromArg
  readonly seed?: FromArg
  readonly first?: FromArg
  readonly particles?: readonly Listed[]
  readonly wind?: Wind
}

/** A set of output channels. */
export type Slot = { readonly x: string; readonly y: string; readonly turn: string; readonly on: string }

export type Air = { readonly gravity?: number; readonly drag?: number; readonly glide?: number; readonly lift?: number; readonly spin?: number; readonly spinDrag?: number }
export type Guide = { readonly k?: readonly [number, number, number]; readonly d?: readonly [number, number, number]; readonly ease?: number; readonly fade?: number }
export type Spawn = { readonly x?: readonly [left: number, right: number]; readonly y?: Drawn; readonly turn?: Drawn; readonly launch?: number; readonly fall?: number; readonly spin?: Drawn }

/** A `particle` driver's def (the file's header says what each field does). */
export type ParticleDef = DriverDef & {
  readonly watch: readonly Watch[]
  readonly fates?: readonly Fate[]
  readonly wind?: Wind
  readonly spawn?: Spawn
  readonly air?: Air
  readonly guide?: Guide
  readonly box: readonly [x0: number, y0: number, x1: number, y1: number]
  readonly most?: number
  readonly quantum?: number
  readonly salt?: number
  readonly out: { readonly slots: readonly Slot[] } | { readonly each: string; readonly count: number }
  readonly newest?: { readonly x: string; readonly y: string; readonly on: string }
}

// The prototype's air, and its guide.
export const AIR = { gravity: 14, drag: 1.6, glide: 10, lift: 0.35, spin: 0.12, spinDrag: 0.8 }
const GUIDE = { k: [30, 400, 3] as const, d: [6, 30, 2] as const, ease: 1.7, fade: 0.2 }
const MOST = 10
const SALT = 0x7a1

// ---------------------------------------------------------------- a flight

/** A fated particle's landing: its target slides from where it set off to its goal over `time` seconds. */
export type Landing = { readonly from: readonly [x: number, y: number, turn: number]; readonly to: readonly [x: number, y: number, turn: number]; readonly time: number; readonly ease: number; readonly fade: number }

/** One particle's flight, simulated whole. */
export type Flight = {
  /** Its index in its instance: its preferred slot, its `each` channels. */
  readonly index: number
  /** The timeline's times it sets off and lands or leaves: it is in the air while `start <= t < end`. */
  readonly start: number
  readonly end: number
  /** Its x, y and turn every sub-step from its start, through its end. */
  readonly path: Float64Array
  readonly landing?: Landing
}

/** The flights an instance spawned. */
type Spawned = { readonly key: string; readonly at: number; readonly end: number; readonly flights: readonly Flight[] }

/** The driver's state: every instance whose flights may still be in the air. */
type ParticleState = { readonly spawned: readonly Spawned[] }

const drawn = (value: Drawn | undefined, r: number, fallback: number): number => (value === undefined ? fallback : typeof value === 'number' ? value : value[0] + (value[1] - value[0]) * r)

const fromArg = (value: FromArg | undefined, args: Values, fallback: number): number => {
  if (value === undefined) return fallback
  if (typeof value === 'number') return value
  const arg = args[value.arg] ?? value.default ?? 0
  return arg * (value.scale ?? 1) + (value.add ?? 0)
}

/** `a` to `b` by `e`, as `a (1 - e) + b e`: exactly `b` at 1. */
const toward = (a: number, b: number, e: number): number => a * (1 - e) + b * e

/**
 * A particle's flight from (x, y) at `turn`, flown from `start` in `wind`
 * (across, by its time in the air), guided to `landing` when it has one;
 * its displacement scaled by `scale` about where it set off.
 */
export function fly(def: ParticleDef, from: { x: number; y: number; turn: number; vx: number; vy: number; spin: number; scale: number }, wind: (u: number) => number, start: number, index: number, landing?: Landing): Flight {
  const air = { ...AIR, ...def.air }
  const guide = { ...GUIDE, ...def.guide }
  const [bx0, by0, bx1, by1] = def.box
  const most = def.most ?? MOST
  const h = 1 / SUB
  let { x, y, turn, vx, vy, spin } = from
  const path: number[] = []
  let end = most
  for (let n = 0; ; n++) {
    const u = n * h
    const px = from.x + (x - from.x) * from.scale
    const py = from.y + (y - from.y) * from.scale
    path.push(px, py, turn)
    if (landing !== undefined) {
      if (u >= landing.time) {
        end = landing.time
        break
      }
    } else if (px < bx0 || px > bx1 || py < by0 || py > by1) {
      end = u
      break
    }
    if (u >= most) break
    // One sub-step, semi-implicit: the velocity first, then the place.
    const wx = wind(u)
    const glide = Math.sin(2 * turn)
    let ax = -air.drag * (vx - wx) + air.glide * glide
    let ay = air.gravity - air.drag * vy - air.lift * air.glide * Math.abs(glide)
    let at = air.spin * (vx - wx) - air.spinDrag * spin
    if (landing !== undefined) {
      const s = Math.min(1, u / landing.time)
      const k = guide.k[0] + guide.k[1] * s ** guide.k[2]
      const d = guide.d[0] + guide.d[1] * s ** guide.d[2]
      const e = 1 - (1 - s) ** landing.ease
      ax += k * (toward(landing.from[0], landing.to[0], e) - x) - d * vx
      ay += k * (toward(landing.from[1], landing.to[1], e) - y) - d * vy
      at += k * (toward(landing.from[2], landing.to[2], e) - turn) - d * spin
    }
    vx += ax * h
    vy += ay * h
    x += vx * h
    y += vy * h
    spin += at * h
    turn += spin * h
  }
  return { index, start, end: start + end, path: Float64Array.from(path), ...(landing !== undefined ? { landing } : {}) }
}

/**
 * Where a flight is `u` seconds after it set off (0 to its length): its
 * samples read between sub-steps, and a fated one's offset from its sliding
 * target faded out over the end, so at its length it is exactly at its goal.
 * The turn unrounded.
 */
export function placeAt(flight: Flight, u: number): { readonly x: number; readonly y: number; readonly turn: number } {
  const { path, landing } = flight
  const last = path.length / 3 - 1
  const i = Math.max(0, Math.min(last, u * SUB))
  const i0 = Math.min(Math.floor(i), Math.max(0, last - 1))
  const i1 = Math.min(last, i0 + 1)
  const f = i - i0
  const read = (k: number) => path[i0 * 3 + k]! + (path[i1 * 3 + k]! - path[i0 * 3 + k]!) * f
  let x = read(0)
  let y = read(1)
  let turn = read(2)
  if (landing !== undefined) {
    const s = Math.min(1, Math.max(0, u / landing.time))
    const e = 1 - (1 - s) ** landing.ease
    const fade = keys([[0, 1], [landing.time * (1 - landing.fade), 1], [landing.time, 0]], u)
    const tx = toward(landing.from[0], landing.to[0], e)
    const ty = toward(landing.from[1], landing.to[1], e)
    const tt = toward(landing.from[2], landing.to[2], e)
    x = tx + (x - tx) * fade
    y = ty + (y - ty) * fade
    turn = tt + (turn - tt) * fade
  }
  return { x, y, turn }
}

/** Whether a watch's fates are a fixed list of fate ids. */
export const isList = (fates: Watch['fates']): fates is readonly string[] => Array.isArray(fates)

/** The letters of a clip's id that spell its fates: past its last `after`, or all of it. */
export const spelling = (clip: string, after: string | undefined): string => (after === undefined || after === '' ? clip : clip.slice(clip.lastIndexOf(after) + after.length))

/** The fates of an instance's particles, in order, as indices into `def.fates` (-1: no such fate). */
function fatesOf(def: ParticleDef, watch: Watch, instance: Instance): number[] {
  const list = def.fates ?? []
  const index = (id: string | undefined) => list.findIndex(fate => fate.id === id)
  const fates = watch.fates
  if (fates === undefined) return []
  if (isList(fates)) return fates.map(index)
  if ('spell' in fates) return [...spelling(instance.clip, fates.after)].map(letter => index(fates.spell[letter]))
  const out: number[] = []
  for (const arg of fates.args) {
    const value = instance.args?.[arg]
    if (value === undefined || value < 0) break
    out.push(Math.round(value))
  }
  return out
}

/** The wind across, by time in the air, for a particle blowing from `side` with hash draws `rs` (speed) and `rp` (phase). */
function windOf(wind: Wind | undefined, side: number, rs: number, rp: number): (u: number) => number {
  const speed = drawn(wind?.speed, rs, 0)
  const shape = wind?.keys
  const sway = wind?.sway
  const phase = rp * Math.PI * 2
  return u => -side * speed * (shape === undefined || shape.length === 0 ? 1 : keys(shape, u)) + (sway === undefined ? 0 : sway[0] * Math.sin(Math.PI * 2 * sway[1] * u + phase))
}

/** Every particle `instance` spawns under `watch`, flown whole: a pure function of the instance (and the rig's anchors). */
export function simulate(def: ParticleDef, watch: Watch, instance: Instance, anchor: (ref: AnchorRef) => Pt): Flight[] {
  const args = instance.args ?? {}
  const salt = def.salt ?? SALT
  const seed = Math.floor(fromArg(watch.seed, args, 0))
  const spawn = def.spawn ?? {}
  const flights: Flight[] = []
  if (watch.particles !== undefined) {
    watch.particles.forEach((listed, k) => {
      const r = hash(seed, k, salt)
      const wind = windOf(watch.wind ?? def.wind, 0, hash(seed, k, salt + 1), hash(seed, k, salt + 2))
      const spin = drawn(spawn.spin, hash(seed, k, salt + 3), 0)
      const from = { x: listed.x, y: listed.y, turn: drawn(spawn.turn, r, 0), vx: (spawn.launch ?? 0) * wind(0), vy: spawn.fall ?? 0, spin, scale: listed.scale ?? 1 }
      flights.push(fly(def, from, wind, instance.at + listed.at, k))
    })
    return flights
  }
  const side = Math.sign(fromArg(watch.side, args, 1)) || 1
  const first = Math.round(fromArg(watch.first, args, 0))
  const taken = new Map<number, number>()
  fatesOf(def, watch, instance).forEach((which, k) => {
    const fate = def.fates?.[which]
    if (fate === undefined) return
    const r = hash(seed, k, salt)
    const wind = windOf(fate.wind ?? watch.wind ?? def.wind, side, hash(seed, k, salt + 1), hash(seed, k, salt + 2))
    const [left, right] = spawn.x ?? [def.box[0], def.box[2]]
    const spin = drawn(spawn.spin, hash(seed, k, salt + 3), 0)
    const from = { x: side < 0 ? left : right, y: drawn(spawn.y, r, 0), turn: drawn(spawn.turn, r, 0), vx: (spawn.launch ?? 0) * wind(0), vy: spawn.fall ?? 0, spin, scale: 1 }
    const start = instance.at + k * (watch.spacing ?? 0)
    let landing: Landing | undefined
    const targets = fate.targets ?? []
    if (targets.length > 0 && fate.time !== undefined && fate.time > 0) {
      const count = taken.get(which) ?? 0
      taken.set(which, count + 1)
      const target = targets[Math.max(0, Math.min(targets.length - 1, first + count))]!
      const goal: Pt = target.anchor !== undefined ? anchor(target.anchor) : (target.at ?? [0, 0])
      const guide = { ...GUIDE, ...def.guide }
      landing = { from: [from.x, from.y, from.turn], to: [goal[0], goal[1], target.turn ?? 0], time: fate.time, ease: guide.ease, fade: guide.fade }
    }
    flights.push(fly(def, from, wind, start, k, landing))
  })
  return flights
}

/** The latest a flight of `instance` may still be in the air, before simulating it. */
function reachOf(def: ParticleDef, watch: Watch, instance: Instance): number {
  const most = def.most ?? MOST
  if (watch.particles !== undefined) return instance.at + Math.max(0, ...watch.particles.map(p => p.at)) + most
  return instance.at + Math.max(0, fatesOf(def, watch, instance).length - 1) * (watch.spacing ?? 0) + most
}

const keyOf = (lane: string, instance: Instance): string =>
  `${lane}\u0000${instance.clip}\u0000${instance.at}\u0000${JSON.stringify(Object.entries(instance.args ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))}`

/** The instances `watch` sees in `timeline` by `t`, with their lanes. */
function* watched(watch: Watch, timeline: Timeline, t: number): Generator<readonly [string, Instance]> {
  const lanes = watch.lane !== undefined ? [watch.lane] : Object.keys(timeline)
  for (const lane of lanes) {
    for (const instance of timeline[lane] ?? []) if (instance.at <= t && watch.clips.includes(instance.clip)) yield [lane, instance]
  }
}

/** Each def's `each` channel names, made once. */
const EACH = new WeakMap<object, readonly Slot[]>()

/** The output channels of a particle driver, set by set. */
export function slotsOf(def: ParticleDef): readonly Slot[] {
  const out = def.out
  if ('slots' in out) return out.slots
  let slots = EACH.get(out)
  if (slots === undefined) {
    slots = Array.from({ length: Math.max(0, out.count) }, (_, k) => ({ x: `${out.each}.${k}.x`, y: `${out.each}.${k}.y`, turn: `${out.each}.${k}.turn`, on: `${out.each}.${k}.on` }))
    EACH.set(out, slots)
  }
  return slots
}

/** Steps the particle driver: spawns what newly applies, then writes every particle in the air. */
function stepParticles(def: ParticleDef, state: unknown, frame: DriverFrame): ParticleState {
  const t = frame.t
  // After a gap (the pet hidden, asleep) it starts over, as on a first step: the timeline has resynced.
  const prior: readonly Spawned[] = frame.gap ? [] : ((state as ParticleState | undefined)?.spawned ?? [])
  const known = new Map(prior.map(entry => [entry.key, entry]))
  const spawned: Spawned[] = []
  const seen = new Set<string>()
  for (const watch of def.watch) {
    for (const [lane, instance] of watched(watch, frame.timeline, t)) {
      const key = keyOf(lane, instance)
      if (seen.has(key)) continue
      seen.add(key)
      let entry = known.get(key)
      if (entry === undefined) {
        // Nothing of it can be in the air any more: never flown.
        if (t >= reachOf(def, watch, instance)) continue
        const flights = simulate(def, watch, instance, frame.anchor)
        entry = { key, at: instance.at, end: Math.max(instance.at, ...flights.map(flight => flight.end)), flights }
      }
      spawned.push(entry)
    }
  }
  // Flights go on after their instance leaves the timeline, until each lands or leaves.
  for (const entry of prior) if (!seen.has(entry.key) && entry.at <= t && t < entry.end) spawned.push(entry)

  // In the air now, oldest first.
  const flying: { readonly flight: Flight; readonly key: string }[] = []
  for (const entry of spawned) for (const flight of entry.flights) if (flight.start <= t && t < flight.end) flying.push({ flight, key: entry.key })
  flying.sort((a, b) => a.flight.start - b.flight.start || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || a.flight.index - b.flight.index)

  const values = frame.values
  const write = (id: string, value: number) => {
    const range = frame.rangeOf(id)
    values[id] = range === undefined ? value : Math.max(range[0], Math.min(range[1], value))
  }
  const q = def.quantum
  const put = (slot: Slot, flight: Flight) => {
    const at = placeAt(flight, t - flight.start)
    write(slot.x, at.x)
    write(slot.y, at.y)
    write(slot.turn, q !== undefined && q > 0 ? Math.round(at.turn * q) / q : at.turn)
    write(slot.on, 1)
  }
  const slots = slotsOf(def)
  if ('slots' in def.out) {
    // The newest n in the air, each in its own set while that is free, else the first free one.
    const shown = flying.slice(Math.max(0, flying.length - slots.length))
    const taken: boolean[] = slots.map(() => false)
    const later: Flight[] = []
    for (const { flight } of shown) {
      const own = flight.index % slots.length
      if (taken[own]) later.push(flight)
      else {
        taken[own] = true
        put(slots[own]!, flight)
      }
    }
    for (const flight of later) {
      const free = taken.indexOf(false)
      if (free < 0) break
      taken[free] = true
      put(slots[free]!, flight)
    }
  } else {
    for (const { flight } of flying) if (flight.index < slots.length) put(slots[flight.index]!, flight)
  }
  const newest = flying.at(-1)
  if (def.newest !== undefined && newest !== undefined) {
    const at = placeAt(newest.flight, t - newest.flight.start)
    write(def.newest.x, at.x)
    write(def.newest.y, at.y)
    write(def.newest.on, 1)
  }
  return { spawned }
}

export const PARTICLE: readonly DriverType[] = [
  {
    id: 'particle',
    step: (def, state, frame) => stepParticles(def as ParticleDef, state, frame),
  },
]
