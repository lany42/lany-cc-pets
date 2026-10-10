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
// back to the layer's units by the inverse of `M` and runs the rules; `svg`
// draws the rules as a pattern of masked layers (ellipses, circles, rose and
// curve polygons, half planes), the fill clipping it to the opening (over
// what its own geometry spans). Pure: imports nothing at run time.
import type { Paint } from './kit/canvas'
import type { PaintMoment, PaintType, RigContext } from './registry'
import type { Affine, LayerDef, PaintDef, Problem, Pt, ResolvedPaint, Scalar } from './schema'

// ---------------------------------------------------------------- the def

/** A place: one of the layer's anchors, by id, or a point in its units. */
type Place = string | Pt
type Comparison = 'lt' | 'le' | 'gt' | 'ge'
const COMPARISONS: readonly Comparison[] = ['lt', 'le', 'gt', 'ge']
/** The predicate kinds that read the sample's place, and those over params and other predicates. */
const SHAPES = ['ellipse', 'rose', 'circle', 'above', 'below', 'halfPlane'] as const
const LOGIC = ['all', 'any', 'not'] as const

type RuleDef = { readonly when?: unknown; readonly color?: string; readonly rules?: readonly RuleDef[]; readonly doc?: string }

// ---------------------------------------------------------------- resolved: numbers only

/** A predicate at a moment: places, radii and curves as numbers, params folded to constants. */
type Region =
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'ellipse'; readonly x: number; readonly y: number; readonly rx: number; readonly ry: number; readonly sx?: number; readonly sy?: number; readonly axis?: 'x' | 'y'; readonly op: Comparison; readonly value: number }
  | { readonly kind: 'rose'; readonly x: number; readonly y: number; readonly radius: number; readonly k: number; readonly base: number; readonly depth: number }
  | { readonly kind: 'circle'; readonly x: number; readonly y: number; readonly r: number }
  | { readonly kind: 'curve'; readonly xs: readonly number[]; readonly ys: readonly number[]; readonly offset: number; readonly isAbove: boolean }
  | { readonly kind: 'half'; readonly x: number; readonly y: number; readonly nx: number; readonly ny: number; readonly op: Comparison; readonly value: number }
  | { readonly kind: 'all' | 'any'; readonly of: readonly Region[] }
  | { readonly kind: 'not'; readonly of: Region }

type Rule = { readonly when?: Region; readonly color?: number; readonly rules?: readonly Rule[] }

/** The paint resolved: its rules, colors as 0xRRGGBB. */
type Resolved = ResolvedPaint & { readonly type: 'regions'; readonly rules: readonly Rule[] }

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

// ---------------------------------------------------------------- checking

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

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isObject = (x: unknown): x is Readonly<Record<string, unknown>> => x !== null && typeof x === 'object' && !Array.isArray(x)

/** Problems with a scalar: a finite number, a binding to a declared value, or keyforms whose grids hold their axes' product. */
function checkScalar(value: unknown, path: string, ctx: RigContext, out: Problem[]): void {
  if (isNumber(value)) return
  if (!isObject(value)) return void out.push(problemAt(path, 'is not a number, a param binding or keyforms'))
  if (value.param !== undefined) {
    if (typeof value.param !== 'string' || !ctx.isValue(value.param)) out.push(problemAt(`${path}.param`, `"${String(value.param)}" is not a param or derived param`))
    for (const key of ['scale', 'offset']) if (value[key] !== undefined && !isNumber(value[key])) out.push(problemAt(`${path}.${key}`, 'is not a finite number'))
    return
  }
  if (!isNumber(value.base)) out.push(problemAt(`${path}.base`, 'is not a finite number'))
  if (!Array.isArray(value.keyforms)) return void out.push(problemAt(`${path}.keyforms`, 'is not a list of blocks'))
  value.keyforms.forEach((block: unknown, k: number) => {
    const at = `${path}.keyforms[${k}]`
    if (!isObject(block) || !Array.isArray(block.on) || !Array.isArray(block.axes) || !Array.isArray(block.values)) return void out.push(problemAt(at, 'is not a block of `on`, `axes` and `values`'))
    for (const id of block.on) if (typeof id !== 'string' || !ctx.isValue(id)) out.push(problemAt(`${at}.on`, `"${String(id)}" is not a param or derived param`))
    const size = block.axes.reduce((product: number, axis: unknown) => product * (Array.isArray(axis) ? axis.length : Number.NaN), 1)
    if (block.values.length !== size) out.push(problemAt(`${at}.values`, `${block.values.length} values but its axes make ${size}`))
  })
}

const problemAt = (path: string, message: string): Problem => ({ path, message, level: 'error' })

/** Problems with a predicate at `path`, against the layer's anchors and curves. */
function checkPredicate(def: unknown, path: string, ctx: RigContext, layer: LayerDef, out: Problem[]): void {
  if (typeof def === 'boolean') return
  if (!isObject(def)) return void out.push(problemAt(path, 'is not a predicate'))
  const kinds = Object.keys(def)
  const known = [...SHAPES, ...LOGIC, ...COMPARISONS] as readonly string[]
  if (kinds.length !== 1 || !known.includes(kinds[0]!)) return void out.push(problemAt(path, `takes exactly one of ${known.join(', ')} (has ${kinds.join(', ') || 'none'})`))
  const kind = kinds[0]!
  const at = `${path}.${kind}`
  const body = def[kind]
  if (kind === 'all' || kind === 'any') {
    if (!Array.isArray(body) || body.length === 0) return void out.push(problemAt(at, 'is not a list of predicates'))
    return body.forEach((one, k) => checkPredicate(one, `${at}[${k}]`, ctx, layer, out))
  }
  if (kind === 'not') return checkPredicate(body, at, ctx, layer, out)
  if ((COMPARISONS as readonly string[]).includes(kind)) {
    if (!Array.isArray(body) || body.length !== 2 || typeof body[0] !== 'string' || !isNumber(body[1])) return void out.push(problemAt(at, 'is not [param, value]'))
    if (!ctx.isValue(body[0])) out.push(problemAt(at, `"${body[0]}" is not a param or derived param`))
    return
  }
  if (!isObject(body)) return void out.push(problemAt(at, 'is not an object of its fields'))
  const fields: Readonly<Record<string, readonly string[]>> = {
    ellipse: ['at', 'rx', 'ry', 'scale', 'axis', ...COMPARISONS],
    rose: ['at', 'radius', 'lobes', 'base'],
    circle: ['at', 'r'],
    above: ['curve', 'offset'],
    below: ['curve', 'offset'],
    halfPlane: ['at', 'normal', ...COMPARISONS],
  }
  for (const key of Object.keys(body)) if (!fields[kind]!.includes(key)) out.push(problemAt(`${at}.${key}`, `is not a field of ${kind} (${fields[kind]!.join(', ')})`))
  const checkPlace = (place: unknown): void => {
    if (typeof place === 'string') {
      if (!(layer.anchors ?? []).some(anchor => anchor.id === place)) out.push(problemAt(`${at}.at`, `"${place}" is not an anchor of layer "${layer.id}"`))
    } else if (!(Array.isArray(place) && place.length === 2 && place.every(isNumber))) out.push(problemAt(`${at}.at`, 'is not an anchor id or a point [x, y]'))
  }
  const checkOp = (): void => {
    const ops = COMPARISONS.filter(op => body[op] !== undefined)
    if (ops.length !== 1) out.push(problemAt(at, `takes exactly one of ${COMPARISONS.join(', ')} (has ${ops.length})`))
    else if (!isNumber(body[ops[0]!])) out.push(problemAt(`${at}.${ops[0]}`, 'is not a finite number'))
  }
  if (kind === 'ellipse') {
    checkPlace(body.at)
    checkScalar(body.rx, `${at}.rx`, ctx, out)
    checkScalar(body.ry, `${at}.ry`, ctx, out)
    if (body.scale !== undefined && !(Array.isArray(body.scale) && body.scale.length === 2 && body.scale.every(s => isNumber(s) && s > 0))) out.push(problemAt(`${at}.scale`, 'is not [sx, sy], both positive'))
    if (body.axis !== undefined && body.axis !== 'x' && body.axis !== 'y') out.push(problemAt(`${at}.axis`, 'is not "x" or "y"'))
    checkOp()
  } else if (kind === 'rose') {
    checkPlace(body.at)
    checkScalar(body.radius, `${at}.radius`, ctx, out)
    if (!(isNumber(body.lobes) && body.lobes > 0)) out.push(problemAt(`${at}.lobes`, 'is not a positive number'))
    if (!(isNumber(body.base) && body.base >= 0 && body.base <= 1)) out.push(problemAt(`${at}.base`, 'is not a number from 0 to 1'))
  } else if (kind === 'circle') {
    checkPlace(body.at)
    checkScalar(body.r, `${at}.r`, ctx, out)
  } else if (kind === 'above' || kind === 'below') {
    const curve = (layer.curves ?? []).find(one => one.id === body.curve)
    if (curve === undefined) out.push(problemAt(`${at}.curve`, `"${String(body.curve)}" is not a helper curve of layer "${layer.id}"`))
    else if (curve.points.length < 2) out.push(problemAt(`${at}.curve`, `"${curve.id}" has ${curve.points.length} points: a line needs two`))
    if (body.offset !== undefined && !isNumber(body.offset)) out.push(problemAt(`${at}.offset`, 'is not a finite number'))
  } else {
    checkPlace(body.at)
    const normal = body.normal
    if (!(Array.isArray(normal) && normal.length === 2 && normal.every(isNumber) && (normal[0] !== 0 || normal[1] !== 0))) out.push(problemAt(`${at}.normal`, 'is not a direction [nx, ny]'))
    checkOp()
  }
}

/** Problems with a list of rules at `path`; the top list's last rule must color every sample left. */
function checkRules(list: unknown, path: string, ctx: RigContext, layer: LayerDef, out: Problem[], isTop: boolean): void {
  if (!Array.isArray(list) || list.length === 0) return void out.push(problemAt(path, 'is not a list of rules'))
  list.forEach((rule: unknown, k: number) => {
    const at = `${path}[${k}]`
    if (!isObject(rule)) return void out.push(problemAt(at, 'is not a rule ({ when?, color } or { when?, rules })'))
    for (const key of Object.keys(rule)) if (!['when', 'color', 'rules', 'doc'].includes(key)) out.push(problemAt(`${at}.${key}`, 'is not a field of a rule (when, color, rules, doc)'))
    if (rule.when !== undefined) checkPredicate(rule.when, `${at}.when`, ctx, layer, out)
    if ((rule.color === undefined) === (rule.rules === undefined)) out.push(problemAt(at, 'takes a color or nested rules, one of them'))
    if (rule.color !== undefined && (typeof rule.color !== 'string' || !ctx.isColor(rule.color))) out.push(problemAt(`${at}.color`, `"${String(rule.color)}" is not a palette color`))
    if (rule.rules !== undefined) checkRules(rule.rules, `${at}.rules`, ctx, layer, out, false)
  })
  const last = list[list.length - 1]
  if (isTop && isObject(last) && (last.when !== undefined || last.color === undefined)) out.push(problemAt(`${path}[${list.length - 1}]`, 'the last rule must take no `when` and a color, so every sample has one'))
}

// ---------------------------------------------------------------- SVG

/** A box in the layer's units, [x0, y0, x1, y1]: what the pattern and its masks cover. */
type Box = readonly [x0: number, y0: number, x1: number, y1: number]
/** Points round a rose's outline. */
const ROSE_POINTS = 180

const num = (x: number): string => String(Math.round(x * 1e4) / 1e4 || 0)
const points = (list: readonly Pt[]): string => list.map(([x, y]) => `${num(x)},${num(y)}`).join(' ')
const area = ([x0, y0, x1, y1]: Box): string => `x="${num(x0)}" y="${num(y0)}" width="${num(x1 - x0)}" height="${num(y1 - y0)}"`

/**
 * What the rules' own geometry spans (their anchors, radii and curves), with a
 * quarter of its size and two units to spare: the opening it fills lies
 * between its helper curves. A fill reaching further would see the pattern
 * repeat (a pattern as big as anything at all is more than renderers allot).
 */
function extent(list: readonly Rule[]): Box {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const grow = (x: number, y: number, r = 0): void => {
    x0 = Math.min(x0, x - r)
    y0 = Math.min(y0, y - r)
    x1 = Math.max(x1, x + r)
    y1 = Math.max(y1, y + r)
  }
  const visit = (r: Region): void => {
    if (r.kind === 'ellipse') grow(r.x, r.y, (Math.max(r.rx, r.ry) * Math.abs(r.value)) / Math.min(r.sx ?? 1, r.sy ?? 1))
    else if (r.kind === 'rose') grow(r.x, r.y, r.radius)
    else if (r.kind === 'circle') grow(r.x, r.y, r.r)
    else if (r.kind === 'curve') r.xs.forEach((x, k) => grow(x, r.ys[k]! + r.offset))
    else if (r.kind === 'half') grow(r.x, r.y)
    else if (r.kind === 'not') visit(r.of)
    else if (r.kind === 'all' || r.kind === 'any') r.of.forEach(visit)
  }
  const walk = (rules: readonly Rule[]): void => {
    for (const rule of rules) {
      if (rule.when !== undefined) visit(rule.when)
      if (rule.rules !== undefined) walk(rule.rules)
    }
  }
  walk(list)
  // nothing placed (rules over params alone): one color, which repeats as well as it lies
  if (x0 > x1) return [0, 0, 1, 1]
  const spare = 2 + Math.max(x1 - x0, y1 - y0) / 4
  return [x0 - spare, y0 - spare, x1 + spare, y1 + spare]
}

/** `box` cut to one side of a line: (p - (x, y)) . n on the `isLess` side of `value`. */
function halfPolygon(box: Box, x: number, y: number, nx: number, ny: number, value: number, isLess: boolean): Pt[] {
  const side = (p: Pt): number => ((p[0] - x) * nx + (p[1] - y) * ny - value) * (isLess ? -1 : 1)
  const [bx0, by0, bx1, by1] = box
  const corners: Pt[] = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]]
  const out: Pt[] = []
  corners.forEach((a, k) => {
    const b = corners[(k + 1) % 4]!
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) out.push(a)
    if (sa * sb < 0) out.push([a[0] + ((b[0] - a[0]) * sa) / (sa - sb), a[1] + ((b[1] - a[1]) * sa) / (sa - sb)])
  })
  return out
}

/** Masks for SVG over `box`, white where a region holds, written into `defs`; `mask(r)` is its id, or undefined where it always holds. */
function svgMasks(id: string, box: Box, defs: string[]): (r: Region) => string | undefined {
  let count = 0
  const everywhere = (fill: string, extra = ''): string => `<rect ${area(box)} fill="${fill}"${extra}/>`
  const add = (content: string): string => {
    const name = `${id}-m${count++}`
    defs.push(`<mask id="${name}" maskUnits="userSpaceOnUse" ${area(box)}>${content}</mask>`)
    return name
  }
  const within = (shape: string, isInside: boolean): string => (isInside ? shape.replace('/>', ' fill="#fff"/>') : everywhere('#fff') + shape.replace('/>', ' fill="#000"/>'))
  const mask = (r: Region): string | undefined => {
    switch (r.kind) {
      case 'const':
        return r.value ? undefined : add('')
      case 'ellipse': {
        const isLess = r.op === 'lt' || r.op === 'le'
        if (r.axis !== undefined) {
          // a line across: dx or dy against the value, as a coordinate
          const scale = (r.axis === 'x' ? r.sx : r.sy) ?? 1
          const edge = (r.axis === 'x' ? r.x : r.y) + (r.value * (r.axis === 'x' ? r.rx : r.ry)) / scale
          const polygon = r.axis === 'x' ? halfPolygon(box, edge, 0, 1, 0, 0, isLess) : halfPolygon(box, 0, edge, 0, 1, 0, isLess)
          return add(`<polygon points="${points(polygon)}" fill="#fff"/>`)
        }
        if (r.value <= 0) return isLess ? add('') : undefined
        const ex = (r.rx * r.value) / (r.sx ?? 1)
        const ey = (r.ry * r.value) / (r.sy ?? 1)
        return add(within(`<ellipse cx="${num(r.x)}" cy="${num(r.y)}" rx="${num(Math.abs(ex))}" ry="${num(Math.abs(ey))}"/>`, isLess))
      }
      case 'rose': {
        const outline: Pt[] = Array.from({ length: ROSE_POINTS }, (_, k) => {
          const angle = (k / ROSE_POINTS) * Math.PI * 2
          const r1 = Math.max(0, r.radius) * (r.base + r.depth * Math.abs(Math.cos(r.k * angle)))
          return [r.x + r1 * Math.cos(angle), r.y + r1 * Math.sin(angle)]
        })
        return add(`<polygon points="${points(outline)}" fill="#fff"/>`)
      }
      case 'circle':
        return add(`<circle cx="${num(r.x)}" cy="${num(r.y)}" r="${num(Math.max(0, r.r))}" fill="#fff"/>`)
      case 'curve': {
        const n = r.xs.length
        const line: Pt[] = r.xs.map((x, k) => [x, r.ys[k]! + r.offset])
        const toward = r.isAbove ? box[1] : box[3]
        const outline: Pt[] = [[box[0], r.ys[0]! + r.offset], ...line, [box[2], r.ys[n - 1]! + r.offset], [box[2], toward], [box[0], toward]]
        return add(`<polygon points="${points(outline)}" fill="#fff"/>`)
      }
      case 'half':
        return add(`<polygon points="${points(halfPolygon(box, r.x, r.y, r.nx, r.ny, r.value, r.op === 'lt' || r.op === 'le'))}" fill="#fff"/>`)
      case 'not': {
        const of = mask(r.of)
        return add(of === undefined ? '' : everywhere('#fff') + everywhere('#000', ` mask="url(#${of})"`))
      }
      case 'all': {
        const names = r.of.map(mask).filter((name): name is string => name !== undefined)
        if (names.length === 0) return undefined
        return add(names.reduce((inner, name) => `<g mask="url(#${name})">${inner}</g>`, everywhere('#fff')))
      }
      case 'any': {
        const names = r.of.map(mask)
        if (names.some(name => name === undefined)) return undefined
        return add(names.map(name => everywhere('#fff', ` mask="url(#${name})"`)).join(''))
      }
    }
  }
  return mask
}

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`

// ---------------------------------------------------------------- the entry

const regions: PaintType = {
  id: 'regions',
  inputs(def: PaintDef): readonly string[] {
    return [...new Set(ruleInputs(def.rules))]
  },
  check(def: PaintDef, path: string, ctx: RigContext, layer: LayerDef): Problem[] {
    const out: Problem[] = []
    for (const key of Object.keys(def)) if (!['type', 'rules', 'doc'].includes(key)) out.push(problemAt(`${path}.${key}`, 'is not a field of a regions paint (type, rules, doc)'))
    checkRules(def.rules, `${path}.rules`, ctx, layer, out, true)
    return out
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
  // A pattern in the layer's units (the path that fills with it carries M as its transform): each rule a square in its
  // color, masked to where it holds and every rule above it does not, laid from the last rule to the first.
  svg(paint: ResolvedPaint, _M: Affine, id: string): { readonly fill: string; readonly defs?: string } {
    const list = (paint as Resolved).rules
    const box = extent(list)
    const defs: string[] = []
    const mask = svgMasks(id, box, defs)
    const layers: string[] = []
    const lay = (list: readonly Rule[], within: readonly Region[]): void => {
      for (let k = list.length - 1; k >= 0; k--) {
        const rule = list[k]!
        const where = rule.when === undefined ? within : [...within, rule.when]
        if (rule.rules !== undefined) {
          lay(rule.rules, where)
          continue
        }
        const name = where.length === 0 ? undefined : mask(where.length === 1 ? where[0]! : { kind: 'all', of: where })
        layers.push(`<rect ${area(box)} fill="${hex(rule.color!)}"${name === undefined ? '' : ` mask="url(#${name})"`}/>`)
      }
    }
    lay(list, [])
    // a pattern's content is drawn from its tile's corner: moved back, it is in the layer's units, as are its masks
    const pattern = `<pattern id="${id}" patternUnits="userSpaceOnUse" ${area(box)}><g transform="translate(${num(-box[0])} ${num(-box[1])})">${layers.join('')}</g></pattern>`
    return { fill: `url(#${id})`, defs: defs.join('') + pattern }
  },
}

/** The regions paint, for the registry's paints. */
export const REGIONS: readonly PaintType[] = [regions]
