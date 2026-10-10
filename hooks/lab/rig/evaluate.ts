// The evaluator: a rig at a pose, `evaluate(rig, params, view) -> Geometry`.
// Pure, and run every frame by the live looks, so a rig is made ready once
// (`compileRig`: every type looked up, every value given a slot, every
// keyform block flattened, every frame box measured) and each evaluation
// only does arithmetic:
//
// 1. values: every param (from `params`, else its default), then every
//    derived param in order, by its combiner;
// 2. spaces: each space's own transform (its type's `local`), then its
//    chain to the root, `then(local, parent's chain)`; a space under the root
//    has its local alone (never multiplied by an identity);
// 3. layers, in order, each whose `visible` holds: its nodes (shape nodes,
//    then anchors, then curves' points), each its base plus every node
//    block's interpolated offset times its frame's width and height (`base +
//    stored * w`, block after block); its shapes' props (scalars evaluated:
//    a number, a binding `scale * value + offset`, keyforms `base + blocks`;
//    tables as written), plus their prop blocks' interpolated deltas; its
//    alpha likewise (1 when absent); its shapes' commands, by their kinds;
//    its paint resolved by its type. One `Drawable` a layer.
//
// A block is read multilinearly: each axis's interpolator gives weights on
// its positions, a grid point's weight is their product (left to right), and
// the block's value is the weighted sum of its grid points'. A layer that
// nothing moves (no blocks, constant scalars) keeps its commands from one
// frame to the next while the view's hairline holds.
//
// Frames (whose box scales node offsets): a layer's `frame`, else its group,
// the part of its id before the first `.` (`eyeR.white` is in `eyeR`). Its
// box is a `frames` entry of that id, else the union of the base nodes of
// every layer whose id is it or starts with it and a `.`: `frameOf` (the
// tests' sweep uses it too; the validator applies the same rule in its own).
// Pure: imports nothing at run time but the kit's pen, the registry and two
// of its families' helpers.
import type { Affine } from './kit/pen'
import { IDENTITY, then } from './kit/pen'
import { paramsIn } from './interp'
import { paintDefOf } from './paints'
import type { Combiner, Interpolator, PaintMoment, PaintType, ShapeKind, SpaceType } from './registry'
import { REGISTRY, rgb } from './registry'
import type { AnchorRef, BlockAxes, Command, DerivedDef, Drawable, Geometry, LayerDef, NodeBlock, PaintDef, Predicate, PropBlock, Pt, ResolvedPaint, RigDoc, Scalar, ShapeDef, SpaceDef, Values, View } from './schema'
import { ROOT } from './schema'

/** A rig made ready to evaluate (frames, node counts and types looked up once); `doc` is the document it was made from. */
export type Rig = { readonly doc: RigDoc }

// ---------------------------------------------------------------- compiled forms

/** A keyform block made ready: its axes' value slots, its interpolator, its grid's strides, its values flat (grid point by grid point, `width` numbers each). */
type Grid = {
  readonly slots: readonly number[]
  readonly axes: readonly (readonly number[])[]
  readonly interp: Interpolator
  readonly strides: readonly number[]
  readonly width: number
  readonly values: Float64Array
}

/** A scalar made ready: a constant, a binding to a value's slot, or a base plus blocks. */
type Num =
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'bind'; readonly slot: number; readonly scale: number | undefined; readonly offset: number | undefined }
  | { readonly kind: 'keyed'; readonly base: number; readonly blocks: readonly Grid[] }

/** One shape of a layer: its kind, its nodes' place among the layer's, its props and the blocks that move them. */
type Shape = {
  readonly def: ShapeDef
  readonly kind: ShapeKind
  readonly first: number
  readonly count: number
  readonly scalars: readonly (readonly [prop: string, value: Num])[]
  readonly tables: readonly (readonly [prop: string, base: readonly number[]])[]
  readonly blocks: readonly (readonly [prop: string, block: Grid])[]
}

/** A layer made ready. `cache` holds a still layer's commands at the last hairline. */
type Layer = {
  readonly def: LayerDef
  /** Its space's index in `Compiled.spaces`; -1 the root. */
  readonly space: number
  readonly visible: (values: Float64Array) => boolean
  readonly shapes: readonly Shape[]
  /** Its base nodes, x and y each. */
  readonly base: Float64Array
  readonly w: number
  readonly h: number
  readonly nodeBlocks: readonly Grid[]
  readonly alpha: Num
  readonly alphaBlocks: readonly Grid[]
  readonly anchors: ReadonlyMap<string, number>
  readonly curves: ReadonlyMap<string, readonly [first: number, count: number]>
  /** A paint that never changes, resolved once; else its type and def, resolved each time. */
  readonly fixed: ResolvedPaint | undefined
  readonly paint: { readonly type: PaintType; readonly def: PaintDef }
  readonly clip: 'none' | 'figure'
  readonly isStill: boolean
  /** Room for the widest of its blocks' values. */
  readonly scratch: Float64Array
  cache: { readonly hairline: number; readonly d: readonly Command[] } | undefined
}

type Space = { readonly def: SpaceDef; readonly type: SpaceType; readonly parent: number }

type Compiled = {
  readonly doc: RigDoc
  /** Every value's id by slot: the params, then the derived params. */
  readonly ids: readonly string[]
  readonly slotOf: ReadonlyMap<string, number>
  readonly defaults: Float64Array
  readonly derived: readonly { readonly slot: number; readonly def: DerivedDef; readonly combiner: Combiner }[]
  /** Parents before children. */
  readonly spaces: readonly Space[]
  readonly layers: readonly Layer[]
  readonly layerIndex: ReadonlyMap<string, number>
  readonly colors: ReadonlyMap<string, number>
  /** Raw scalars (a space's, a paint's) made ready on first use. */
  readonly scalars: WeakMap<object, Num>
  inputs: ReadonlyMap<string, ReadonlySet<string>> | undefined
}

const COMPILED = new WeakMap<Rig, Compiled>()

/** A rig's compiled form, made on first use for a rig `compileRig` didn't make. */
function compiledOf(rig: Rig): Compiled {
  let c = COMPILED.get(rig)
  if (c === undefined) {
    c = compile(rig.doc)
    COMPILED.set(rig, c)
  }
  return c
}

/** Makes `doc` ready to evaluate. It assumes a valid document (the builder validates every pet's); one that is not may throw. */
export function compileRig(doc: RigDoc): Rig {
  const rig: Rig = { doc }
  COMPILED.set(rig, compile(doc))
  return rig
}

/** A type by id from one of the registry's tables, or a clear throw. */
function lookUp<T>(table: ReadonlyMap<string, T>, id: string, what: string): T {
  const one = table.get(id)
  if (one === undefined) throw new Error(`rig: no ${what} "${id}" is registered`)
  return one
}

/** The group a layer id names by default: the part before its first `.` (the id itself without one). */
export const groupOf = (id: string): string => (id.includes('.') ? id.slice(0, id.indexOf('.')) : id)

/**
 * A layer's base nodes in order, as keyforms index them: its shapes' nodes
 * (each shape's kind's, in the shape array's order), then its anchors, then
 * its curves' points. A shape whose kind isn't registered gives none.
 */
export function baseNodesOf(layer: LayerDef): Pt[] {
  const out: Pt[] = []
  const shapes: readonly ShapeDef[] = Array.isArray(layer.shape) ? layer.shape : [layer.shape as ShapeDef]
  for (const shape of shapes) out.push(...(REGISTRY.shapes.get(shape.kind)?.nodes(shape) ?? []))
  for (const anchor of layer.anchors ?? []) out.push(anchor.at)
  for (const curve of layer.curves ?? []) out.push(...curve.points)
  return out
}

/**
 * The frame a layer's node offsets are stored in: its id (the layer's
 * `frame`, else its group) and its box, a `frames` entry of that id or else
 * the union of the base nodes of every layer whose id is it or starts with it
 * and a `.` (undefined when nothing spans it). Offsets are `[dx / w, dy / h]`
 * of the box.
 */
export function frameOf(doc: RigDoc, layer: LayerDef): { readonly id: string; readonly box: readonly [x0: number, y0: number, x1: number, y1: number] | undefined } {
  const id = layer.frame ?? groupOf(layer.id)
  const declared = doc.frames?.find(one => one.id === id)
  if (declared !== undefined) return { id, box: declared.box }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const other of doc.layers) {
    if (other.id !== id && !other.id.startsWith(`${id}.`)) continue
    for (const [x, y] of baseNodesOf(other)) {
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
  }
  return { id, box: x0 <= x1 ? [x0, y0, x1, y1] : undefined }
}

/** A block made ready: `values` already flat, `width` numbers a grid point. */
function gridOf(block: BlockAxes, values: Float64Array, width: number, slotOf: ReadonlyMap<string, number>): Grid {
  const strides: number[] = new Array<number>(block.axes.length)
  let stride = 1
  for (let a = block.axes.length - 1; a >= 0; a--) {
    strides[a] = stride
    stride *= block.axes[a]!.length
  }
  return {
    slots: block.on.map(id => lookUp(slotOf, id, 'param or derived param')),
    axes: block.axes,
    interp: lookUp(REGISTRY.interpolators, block.interp ?? 'linear', 'interpolator'),
    strides,
    width,
    values,
  }
}

/** A scalar made ready. */
function numOf(value: Scalar, slotOf: ReadonlyMap<string, number>): Num {
  if (typeof value === 'number') return { kind: 'const', value }
  if ('param' in value) return { kind: 'bind', slot: lookUp(slotOf, value.param, 'param or derived param'), scale: value.scale, offset: value.offset }
  return { kind: 'keyed', base: value.base, blocks: value.keyforms.map(block => gridOf(block, Float64Array.from(block.values), 1, slotOf)) }
}

const ALWAYS = (): boolean => true
const NEVER = (): boolean => false

/** A visibility predicate made ready. */
function predicateOf(p: Predicate | undefined, slotOf: ReadonlyMap<string, number>): (values: Float64Array) => boolean {
  if (p === undefined || p === true) return ALWAYS
  if (p === false) return NEVER
  const slot = (id: string) => lookUp(slotOf, id, 'param or derived param')
  if ('lt' in p) {
    const [at, v] = [slot(p.lt[0]), p.lt[1]]
    return values => values[at]! < v
  }
  if ('le' in p) {
    const [at, v] = [slot(p.le[0]), p.le[1]]
    return values => values[at]! <= v
  }
  if ('gt' in p) {
    const [at, v] = [slot(p.gt[0]), p.gt[1]]
    return values => values[at]! > v
  }
  if ('ge' in p) {
    const [at, v] = [slot(p.ge[0]), p.ge[1]]
    return values => values[at]! >= v
  }
  if ('all' in p) {
    const parts = p.all.map(one => predicateOf(one, slotOf))
    return values => parts.every(one => one(values))
  }
  if ('any' in p) {
    const parts = p.any.map(one => predicateOf(one, slotOf))
    return values => parts.some(one => one(values))
  }
  const inner = predicateOf(p.not, slotOf)
  return values => !inner(values)
}

/** The params and derived params a predicate reads. */
function predicateIds(p: Predicate | undefined): string[] {
  if (p === undefined || typeof p === 'boolean') return []
  if ('lt' in p) return [p.lt[0]]
  if ('le' in p) return [p.le[0]]
  if ('gt' in p) return [p.gt[0]]
  if ('ge' in p) return [p.ge[0]]
  if ('all' in p) return p.all.flatMap(predicateIds)
  if ('any' in p) return p.any.flatMap(predicateIds)
  return predicateIds(p.not)
}

const isNodeBlock = (block: NodeBlock | PropBlock): block is NodeBlock => 'nodes' in block

function compileLayer(doc: RigDoc, layer: LayerDef, slotOf: ReadonlyMap<string, number>, spaceIndex: ReadonlyMap<string, number>, colors: ReadonlyMap<string, number>): Layer {
  const isArray = Array.isArray(layer.shape)
  const defs: readonly ShapeDef[] = isArray ? (layer.shape as readonly ShapeDef[]) : [layer.shape as ShapeDef]
  const base = baseNodesOf(layer)
  const blocks = layer.keyforms ?? []
  let widest = 1
  // Prop blocks by the shape they move ('alpha' the layer's own).
  const alphaBlocks: Grid[] = []
  const shapeBlocks: (readonly [string, Grid])[][] = defs.map(() => [])
  for (const block of blocks) {
    if (isNodeBlock(block)) continue
    const width = typeof block.values[0] === 'number' ? 1 : (block.values[0] as readonly number[]).length
    widest = Math.max(widest, width)
    const flat = new Float64Array(block.values.length * width)
    block.values.forEach((value, g) => (typeof value === 'number' ? (flat[g] = value) : flat.set(value, g * width)))
    const ready = gridOf(block, flat, width, slotOf)
    if (block.prop === 'alpha') {
      alphaBlocks.push(ready)
      continue
    }
    const dot = block.prop.indexOf('.')
    const at = isArray ? Number(block.prop.slice(0, dot)) : 0
    const prop = isArray ? block.prop.slice(dot + 1) : block.prop
    const list = shapeBlocks[at]
    if (list === undefined) throw new Error(`rig: layer "${layer.id}" has no shape ${at} for its block on "${block.prop}"`)
    list.push([prop, ready])
  }
  let first = 0
  const shapes = defs.map((def, k): Shape => {
    const kind = lookUp(REGISTRY.shapes, def.kind, 'shape kind')
    const count = kind.nodes(def).length
    const scalars: (readonly [string, Num])[] = []
    const tables: (readonly [string, readonly number[]])[] = []
    for (const [prop, length] of Object.entries(kind.props(def))) {
      if (def[prop] === undefined) continue
      if (length === 0) scalars.push([prop, numOf(def[prop] as Scalar, slotOf)])
      else tables.push([prop, def[prop] as readonly number[]])
    }
    for (const [prop] of shapeBlocks[k]!) if (!scalars.some(([one]) => one === prop) && !tables.some(([one]) => one === prop)) throw new Error(`rig: layer "${layer.id}" has a block on "${prop}", which its ${def.kind} doesn't give`)
    const shape: Shape = { def, kind, first, count, scalars, tables, blocks: shapeBlocks[k]! }
    first += count
    return shape
  })
  // Node blocks, flat: per grid point, x and y of every node.
  const nodeBlocks: Grid[] = []
  let w = 1
  let h = 1
  if (blocks.some(isNodeBlock)) {
    const { id, box } = frameOf(doc, layer)
    if (box === undefined) throw new Error(`rig: layer "${layer.id}" has node keyforms but its frame "${id}" spans nothing`)
    w = box[2] - box[0]
    h = box[3] - box[1]
  }
  for (const block of blocks) {
    if (!isNodeBlock(block)) continue
    const width = base.length * 2
    widest = Math.max(widest, width)
    const flat = new Float64Array(block.nodes.length * width)
    block.nodes.forEach((points, g) => points.forEach(([dx, dy], i) => flat.set([dx, dy], g * width + i * 2)))
    nodeBlocks.push(gridOf(block, flat, width, slotOf))
  }
  const anchors = new Map<string, number>()
  let at = first
  for (const anchor of layer.anchors ?? []) anchors.set(anchor.id, at++)
  const curves = new Map<string, readonly [number, number]>()
  for (const curve of layer.curves ?? []) {
    curves.set(curve.id, [at, curve.points.length])
    at += curve.points.length
  }
  const paintDef = paintDefOf(layer.paint)
  const paintType = lookUp(REGISTRY.paints, paintDef.type, 'paint')
  const isSolid = paintDef.type === 'solid'
  const isStill = nodeBlocks.length === 0 && shapes.every(shape => shape.blocks.length === 0 && shape.scalars.every(([, value]) => value.kind === 'const'))
  return {
    def: layer,
    space: layer.space === ROOT ? -1 : lookUp(spaceIndex, layer.space, 'space'),
    visible: predicateOf(layer.visible, slotOf),
    shapes,
    base: Float64Array.from(base.flat()),
    w,
    h,
    nodeBlocks,
    alpha: numOf(layer.alpha ?? 1, slotOf),
    alphaBlocks,
    anchors,
    curves,
    fixed: isSolid ? { type: 'solid', color: lookUp(colors, paintDef.color as string, 'palette color') } : undefined,
    paint: { type: paintType, def: paintDef },
    clip: layer.clip ?? 'none',
    isStill,
    scratch: new Float64Array(widest),
    cache: undefined,
  }
}

function compile(doc: RigDoc): Compiled {
  const ids = [...doc.params.map(one => one.id), ...(doc.derived ?? []).map(one => one.id)]
  const slotOf = new Map(ids.map((id, slot) => [id, slot]))
  const defaults = new Float64Array(ids.length)
  doc.params.forEach((one, slot) => (defaults[slot] = one.default))
  const derived = (doc.derived ?? []).map(def => ({ slot: slotOf.get(def.id)!, def, combiner: lookUp(REGISTRY.combiners, def.op, 'combiner') }))
  // Spaces, parents first.
  const byId = new Map((doc.spaces ?? []).map(def => [def.id, def]))
  const spaces: Space[] = []
  const spaceIndex = new Map<string, number>()
  const place = (def: SpaceDef, path: readonly string[]): number => {
    const known = spaceIndex.get(def.id)
    if (known !== undefined) return known
    if (path.includes(def.id)) throw new Error(`rig: spaces ${[...path, def.id].join(' > ')} make a cycle`)
    const parent = def.parent === ROOT ? -1 : place(lookUp(byId, def.parent, 'space'), [...path, def.id])
    spaces.push({ def, type: lookUp(REGISTRY.spaces, def.type, 'space type'), parent })
    spaceIndex.set(def.id, spaces.length - 1)
    return spaces.length - 1
  }
  for (const def of doc.spaces ?? []) place(def, [])
  const colors = new Map(Object.entries(doc.palette).map(([name, hex]) => [name, rgb(hex)]))
  const layers = doc.layers.map(layer => compileLayer(doc, layer, slotOf, spaceIndex, colors))
  return { doc, ids, slotOf, defaults, derived, spaces, layers, layerIndex: new Map(doc.layers.map((layer, k) => [layer.id, k])), colors, scalars: new WeakMap(), inputs: undefined }
}

// ---------------------------------------------------------------- reading blocks

/** The grid points the last `weigh` call read, as flat indices and weights; swapped with the next pair as axes multiply out. */
let gridAt = new Int32Array(64)
let gridWeight = new Float64Array(64)
let nextAt = new Int32Array(64)
let nextWeight = new Float64Array(64)

/** Grows the grid's scratch to `size`, keeping the current points. */
function grow(size: number): void {
  if (nextAt.length >= size) return
  const n = Math.max(size, nextAt.length * 2)
  const keepAt = gridAt
  const keepWeight = gridWeight
  gridAt = new Int32Array(n)
  gridWeight = new Float64Array(n)
  gridAt.set(keepAt)
  gridWeight.set(keepWeight)
  nextAt = new Int32Array(n)
  nextWeight = new Float64Array(n)
}

/** The grid points `block` reads at `values` and their weights (each the product of its axes' weights, left to right), into `gridAt` and `gridWeight`; their count. */
function weigh(block: Grid, values: Float64Array): number {
  gridAt[0] = 0
  gridWeight[0] = 1
  let count = 1
  for (let a = 0; a < block.axes.length; a++) {
    const pairs = block.interp.weights(block.axes[a]!, values[block.slots[a]!]!)
    const stride = block.strides[a]!
    grow(count * pairs.length)
    let n = 0
    for (let i = 0; i < count; i++) {
      for (const [index, weight] of pairs) {
        nextAt[n] = gridAt[i]! + index * stride
        nextWeight[n] = gridWeight[i]! * weight
        n++
      }
    }
    const at = gridAt
    const weight = gridWeight
    gridAt = nextAt
    gridWeight = nextWeight
    nextAt = at
    nextWeight = weight
    count = n
  }
  return count
}

/** `block`'s value at `values` (its grid points' values, weighted and summed), its `width` numbers into `into`. */
function interpolate(block: Grid, values: Float64Array, into: Float64Array): void {
  const count = weigh(block, values)
  const width = block.width
  const flat = block.values
  into.fill(0, 0, width)
  for (let g = 0; g < count; g++) {
    const weight = gridWeight[g]!
    if (weight === 0) continue
    const at = gridAt[g]! * width
    for (let i = 0; i < width; i++) into[i]! += weight * flat[at + i]!
  }
}

/** Room for one number: a scalar block's value. */
const ONE = new Float64Array(1)

/** A scalar's value at `values`. */
function numAt(num: Num, values: Float64Array): number {
  if (num.kind === 'const') return num.value
  if (num.kind === 'bind') {
    let v = values[num.slot]!
    if (num.scale !== undefined) v = num.scale * v
    if (num.offset !== undefined) v = v + num.offset
    return v
  }
  let v = num.base
  for (const block of num.blocks) {
    interpolate(block, values, ONE)
    v += ONE[0]!
  }
  return v
}

/** A raw scalar's value (a space's, a paint's), made ready on first use. */
function rawAt(c: Compiled, value: Scalar, values: Float64Array): number {
  if (typeof value === 'number') return value
  let num = c.scalars.get(value)
  if (num === undefined) {
    num = numOf(value, c.slotOf)
    c.scalars.set(value, num)
  }
  return numAt(num, values)
}

// ---------------------------------------------------------------- evaluating

/** Every value's slot filled: the params from `params` (else their defaults), then the derived params in order. */
function valuesAt(c: Compiled, params: Values): Float64Array {
  const values = Float64Array.from(c.defaults)
  const params0 = c.doc.params
  for (let k = 0; k < params0.length; k++) {
    const v = params[params0[k]!.id]
    if (v !== undefined) values[k] = v
  }
  if (c.derived.length > 0) {
    const get = (id: string): number => values[c.slotOf.get(id)!]!
    for (const one of c.derived) values[one.slot] = one.combiner.value(one.def, get)
  }
  return values
}

/** Every space's chain to the root, by index. */
function chainsAt(c: Compiled, values: Float64Array): Affine[] {
  const chains: Affine[] = new Array<Affine>(c.spaces.length)
  const scalar = (value: Scalar | undefined): number | undefined => (value === undefined ? undefined : rawAt(c, value, values))
  c.spaces.forEach((space, k) => {
    const local = space.type.local(space.def, scalar)
    chains[k] = space.parent < 0 ? local : then(local, chains[space.parent]!)
  })
  return chains
}

/** A layer's nodes at `values`: its base, plus every node block's offset times its frame. */
function nodesAt(layer: Layer, values: Float64Array): Float64Array {
  const nodes = Float64Array.from(layer.base)
  const offset = layer.scratch
  const { w, h } = layer
  for (const block of layer.nodeBlocks) {
    interpolate(block, values, offset)
    for (let i = 0; i < nodes.length; i += 2) {
      nodes[i]! += offset[i]! * w
      nodes[i + 1]! += offset[i + 1]! * h
    }
  }
  return nodes
}

/** Points `first` to `first + count` of `nodes`. */
function pointsOf(nodes: Float64Array, first: number, count: number): Pt[] {
  const out: Pt[] = new Array<Pt>(count)
  for (let k = 0; k < count; k++) out[k] = [nodes[(first + k) * 2]!, nodes[(first + k) * 2 + 1]!]
  return out
}

/** A layer's commands at `values`: each shape's, by its kind, from its nodes and props. */
function commandsAt(layer: Layer, nodes: Float64Array, values: Float64Array, view: View): readonly Command[] {
  const out: Command[][] = []
  for (const shape of layer.shapes) {
    const props: Record<string, number | readonly number[]> = {}
    for (const [prop, num] of shape.scalars) props[prop] = numAt(num, values)
    for (const [prop, table] of shape.tables) props[prop] = table
    for (const [prop, block] of shape.blocks) {
      interpolate(block, values, layer.scratch)
      const now = props[prop]!
      if (typeof now === 'number') props[prop] = now + layer.scratch[0]!
      else {
        // A table a block moves: copied, the first time, from the document's.
        const table = shape.tables.some(([one, base]) => one === prop && base === now) ? Array.from(now) : (now as number[])
        for (let k = 0; k < table.length; k++) table[k]! += layer.scratch[k]!
        props[prop] = table
      }
    }
    out.push(shape.kind.commands(shape.def, pointsOf(nodes, shape.first, shape.count), props, view) as Command[])
  }
  return out.length === 1 ? out[0]! : out.flat()
}

/** A layer's paint at `values`, its anchors and curves where `nodes` puts them. */
function paintAt(c: Compiled, layer: Layer, nodes: Float64Array, values: Float64Array, view: View): ResolvedPaint {
  if (layer.fixed !== undefined) return layer.fixed
  const moment: PaintMoment = {
    color: name => lookUp(c.colors, name, 'palette color'),
    anchor(id) {
      const at = layer.anchors.get(id)
      if (at === undefined) throw new Error(`rig: layer "${layer.def.id}" has no anchor "${id}"`)
      return [nodes[at * 2]!, nodes[at * 2 + 1]!]
    },
    curve(id) {
      const span = layer.curves.get(id)
      if (span === undefined) throw new Error(`rig: layer "${layer.def.id}" has no curve "${id}"`)
      return pointsOf(nodes, span[0], span[1])
    },
    value: id => values[lookUp(c.slotOf, id, 'param or derived param')]!,
    scalar: value => rawAt(c, value, values),
    view,
  }
  return layer.paint.type.resolve(layer.paint.def, moment)
}

/** One visible layer's fill. */
function drawableOf(c: Compiled, layer: Layer, values: Float64Array, chains: readonly Affine[], view: View): Drawable {
  const isCached = layer.isStill && layer.cache !== undefined && layer.cache.hairline === view.hairline
  const nodes = layer.nodeBlocks.length === 0 ? layer.base : nodesAt(layer, values)
  let d: readonly Command[]
  if (isCached) d = layer.cache!.d
  else {
    d = commandsAt(layer, nodes, values, view)
    if (layer.isStill) layer.cache = { hairline: view.hairline, d }
  }
  let alpha = numAt(layer.alpha, values)
  for (const block of layer.alphaBlocks) {
    interpolate(block, values, ONE)
    alpha += ONE[0]!
  }
  return {
    id: layer.def.id,
    transform: layer.space < 0 ? IDENTITY : chains[layer.space]!,
    d,
    paint: paintAt(c, layer, nodes, values, view),
    alpha,
    clip: layer.clip,
  }
}

/** The view of a room whose units map to samples by `m`: its line floor, `1.5 / min(m[0], m[3])` units. */
export function viewOf(m: Affine): View {
  return { hairline: 1.5 / Math.min(m[0], m[3]) }
}

/** Every param (at its default where `params` lacks it) and every derived param, in declaration order. */
export function valuesOf(rig: Rig, params: Values): Values {
  const c = compiledOf(rig)
  const values = valuesAt(c, params)
  const out: Record<string, number> = {}
  c.ids.forEach((id, slot) => (out[id] = values[slot]!))
  return out
}

/** The rig at `params` (any missing at their defaults): its visible layers' fills, in draw order. */
export function evaluate(rig: Rig, params: Values, view: View): Geometry {
  const c = compiledOf(rig)
  const values = valuesAt(c, params)
  const chains = chainsAt(c, values)
  const out: Drawable[] = []
  for (const layer of c.layers) if (layer.visible(values)) out.push(drawableOf(c, layer, values, chains, view))
  return out
}

/**
 * Where a layer's anchor is at `params` (`layer#anchor`): in its layer's
 * units, its space, and that space's chain to root units. A curve's name
 * gives its first point. Shown or not, the layer's keyforms place it; the
 * view doesn't (nodes never depend on it).
 */
export function anchorOf(rig: Rig, ref: AnchorRef, params: Values, _view: View): { readonly space: string; readonly at: Pt; readonly transform: Affine } {
  const c = compiledOf(rig)
  const hash = ref.indexOf('#')
  const layer = c.layers[c.layerIndex.get(ref.slice(0, hash)) ?? -1]
  if (hash < 0 || layer === undefined) throw new Error(`rig: "${ref}" names no layer (anchors are "layer#anchor")`)
  const name = ref.slice(hash + 1)
  const at = layer.anchors.get(name) ?? layer.curves.get(name)?.[0]
  if (at === undefined) throw new Error(`rig: layer "${layer.def.id}" has no anchor or curve "${name}"`)
  const values = valuesAt(c, params)
  const nodes = nodesAt(layer, values)
  return { space: layer.def.space, at: [nodes[at * 2]!, nodes[at * 2 + 1]!], transform: layer.space < 0 ? IDENTITY : chainsAt(c, values)[layer.space]! }
}

/**
 * Which params can change each layer's fill (its space chain's, its
 * keyforms', its props' and paint's, its alpha's and its visibility's), by
 * layer id: what the runtime's repaint parts are derived from.
 */
export function inputsOf(rig: Rig): ReadonlyMap<string, ReadonlySet<string>> {
  const c = compiledOf(rig)
  if (c.inputs !== undefined) return c.inputs
  // Each value's params: a param itself; a derived param its inputs' params, through any depth.
  const paramsOf = new Map<string, ReadonlySet<string>>()
  for (const param of c.doc.params) paramsOf.set(param.id, new Set([param.id]))
  for (const { def, combiner } of c.derived) {
    const set = new Set<string>()
    for (const id of combiner.inputs(def)) for (const param of paramsOf.get(id) ?? []) set.add(param)
    paramsOf.set(def.id, set)
  }
  const out = new Map<string, ReadonlySet<string>>()
  for (const layer of c.layers) {
    const set = new Set<string>()
    const add = (ids: Iterable<string>): void => {
      for (const id of ids) for (const param of paramsOf.get(id) ?? []) set.add(param)
    }
    for (let at = layer.space; at >= 0; at = c.spaces[at]!.parent) {
      const space = c.spaces[at]!
      add(space.type.inputs?.(space.def) ?? [])
      add(paramsIn(space.def))
    }
    for (const block of layer.def.keyforms ?? []) add(block.on)
    for (const shape of layer.shapes) {
      add(paramsIn(shape.def))
      add(shape.kind.inputs?.(shape.def) ?? [])
    }
    add(paramsIn(layer.def.alpha))
    add(predicateIds(layer.def.visible))
    add(paramsIn(layer.paint.def))
    add(layer.paint.type.inputs?.(layer.paint.def) ?? [])
    out.set(layer.def.id, set)
  }
  c.inputs = out
  return out
}
