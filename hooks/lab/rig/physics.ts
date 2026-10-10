// The stateful drivers that follow: `lag`, a first-order follower (a mood's
// channels easing toward its targets), and `pendulum`, a damped swing
// driven by its inputs (hair, in the physics pipeline). Each
// reads the params and signals as the stages before it left them and writes
// its outputs back (registry.ts's `DriverType`); the driver runtime
// (drivers.ts) keeps their states between steps and hands each `undefined`
// when it starts over (the first step, a step back in time). After a gap of
// over 2 s (`frame.gap`) each decides: `lag` eases across it with the real
// `dt`, and `pendulum` starts over.
//
//   lag       { times: { param: seconds | { signal } }, scale?: signal,
//               quantum?: { param: steps a unit } }
//             x += (target - x) * (1 - Math.exp(-dt / lag)) for each listed
//             param, `lag` its time times the `scale` signal (a `{ signal }`
//             time is read raw); x = target when it starts over or dt <= 0,
//             and across a gap the same formula with the gap's dt.
//             It writes x, rounded to `1 / quantum` where one is given
//             (Sakura's lid, in twentieths), and keeps x unrounded.
//   pendulum  { period, damping, follow: [[input, gain]...],
//               kick: [[input, gain]...], out: { param, blend } }
//             theta = sum(follow_i x_i) + e, where
//             e'' + 2 z w e' + w^2 e = -sum(follow_i (x_i'' + 2 z w x_i'))
//                                      - sum(kick_j x_j''),
//             w = 2 pi / period, z = damping: `follow` is how far the hair's
//             rest goes with an input, `kick` how hard the input's
//             acceleration flings it. The inputs (params or signals) are held
//             linear over each step (first-order hold), so their x'' terms
//             are jumps in e' at the step's start and their x' terms a
//             constant push within it, and the damped oscillator's closed form
//             (underdamped, critical or overdamped) advances e exactly: the
//             result depends on the frame rate only through how finely the
//             inputs are sampled (1% of the swing at 32 fps, 8.4 (c)). theta
//             is written by `out.blend`, held to the param's range. After a
//             gap it starts over, at rest on its inputs.
//
// Pure: imports nothing at run time but the blend modes.
import { BLENDS } from './blends'
import type { BlendMode, DriverType } from './registry'
import type { DriverDef } from './schema'

/** A `lag` driver's fields. */
export type LagDef = DriverDef & {
  /** Each param's (or signal's) lag, seconds (times `scale`), or a signal holding it (raw). */
  readonly times: Readonly<Record<string, number | { readonly signal: string }>>
  /** A signal the numeric times are multiplied by (Sakura's mood tempo). */
  readonly scale?: string
  /** Params written rounded to `1 / steps` (Sakura's lid: 20). */
  readonly quantum?: Readonly<Record<string, number>>
}

/** A pendulum's input and its gain: [param or signal, gain]. */
export type Gain = readonly [input: string, gain: number]

/** A `pendulum` driver's fields. */
export type PendulumDef = DriverDef & {
  /** The undamped swing's period, seconds. */
  readonly period: number
  /** The damping ratio: under 1 it overshoots, each half swing `exp(-z pi / sqrt(1 - z^2))` of the last. */
  readonly damping: number
  readonly follow?: readonly Gain[]
  readonly kick?: readonly Gain[]
  readonly out: { readonly param: string; readonly blend: string }
}

/** A pendulum's state: its swing `e` and `e'`, its inputs' last values, and the last step's slope of its x'' terms. */
export type PendulumState = { readonly e: number; readonly v: number; readonly last: readonly number[]; readonly slope: number }

const BLEND = new Map(BLENDS.map(blend => [blend.id, blend]))

// ---------------------------------------------------------------- lag

/** A lag compiled: its params in order, each one's time or signal and quantum. */
type Lag = {
  readonly ids: readonly string[]
  readonly times: readonly number[]
  readonly signals: readonly (string | undefined)[]
  readonly quanta: readonly (number | undefined)[]
  readonly scale: string | undefined
}

const LAGS = new WeakMap<object, Lag>()

export function lagOf(def: LagDef): Lag {
  let lag = LAGS.get(def)
  if (lag === undefined) {
    const ids = Object.keys(def.times)
    lag = {
      ids,
      times: ids.map(id => {
        const time = def.times[id]
        return typeof time === 'number' ? time : 0
      }),
      signals: ids.map(id => {
        const time = def.times[id]
        return typeof time === 'number' ? undefined : time?.signal
      }),
      quanta: ids.map(id => def.quantum?.[id]),
      scale: def.scale,
    }
    LAGS.set(def, lag)
  }
  return lag
}

const lag: DriverType = {
  id: 'lag',
  step(def, state, frame) {
    const lag = lagOf(def as LagDef)
    const values = frame.values
    const last = state as readonly number[] | undefined
    const dt = frame.dt
    const scale = lag.scale === undefined ? undefined : values[lag.scale]!
    const next: number[] = []
    for (let i = 0; i < lag.ids.length; i++) {
      const id = lag.ids[i]!
      const target = values[id]!
      let x = target
      // Across a gap too: it eases on over it with the whole dt.
      if (last !== undefined && dt > 0) {
        const signal = lag.signals[i]
        // Sakura's own order: her base lag times her mood's tempo.
        const time = signal !== undefined ? values[signal]! : scale === undefined ? lag.times[i]! : lag.times[i]! * scale
        if (time > 0) {
          x = last[i]!
          x += (target - x) * (1 - Math.exp(-dt / time))
        }
      }
      next.push(x)
      const q = lag.quanta[i]
      values[id] = q === undefined ? x : Math.round(x * q) / q
    }
    return next
  },
}

// ---------------------------------------------------------------- pendulum

/** A pendulum compiled: its distinct inputs with their summed gains, and its oscillator's constants. */
type Pendulum = {
  readonly inputs: readonly string[]
  /** Per input, the gain of its x'' term (follow + kick). */
  readonly a: readonly number[]
  /** Per input, the gain of its x' term (2 z w follow). */
  readonly b: readonly number[]
  /** The rest: [input index, follow gain], in `follow`'s order. */
  readonly rest: readonly (readonly [index: number, gain: number])[]
  readonly w: number
  readonly z: number
  /** z w, the envelope's decay rate. */
  readonly sigma: number
  /** The damped frequency (underdamped), or the hyperbolic one (overdamped). */
  readonly q: number
  readonly out: string
  readonly blend: BlendMode
}

const PENDULUMS = new WeakMap<object, Pendulum>()

export function pendulumOf(def: PendulumDef): Pendulum {
  let p = PENDULUMS.get(def)
  if (p === undefined) {
    const w = (2 * Math.PI) / def.period
    const z = def.damping
    const inputs: string[] = []
    const a: number[] = []
    const b: number[] = []
    const indexOf = (id: string): number => {
      let k = inputs.indexOf(id)
      if (k < 0) {
        k = inputs.push(id) - 1
        a.push(0)
        b.push(0)
      }
      return k
    }
    const rest: [number, number][] = []
    for (const [id, gain] of def.follow ?? []) {
      const k = indexOf(id)
      a[k]! += gain
      b[k]! += 2 * z * w * gain
      rest.push([k, gain])
    }
    for (const [id, gain] of def.kick ?? []) a[indexOf(id)]! += gain
    const blend = BLEND.get(def.out.blend)
    if (blend === undefined) throw new Error(`pendulum ${def.id}: unknown blend "${def.out.blend}"`)
    p = { inputs, a, b, rest, w, z, sigma: z * w, q: w * Math.sqrt(Math.abs(1 - z * z)), out: def.out.param, blend }
    PENDULUMS.set(def, p)
  }
  return p
}

/**
 * The swing `dt` on from (e, v), with `ess` its equilibrium for this step's
 * constant push: the damped oscillator's closed form, exact for any `dt`.
 */
function swing(p: Pendulum, e: number, v: number, ess: number, dt: number): readonly [e: number, v: number] {
  const d0 = e - ess
  // At its equilibrium and still, it stays: exactly, so still inputs rest forever.
  if (d0 === 0 && v === 0) return [ess + 0, 0]
  const { sigma, q } = p
  let d: number
  let dv: number
  if (p.z < 1) {
    const ex = Math.exp(-sigma * dt)
    const c = Math.cos(q * dt)
    const s = Math.sin(q * dt)
    const B = (v + sigma * d0) / q
    d = ex * (d0 * c + B * s)
    dv = ex * (B * q * c - d0 * q * s) - sigma * d
  } else if (p.z === 1) {
    const ex = Math.exp(-sigma * dt)
    const B = v + sigma * d0
    d = ex * (d0 + B * dt)
    dv = ex * B - sigma * d
  } else {
    // cosh and sinh under the envelope; for a long step, as two decaying exponentials (no overflow).
    const B = (v + sigma * d0) / q
    let ch: number
    let sh: number
    if (q * dt < 1) {
      const ex = Math.exp(-sigma * dt)
      ch = ex * Math.cosh(q * dt)
      sh = ex * Math.sinh(q * dt)
    } else {
      const slow = Math.exp((q - sigma) * dt)
      const fast = Math.exp(-(q + sigma) * dt)
      ch = (slow + fast) / 2
      sh = (slow - fast) / 2
    }
    d = d0 * ch + B * sh
    dv = q * (d0 * sh + B * ch) - sigma * d
  }
  return [d + ess, dv]
}

const pendulum: DriverType = {
  id: 'pendulum',
  step(def, state, frame) {
    const p = pendulumOf(def as PendulumDef)
    const values = frame.values
    const n = p.inputs.length
    const x: number[] = []
    for (let k = 0; k < n; k++) x.push(values[p.inputs[k]!] ?? 0)
    let e = 0
    let v = 0
    let slope = 0
    // After a gap it starts over, as on the first step: at rest on its inputs.
    const last = frame.gap ? undefined : (state as PendulumState | undefined)
    if (last !== undefined) {
      e = last.e
      v = last.v
      slope = last.slope
      const dt = frame.dt
      if (dt > 0) {
        // The inputs' slopes over this step: their x'' terms jump e' now, their x' terms push steadily.
        let jerk = 0
        let push = 0
        for (let k = 0; k < n; k++) {
          const s = (x[k]! - last.last[k]!) / dt
          jerk += p.a[k]! * s
          push -= p.b[k]! * s
        }
        v -= jerk - slope
        slope = jerk
        ;[e, v] = swing(p, e, v, push / (p.w * p.w), dt)
      }
    }
    let rest = 0
    for (const [k, gain] of p.rest) rest += gain * x[k]!
    let theta = p.blend.apply(values[p.out] ?? 0, rest + e, undefined)
    const range = frame.rangeOf(p.out)
    if (range !== undefined) theta = Math.max(range[0], Math.min(range[1], theta))
    values[p.out] = theta
    const next: PendulumState = { e, v, last: x, slope }
    return next
  },
}

export const PHYSICS: readonly DriverType[] = [lag, pendulum]
