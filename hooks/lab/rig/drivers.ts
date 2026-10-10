// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The driver runtime: what pose a pet holds at any moment, `params =
// driver(t)`. A drivers document is bound to its rig once (`bindDrivers`:
// clips, tracks and their sources, blends and references looked up, lanes
// and pipelines laid out), then stepped: `step(program,
// pipeline, state, timeline, t)` runs the pipeline's stages in order over a
// fresh pose and hands back every param, every signal and the next state.
//
// A step. Every param starts at the rig's default and every signal at its
// own, each step; then each stage applies in turn:
//
//   lanes   lane by lane in the stage's order, each lane's active instances
//           in the order they were placed, each instance's tracks in its
//           clip's order. In a lane an instance applies while `at <= t < at
//           + length` (its own `length`, else its clip's; a looping clip from
//           `at` on, until its own `length` if it gives one); in a `hold` lane
//           the last placed instance with `at <= t` applies, one at most. Its
//           clip time is `t - at`, or for a looping clip the timeline's time
//           modulo the clip's length. A track's value is its source's
//           (sources.ts), `* scale`, `+ offset` (each only when given), at
//           clip time (or `t`, `clock: 'absolute'`); it writes its param by
//           its blend (blends.ts; `set` when it names none), unless its gate
//           (`if`) fails or the stage mutes one of its tags. A muted track,
//           or one with no param, can still be read by `from` and `mul`.
//   driver  a stateful driver (physics.ts, and others by type) reads the pose
//           as the stages before it left it and writes its outputs.
//
// The state is a value: `step` never changes the state or timeline it is
// given. It starts over (every driver handed `undefined`, `dt` 0) on the
// first step and on a step back in time; a repeated `t` is `dt` 0 without
// starting over. After a gap of over 2 s (the pet hidden, asleep), when a
// pet's behavior starts its schedule over (behavior.ts's `startsOver`) but
// its moods ease on, each driver is handed its state, the real `dt` and
// `gap`, and decides: `lag` eases across the gap, a pendulum starts over.
//
// It runs every frame in the live pets, so binding compiles what it can and a
// step allocates little: the pose and the two records it returns, each a copy
// of a record made whole when bound (never built key by key, which makes a
// slow object past a dozen keys), and the state. Tracks are read through one
// reader per program, pointed at each instance as it is laid. Pure: `step`
// never changes what it is given, and imports nothing at run time but the
// engine's own modules.
import { anchorOf } from './evaluate'
import type { Rig } from './evaluate'
import { REGISTRY } from './registry'
import type { BlendMode, DriverFrame, DriverType, Easing, Source } from './registry'
import type { AnchorRef, ClipDef, DriverDef, DriversDoc, Gate, Instance, KeyValue, Pt, Timeline, TrackDef, Values } from './schema'
import { keyValue } from './sources'

/** A drivers document bound to its rig (clips, lanes and drivers looked up once). */
export type Program = { readonly rig: Rig; readonly doc: DriversDoc }

/** The drivers' state between steps: the last step's time and each stateful driver's own. */
export type DriverState = { readonly t: number; readonly drivers: Readonly<Record<string, unknown>> }

/** A gap between steps longer than this, seconds, is a resync: its step's drivers are told (`DriverFrame.gap`). */
export const GAP = 2

// ---------------------------------------------------------------- binding

/** A track bound: its source and blend looked up. */
type Track = {
  readonly def: TrackDef
  readonly source: Source
  readonly param: string | undefined
  readonly blend: BlendMode
  readonly to: KeyValue | undefined
  readonly gate: Gate | undefined
  readonly tags: readonly string[]
  readonly absolute: boolean
}

/** A clip bound: its tracks, their ids' places, its args' defaults. */
type Clip = {
  readonly id: string
  readonly length: number
  readonly loop: boolean
  readonly tracks: readonly Track[]
  readonly index: ReadonlyMap<string, number>
  readonly defaults: Readonly<Record<string, number>>
}

/** A lanes stage, its lanes looked up; or a driver stage, its type looked up (undefined: declared, not built). */
type Stage =
  | { readonly lanes: readonly { readonly id: string; readonly hold: boolean }[]; readonly mute: readonly string[] }
  | { readonly driver: DriverDef; readonly type: DriverType | undefined }

/** A program's compiled form, kept beside it. */
type Bound = {
  readonly params: readonly string[]
  readonly signals: readonly string[]
  /** Every param and signal at its default: each step's pose starts as a copy. */
  readonly start: Readonly<Record<string, number>>
  /** Every param, and every signal, at its default: what a step's two results are copied from. */
  readonly paramStart: Readonly<Record<string, number>>
  readonly signalStart: Readonly<Record<string, number>>
  readonly paramDefaults: readonly number[]
  readonly signalDefaults: readonly number[]
  /** Whether `start`'s keys are the params then the signals, each once: then a pose's values can be read in that order at once. */
  readonly ordered: boolean
  readonly clips: ReadonlyMap<string, Clip>
  readonly pipelines: ReadonlyMap<string, readonly Stage[]>
  readonly rangeOf: (id: string) => readonly [number, number] | undefined
  readonly anchor: (ref: AnchorRef) => Pt
  /** What its clips' tracks read through as they are laid. */
  readonly reader: Reader
}

const BOUND = new WeakMap<Program, Bound>()

const NO_TAGS: readonly string[] = []

function bindTrack(def: TrackDef, where: string): Track {
  let source: Source | undefined
  for (const one of REGISTRY.sources.values()) {
    if (def[one.id] !== undefined) {
      source = one
      break
    }
  }
  if (source === undefined) throw new Error(`${where}: no registered source (${[...REGISTRY.sources.keys()].join(', ')})`)
  const blend = REGISTRY.blends.get(def.blend ?? 'set')
  if (blend === undefined) throw new Error(`${where}: unknown blend "${def.blend}"`)
  return { def, source, param: def.param, blend, to: def.to, gate: def.if, tags: def.tags ?? NO_TAGS, absolute: def.clock === 'absolute' }
}

function bindClip(def: ClipDef): Clip {
  const defaults: Record<string, number> = {}
  for (const arg of def.args ?? []) if (arg.default !== undefined) defaults[arg.id] = arg.default
  const index = new Map<string, number>()
  def.tracks.forEach((track, k) => {
    if (track.id !== undefined) index.set(track.id, k)
  })
  return {
    id: def.id,
    length: def.length,
    loop: def.loop === true && def.length > 0,
    tracks: def.tracks.map((track, k) => bindTrack(track, `clip "${def.id}" track ${track.id ?? k}`)),
    index,
    defaults,
  }
}

/**
 * A record of these ids and values, made whole at once: each step copies it
 * (`{ ...record }`) rather than adding its keys one by one, which past a dozen
 * or so computed keys makes a slow (dictionary) object in V8, 80 times dearer
 * to copy and slower to read.
 */
const recordOf = (entries: readonly (readonly [string, number])[]): Readonly<Record<string, number>> => Object.fromEntries(entries)

function bind(rig: Rig, doc: DriversDoc): Bound {
  const ranges = new Map<string, readonly [number, number]>()
  for (const param of rig.doc.params) ranges.set(param.id, [param.min, param.max])
  const signals = doc.signals ?? []
  const paramEntries = rig.doc.params.map(param => [param.id, param.default] as const)
  const signalEntries = signals.map(signal => [signal.id, signal.default] as const)
  const start = recordOf([...paramEntries, ...signalEntries])
  const clips = new Map(doc.clips.map(clip => [clip.id, bindClip(clip)]))
  const holds = new Map(doc.lanes.map(lane => [lane.id, lane.hold === true]))
  const drivers = new Map((doc.drivers ?? []).map(driver => [driver.id, driver]))
  const pipelines = new Map<string, readonly Stage[]>()
  for (const [name, stages] of Object.entries(doc.pipelines)) {
    pipelines.set(
      name,
      stages.map((stage, k): Stage => {
        if ('driver' in stage) {
          const driver = drivers.get(stage.driver)
          if (driver === undefined) throw new Error(`pipeline "${name}" stage ${k}: no driver "${stage.driver}"`)
          return { driver, type: REGISTRY.drivers.get(driver.type) }
        }
        const lanes = stage.lanes.map(id => {
          const hold = holds.get(id)
          if (hold === undefined) throw new Error(`pipeline "${name}" stage ${k}: no lane "${id}"`)
          return { id, hold }
        })
        return { lanes, mute: stage.mute ?? NO_TAGS }
      }),
    )
  }
  // A rig anchor at the rig's defaults, asked for by a driver (a prop's target): placed once, when first asked.
  const anchors = new Map<AnchorRef, Pt>()
  const anchor = (ref: AnchorRef): Pt => {
    let at = anchors.get(ref)
    if (at === undefined) {
      at = anchorOf(rig, ref, {}, { hairline: 1 }).at
      anchors.set(ref, at)
    }
    return at
  }
  return {
    params: rig.doc.params.map(param => param.id),
    signals: signals.map(signal => signal.id),
    start,
    paramStart: recordOf(paramEntries),
    signalStart: recordOf(signalEntries),
    paramDefaults: paramEntries.map(([, value]) => value),
    signalDefaults: signalEntries.map(([, value]) => value),
    ordered: Object.keys(start).every((id, k) => id === (k < paramEntries.length ? paramEntries[k]![0] : signalEntries[k - paramEntries.length]?.[0])) && Object.keys(start).length === paramEntries.length + signalEntries.length,
    clips,
    pipelines,
    rangeOf: id => ranges.get(id),
    anchor,
    reader: readerOf(),
  }
}

/** `program` compiled, binding it on first use when it was made by hand rather than by `bindDrivers`. */
export function boundOf(program: Program): Bound {
  let bound = BOUND.get(program)
  if (bound === undefined) {
    bound = bind(program.rig, program.doc)
    BOUND.set(program, bound)
  }
  return bound
}

/** Binds `doc` to `rig`. It assumes both are valid (the builder validates every pet's); a reference that doesn't resolve throws, naming it. */
export function bindDrivers(rig: Rig, doc: DriversDoc): Program {
  const program: Program = { rig, doc }
  BOUND.set(program, bind(rig, doc))
  return program
}

// ---------------------------------------------------------------- laying clips

/**
 * What a clip instance's tracks read as they apply, a source's
 * `SourceMoment`: the time, the instance's args (its clip's defaults where it
 * gives none; 0 where neither does), its clip's tracks by id. One per bound
 * program, pointed at each instance in turn as it is laid (laying never
 * nests: a track reads only its own clip's tracks), its `time` set for a read
 * and restored after it: nothing is allocated per read.
 */
type Reader = {
  time: number
  clip: Clip
  args: Values | undefined
  arg(id: string): number
  track(id: string, time: number): number
  easing(id: string): Easing
}

function easingOf(id: string): Easing {
  const easing = REGISTRY.easings.get(id)
  if (easing === undefined) throw new Error(`unknown easing "${id}"`)
  return easing
}

const NO_CLIP: Clip = { id: '', length: 0, loop: false, tracks: [], index: new Map(), defaults: {} }

function readerOf(): Reader {
  const reader: Reader = {
    time: 0,
    clip: NO_CLIP,
    args: undefined,
    arg: id => reader.args?.[id] ?? reader.clip.defaults[id] ?? 0,
    track: (id, time) => {
      const index = reader.clip.index.get(id)
      if (index === undefined) throw new Error(`clip "${reader.clip.id}": no track "${id}"`)
      return valueOf(reader, index, time)
    },
    easing: easingOf,
  }
  return reader
}

/** Track `index` of the reader's clip at `time`: its source's value, `* scale`, `+ offset`. */
function valueOf(reader: Reader, index: number, time: number): number {
  const one = reader.clip.tracks[index]!
  const outer = reader.time
  reader.time = time
  let v = one.source.value(one.def, reader)
  reader.time = outer
  if (one.def.scale !== undefined) v = v * one.def.scale
  if (one.def.offset !== undefined) v = v + one.def.offset
  return v
}

/** Whether a track's gate holds: an arg or a signal not 0, `not`, `all`. */
function holds(gate: Gate, reader: Reader, values: Values): boolean {
  if ('arg' in gate) return reader.arg(gate.arg) !== 0
  if ('signal' in gate) return (values[gate.signal] ?? 0) !== 0
  if ('not' in gate) return !holds(gate.not, reader, values)
  for (const one of gate.all) if (!holds(one, reader, values)) return false
  return true
}

/** Whether any of `tags` is muted. */
function isMuted(tags: readonly string[], mute: readonly string[]): boolean {
  for (const tag of tags) if (mute.includes(tag)) return true
  return false
}

/** Lays `clip` over `values` at clip time `u` (and timeline time `t`), skipping tracks tagged with any of `mute`. */
export function lay(reader: Reader, clip: Clip, u: number, t: number, args: Values | undefined, values: Record<string, number>, mute: readonly string[]): void {
  reader.clip = clip
  reader.args = args
  const tracks = clip.tracks
  for (let k = 0; k < tracks.length; k++) {
    const track = tracks[k]!
    const param = track.param
    if (param === undefined) continue
    if (mute.length > 0 && isMuted(track.tags, mute)) continue
    if (track.gate !== undefined && !holds(track.gate, reader, values)) continue
    const v = valueOf(reader, k, track.absolute ? t : u)
    values[param] = track.blend.apply(values[param] ?? 0, v, track.to === undefined ? undefined : keyValue(track.to, reader))
  }
}

export function clipOf(bound: Bound, id: string): Clip {
  const clip = bound.clips.get(id)
  if (clip === undefined) throw new Error(`no clip "${id}"`)
  return clip
}

/** Lays one instance at timeline time `t`: its clip time is `t - at`, or a looping clip's the timeline's time modulo its length. */
function play(reader: Reader, clip: Clip, instance: Instance, t: number, values: Record<string, number>, mute: readonly string[]): void {
  const L = clip.length
  const u = clip.loop ? ((t % L) + L) % L : t - instance.at
  lay(reader, clip, u, t, instance.args, values, mute)
}

/** A lanes stage at `t`: lane by lane, each lane's active instances in the order placed. */
export function layLanes(bound: Bound, stage: Extract<Stage, { lanes: unknown }>, timeline: Timeline, t: number, values: Record<string, number>): void {
  for (const lane of stage.lanes) {
    const list = timeline[lane.id]
    if (list === undefined) continue
    if (lane.hold) {
      for (let k = list.length - 1; k >= 0; k--) {
        const instance = list[k]!
        if (instance.at <= t) {
          play(bound.reader, clipOf(bound, instance.clip), instance, t, values, stage.mute)
          break
        }
      }
      continue
    }
    for (const instance of list) {
      if (instance.at > t) continue
      const clip = clipOf(bound, instance.clip)
      const length = instance.length ?? (clip.loop ? Infinity : clip.length)
      if (t < instance.at + length) play(bound.reader, clip, instance, t, values, stage.mute)
    }
  }
}

export function stagesOf(bound: Bound, pipeline: string): readonly Stage[] {
  const stages = bound.pipelines.get(pipeline)
  if (stages === undefined) throw new Error(`no pipeline "${pipeline}" (${[...bound.pipelines.keys()].join(', ')})`)
  return stages
}

/**
 * The values of `ids` in `values`, as a new record: a copy of `template` (each
 * at its default) written over only where a value is not its default
 * (`Object.is`, so -0 and NaN are kept), a handful of keys a step rather than
 * every one. `all` is `values`' values in its keys' order (the params, then
 * the signals), read at once, with `ids` from `at` on; without it each is
 * read by its key.
 */
function pick(values: Values, all: readonly number[] | undefined, at: number, ids: readonly string[], defaults: readonly number[], template: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = { ...template }
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    const value = all === undefined ? values[id]! : all[at + i]!
    if (!Object.is(value, defaults[i])) out[id] = value
  }
  return out
}

/** A pose's params and signals as two new records. */
export function results(bound: Bound, values: Values): { readonly params: Values; readonly signals: Values } {
  const P = bound.params.length
  // In key order, unless a driver added or took away a key: then by key.
  const read = bound.ordered ? (Object.values(values) as number[]) : undefined
  const all = read !== undefined && read.length === P + bound.signals.length ? read : undefined
  return { params: pick(values, all, 0, bound.params, bound.paramDefaults, bound.paramStart), signals: pick(values, all, P, bound.signals, bound.signalDefaults, bound.signalStart) }
}

// ---------------------------------------------------------------- stepping

/**
 * One step of `pipeline` at `t`: every param (from the rig's defaults, through
 * each stage in order) and every signal, and the next state. The state starts
 * over (undefined) on the first step or a step back in time; the step after a
 * gap over 2 s hands each driver its state with `gap` set, for it to decide.
 */
export function step(program: Program, pipeline: string, state: DriverState | undefined, timeline: Timeline, t: number): { readonly params: Values; readonly signals: Values; readonly state: DriverState } {
  const bound = boundOf(program)
  const stages = stagesOf(bound, pipeline)
  // The last step, unless this one starts over: the first, or a step back.
  const last = state === undefined || t < state.t ? undefined : state
  const values: Record<string, number> = { ...bound.start }
  const drivers: Record<string, unknown> = {}
  let frame: DriverFrame | undefined
  for (const stage of stages) {
    if ('lanes' in stage) {
      layLanes(bound, stage, timeline, t, values)
      continue
    }
    const { driver, type } = stage
    if (type === undefined) throw new Error(`driver "${driver.id}": type "${driver.type}" has no implementation`)
    frame ??= { t, dt: last === undefined ? 0 : t - last.t, gap: last !== undefined && t - last.t > GAP, values, timeline, anchor: bound.anchor, rangeOf: bound.rangeOf }
    drivers[driver.id] = type.step(driver, last?.drivers[driver.id], frame)
  }
  const { params, signals } = results(bound, values)
  return { params, signals, state: { t, drivers } }
}
