// What the rig engine can do, by type id: every capability a document may
// name (a combiner, an interpolator, a shape kind, a space, a paint; an
// easing, a track source, a blend mode, a driver) is an entry in one of these
// tables, and nothing else in the engine knows one pet from another. A new
// capability is a new entry: written once, in the module of its family, and
// listed here. The validator rejects a type id no table holds (a declared
// slot only warns); the evaluator and the driver runtime look every type up
// here and call it.
//
// Each entry checks its own fields (the validator calls `check` once the
// document's structure and references hold) and does its own work. Pure:
// imports nothing at run time but the entries' modules.
import type { Paint } from './kit/canvas'
import { BLENDS } from './blends'
import { COMBINERS } from './combiners'
import { EASINGS } from './easings'
import { INTERPOLATORS } from './interp'
import { LOOK_AT } from './lookat'
import { PAINTS } from './paints'
import { PARTICLE } from './particle'
import { PHYSICS } from './physics'
import { REGIONS } from './regions'
import type {
  Affine,
  AnchorRef,
  Command,
  DerivedDef,
  DriverDef,
  DriversDoc,
  LayerDef,
  PaintDef,
  Problem,
  Pt,
  ResolvedPaint,
  RigDoc,
  Scalar,
  ShapeDef,
  SpaceDef,
  Timeline,
  TrackDef,
  Values,
  View,
} from './schema'
import { SHAPES } from './shapes'
import { SOURCES } from './sources'
import { SPACES } from './spaces'

// ---------------------------------------------------------------- checking

/** What a rig-side entry's `check` may ask of the rig it sits in. */
export type RigContext = {
  readonly rig: RigDoc
  /** Whether `id` names a param or a derived param declared before `before` (any, when absent). */
  isValue(id: string, before?: string): boolean
  /** A param's [min, max], or a derived param's from its inputs'. */
  rangeOf(id: string): readonly [number, number] | undefined
  isColor(name: string): boolean
  isSpace(id: string): boolean
  /** Whether a layer has this anchor (or curve), as `layer#anchor`. */
  isAnchor(ref: AnchorRef): boolean
}

/** What a driver-side entry's `check` may ask of the drivers document and its rig. */
export type DriversContext = {
  readonly doc: DriversDoc
  readonly rig: RigDoc
  /** A rig param or a declared signal. */
  isChannel(id: string): boolean
  isSignal(id: string): boolean
  isLane(id: string): boolean
  isClip(id: string): boolean
  isEasing(id: string): boolean
  isAnchor(ref: AnchorRef): boolean
  /** A rig param's [min, max]. */
  rangeOf(id: string): readonly [number, number] | undefined
}

/** A problem at `path`: an error unless `level` says otherwise. */
export const problem = (path: string, message: string, level: 'error' | 'warn' = 'error'): Problem => ({ path, message, level })

// ---------------------------------------------------------------- the rig's types

/** A derived param's op: a combination of params and earlier derived params (`sum`, `max`, `min`, `pow`). */
export interface Combiner {
  readonly id: string
  /** The ids it reads, in its def. */
  inputs(def: DerivedDef): readonly string[]
  check(def: DerivedDef, path: string, ctx: RigContext): Problem[]
  value(def: DerivedDef, get: (id: string) => number): number
  /** Its range from its inputs' ranges. */
  range(def: DerivedDef, rangeOf: (id: string) => readonly [number, number]): readonly [number, number]
}

/**
 * How a keyform block reads between its positions along one axis (`linear`,
 * `step`, `cubic`): the positions that make up `x` and their weights, as
 * `[index, weight]` pairs. Holds outside the first and last position.
 */
export interface Interpolator {
  readonly id: string
  weights(axis: readonly number[], x: number): readonly (readonly [index: number, weight: number])[]
}

/** A shape kind (`path`, `stroke`, `ellipse`, `band`): its nodes, its props, and how it becomes path commands. */
export interface ShapeKind {
  readonly id: string
  /** Its nodes as the def places them, in order: what node keyforms move. */
  nodes(def: ShapeDef): readonly Pt[]
  /** The props keyforms may move, each with its length: 0 a scalar, n a table of n. */
  props(def: ShapeDef): Readonly<Record<string, number>>
  /** Params its own fields read beyond its scalars (which the evaluator follows itself). */
  inputs?(def: ShapeDef): readonly string[]
  check(def: ShapeDef, path: string, ctx: RigContext): Problem[]
  /**
   * Its commands in its own units, from its nodes and props at this moment
   * (scalars evaluated, keyforms added). A stroke's or an ellipse's outline is
   * made by the painted kit's own `stroke` and `ellipse`, so it is the
   * kit's polygon.
   */
  commands(def: ShapeDef, nodes: readonly Pt[], props: Readonly<Record<string, number | readonly number[]>>, view: View): readonly Command[]
}

/** A space type (`transform`): its units to its parent's. */
export interface SpaceType {
  readonly id: string
  inputs?(def: SpaceDef): readonly string[]
  check(def: SpaceDef, path: string, ctx: RigContext): Problem[]
  /** Its units to its parent's, `scalar` evaluating any of its scalars at this moment (undefined for one it lacks). */
  local(def: SpaceDef, scalar: (value: Scalar | undefined) => number | undefined): Affine
}

/** What a paint may read as it resolves at a moment. */
export type PaintMoment = {
  /** A palette name's color, 0xRRGGBB. */
  color(name: string): number
  /** One of the layer's anchors (or a curve's points), where its keyforms put it, in the layer's units. */
  anchor(id: string): Pt
  curve(id: string): readonly Pt[]
  /** A param's or derived param's value. */
  value(id: string): number
  scalar(value: Scalar): number
  readonly view: View
}

/** A paint type (`solid`, `rows`, `columns`, `ribs`, `regions`). */
export interface PaintType {
  readonly id: string
  /** Params it reads beyond its scalars. */
  inputs?(def: PaintDef): readonly string[]
  check(def: PaintDef, path: string, ctx: RigContext, layer: LayerDef): Problem[]
  /** It at this moment: colors as numbers, anchors placed, scalars evaluated. */
  resolve(def: PaintDef, at: PaintMoment): ResolvedPaint
  /** The canvas's paint; `M` maps the layer's units to samples (its transform, then the room's `m`). */
  canvas(paint: ResolvedPaint, M: Affine): Paint
  /** SVG's fill for it (a color, or `url(#id)`) and the `<defs>` that needs; `M` maps the layer's units to the SVG's. */
  svg(paint: ResolvedPaint, M: Affine, id: string): { readonly fill: string; readonly defs?: string }
}

// ---------------------------------------------------------------- the drivers' types

/** An easing (`linear`, `smooth`, `inQuad`, `outQuad`, `outCubic`, `inOutSine`, `hold`): a segment's share at `s` in [0, 1], 0 at 0 and 1 at 1. */
export interface Easing {
  readonly id: string
  ease(s: number): number
}

/** What a track source may read: its time, the instance's args, earlier tracks of its clip. */
export type SourceMoment = {
  /** The time it is read at: clip time, or the timeline's with `clock: 'absolute'`. */
  readonly time: number
  arg(id: string): number
  /** Another track of the clip, by id, at a time on the same clock. */
  track(id: string, time: number): number
  easing(id: string): Easing
}

/** A track source (`keys`, `from`, `osc`, `mul`): its id is the track field that holds it. */
export interface Source {
  readonly id: string
  /** The clip's tracks it reads. */
  reads?(track: TrackDef): readonly string[]
  check(track: TrackDef, path: string, ctx: DriversContext): Problem[]
  /** Its raw value (before the track's `scale` and `offset`). */
  value(track: TrackDef, at: SourceMoment): number
}

/** How a track writes its channel (`add`, `max`, `min`, `set`, `mix`): `to` is `mix`'s target. */
export interface BlendMode {
  readonly id: string
  apply(current: number, value: number, to: number | undefined): number
}

/** What a driver is handed each step. */
export type DriverFrame = {
  /** The timeline's time, seconds. */
  readonly t: number
  /** Seconds since the last step; 0 on a step that starts over. */
  readonly dt: number
  /**
   * True on the step after a gap of over 2 s (the pet hidden, asleep): the
   * timeline has resynced, and the driver is handed its state and the real
   * `dt` to decide for itself. `lag` eases across the gap; `pendulum` and
   * `particle` start over.
   */
  readonly gap: boolean
  /** The working params and signals, as the stages before it left them: it reads its inputs and writes its outputs here. */
  readonly values: Record<string, number>
  readonly timeline: Timeline
  /** A rig anchor's place at the rig's defaults, in its space's units (a target a prop flies to). */
  anchor(ref: AnchorRef): Pt
  /** A rig param's [min, max] (outputs are held to it). */
  rangeOf(id: string): readonly [number, number] | undefined
}

/** A stateful driver type (`lag`, `pendulum`, `particle`, `lookAt`). */
export interface DriverType {
  readonly id: string
  check(def: DriverDef, path: string, ctx: DriversContext): Problem[]
  /** The params and signals it reads, and those it writes. */
  inputs(def: DriverDef): readonly string[]
  outputs(def: DriverDef): readonly string[]
  /**
   * One step: writes its outputs into `frame.values` and returns its next
   * state. `state` is undefined when it starts over (the first step, a step
   * back in time); after a gap over 2 s it gets its state and `frame.gap`.
   * It never changes the state it is given.
   */
  step(def: DriverDef, state: unknown, frame: DriverFrame): unknown
}

// ---------------------------------------------------------------- the tables

/** Every registered type, by family and id. */
export type Registry = {
  readonly combiners: ReadonlyMap<string, Combiner>
  readonly interpolators: ReadonlyMap<string, Interpolator>
  readonly shapes: ReadonlyMap<string, ShapeKind>
  readonly spaces: ReadonlyMap<string, SpaceType>
  readonly paints: ReadonlyMap<string, PaintType>
  readonly easings: ReadonlyMap<string, Easing>
  readonly sources: ReadonlyMap<string, Source>
  readonly blends: ReadonlyMap<string, BlendMode>
  readonly drivers: ReadonlyMap<string, DriverType>
  /** Types declared with no implementation yet: a document may name them, and the validator warns. */
  readonly slots: ReadonlySet<string>
}

const byId = <T extends { readonly id: string }>(entries: readonly T[]): ReadonlyMap<string, T> => new Map(entries.map(entry => [entry.id, entry]))

export const REGISTRY: Registry = {
  combiners: byId(COMBINERS),
  interpolators: byId(INTERPOLATORS),
  shapes: byId(SHAPES),
  spaces: byId(SPACES),
  paints: byId([...PAINTS, ...REGIONS]),
  easings: byId(EASINGS),
  sources: byId(SOURCES),
  blends: byId(BLENDS),
  drivers: byId([...PHYSICS, ...PARTICLE, ...LOOK_AT]),
  // When acts play: the choreographer as data; until then each pet's behavior writes its timeline, as code (rig-pets/<id>-behavior.ts on behavior.ts).
  slots: new Set(['behavior']),
}

/** A color by palette name as 0xRRGGBB, from `#rrggbb`. */
export const rgb = (hex: string): number => Number.parseInt(hex.slice(1), 16)

/** Values with any param missing from `params` at its default. */
export const withDefaults = (rig: RigDoc, params: Values): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const param of rig.params) out[param.id] = params[param.id] ?? param.default
  return out
}
