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
import type { DriversContext, Source, SourceMoment } from './registry'
import type { ClipDef, Factor, KeyValue, OscDef, Problem, TrackDef } from './schema'

/** A problem at `path` (registry.ts's `problem`; not imported, so this module loads before the registry that lists it). */
const problem = (path: string, message: string, level: 'error' | 'warn' = 'error'): Problem => ({ path, message, level })

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** A key's value (or a `mix` track's `to`) at a moment: a number, or an arg scaled and offset (each only when given). */
export function keyValue(value: KeyValue, args: { arg(id: string): number }): number {
  if (typeof value === 'number') return value
  let v = args.arg(value.arg)
  if (value.scale !== undefined) v *= value.scale
  if (value.add !== undefined) v += value.add
  return v
}

/** Problems with a key value: a finite number, or `{ arg, scale?, add? }`. */
function checkValue(value: unknown, path: string): Problem[] {
  if (isNumber(value)) return []
  if (typeof value !== 'object' || value === null) return [problem(path, 'a key value is a number or { arg, scale?, add? }')]
  const v = value as { readonly arg?: unknown; readonly scale?: unknown; readonly add?: unknown }
  const out: Problem[] = []
  if (typeof v.arg !== 'string') out.push(problem(path, 'an arg value needs `arg`, the name of one of its clip\'s args'))
  if (v.scale !== undefined && !isNumber(v.scale)) out.push(problem(`${path}.scale`, 'not a finite number'))
  if (v.add !== undefined && !isNumber(v.add)) out.push(problem(`${path}.add`, 'not a finite number'))
  return out
}

/** The clip holding `track` (the validator hands each its own object), if it can be found. */
const clipOf = (track: TrackDef, ctx: DriversContext): ClipDef | undefined => ctx.doc.clips.find(clip => clip.tracks.includes(track))

/** Problems with a reference to another track of the clip by id. */
function checkTrackRef(id: unknown, track: TrackDef, path: string, ctx: DriversContext): Problem[] {
  if (typeof id !== 'string') return [problem(path, 'names a track by its id (a string)')]
  const clip = clipOf(track, ctx)
  if (clip === undefined) return []
  const other = clip.tracks.find(one => one.id === id)
  if (other === undefined) return [problem(path, `no track "${id}" in clip "${clip.id}"`)]
  if (other === track) return [problem(path, `track "${id}" reads itself`)]
  return []
}

const keys: Source = {
  id: 'keys',
  check(track, path, ctx) {
    const out: Problem[] = []
    if (track.ease !== undefined && (typeof track.ease !== 'string' || !ctx.isEasing(track.ease))) out.push(problem(`${path}.ease`, `unknown easing ${JSON.stringify(track.ease)}`))
    const list = track.keys as unknown
    if (!Array.isArray(list) || list.length === 0) return [...out, problem(`${path}.keys`, 'needs at least one key, [time, value, easing?]')]
    let last = -Infinity
    list.forEach((key: unknown, k) => {
      const at = `${path}.keys[${k}]`
      if (!Array.isArray(key) || key.length < 2 || key.length > 3) {
        out.push(problem(at, 'a key is [time, value] or [time, value, easing]'))
        return
      }
      const [time, value, easing] = key as [unknown, unknown, unknown]
      if (!isNumber(time)) out.push(problem(at, 'its time is not a finite number'))
      else {
        if (time <= last) out.push(problem(at, `its time ${time} is not after the last key's, ${last}`))
        last = time
      }
      out.push(...checkValue(value, `${at}[1]`))
      if (easing !== undefined && (typeof easing !== 'string' || !ctx.isEasing(easing))) out.push(problem(`${at}[2]`, `unknown easing ${JSON.stringify(easing)}`))
    })
    return out
  },
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
  reads: track => (typeof track.from === 'string' ? [track.from] : []),
  check(track, path, ctx) {
    const out = checkTrackRef(track.from, track, `${path}.from`, ctx)
    if (track.shift !== undefined && !isNumber(track.shift)) out.push(problem(`${path}.shift`, 'not a finite number'))
    return out
  },
  value: (track, at) => at.track(track.from!, track.shift === undefined ? at.time : at.time - track.shift),
}

const osc: Source = {
  id: 'osc',
  check(track, path) {
    const def = track.osc as unknown
    if (typeof def !== 'object' || def === null) return [problem(`${path}.osc`, 'an oscillator is { rate, amp?, phase?, fm?, rectify?, pow?, clamp?, env? }')]
    const o = def as { readonly [field: string]: unknown }
    const at = `${path}.osc`
    const out: Problem[] = []
    if (!isNumber(o.rate)) out.push(problem(`${at}.rate`, 'needs a finite rate, in hertz'))
    for (const field of ['amp', 'phase', 'pow'] as const) if (o[field] !== undefined && !isNumber(o[field])) out.push(problem(`${at}.${field}`, 'not a finite number'))
    if (o.rectify !== undefined && typeof o.rectify !== 'boolean') out.push(problem(`${at}.rectify`, 'true or false'))
    // A sine's negative half raised to a fractional power is NaN: rectify it first, as her talk does.
    if (isNumber(o.pow) && !Number.isInteger(o.pow) && o.rectify !== true) out.push(problem(`${at}.pow`, `a fractional power (${o.pow}) needs \`rectify\`, or the negative halves are NaN`))
    const tuple = (field: string, n: number, what: string): void => {
      const v = o[field]
      if (v !== undefined && !(Array.isArray(v) && v.length === n && v.every(isNumber))) out.push(problem(`${at}.${field}`, `${what}, ${n} finite numbers`))
    }
    tuple('fm', 2, '[rate, depth]')
    tuple('clamp', 2, '[lo, hi]')
    tuple('env', 4, '[base, depth, rate, phase]')
    const clamp = o.clamp as readonly number[] | undefined
    if (Array.isArray(clamp) && clamp.length === 2 && clamp[0]! > clamp[1]!) out.push(problem(`${at}.clamp`, `lo ${clamp[0]} is above hi ${clamp[1]}`))
    return out
  },
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
  reads: track => track.mul?.map(f => f[0]) ?? [],
  check(track, path, ctx) {
    const list = track.mul as unknown
    if (!Array.isArray(list) || list.length === 0) return [problem(`${path}.mul`, 'needs at least one factor, [track, scale?, offset?]')]
    const out: Problem[] = []
    list.forEach((f: unknown, k) => {
      const at = `${path}.mul[${k}]`
      if (!Array.isArray(f) || f.length < 1 || f.length > 3) {
        out.push(problem(at, 'a factor is [track, scale?, offset?]'))
        return
      }
      out.push(...checkTrackRef(f[0], track, `${at}[0]`, ctx))
      if (f[1] !== undefined && !isNumber(f[1])) out.push(problem(`${at}[1]`, 'its scale is not a finite number'))
      if (f[2] !== undefined && !isNumber(f[2])) out.push(problem(`${at}[2]`, 'its offset is not a finite number'))
    })
    return out
  },
  value(track, at) {
    const list = track.mul!
    let product = factor(list[0]!, at)
    for (let k = 1; k < list.length; k++) product *= factor(list[k]!, at)
    return product
  },
}

export const SOURCES: readonly Source[] = [keys, from, osc, mul]
