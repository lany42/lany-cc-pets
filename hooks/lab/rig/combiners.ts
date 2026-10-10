// Derived params' ops (registry.ts's `Combiner`): a derived param is one of
// these over params and earlier derived params, evaluated in order before
// any keyform. Each is computed term by term, in this order:
//
//   sum    the first term's value * weight, += each next one's, + offset
//          (only when given), then clamped as Math.max(lo, Math.min(hi, v))
//          (only when given): Momiji's `min(1, blink + wink + smirk * 0.28)`
//   max    Math.max of value * weight over the terms, then clamped
//   min    Math.min likewise
//   pow    `of` clamped to [0, 1], then ** k: Sakura's lid cubed
//   wave   offset + amp * f(of * rate + phase), f Math.sin or Math.cos, by
//          absolute value with `abs` (amp 1, offset and phase 0 when absent):
//          a tumbling petal's width, `0.3 + 0.7 |cos(1.3 turn)|`
//   round  Math.round(of * by) / per: the shower's quarter turns
//   div    of / by, then clamped (only when given): a share of a span, as
//          the shower's `(amount - delay) / span`
//
// A range is worked out from the inputs' ranges, for the validator and for
// keyform axes. Registered in registry.ts; a new op is an entry here. Pure:
// imports nothing at run time.
import type { Combiner, RigContext } from './registry'
import type { DerivedDef, Problem } from './schema'

/** A problem at `path` (registry.ts's `problem`; not imported, so this module loads before the registry that lists it). */
const problem = (path: string, message: string): Problem => ({ path, message, level: 'error' })

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

type Range = readonly [number, number]

/** A range scaled by `k` (flipped when k is negative). */
const scaled = ([lo, hi]: Range, k: number): Range => (k >= 0 ? [lo * k, hi * k] : [hi * k, lo * k])

/** A range held to a def's `clamp`, as the value is. */
const clamped = (def: DerivedDef, [lo, hi]: Range): Range => (def.clamp === undefined ? [lo, hi] : [Math.max(def.clamp[0], Math.min(def.clamp[1], lo)), Math.max(def.clamp[0], Math.min(def.clamp[1], hi))])

/** A value held to a def's `clamp`, when it has one. */
const clamp = (def: DerivedDef, v: number): number => (def.clamp === undefined ? v : Math.max(def.clamp[0], Math.min(def.clamp[1], v)))

/** Checks an input id: a param or a derived param declared before this one. */
function checkInput(id: unknown, path: string, def: DerivedDef, ctx: RigContext): Problem[] {
  return typeof id === 'string' && ctx.isValue(id, def.id) ? [] : [problem(path, `"${String(id)}" is not a param or a derived param declared before "${def.id}"`)]
}

/** Checks `terms` (at least one [id, weight]) and `clamp` ([lo, hi], lo <= hi), and `offset` where the op takes one. */
function checkTerms(def: DerivedDef, path: string, ctx: RigContext, hasOffset: boolean): Problem[] {
  const problems: Problem[] = []
  if (!Array.isArray(def.terms) || def.terms.length === 0) problems.push(problem(`${path}.terms`, 'holds at least one [id, weight]'))
  else
    def.terms.forEach((term, k) => {
      if (!Array.isArray(term) || term.length !== 2 || !isNumber(term[1])) problems.push(problem(`${path}.terms[${k}]`, 'is [id, finite weight]'))
      else problems.push(...checkInput(term[0], `${path}.terms[${k}][0]`, def, ctx))
    })
  if (hasOffset && def.offset !== undefined && !isNumber(def.offset)) problems.push(problem(`${path}.offset`, 'is not a finite number'))
  if (!hasOffset && def.offset !== undefined) problems.push(problem(`${path}.offset`, `"${def.op}" takes no offset`))
  problems.push(...checkClamp(def, path))
  return problems
}

function checkClamp(def: DerivedDef, path: string): Problem[] {
  if (def.clamp === undefined) return []
  const c = def.clamp as unknown
  return Array.isArray(c) && c.length === 2 && isNumber(c[0]) && isNumber(c[1]) && c[0] <= c[1] ? [] : [problem(`${path}.clamp`, 'is [lo, hi], finite, lo <= hi')]
}

/** Checks the named fields are finite numbers (`required` ones present). */
function checkNumbers(def: DerivedDef, path: string, required: readonly string[], optional: readonly string[]): Problem[] {
  const problems: Problem[] = []
  for (const field of required) if (!isNumber(def[field])) problems.push(problem(`${path}.${field}`, 'is a finite number'))
  for (const field of optional) if (def[field] !== undefined && !isNumber(def[field])) problems.push(problem(`${path}.${field}`, 'is not a finite number'))
  return problems
}

const termsOf = (def: DerivedDef): readonly (readonly [string, number])[] => def.terms ?? []

const sum: Combiner = {
  id: 'sum',
  inputs: def => termsOf(def).map(([id]) => id),
  check: (def, path, ctx) => checkTerms(def, path, ctx, true),
  value(def, get) {
    const terms = termsOf(def)
    let v = get(terms[0]![0]) * terms[0]![1]
    for (let k = 1; k < terms.length; k++) v += get(terms[k]![0]) * terms[k]![1]
    if (def.offset !== undefined) v = v + def.offset
    return clamp(def, v)
  },
  range(def, rangeOf) {
    let lo = 0
    let hi = 0
    for (const [id, weight] of termsOf(def)) {
      const [a, b] = scaled(rangeOf(id), weight)
      lo += a
      hi += b
    }
    return clamped(def, [lo + (def.offset ?? 0), hi + (def.offset ?? 0)])
  },
}

/** `max` or `min` of the weighted terms, clamped. */
function extreme(id: 'max' | 'min', pick: (a: number, b: number) => number): Combiner {
  return {
    id,
    inputs: def => termsOf(def).map(([one]) => one),
    check: (def, path, ctx) => checkTerms(def, path, ctx, false),
    value(def, get) {
      const terms = termsOf(def)
      let v = get(terms[0]![0]) * terms[0]![1]
      for (let k = 1; k < terms.length; k++) v = pick(v, get(terms[k]![0]) * terms[k]![1])
      return clamp(def, v)
    },
    range(def, rangeOf) {
      const ranges = termsOf(def).map(([one, weight]) => scaled(rangeOf(one), weight))
      return clamped(def, [ranges.map(r => r[0]).reduce((a, b) => pick(a, b)), ranges.map(r => r[1]).reduce((a, b) => pick(a, b))])
    },
  }
}

const pow: Combiner = {
  id: 'pow',
  inputs: def => [def.of!],
  check: (def, path, ctx) => [...checkInput(def.of, `${path}.of`, def, ctx), ...(isNumber(def.k) && def.k > 0 ? [] : [problem(`${path}.k`, 'is a finite number over 0')])],
  value: (def, get) => Math.max(0, Math.min(1, get(def.of!))) ** def.k!,
  range(def, rangeOf) {
    const [lo, hi] = rangeOf(def.of!)
    return [Math.max(0, Math.min(1, lo)) ** def.k!, Math.max(0, Math.min(1, hi)) ** def.k!]
  },
}

const wave: Combiner = {
  id: 'wave',
  inputs: def => [def.of!],
  check(def, path, ctx) {
    const problems = [...checkInput(def.of, `${path}.of`, def, ctx), ...checkNumbers(def, path, ['rate'], ['phase', 'amp', 'offset'])]
    if (def.fn !== 'sin' && def.fn !== 'cos') problems.push(problem(`${path}.fn`, 'is "sin" or "cos"'))
    if (def.abs !== undefined && typeof def.abs !== 'boolean') problems.push(problem(`${path}.abs`, 'is true or false'))
    return problems
  },
  value(def, get) {
    let x = get(def.of!) * (def.rate as number)
    if (def.phase !== undefined) x = x + (def.phase as number)
    let f = def.fn === 'sin' ? Math.sin(x) : Math.cos(x)
    if (def.abs === true) f = Math.abs(f)
    if (def.amp !== undefined) f = (def.amp as number) * f
    return def.offset !== undefined ? def.offset + f : f
  },
  range(def) {
    const amp = (def.amp as number | undefined) ?? 1
    const [lo, hi] = scaled(def.abs === true ? [0, 1] : [-1, 1], amp)
    return [lo + (def.offset ?? 0), hi + (def.offset ?? 0)]
  },
}

const round: Combiner = {
  id: 'round',
  inputs: def => [def.of!],
  check(def, path, ctx) {
    const problems = [...checkInput(def.of, `${path}.of`, def, ctx), ...checkNumbers(def, path, ['by', 'per'], [])]
    if (def.per === 0) problems.push(problem(`${path}.per`, 'is not 0'))
    return problems
  },
  value: (def, get) => Math.round(get(def.of!) * (def.by as number)) / (def.per as number),
  range(def, rangeOf) {
    const [lo, hi] = rangeOf(def.of!)
    const a = Math.round(lo * (def.by as number)) / (def.per as number)
    const b = Math.round(hi * (def.by as number)) / (def.per as number)
    return [Math.min(a, b), Math.max(a, b)]
  },
}

const div: Combiner = {
  id: 'div',
  inputs: def => [def.of!],
  check(def, path, ctx) {
    const problems = [...checkInput(def.of, `${path}.of`, def, ctx), ...checkNumbers(def, path, ['by'], []), ...checkClamp(def, path)]
    if (def.by === 0) problems.push(problem(`${path}.by`, 'is not 0'))
    return problems
  },
  value: (def, get) => clamp(def, get(def.of!) / (def.by as number)),
  range: (def, rangeOf) => clamped(def, scaled(rangeOf(def.of!), 1 / (def.by as number))),
}

/** Derived params' ops, by id: `sum`, `max`, `min`, `pow`, `wave`, `round`, `div`. */
export const COMBINERS: readonly Combiner[] = [sum, extreme('max', Math.max), extreme('min', Math.min), pow, wave, round, div]
