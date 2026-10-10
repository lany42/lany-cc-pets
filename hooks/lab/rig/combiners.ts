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
// Registered in registry.ts; a new op is an entry here. Pure: imports
// nothing at run time.
import type { Combiner } from './registry'
import type { DerivedDef } from './schema'

/** A value held to a def's `clamp`, when it has one. */
const clamp = (def: DerivedDef, v: number): number => (def.clamp === undefined ? v : Math.max(def.clamp[0], Math.min(def.clamp[1], v)))

/** A def's `terms`, or none. */
export const termsOf = (def: DerivedDef): readonly (readonly [string, number])[] => def.terms ?? []

const sum: Combiner = {
  id: 'sum',
  inputs: def => termsOf(def).map(([id]) => id),
  value(def, get) {
    const terms = termsOf(def)
    let v = get(terms[0]![0]) * terms[0]![1]
    for (let k = 1; k < terms.length; k++) v += get(terms[k]![0]) * terms[k]![1]
    if (def.offset !== undefined) v = v + def.offset
    return clamp(def, v)
  },
}

/** `max` or `min` of the weighted terms, clamped. */
function extreme(id: 'max' | 'min', pick: (a: number, b: number) => number): Combiner {
  return {
    id,
    inputs: def => termsOf(def).map(([one]) => one),
    value(def, get) {
      const terms = termsOf(def)
      let v = get(terms[0]![0]) * terms[0]![1]
      for (let k = 1; k < terms.length; k++) v = pick(v, get(terms[k]![0]) * terms[k]![1])
      return clamp(def, v)
    },
  }
}

const pow: Combiner = {
  id: 'pow',
  inputs: def => [def.of!],
  value: (def, get) => Math.max(0, Math.min(1, get(def.of!))) ** def.k!,
}

const wave: Combiner = {
  id: 'wave',
  inputs: def => [def.of!],
  value(def, get) {
    let x = get(def.of!) * (def.rate as number)
    if (def.phase !== undefined) x = x + (def.phase as number)
    let f = def.fn === 'sin' ? Math.sin(x) : Math.cos(x)
    if (def.abs === true) f = Math.abs(f)
    if (def.amp !== undefined) f = (def.amp as number) * f
    return def.offset !== undefined ? def.offset + f : f
  },
}

const round: Combiner = {
  id: 'round',
  inputs: def => [def.of!],
  value: (def, get) => Math.round(get(def.of!) * (def.by as number)) / (def.per as number),
}

const div: Combiner = {
  id: 'div',
  inputs: def => [def.of!],
  value: (def, get) => clamp(def, get(def.of!) / (def.by as number)),
}

/** Derived params' ops, by id: `sum`, `max`, `min`, `pow`, `wave`, `round`, `div`. */
export const COMBINERS: readonly Combiner[] = [sum, extreme('max', Math.max), extreme('min', Math.min), pow, wave, round, div]
