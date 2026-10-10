// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The `lookAt` driver: params that follow a target,
// as eyes follow a petal. Each output reads one of the target's channels (a
// place, in some space's units, that a driver or a clip wrote), maps it to the
// param's own range by a centre and a span, rounds it to steps (eyes track in
// small hops, not a creep that would repaint the eyes every frame), and
// mixes it in by a weight a clip writes, so the look eases on and off with
// its act:
//
//   value = round(clamp((target - centre) / span, lo, hi) * quantum) / quantum
//   out   = out + (value - out) * weight
//
// Sakura's `follow` feeds it her newest petal's place (the `particle`
// driver's `newest`) and her gust's weight, keys [[0.2, 0], [0.45, 1]]: her
// eyes on the petal in eighths (the tests check it against this formula).
// It keeps no state, so a gap (or a step back) changes nothing for it.
//
// Its def:
//
//   target   { [name]: channel }: the target's channels by name (`x`, `y`),
//            signals or params.
//   when     a channel: it acts only while that is not 0 (a target in the
//            air); always when absent.
//   weight   a channel: how much it takes over, 0 to 1 (1 when absent); at
//            0 or under it leaves its outputs alone.
//   out      [{ param, of, centre, span, clamp?: [lo, hi], quantum? }]: each
//            output, the target channel it follows (`of`, a name in
//            `target`), its centre and span, its clamp (none), its steps
//            (unrounded when absent). Outputs are held to their params'
//            ranges.
//
// Pure: imports nothing at run time (the registry's types only).
import type { DriverFrame, DriverType } from './registry'
import type { DriverDef } from './schema'

/** One output of a `lookAt`: the param it writes and how it maps its target. */
export type LookOut = {
  readonly param: string
  readonly of: string
  readonly centre: number
  readonly span: number
  readonly clamp?: readonly [lo: number, hi: number]
  readonly quantum?: number
}

/** A `lookAt` driver's def (the file's header says what each field does). */
export type LookAtDef = DriverDef & {
  readonly target: Readonly<Record<string, string>>
  readonly when?: string
  readonly weight?: string
  readonly out: readonly LookOut[]
}

/** Where an output looks for a target at `x`: mapped to its range, clamped, in steps. */
export function aim(out: LookOut, x: number): number {
  let v = (x - out.centre) / out.span
  if (out.clamp !== undefined) v = Math.max(out.clamp[0], Math.min(out.clamp[1], v))
  const q = out.quantum
  return q !== undefined && q > 0 ? Math.round(v * q) / q : v
}

/** Mixes each output toward its target by the weight, when the target is there. */
function stepLookAt(def: LookAtDef, frame: DriverFrame): undefined {
  const values = frame.values
  if (def.when !== undefined && (values[def.when] ?? 0) === 0) return undefined
  const weight = def.weight === undefined ? 1 : (values[def.weight] ?? 0)
  // Nothing at all until the weight is above 0.
  if (!(weight > 0)) return undefined
  for (const out of def.out) {
    const channel = def.target[out.of]
    if (channel === undefined) continue
    const current = values[out.param] ?? 0
    const next = current + (aim(out, values[channel] ?? 0) - current) * weight
    const range = frame.rangeOf(out.param)
    values[out.param] = range === undefined ? next : Math.max(range[0], Math.min(range[1], next))
  }
  return undefined
}

export const LOOK_AT: readonly DriverType[] = [
  {
    id: 'lookAt',
    step: (def, _state, frame) => stepLookAt(def as LookAtDef, frame),
  },
]
