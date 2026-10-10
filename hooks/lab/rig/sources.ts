// Where a track's value comes from: its source, named by the track field that
// holds it (registry.ts's `Source`). The driver runtime (drivers.ts) asks a
// track's source for its raw value at a time, then applies the track's
// `scale` and `offset` and its blend; a source reads the time, the clip
// instance's args, earlier tracks of its clip and the easings through the
// `SourceMoment` it is handed, and nothing else.
//
//   keys  [time, value, easing?] keys: the first value before the first key,
//         the last after the last, and in a segment `va + (vb - va) * E(s)`,
//         s = (t - ta) / (tb - ta), as motion.ts's `keys` (a key's own time
//         belongs to the segment ending there, so it gives that key's value).
//         A value is a number or an arg, `arg * scale + add`.
//   from  another track of the clip `shift` seconds earlier: Momiji's toss's
//         side locks, its fringe curve 0.1 s late.
//   osc   a sine on clip or absolute time, its phase modulated, optionally
//         rectified, raised, clamped, scaled and enveloped (OscDef): her talk,
//         Sakura's giggle flutter.
//   mul   the product, left to right, of earlier tracks, each `scale * value
//         + offset`: the flutter times its envelope.
//
// Registered in registry.ts; a new source is an entry here. Pure: imports
// nothing at run time.
import type { Source, SourceMoment } from './registry'
import type { Factor, KeyValue, OscDef } from './schema'

/** A key's value (or a `mix` track's `to`) at a moment: a number, or an arg scaled and offset (each only when given). */
export function keyValue(value: KeyValue, args: { arg(id: string): number }): number {
  if (typeof value === 'number') return value
  let v = args.arg(value.arg)
  if (value.scale !== undefined) v *= value.scale
  if (value.add !== undefined) v += value.add
  return v
}

const keys: Source = {
  id: 'keys',
  value(track, at) {
    const list = track.keys!
    const t = at.time
    const first = list[0]
    if (first === undefined) return 0
    if (t <= first[0]) return keyValue(first[1], at)
    for (let k = 1; k < list.length; k++) {
      const b = list[k]!
      if (t <= b[0]) {
        const a = list[k - 1]!
        const va = keyValue(a[1], at)
        const vb = keyValue(b[1], at)
        const s = (t - a[0]) / (b[0] - a[0])
        return va + (vb - va) * at.easing(a[2] ?? track.ease ?? 'linear').ease(s)
      }
    }
    return keyValue(list[list.length - 1]![1], at)
  },
}

const from: Source = {
  id: 'from',
  value: (track, at) => at.track(track.from!, track.shift === undefined ? at.time : at.time - track.shift),
}

const osc: Source = {
  id: 'osc',
  value(track, at) {
    const o: OscDef = track.osc!
    const t = at.time
    // Momiji's talk: Math.sin(t * Math.PI * 2 * 4.3 + Math.sin(t * 2.3) * 1.5), term for term.
    let phase = t * Math.PI * 2 * o.rate
    if (o.phase !== undefined) phase += o.phase
    if (o.fm !== undefined) phase += o.fm[1] * Math.sin(t * o.fm[0])
    let v = Math.sin(phase)
    if (o.rectify === true) v = Math.max(0, v)
    if (o.pow !== undefined) v = v ** o.pow
    if (o.clamp !== undefined) v = Math.max(o.clamp[0], Math.min(o.clamp[1], v))
    if (o.amp !== undefined) v = o.amp * v
    if (o.env !== undefined) v = v * (o.env[0] + o.env[1] * Math.sin(t * o.env[2] + o.env[3]))
    return v
  },
}

/** One factor of a product: `scale * track + offset`, each only when given. */
function factor(f: Factor, at: SourceMoment): number {
  let v = at.track(f[0], at.time)
  if (f[1] !== undefined) v = f[1] * v
  if (f[2] !== undefined) v = v + f[2]
  return v
}

const mul: Source = {
  id: 'mul',
  value(track, at) {
    const list = track.mul!
    let product = factor(list[0]!, at)
    for (let k = 1; k < list.length; k++) product *= factor(list[k]!, at)
    return product
  },
}

export const SOURCES: readonly Source[] = [keys, from, osc, mul]
