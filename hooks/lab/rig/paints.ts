// The rig's paints (registry.ts's `PaintType`): what a layer fills with. A
// paint resolves at a moment (its colors as numbers, its anchors where the
// layer's keyforms put them), then becomes the canvas's paint under the
// layer's full transform `M` (its space chain, then the room's `m`), so it
// can think in the layer's units; or SVG's fill.
//
//   solid    one palette color (a layer's `paint` as a bare name is this)
//   rows     `{ top, bottom, stops: [[fraction, color]...], steps? }`: a
//            gradient (or cel steps, with `steps`) by sample row, its stops
//            at `top + span * fraction` between the layer's two anchors'
//            projected heights (`vertical()` below): Momiji's iris
//   columns  `{ stops: [[x, color]...], else }`: by column, `u = (x - M[4]) /
//            M[0]` across the layer's units, the first stop whose `u < x`,
//            else `else`: her beanie's dome
//   ribs     `{ centre, half, freq, threshold, shadeFrom, colors: { rib,
//            ribShade, gap, gapShade } }`: a cylinder's ribs by column, `v =
//            clamp((u - centre) / half, -1, 1)`, a rib where `cos(asin(v) *
//            freq) > threshold`, shaded past `v > shadeFrom`: her cuff
//
// (`regions`, Sakura's eye, is regions.ts.) In SVG, rows and columns are
// hard-stop linear gradients in the layer's units, their lines across the
// same rows or columns of the picture the canvas's are; ribs are their bands
// worked out along the cylinder. Registered in registry.ts. Pure: imports
// nothing at run time but the kit's pen (for `mixColor`).
import type { Paint } from './kit/canvas'
import type { Affine } from './kit/pen'
import { mixColor } from './kit/pen'
import type { PaintType, RigContext } from './registry'
import type { LayerDef, PaintDef, Problem, Pt, ResolvedPaint } from './schema'

/** A problem at `path` (registry.ts's `problem`; not imported, so this module loads before the registry that lists it). */
const problem = (path: string, message: string): Problem => ({ path, message, level: 'error' })

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** A color as SVG writes it. */
const css = (rgb: number): string => `#${rgb.toString(16).padStart(6, '0')}`

/** Rounded for SVG: 4 decimals, no `-0`. */
const num = (x: number): string => {
  const r = Number(x.toFixed(4))
  return Object.is(r, -0) ? '0' : String(r)
}

/** Checks a palette color's name. */
const checkColor = (name: unknown, path: string, ctx: RigContext): Problem[] => (typeof name === 'string' && ctx.isColor(name) ? [] : [problem(path, `"${String(name)}" is not a palette color`)])

/** Checks `[[at, color]...]` stops: at least one, `at` finite and never decreasing. */
function checkStops(stops: unknown, path: string, ctx: RigContext): Problem[] {
  if (!Array.isArray(stops) || stops.length === 0) return [problem(path, 'is a list of [at, color], at least one')]
  const problems: Problem[] = []
  for (let k = 0; k < stops.length; k++) {
    const stop: unknown = stops[k]
    if (!Array.isArray(stop) || stop.length !== 2 || !isNumber(stop[0])) {
      problems.push(problem(`${path}[${k}]`, 'is [at, color], at finite'))
      continue
    }
    problems.push(...checkColor(stop[1], `${path}[${k}][1]`, ctx))
    const before: unknown = stops[k - 1]
    if (Array.isArray(before) && isNumber(before[0]) && stop[0] < before[0]) problems.push(problem(`${path}[${k}][0]`, 'stops never go back'))
  }
  return problems
}

/** Checks an anchor id of the layer's own. */
const checkAnchor = (id: unknown, path: string, layer: LayerDef): Problem[] => (typeof id === 'string' && (layer.anchors ?? []).some(one => one.id === id) ? [] : [problem(path, `"${String(id)}" is not one of ${layer.id}'s anchors`)])

// ---------------------------------------------------------------- SVG gradients

/**
 * A linear gradient in the layer's units along a coordinate `c(p) = g . p +
 * c0` of the layer's points: from where `c` is `lo` to where it is `hi`, its
 * stops `[c, color]`. Each line of equal `c` is a line of equal color, in
 * SVG as on the canvas.
 */
function gradient(id: string, g: Pt, c0: number, lo: number, hi: number, stops: readonly (readonly [number, number])[]): string {
  const g2 = g[0] * g[0] + g[1] * g[1]
  const at = (c: number): Pt => [(g[0] * (c - c0)) / g2, (g[1] * (c - c0)) / g2]
  const [x1, y1] = at(lo)
  const [x2, y2] = at(hi)
  const span = hi - lo
  const marks = stops.map(([c, color]) => `<stop offset="${num(Math.max(0, Math.min(1, (c - lo) / span)))}" stop-color="${css(color)}"/>`).join('')
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}">${marks}</linearGradient>`
}

/** Hard stops: `colors[0]` below `edges[0]`, `colors[k]` from `edges[k - 1]` to `edges[k]`, the last above the last edge. */
function bands(edges: readonly number[], colors: readonly number[]): [number, number][] {
  const out: [number, number][] = []
  edges.forEach((edge, k) => out.push([edge, colors[k]!], [edge, colors[k + 1]!]))
  return out
}

/** The span a gradient's line covers: its stops' first to last, or a unit about one alone. */
const spanOf = (at: readonly number[]): readonly [number, number] => {
  const lo = Math.min(...at)
  const hi = Math.max(...at)
  return hi > lo ? [lo, hi] : [lo - 1, lo + 1]
}

/** `u = (x - M[4]) / M[0]` as a coordinate of the layer's points: SVG's own x, scaled and moved. */
const across = (M: Affine): { readonly g: Pt; readonly c0: number } => ({ g: [1, M[2] / M[0]], c0: 0 })

// ---------------------------------------------------------------- the paints

const solid: PaintType = {
  id: 'solid',
  check: (def, path, ctx) => checkColor(def.color, `${path}.color`, ctx),
  resolve: (def, at) => ({ type: 'solid', color: at.color(def.color as string) }),
  canvas: paint => paint.color as number,
  svg: paint => ({ fill: css(paint.color as number) }),
}

/** A gradient (or cel steps) by sample row through `[y in samples, color]` stops (the tests keep a copy as their oracle). */
function vertical(stops: readonly (readonly [number, number])[], steps: boolean): Paint {
  return {
    row: y => {
      let k = 0
      while (k < stops.length - 2 && y > stops[k + 1]![0]) k++
      const [ya, ca] = stops[k]!
      const [yb, cb] = stops[k + 1] ?? stops[k]!
      if (steps) return y < yb ? ca : cb
      return yb === ya ? ca : mixColor(ca, cb, Math.max(0, Math.min(1, (y - ya) / (yb - ya))))
    },
  }
}

/** A resolved `rows` paint: its anchors in the layer's units, its stops' colors as numbers. */
type Rows = ResolvedPaint & { readonly top: Pt; readonly bottom: Pt; readonly stops: readonly (readonly [number, number])[]; readonly steps: boolean }

const rows: PaintType = {
  id: 'rows',
  check(def, path, ctx, layer) {
    const problems = [...checkAnchor(def.top, `${path}.top`, layer), ...checkAnchor(def.bottom, `${path}.bottom`, layer), ...checkStops(def.stops, `${path}.stops`, ctx)]
    if (def.steps !== undefined && typeof def.steps !== 'boolean') problems.push(problem(`${path}.steps`, 'is true or false'))
    return problems
  },
  resolve: (def, at): Rows => ({
    type: 'rows',
    top: at.anchor(def.top as string),
    bottom: at.anchor(def.bottom as string),
    stops: (def.stops as readonly (readonly [number, string])[]).map(([f, name]) => [f, at.color(name)] as const),
    steps: def.steps === true,
  }),
  canvas(paint, M) {
    const { top: a, bottom: b, stops, steps } = paint as Rows
    // A point's sample row under M.
    const top = M[1] * a[0] + M[3] * a[1] + M[5]
    const span = M[1] * b[0] + M[3] * b[1] + M[5] - top
    return vertical(
      stops.map(([f, color]) => [top + span * f, color] as const),
      steps,
    )
  },
  svg(paint, M, id) {
    const { top: a, bottom: b, stops, steps } = paint as Rows
    const top = M[1] * a[0] + M[3] * a[1] + M[5]
    const span = M[1] * b[0] + M[3] * b[1] + M[5] - top
    if (span === 0) return { fill: css(stops[0]![1]) }
    // The fraction of the way from the top's row to the bottom's, as a coordinate of the layer's points.
    const g: Pt = [M[1] / span, M[3] / span]
    const c0 = (M[5] - top) / span
    const marks = steps
      ? bands(
          stops.slice(1).map(([f]) => f),
          stops.map(([, color]) => color),
        )
      : stops
    return { fill: `url(#${id})`, defs: gradient(id, g, c0, 0, 1, marks) }
  },
}

/** A resolved `columns` paint. */
type Columns = ResolvedPaint & { readonly stops: readonly (readonly [number, number])[]; readonly else: number }

const columns: PaintType = {
  id: 'columns',
  check: (def, path, ctx) => [...checkStops(def.stops, `${path}.stops`, ctx), ...checkColor(def.else, `${path}.else`, ctx)],
  resolve: (def, at): Columns => ({
    type: 'columns',
    stops: (def.stops as readonly (readonly [number, string])[]).map(([x, name]) => [x, at.color(name)] as const),
    else: at.color(def.else as string),
  }),
  canvas(paint, M) {
    const { stops, else: otherwise } = paint as Columns
    const e = M[4]
    const a = M[0]
    return {
      column: x => {
        const u = (x - e) / a
        for (const [at, color] of stops) if (u < at) return color
        return otherwise
      },
    }
  },
  svg(paint, M, id) {
    const { stops, else: otherwise } = paint as Columns
    const { g, c0 } = across(M)
    const edges = stops.map(([x]) => x)
    const [lo, hi] = spanOf(edges)
    return { fill: `url(#${id})`, defs: gradient(id, g, c0, lo, hi, bands(edges, [...stops.map(([, color]) => color), otherwise])) }
  },
}

/** A resolved `ribs` paint. */
type Ribs = ResolvedPaint & {
  readonly centre: number
  readonly half: number
  readonly freq: number
  readonly threshold: number
  readonly shadeFrom: number
  readonly rib: number
  readonly ribShade: number
  readonly gap: number
  readonly gapShade: number
}

/** A ribs paint's color at `u` across the layer's units: her cuff's formula. */
function ribAt(paint: Ribs, u: number): number {
  const v = Math.max(-1, Math.min(1, (u - paint.centre) / paint.half))
  const angle = Math.asin(v)
  const isRib = Math.cos(angle * paint.freq) > paint.threshold
  const isShade = v > paint.shadeFrom
  return isRib ? (isShade ? paint.ribShade : paint.rib) : isShade ? paint.gapShade : paint.gap
}

const RIB_COLORS = ['rib', 'ribShade', 'gap', 'gapShade'] as const

const ribs: PaintType = {
  id: 'ribs',
  check(def, path, ctx) {
    const problems: Problem[] = []
    for (const field of ['centre', 'half', 'freq', 'threshold', 'shadeFrom']) if (!isNumber(def[field])) problems.push(problem(`${path}.${field}`, 'is a finite number'))
    if (def.half === 0) problems.push(problem(`${path}.half`, 'is not 0'))
    const colors = def.colors as unknown
    if (colors === null || typeof colors !== 'object') problems.push(problem(`${path}.colors`, `is { ${RIB_COLORS.join(', ')} }`))
    else for (const name of RIB_COLORS) problems.push(...checkColor((colors as Record<string, unknown>)[name], `${path}.colors.${name}`, ctx))
    return problems
  },
  resolve(def, at): Ribs {
    const colors = def.colors as Readonly<Record<(typeof RIB_COLORS)[number], string>>
    return {
      type: 'ribs',
      centre: def.centre as number,
      half: def.half as number,
      freq: def.freq as number,
      threshold: def.threshold as number,
      shadeFrom: def.shadeFrom as number,
      rib: at.color(colors.rib),
      ribShade: at.color(colors.ribShade),
      gap: at.color(colors.gap),
      gapShade: at.color(colors.gapShade),
    }
  },
  canvas(paint, M) {
    const e = M[4]
    const a = M[0]
    return { column: x => ribAt(paint as Ribs, (x - e) / a) }
  },
  svg(paint, M, id) {
    const one = paint as Ribs
    // Its bands, found along the cylinder (past either end the color holds): sampled finely, each change narrowed by halving.
    const lo = one.centre - Math.abs(one.half)
    const hi = one.centre + Math.abs(one.half)
    const n = 720
    const edges: number[] = []
    const colors = [ribAt(one, lo)]
    for (let k = 1; k <= n; k++) {
      let a = lo + ((hi - lo) * (k - 1)) / n
      let b = lo + ((hi - lo) * k) / n
      const color = ribAt(one, b)
      if (color === colors[colors.length - 1]) continue
      for (let j = 0; j < 24; j++) {
        const mid = (a + b) / 2
        if (ribAt(one, mid) === color) b = mid
        else a = mid
      }
      edges.push(b)
      colors.push(color)
    }
    if (edges.length === 0) return { fill: css(colors[0]!) }
    const { g, c0 } = across(M)
    return { fill: `url(#${id})`, defs: gradient(id, g, c0, lo, hi, bands(edges, colors)) }
  },
}

/** The paints, by id: `solid`, `rows`, `columns`, `ribs` (regions.ts adds `regions`). */
export const PAINTS: readonly PaintType[] = [solid, rows, columns, ribs]

/** A layer's paint as written: a bare palette name is a `solid` paint of it. */
export const paintDefOf = (paint: string | PaintDef): PaintDef => (typeof paint === 'string' ? { type: 'solid', color: paint } : paint)
