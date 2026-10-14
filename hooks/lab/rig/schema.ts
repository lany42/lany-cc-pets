// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The rig engine's documents and what it hands out: a painted pet as data.
//
//     geometry = rig(params)      params = driver(t)
//
// A pet is two JSON documents: a rig (`RigDoc`:
// params, derived params, spaces, layers and their keyforms; what the pet
// looks like at any pose) and its drivers (`DriversDoc`: clips of keyed
// tracks, lanes of a timeline, stateful drivers and the pipelines that run
// them; what pose it holds at any moment). Neither holds code: every
// capability is a registered type (registry.ts) named by id, so a new kind of
// shape, paint, easing or driver is a registry entry, never a branch for one
// pet. The documents are authored in the studio and built into pets.ts
// (generated: never edit it by hand).
//
// The engine evaluates a rig into `Geometry` (an ordered list of fills, each
// path commands in its own units under its space's transform), which the
// output stages draw: raster.ts through the painted kit's own pen and canvas
// (so equal commands give equal samples), the dev tools' SVG stage as SVG.
// Pure: imports nothing at run time.
import type { Affine } from './kit/pen'

export type { Affine } from './kit/pen'

/** A point, in some space's units: (x, y), y down. */
export type Pt = readonly [x: number, y: number]

/** A param's (or signal's) value by id. */
export type Values = Readonly<Record<string, number>>

/** The schema's version, in each document's `schema`. */
export const SCHEMA = 1

// ---------------------------------------------------------------- numbers that move

/** `scale * value + offset` of a param, a derived param or (in a driver) a signal. */
export type Binding = { readonly param: string; readonly scale?: number; readonly offset?: number }

/** A number that moves with keyforms: `base` plus every block's interpolated value (prop blocks with no `prop`). */
export type KeyedScalar = { readonly base: number; readonly keyforms: readonly ScalarBlock[] }

/**
 * Anywhere the schema takes a number that may move (a transform's angle, an
 * ellipse's radius, an alpha, a stroke's scale): a constant, a linear binding,
 * or keyforms.
 */
export type Scalar = number | Binding | KeyedScalar

// ---------------------------------------------------------------- params

/** One standard (Live2D) parameter a param corresponds to: `standard = scale * value + offset`. */
export type StandardMap = { readonly id: string; readonly scale?: number; readonly offset?: number }

/** A param: a continuous number the drivers set and the rig reads; the pets' channel names. */
export type ParamDef = {
  readonly id: string
  readonly min: number
  readonly max: number
  readonly default: number
  /** The Live2D ids it maps to. */
  readonly standard?: readonly StandardMap[]
  /** The runtime's repaint quantum: 1 a whole sample, 2 a half (the painted look's `snap`). */
  readonly snap?: number
  readonly doc?: string
}

/** A weighted input of a combiner: [param or derived param, weight]. */
export type Term = readonly [id: string, weight: number]

/**
 * A derived param: a registered combiner (`op`) of params or earlier derived
 * params, evaluated in order before any keyform. The built-in ops' fields:
 *
 * - `sum`: `terms`, `offset` (0), `clamp` ([lo, hi], none): clamp(sum of
 *   weight * input in term order, then + offset);
 * - `max`, `min`: `terms`, `clamp`: the largest (smallest) weighted input;
 * - `pow`: `of`, `k`: of clamped to [0, 1], raised to k.
 *
 * Other ops carry fields of their own: combiners.ts says each op's.
 */
export type DerivedDef = {
  readonly id: string
  readonly op: string
  readonly terms?: readonly Term[]
  readonly offset?: number
  readonly clamp?: readonly [lo: number, hi: number]
  readonly of?: string
  readonly k?: number
  readonly [field: string]: unknown
}

// ---------------------------------------------------------------- spaces

/**
 * A space (a deformer): maps its children's units into its parent's; `root`
 * is the pet's own units, mapped to samples by the layout's `m`. The one
 * built-in type, `transform`, composes: scale (sx, sy) about `pivot`, then
 * rotate about `pivot` (radians, clockwise on screen), then translate
 * (x, y). An absent part is skipped, not composed as identity.
 */
export type SpaceDef = {
  readonly id: string
  readonly type: string
  readonly parent: string
  readonly pivot?: Pt
  readonly rotate?: Scalar
  readonly x?: Scalar
  readonly y?: Scalar
  readonly sx?: Scalar
  readonly sy?: Scalar
  readonly [field: string]: unknown
}

/** The root space's id: the pet's own units. */
export const ROOT = 'root'

/**
 * A deformer, by registered `type` (deform.ts: `bones`, `turn`): it moves the
 * nodes of the layers that name it in their `deform`, in their own units,
 * after their keyforms and before their space's transform. At rest it moves
 * nothing. Optional: a rig without deformers draws as it always did.
 */
export type DeformerDef = { readonly id: string; readonly type: string; readonly [field: string]: unknown }

// ---------------------------------------------------------------- shapes

/** An absolute path command: `M` and `L` one point each, `C` a cubic's two controls and its end, `Z` closes. */
export type Command = readonly ['M', number, number] | readonly ['L', number, number] | readonly ['C', number, number, number, number, number, number] | readonly ['Z']

/**
 * What a layer fills, by registered `kind`. Each kind defines its nodes (the
 * points keyforms move, in order), its props (numbers or tables keyforms may
 * move) and how it becomes path commands. The built-in kinds' fields:
 *
 * - `path`: `d`, absolute `M`/`L`/`C`/`Z`, every subpath opened by `M`;
 *   nodes are every point of `d` in order (a `C` three). Lines stay `L`
 *   (the pen flattens a line as one edge, a cubic as 2 to 48).
 * - `stroke`: `d` is one cubic, `[['M', p0], ['C', c1, c2, p3]]` (its 4
 *   points are its nodes); `n` segments (16); per point k = 0..n, `width[k]`
 *   and `floor[k]` (0); `scale` (1). The pen's tapered outline, `scale *
 *   max(floor[k] * hairline, width[k])` across at t = k / n.
 * - `ellipse`: `at`, its centre (its one node); `rx`, `ry`, `angle` (0)
 *   scalars; `n` (28); `floor` per radius (`{ rx?, ry? }`, in hairlines):
 *   the pen's n-gon.
 * - `band`: `points`, a polyline (its nodes); `thick[k]`, `floor[k]` per
 *   point; `split` ([0.6, 0.4]): the polyline offset up by `split[0]` and
 *   down by `split[1]` of `max(floor[k] * hairline, thick[k])`, out along
 *   it and back (Sakura's lid line).
 */
export type ShapeDef = {
  readonly kind: string
  readonly d?: readonly Command[]
  readonly n?: number
  readonly width?: readonly number[]
  readonly floor?: readonly number[] | Readonly<Record<string, number>>
  readonly scale?: Scalar
  readonly at?: Pt
  readonly rx?: Scalar
  readonly ry?: Scalar
  readonly angle?: Scalar
  readonly points?: readonly Pt[]
  readonly thick?: readonly number[]
  readonly split?: readonly [up: number, down: number]
  readonly [field: string]: unknown
}

// ---------------------------------------------------------------- paints

/**
 * A paint, by registered `type`. A layer's `paint` is a palette name (a
 * solid fill) or one of these. Built-in types: `solid`
 * (`color`, a palette name), `rows` (cel steps or a gradient by sample row
 * between two anchors' projected heights: Momiji's iris), `columns` (hard
 * stops in layer-local x: her beanie's dome), `ribs` (a cylinder's ribs: her
 * cuff), `regions` (ordered rules over the layer's units: Sakura's eye).
 * Colors in a paint are palette names. A paint gets the layer's full
 * transform, so it can think in the layer's units.
 */
export type PaintDef = { readonly type: string; readonly [field: string]: unknown }

/** A layer's paint: a palette name (solid), or a paint. */
export type PaintRef = string | PaintDef

// ---------------------------------------------------------------- visibility

/**
 * When a layer shows: always (`true`), never (`false`), or a predicate over
 * params and derived params: `{ lt: [id, value] }` (and `le`, `gt`, `ge`),
 * `{ all: [...] }`, `{ any: [...] }`, `{ not: ... }`.
 */
export type Predicate =
  | boolean
  | { readonly lt: readonly [id: string, value: number] }
  | { readonly le: readonly [id: string, value: number] }
  | { readonly gt: readonly [id: string, value: number] }
  | { readonly ge: readonly [id: string, value: number] }
  | { readonly all: readonly Predicate[] }
  | { readonly any: readonly Predicate[] }
  | { readonly not: Predicate }

// ---------------------------------------------------------------- keyforms

/**
 * Keyform positions and values over one to three params (or derived params):
 * `axes[i]` holds `on[i]`'s positions, strictly increasing and inside its
 * range; a block holds a value at every point of their grid, row-major (the
 * last axis fastest). One param is a blend shape; two or three a grid,
 * interpolated by the registered `interp` (`linear` by default) along each
 * axis. Outside its first and last positions a block holds. Blocks add, and
 * each is zero at the defaults (or the layer's `basePose`).
 */
export type BlockAxes = {
  readonly on: readonly string[]
  readonly axes: readonly (readonly number[])[]
  readonly interp?: string
}

/** A block of node offsets: per grid point, one `[dx / w, dy / h]` per node (shape nodes, then anchors, then curves' points), in the layer's frame. */
export type NodeBlock = BlockAxes & { readonly nodes: readonly (readonly Pt[])[] }

/** A block over a prop (a stroke's `width`, an ellipse's `rx`, the layer's `alpha`): per grid point, an absolute delta, a number or a table as long as the prop. */
export type PropBlock = BlockAxes & { readonly prop: string; readonly values: readonly (number | readonly number[])[] }

/** A block of a keyed scalar (a space's angle, say): per grid point, an absolute delta. */
export type ScalarBlock = BlockAxes & { readonly values: readonly number[] }

export type Block = NodeBlock | PropBlock

// ---------------------------------------------------------------- layers

/** A named extra node of a layer: moved by its keyforms, never drawn; paints and drivers read it. */
export type AnchorDef = { readonly id: string; readonly at: Pt }

/** A named helper polyline of a layer: extra nodes, moved by its keyforms, never drawn (the lid curve a `regions` paint reads). */
export type CurveDef = { readonly id: string; readonly points: readonly Pt[] }

/**
 * One layer is one fill, in draw order (the array's order). Ids are
 * `group.name` (`eyeR.white`, `mouth.line`): the group names a feature and,
 * by default, its keyform frame.
 */
export type LayerDef = {
  readonly id: string
  /** The space it is drawn in: `root` or a space's id. */
  readonly space: string
  /** The deformers that move its nodes, by id, applied in order (none when absent). */
  readonly deform?: string | readonly string[]
  /** What it fills; an array is one fill of every shape's rings, in order (its nodes concatenated in that order). */
  readonly shape: ShapeDef | readonly ShapeDef[]
  readonly paint: PaintRef
  /** 0 to 1 (1): under 1 it washes, as `canvas.fill` does. */
  readonly alpha?: Scalar
  /** `figure` paints only where something is painted already (the kit's `only`); `none` (default) everywhere. */
  readonly clip?: 'none' | 'figure'
  /** When it shows (true). */
  readonly visible?: Predicate
  /** The group or layer whose base bounding box (over all its nodes) scales node offsets: the layer's group by default. */
  readonly frame?: string
  /** The pose (params; any left out at their defaults) that defines its base, when it is hidden at the defaults. */
  readonly basePose?: Values
  readonly anchors?: readonly AnchorDef[]
  readonly curves?: readonly CurveDef[]
  readonly keyforms?: readonly Block[]
  readonly doc?: string
}

/** A frame for keyform offsets declared outright (a group with no layer spanning it): its base box in its units. */
export type FrameDef = { readonly id: string; readonly box: readonly [x0: number, y0: number, x1: number, y1: number] }

// ---------------------------------------------------------------- the rig

/**
 * A pose drawing mapped to the values it shows: `svg` names one of the pet's
 * pose drawings, drawn at `at`, one to three params or derived params, with
 * every other value at rest. Authoring metadata: the studio's importer reads
 * it, the engine never does, and the builder leaves it out of pets.ts.
 */
export type PoseDef = { readonly svg: string; readonly at: Values }

/** A pet's rig: what it looks like at any pose. */
export type RigDoc = {
  readonly schema: typeof SCHEMA
  readonly id: string
  readonly name?: string
  /** Its box in its own units (y down). */
  readonly units: { readonly width: number; readonly height: number }
  /** Its colors by name, `#rrggbb`. */
  readonly palette: Readonly<Record<string, string>>
  readonly params: readonly ParamDef[]
  readonly derived?: readonly DerivedDef[]
  readonly spaces?: readonly SpaceDef[]
  /** Its deformers, which layers name in `deform`. */
  readonly deformers?: readonly DeformerDef[]
  /** Its pose drawings, for the importer; never read at run time. */
  readonly poses?: readonly PoseDef[]
  readonly frames?: readonly FrameDef[]
  readonly layers: readonly LayerDef[]
}

/** A layer's anchor or curve, as drivers and paints name it: `layer#anchor`. */
export type AnchorRef = string

// ---------------------------------------------------------------- what evaluation hands out

/** What evaluation needs of the room: the line floor, `1.5 / min(m[0], m[3])` units (`viewOf`). */
export type View = { readonly hairline: number }

/**
 * A paint resolved at a moment: its type and whatever its entry needs to make
 * the canvas's paint under the layer's transform (colors as 0xRRGGBB numbers,
 * anchors' places, scalars evaluated).
 */
export type ResolvedPaint = { readonly type: string; readonly [field: string]: unknown }

/** One fill: its commands in its own units, under `transform` (its space chain to root units). */
export type Drawable = {
  /** The layer's id. */
  readonly id: string
  readonly transform: Affine
  readonly d: readonly Command[]
  readonly paint: ResolvedPaint
  readonly alpha: number
  readonly clip: 'none' | 'figure'
}

/** A rig at a pose: its visible layers' fills, in draw order. */
export type Geometry = readonly Drawable[]

// ---------------------------------------------------------------- drivers

/** A signal: a driver-only channel the rig never draws (a mood's tempo, a gust's wind). */
export type SignalDef = { readonly id: string; readonly default: number; readonly doc?: string }

/** A lane of the timeline; a `hold` lane's instance applies from its `at` until the lane's next one. */
export type LaneDef = { readonly id: string; readonly hold?: boolean; readonly doc?: string }

/** A clip argument, with its range; `required` ones must be given by every instance. */
export type ArgDef = { readonly id: string; readonly min?: number; readonly max?: number; readonly default?: number; readonly required?: boolean }

/** A key's value: a number, or an argument (`scale * arg + add`). */
export type KeyValue = number | { readonly arg: string; readonly scale?: number; readonly add?: number }

/** A key: [time, value, easing of the segment to the next key (the track's `ease` by default)]. */
export type Key = readonly [time: number, value: KeyValue, easing?: string]

/**
 * An oscillator (`osc` source): `amp * env * shape(u)`, where `u = 2 pi rate
 * t + phase + fm[1] sin(fm[0] t)`, the sine optionally rectified (negative
 * halves to 0), raised to `pow`, clamped; `env` is `[base, depth, rate, phase]`,
 * `base + depth sin(rate t + phase)` (none: 1). Momiji's talk, Sakura's
 * giggle flutter.
 */
export type OscDef = {
  readonly amp?: number
  readonly rate: number
  readonly phase?: number
  readonly fm?: readonly [rate: number, depth: number]
  readonly rectify?: boolean
  readonly pow?: number
  readonly clamp?: readonly [lo: number, hi: number]
  readonly env?: readonly [base: number, depth: number, rate: number, phase: number]
}

/** A factor of a `mul` track: `scale * track + offset` of an earlier track of the clip. */
export type Factor = readonly [track: string, scale?: number, offset?: number]

/** When a track applies: an argument or a signal that is not 0, and their negations and conjunctions. */
export type Gate = { readonly arg: string } | { readonly signal: string } | { readonly not: Gate } | { readonly all: readonly Gate[] }

/**
 * A track: a value from exactly one registered source (`keys`, `from`, `osc`,
 * `mul`; each a field of that name), times `scale` plus `offset`; read at
 * clip time, or the timeline's absolute time (`clock: 'absolute'`). With a
 * `param` (a rig param or a signal) it writes it by a registered `blend`
 * (`add`, `max`, `min`, `set`, `mix`: toward `to` by the track's value);
 * without one it is only read by later tracks (`from`, `mul`).
 */
export type TrackDef = {
  readonly id?: string
  readonly keys?: readonly Key[]
  /** The default easing of its keys' segments (`linear`). */
  readonly ease?: string
  /** Another track of the clip, read `shift` seconds earlier. */
  readonly from?: string
  readonly shift?: number
  readonly osc?: OscDef
  readonly mul?: readonly Factor[]
  readonly scale?: number
  readonly offset?: number
  readonly clock?: 'clip' | 'absolute'
  readonly param?: string
  readonly blend?: string
  readonly to?: KeyValue
  readonly if?: Gate
  /** Tags a pipeline stage may mute (`hair`: keyed hair, which the physics pipeline simulates instead). */
  readonly tags?: readonly string[]
  readonly [field: string]: unknown
}

/** A clip: tracks in the order they apply, over `length` seconds (0: an instant held by a `hold` lane); `loop` reads the timeline's absolute time modulo its length. */
export type ClipDef = {
  readonly id: string
  readonly length: number
  readonly loop?: boolean
  readonly args?: readonly ArgDef[]
  readonly tracks: readonly TrackDef[]
  readonly doc?: string
}

/**
 * A stateful driver, by registered `type`: `lag` (a
 * first-order follower of a param: a mood's easing), `pendulum` (a
 * damped swing driven by its inputs: hair), `particle` (props simulated whole
 * when their clip instance starts), and others their entries define. It reads
 * the params and signals as the stages before it left them and writes params
 * or signals.
 */
export type DriverDef = { readonly id: string; readonly type: string; readonly [field: string]: unknown }

/** A pipeline stage: a group of lanes (muting tracks by tag), or one driver. */
export type Stage = { readonly lanes: readonly string[]; readonly mute?: readonly string[] } | { readonly driver: string }

/** A pet's drivers: what pose it holds at any moment, given a timeline. */
export type DriversDoc = {
  readonly schema: typeof SCHEMA
  /** The rig's id. */
  readonly rig: string
  readonly signals?: readonly SignalDef[]
  readonly lanes: readonly LaneDef[]
  readonly clips: readonly ClipDef[]
  readonly drivers?: readonly DriverDef[]
  /** Named pipelines (`keyed`, `physics`), each its stages in order. */
  readonly pipelines: Readonly<Record<string, readonly Stage[]>>
}

// ---------------------------------------------------------------- the timeline

/** A clip placed on the timeline: from `at` for its clip's length (or `length`), with its arguments. */
export type Instance = {
  readonly clip: string
  readonly at: number
  readonly args?: Values
  /** Its own length, where it differs from its clip's (a flight simulated longer). */
  readonly length?: number
}

/**
 * What plays when: each lane's instances in the order they were placed. A
 * behavior (rig-pets/<id>-behavior.ts, on the kit's behavior.ts) writes it; the drivers read it. Instances of a non-hold lane apply while
 * `at <= t < at + length` (or always, a looping clip), in placement order.
 */
export type Timeline = Readonly<Record<string, readonly Instance[]>>
