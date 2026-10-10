// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The `regions` paint: one fill colored sample
// by sample by an ordered list of rules over the layer's own units, as
// Sakura's eye is: the opening between her lids is filled once, and where
// each sample falls decides its color (a blossom catchlight, the white
// shaded under the lid, the ringed iris, the pupil), so nothing spills past
// the lids and nothing needs an outline.
//
//   { "type": "regions", "rules": [
//       { "when": { "rose": { "at": "glint", "radius": { "param": "sparkle", "scale": 0.45, "offset": 1.5 }, "lobes": 5, "base": 0.62 } }, "color": "shine" },
//       { "when": { "ellipse": { "at": "iris", "rx": 4.4, "ry": 5.4, "gt": 1 } }, "rules": [
//           { "when": { "above": { "curve": "top", "offset": 1.1 } }, "color": "whiteShade" },
//           { "color": "white" } ] },
//       { "color": "pupil" } ] }
//
// A rule is a predicate (`when`; none: always) and a palette color, or
// nested rules; the first rule whose predicate holds (and, for nested rules,
// one of whose own does) gives the color, and a nested list none of whose
// rules holds falls through to the next rule. The last rule of the list
// takes no predicate, so every sample has a color. Predicates, over a
// sample's place (u, v) in the layer's units:
//
//   ellipse    { at, rx, ry, scale?: [sx, sy], axis?: 'x' | 'y', lt | le | gt | ge }:
//              with dx = (u - x) / rx and dy = (v - y) / ry, the normalized
//              distance hypot(sx dx, sy dy) (or dx or dy alone, on `axis`)
//              against the threshold: her iris's rings, its pupil (scaled
//              1.25 across), its lower half ("lighter low": `axis` y)
//   rose       { at, radius, lobes, base }: within a blossom of `lobes`
//              petals, r < radius (base + (1 - base) |cos(lobes / 2 angle)|):
//              her catchlights
//   circle     { at, r }: within r of `at`
//   above, below  { curve, offset? }: v under (above) or over (below) one
//              of the layer's helper curves, read as a function of x
//              (linear between its points, held past its ends), plus the
//              offset: under her upper lid, along her lower
//   halfPlane  { at, normal: [nx, ny], lt | le | gt | ge }: (p - at) . n
//              against the threshold
//   { lt: [id, value] } (and le, gt, ge), all, any, not, true, false: as
//              a layer's visibility predicates; params are read once a fill
//
// `at` is one of the layer's anchors (by its id) or a point; radii and
// `rx`/`ry` are scalars (a number, a param binding, keyforms), so her glint
// grows with `sparkle`. An anchor and a curve move with the layer's
// keyforms like any node. The paint's one approximation is in
// the curves: a helper polyline stands in for a smooth lid, so a sample
// within a hair of it may fall on the other side. `canvas` maps each sample
// back to the layer's units by the inverse of `M` and runs the rules. Pure:
// imports nothing at run time.
import type { Paint } from './kit/canvas'
import type { PaintMoment, PaintType } from './registry'
import type { Affine, PaintDef, Pt, ResolvedPaint, Scalar } from './schema'

// ---------------------------------------------------------------- the def

/** A place: one of the layer's anchors, by id, or a point in its units. */
type Place = string | Pt
type Comparison = 'lt' | 'le' | 'gt' | 'ge'
/** The comparisons, a param's (`{ lt: [id, value] }`) or a shape's threshold. */
export const COMPARISONS: readonly Comparison[] = ['lt', 'le', 'gt', 'ge']
/** The predicate kinds that read the sample's place. */
export const SHAPES = ['ellipse', 'rose', 'circle', 'above', 'below', 'halfPlane'] as const

type RuleDef = { readonly when?: unknown; readonly color?: string; readonly rules?: readonly RuleDef[]; readonly doc?: string }

// ---------------------------------------------------------------- resolved: numbers only

/** A predicate at a moment: places, radii and curves as numbers, params folded to constants. */
export type Region =
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'ellipse'; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number; readonly sx?: number; readonly sy?: number; readonly axis?: 'x' | 'y'; readonly op: Comparison; readonly value: number }
  | { readonly kind: 'rose'; readonly x: number; readonly y: number; readonly radius: number; readonly k: number; readonly base: number; readonly depth: number }
  | { readonly kind: 'circle'; readonly x: number; readonly y: number; readonly r: number }
  | { readonly kind: 'curve'; readonly xs: readonly number[]; readonly ys: readonly number[]; readonly offset: number; readonly isAbove: boolean }
  | { readonly kind: 'half'; readonly x: number; readonly y: number; readonly nx: number; readonly ny: number; readonly op: Comparison; readonly value: number }
  | { readonly kind: 'all' | 'any'; readonly of: readonly Region[] }
  | { readonly kind: 'not'; readonly of: Region }

export type Rule = { readonly when?: Region; readonly color?: number; readonly rules?: readonly Rule[] }

/** The paint resolved: its rules, colors as 0xRRGGBB. */
export type Resolved = ResolvedPaint & { readonly type: 'regions'; readonly rules: readonly Rule[] }

const ALWAYS: Region = { kind: 'const', value: true }
const NEVER: Region = { kind: 'const', value: false }

const compare = (op: Comparison, a: number, b: number): boolean => (op === 'lt' ? a < b : op === 'le' ? a <= b : op === 'gt' ? a > b : a >= b)
const opOf = (fields: Readonly<Record<string, unknown>>): Comparison => COMPARISONS.find(op => fields[op] !== undefined)!

/** A predicate at this moment, constants folded (a param comparison, an `all` with a false in it). */
function region(def: unknown, at: PaintMoment): Region {
  if (typeof def === 'boolean') return def ? ALWAYS : NEVER
  const pred = def as Readonly<Record<string, unknown>>
  const place = (p: unknown): Pt => {
    const where = p as Place
    return typeof where === 'string' ? at.anchor(where) : where
  }
  for (const op of COMPARISONS) {
    if (pred[op] === undefined) continue
    const [id, value] = pred[op] as readonly [string, number]
    return compare(op, at.value(id), value) ? ALWAYS : NEVER
  }
  if (pred.ellipse !== undefined) {
    const e = pred.ellipse as Readonly<Record<string, unknown>>
    const [x, y] = place(e.at)
    const op = opOf(e)
    const scale = e.scale as readonly [number, number] | undefined
    return {
      kind: 'ellipse',
      x,
      y,
      rx: at.scalar(e.rx as Scalar),
      ry: at.scalar(e.ry as Scalar),
      ...(scale === undefined ? {} : { sx: scale[0], sy: scale[1] }),
      ...(e.axis === undefined ? {} : { axis: e.axis as 'x' | 'y' }),
      op,
      value: e[op] as number,
    }
  }
  if (pred.rose !== undefined) {
    const r = pred.rose as Readonly<Record<string, unknown>>
    const [x, y] = place(r.at)
    const base = r.base as number
    return { kind: 'rose', x, y, radius: at.scalar(r.radius as Scalar), k: (r.lobes as number) / 2, base, depth: 1 - base }
  }
  if (pred.circle !== undefined) {
    const c = pred.circle as Readonly<Record<string, unknown>>
    const [x, y] = place(c.at)
    return { kind: 'circle', x, y, r: at.scalar(c.r as Scalar) }
  }
  if (pred.above !== undefined || pred.below !== undefined) {
    const isAbove = pred.above !== undefined
    const c = (isAbove ? pred.above : pred.below) as Readonly<Record<string, unknown>>
    // read as a function of x: its points by x (a curve drawn right to left is reversed; a tie keeps its order)
    const points = [...at.curve(c.curve as string)].map((p, k) => [p, k] as const)
    points.sort((a, b) => a[0][0] - b[0][0] || a[1] - b[1])
    return { kind: 'curve', xs: points.map(([p]) => p[0]), ys: points.map(([p]) => p[1]), offset: (c.offset as number | undefined) ?? 0, isAbove }
  }
  if (pred.halfPlane !== undefined) {
    const h = pred.halfPlane as Readonly<Record<string, unknown>>
    const [x, y] = place(h.at)
    const [nx, ny] = h.normal as readonly [number, number]
    const op = opOf(h)
    return { kind: 'half', x, y, nx, ny, op, value: h[op] as number }
  }
  if (pred.not !== undefined) {
    const of = region(pred.not, at)
    return of.kind === 'const' ? (of.value ? NEVER : ALWAYS) : { kind: 'not', of }
  }
  const isAll = pred.all !== undefined
  const of = ((isAll ? pred.all : pred.any) as readonly unknown[]).map(one => region(one, at))
  // `all` is false with a false in it, `any` true with a true; the other constants drop out
  if (of.some(one => one.kind === 'const' && one.value !== isAll)) return isAll ? NEVER : ALWAYS
  const rest = of.filter(one => one.kind !== 'const')
  return rest.length === 0 ? (isAll ? ALWAYS : NEVER) : rest.length === 1 ? rest[0]! : { kind: isAll ? 'all' : 'any', of: rest }
}

/** Rules at this moment: those that can never hold dropped, a `when` that always does left out. */
function rules(defs: readonly RuleDef[], at: PaintMoment): Rule[] {
  const out: Rule[] = []
  for (const def of defs) {
    const when = def.when === undefined ? ALWAYS : region(def.when, at)
    if (when.kind === 'const' && !when.value) continue
    const body = def.rules === undefined ? { color: at.color(def.color!) } : { rules: rules(def.rules, at) }
    out.push(when.kind === 'const' ? body : { when, ...body })
  }
  return out
}

// ---------------------------------------------------------------- sample by sample

type Test = (u: number, v: number) => boolean

/** Where a curve (its points by x) is at `u`: linear between its points, held past its ends. */
function curveAt(xs: readonly number[], ys: readonly number[], u: number): number {
  const n = xs.length
  if (u <= xs[0]!) return ys[0]!
  if (u >= xs[n - 1]!) return ys[n - 1]!
  // the last point at or before u: then xs[k] <= u < xs[k + 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid]! <= u) lo = mid
    else hi = mid
  }
  const x0 = xs[lo]!
  const y0 = ys[lo]!
  return y0 + (ys[hi]! - y0) * ((u - x0) / (xs[hi]! - x0))
}

/** A predicate as a test of a sample's place (u, v) in the layer's units. */
function test(r: Region): Test {
  switch (r.kind) {
    case 'const':
      return r.value ? () => true : () => false
    case 'ellipse': {
      const { x, y, rx, ry, sx, sy, axis, op, value } = r
      if (axis === 'x') return u => compare(op, sx === undefined ? (u - x) / rx : ((u - x) / rx) * sx, value)
      if (axis === 'y') return (_u, v) => compare(op, sy === undefined ? (v - y) / ry : ((v - y) / ry) * sy, value)
      if (sx === undefined || sy === undefined) return (u, v) => compare(op, Math.hypot((u - x) / rx, (v - y) / ry), value)
      return (u, v) => compare(op, Math.hypot(((u - x) / rx) * sx, ((v - y) / ry) * sy), value)
    }
    case 'rose': {
      const { x, y, radius, k, base, depth } = r
      return (u, v) => {
        const fx = u - x
        const fy = v - y
        return Math.hypot(fx, fy) < radius * (base + depth * Math.abs(Math.cos(k * Math.atan2(fy, fx))))
      }
    }
    case 'circle': {
      const { x, y, r: radius } = r
      return (u, v) => Math.hypot(u - x, v - y) < radius
    }
    case 'curve': {
      const { xs, ys, offset, isAbove } = r
      return isAbove ? (u, v) => v < curveAt(xs, ys, u) + offset : (u, v) => v > curveAt(xs, ys, u) + offset
    }
    case 'half': {
      const { x, y, nx, ny, op, value } = r
      return (u, v) => compare(op, (u - x) * nx + (v - y) * ny, value)
    }
    case 'not': {
      const of = test(r.of)
      return (u, v) => !of(u, v)
    }
    case 'all': {
      const of = r.of.map(test)
      return (u, v) => of.every(one => one(u, v))
    }
    case 'any': {
      const of = r.of.map(test)
      return (u, v) => of.some(one => one(u, v))
    }
  }
}

/** Rules as a function of a sample's place: its color, or undefined when none holds (a nested list falling through). */
function painter(list: readonly Rule[]): (u: number, v: number) => number | undefined {
  const compiled = list.map(rule => ({ when: rule.when === undefined ? undefined : test(rule.when), color: rule.color, inner: rule.rules === undefined ? undefined : painter(rule.rules) }))
  return (u, v) => {
    for (const { when, color, inner } of compiled) {
      if (when !== undefined && !when(u, v)) continue
      if (inner === undefined) return color
      const found = inner(u, v)
      if (found !== undefined) return found
    }
    return undefined
  }
}

// ---------------------------------------------------------------- inputs

/** The ids a scalar reads: a binding's param, a keyed scalar's blocks' params. */
function scalarInputs(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return []
  const s = value as { param?: unknown; keyforms?: readonly { on?: readonly unknown[] }[] }
  if (typeof s.param === 'string') return [s.param]
  return (s.keyforms ?? []).flatMap(block => (block.on ?? []).filter((id): id is string => typeof id === 'string'))
}

/** Every id a predicate reads: its param comparisons' and its scalars'. */
function predicateInputs(def: unknown): string[] {
  if (def === null || typeof def !== 'object') return []
  const pred = def as Readonly<Record<string, unknown>>
  const out: string[] = []
  for (const op of COMPARISONS) {
    const pair = pred[op]
    if (Array.isArray(pair) && typeof pair[0] === 'string') out.push(pair[0])
  }
  for (const kind of SHAPES) {
    const fields = pred[kind]
    if (fields !== null && typeof fields === 'object') for (const key of ['rx', 'ry', 'radius', 'r']) out.push(...scalarInputs((fields as Record<string, unknown>)[key]))
  }
  if (Array.isArray(pred.all)) for (const one of pred.all) out.push(...predicateInputs(one))
  if (Array.isArray(pred.any)) for (const one of pred.any) out.push(...predicateInputs(one))
  if (pred.not !== undefined) out.push(...predicateInputs(pred.not))
  return out
}

function ruleInputs(list: unknown): string[] {
  return Array.isArray(list) ? list.flatMap((rule: RuleDef) => [...predicateInputs(rule?.when), ...ruleInputs(rule?.rules)]) : []
}

// ---------------------------------------------------------------- the entry

const regions: PaintType = {
  id: 'regions',
  inputs(def: PaintDef): readonly string[] {
    return [...new Set(ruleInputs(def.rules))]
  },
  resolve(def: PaintDef, at: PaintMoment): ResolvedPaint {
    const resolved: Resolved = { type: 'regions', rules: rules(def.rules as readonly RuleDef[], at) }
    return resolved
  },
  canvas(paint: ResolvedPaint, M: Affine): Paint {
    const run = painter((paint as Resolved).rules)
    // samples back to the layer's units: the inverse of M
    const [a, b, c, d, e, f] = M
    const det = a * d - b * c
    return { at: (x, y) => run((d * (x - e) - c * (y - f)) / det, (-b * (x - e) + a * (y - f)) / det) ?? 0 }
  },
}

/** The regions paint, for the registry's paints. */
export const REGIONS: readonly PaintType[] = [regions]
