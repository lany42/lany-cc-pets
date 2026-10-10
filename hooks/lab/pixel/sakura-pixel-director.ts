// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura Pixel's director: the clock, her mood and the news in, a pose of
// picks out, 16 times a second. She plays the acts of the rig pet `sakura`,
// each as picks written here by time, so she is the same girl doing the
// same things; her chance is her own, from her seed (`hash`, never
// Math.random), so the same seed and cues give the same poses.
//
// - idle: she rests, dreamy; blinks seldom, in two stages (half, then shut),
//   a quarter of them only a drowsy droop; looks at you, up at the blossom in
//   her hair, spaces out, or watches a petal only she sees fall; every minute
//   or so tilts her head into a smile, hums with her eyes shut, or giggles.
//   Gusts blow cherry petals past her, a pixel each, her eyes on the newest;
//   some catch in her hair (three at most) and stay; any one may land on her
//   nose instead: she goes cross-eyed, puffs her cheeks and blows it off, and
//   the ones in her hair fly off with it. Left alone her lids grow heavy until
//   she nods off, and wakes with a start.
// - busy: her eyes on the work, re-aimed now and then; a peek up at you with
//   a smile every 12-24 s.
// - ponder: her eyes go to the lock on her right, then her lids lower.
// - talk: she looks at you and talks in her own rhythm of syllables.
// - a turn finished: a giggle, "> <", her shoulders shaking; one a turn, in
//   order. A long turn's spectacle: a shower of petals, her eyes alight.
// - breathing: still but for every fifth breath, a sigh that lifts her chest
//   a whole pixel, and her giggle's shoulders.
//
// Pure: imports nothing at run time but the shared hash and her own art.
import { hash } from '../motion'
import type { Brows, Eyes, Mouth, Pose, Spot } from './sakura-pixel'
import { COLUMNS, NOSE, REST, ROWS, SHOWER, SLOTS } from './sakura-pixel'
import type { Cue, Directing } from './pet'

/** Her frames a tick (her definition's `frames`), and so a second: one constant, so her acts' frames are her clock's. */
export const FRAMES = 4
/** Her rolls' salt, and her petals' own, hers alone. */
const SALT = 0x5c3b
const PETAL_SALT = 0x5c3d
/** A moment that lands on a frame's edge counts as reached. */
const EDGE = 1e-6

/** Her acts. A gust's length follows its petals (`gustLength`); every other's is `LENGTH`'s. */
export type Kind = 'blink' | 'droop' | 'smile' | 'hum' | 'giggle' | 'gust' | 'nose' | 'doze' | 'peek' | 'shower'
/**
 * An act: what, when, how long, its roll, and how many petals were in her
 * hair as it began; a gust's petals' fates in order (`h` caught in her hair,
 * `p` blown past, `n` onto her nose) and the side its wind blows from (-1 the
 * viewer's left); a blink's `side` 1 when her eyes are low.
 */
export type Act = { kind: Kind; at: number; length: number; roll: number; from: number; fates: string; side: number }

/** A gust's petals set off this far apart, seconds; one blown past takes `PAST` to cross, one caught lands in `CATCH`, one on her nose in `ON_NOSE`. */
export const SPACING = 1.5
export const PAST = 2.6
export const CATCH = 1.9
export const ON_NOSE = 2.1
/** A gust lasts until its last petal has crossed, or exactly until it lands on her nose, when the nose takes over. */
export const gustLength = (fates: string): number => (fates.length - 1) * SPACING + (fates.endsWith('n') ? ON_NOSE : PAST)

/** How long each act takes, seconds (a gust's: `gustLength`). */
export const LENGTH: Readonly<Record<Exclude<Kind, 'gust'>, number>> = {
  blink: 0.3125,
  droop: 0.125,
  smile: 3.0,
  hum: 4.6,
  giggle: 2.4,
  nose: 3.7,
  doze: 7.2,
  peek: 1.8,
  shower: 4.2,
}
/** Her bigger moments, and the calm (seconds) she lingers in after each before the next. */
const BIG: ReadonlySet<Kind> = new Set<Kind>(['smile', 'hum', 'giggle', 'nose', 'doze', 'shower'])
export const CALM = 9
/** Acts that close her eyes or hold them on something: no blink of her own meanwhile, nor for `HOLD_OFF` after. */
const HOLDS_BLINK: ReadonlySet<Kind> = new Set<Kind>(['hum', 'giggle', 'nose', 'doze', 'shower'])
const HOLD_OFF = 1
/** Her news (a giggle a turn, the shower for a spectacle) plays one at a time, in order; a giggle this long after its turn ends. */
const NEWS_DELAY = 0.3125
/** Left alone, her lids grow heavy from `DROWSY_FROM` seconds, are at their heaviest `DROWSY_OVER` later, and she nods off past `DOZE_AFTER`. */
const DROWSY_FROM = 60
const DROWSY_OVER = 150
export const DOZE_AFTER = 210
/** A breath, seconds (busy, quicker); every fifth a sigh, her chest up a whole pixel for this part of it. */
const BREATH_IDLE = 4.6
const BREATH_BUSY = 3.9
const SIGH: readonly [number, number] = [0.45, 0.735]
/** Her talk's rhythm: syllables, seconds, each open for its first 58%. */
const SYLLABLES: readonly number[] = [0.22, 0.31, 0.19, 0.27, 0.35, 0.21, 0.25, 0.4]
const RHYTHM = SYLLABLES.reduce((sum, length) => sum + length, 0)

/**
 * Where she looks, in the band: at you, up at the blossom in her hair (to
 * her right), spacing out (her lids heavier), after a petal only she sees,
 * or, busy, at the work; `x` how far aside (a petal's, or the work's).
 */
export type Glance = { kind: 'you' | 'pin' | 'space' | 'petal' | 'work'; x: number; at: number }

/** Her eyes `u` seconds into glance `glance`: after a petal, up, then ahead, then down as it falls, unless it fell well to one side. */
export function lookOf(glance: Glance, u: number): Eyes {
  switch (glance.kind) {
    case 'you':
    case 'space':
      return 'open'
    case 'pin':
      return 'right'
    case 'work':
      return glance.x < -0.4 ? 'left' : 'down'
    case 'petal':
      if (glance.x < -0.4) return 'left'
      if (glance.x > 0.4) return 'right'
      return u < 0.8125 - EDGE ? 'up' : u < 2.3125 - EDGE ? 'open' : 'down'
  }
}

/** Picks over time: for each, when it changes and to what (undefined hands it back to the pose under it). */
type Steps<T> = readonly (readonly [at: number, value: T | undefined])[]
type Script = {
  eyes?: Steps<Eyes>
  mouth?: Steps<Mouth>
  brows?: Steps<Brows>
  puff?: Steps<number>
  breath?: Steps<number>
  bob?: Steps<number>
  lean?: Steps<number>
}

/** The value of `steps` `u` seconds in: its last step at or before then. */
function stepOf<T>(steps: Steps<T> | undefined, u: number): T | undefined {
  let value: T | undefined
  for (const [at, step] of steps ?? []) {
    if (at > u + EDGE) break
    value = step
  }
  return value
}

/** Lays a script's picks `u` seconds in over `pose`. */
function lay(script: Script, u: number, pose: Pose): void {
  const eyes = stepOf(script.eyes, u)
  const mouth = stepOf(script.mouth, u)
  const brows = stepOf(script.brows, u)
  const puff = stepOf(script.puff, u)
  const breath = stepOf(script.breath, u)
  const bob = stepOf(script.bob, u)
  const lean = stepOf(script.lean, u)
  if (eyes !== undefined) pose.eyes = eyes
  if (mouth !== undefined) pose.mouth = mouth
  if (brows !== undefined) pose.brows = brows
  if (puff !== undefined) pose.puff = puff
  if (breath !== undefined) pose.breath = breath
  if (bob !== undefined) pose.bob = bob
  if (lean !== undefined) pose.lean = lean
}

/** Her acts' picks by time: seconds into each act, on her frames (sixteenths of a second). */
const SCRIPTS: Readonly<Record<'smile' | 'hum' | 'doze' | 'peek' | 'shower', Script>> = {
  // Her head tips toward the light, a whole pixel, and her "ω" spreads; her lids soften; the smile goes first.
  smile: {
    lean: [[0.6875, 1], [2.4375, undefined]],
    mouth: [[0.6875, 'smile'], [2.375, undefined]],
    eyes: [[0.875, 'half'], [2.25, undefined]],
  },
  // Eyes closed, a pressed smile.
  hum: {
    eyes: [[0.1875, 'half'], [0.25, 'shut'], [4.3125, 'half'], [4.375, undefined]],
    mouth: [[0.375, 'smile'], [4.3125, undefined]],
  },
  // Her lids close; her head goes down a pixel and over to one side; then she wakes with a start, eyes wide, "oh",
  // and blinks as if that was all it was.
  doze: {
    eyes: [[0.375, 'half'], [1.8125, 'shut'], [4.6875, 'wide'], [5.8125, undefined], [6, 'half'], [6.125, 'shut'], [6.25, 'half'], [6.3125, undefined]],
    bob: [[2.5625, 1], [4.6875, undefined]],
    lean: [[2.625, -1], [4.75, undefined]],
    brows: [[4.6875, 'up'], [5.9375, undefined]],
    mouth: [[4.75, 'open'], [5.1875, undefined]],
  },
  // While busy: a quick look up at you, a little smile, and back to the work.
  peek: {
    eyes: [[0.0625, 'open'], [1.6875, undefined]],
    mouth: [[0.25, 'smile'], [1.5, undefined]],
  },
  // The spectacle: petals shower down round her; her eyes light up, "oh", then she beams.
  shower: {
    eyes: [[0.1875, 'sparkle'], [3.1875, undefined]],
    mouth: [[0.1875, 'open'], [1.1875, 'smile'], [4, undefined]],
  },
}
/** The nose: cross-eyed at the petal, brows up; puffed cheeks, brows knit, lids lowered; pursed, she blows; pleased with herself. */
const NOSE_SCRIPT: Script = {
  eyes: [[0, 'cross'], [1.4375, 'half'], [1.75, undefined]],
  brows: [[0, 'up'], [1.0625, 'knit'], [1.6875, undefined]],
  puff: [[1.0625, 1], [1.6875, undefined]],
  mouth: [[1.6875, 'purse'], [2.25, undefined], [2.625, 'smile'], [3.4375, undefined]],
}
/** When the blown petals take each step of their flight (six steps, the last gone). */
const BLOWN: readonly number[] = [1.9375, 2.0625, 2.1875, 2.25, 2.375, 2.625]
/** Each hair slot's petal flies off to this side as it is blown. */
const AWAY: readonly number[] = [-1, 1, -1]

/** The petals in her hair, `count` of them, as pixels of her head. */
export const hair = (count: number): Spot[] => SLOTS.slice(0, Math.max(0, Math.min(SLOTS.length, count))).map(([x, y]) => [x, y] as const)

const inBox = ([x, y]: Spot): boolean => x >= 0 && x < COLUMNS && y >= 0 && y < ROWS * 2

/**
 * Petal `k` of gust `act`, `uk` seconds after it set off, in her box's
 * pixels before flooring: blown in from the wind's side, then on across her
 * and out, or into her hair at `goal`, or onto her nose. One caught eases
 * into the middle of its pixel, so it lands where it will lie.
 */
export function petalAt(act: Act, k: number, uk: number, goal: Spot | undefined): readonly [number, number] {
  const r = hash(Math.floor(act.roll * 1e6), k, PETAL_SALT)
  const x0 = act.side < 0 ? -1.7 : COLUMNS + 1.7
  const y0 = -0.5 + 3.3 * r
  if (goal === undefined) {
    const s = uk / PAST
    const x = x0 + ((act.side < 0 ? COLUMNS + 1.7 : -1.7) - x0) * s
    const y = y0 + (5.2 + 1.6 * r) * s ** 1.3 - 0.8 * Math.sin(Math.PI * s) + 0.2 * Math.sin(s * 15 + r * 6)
    return [x, y]
  }
  const s = Math.min(1, uk / (act.fates[k] === 'n' ? ON_NOSE : CATCH))
  const e = 1 - (1 - s) ** 1.7
  const x = x0 + (goal[0] + 0.5 - x0) * e
  const y = y0 + (goal[1] + 0.5 - y0) * e - 0.6 * Math.sin(Math.PI * s) * (1 - s) + 0.16 * (1 - s * s) * Math.sin(s * 13 + r * 6)
  return [x, y]
}

/** Where her eyes go for a petal at (x, y) of her box, in her pixels: aside if it is left of column 6 or right of column 9, else up, ahead or down by its row. */
function eyesOn(x: number, y: number): Eyes {
  if (x < 6) return 'left'
  if (x >= 10) return 'right'
  if (y < 3.2) return 'up'
  return y >= 6.7 ? 'down' : 'open'
}

/**
 * A gust, `u` seconds in: its petals one after another, each a pixel; her
 * eyes on the newest, lids as heavy as they were; one coming for her nose
 * crosses them. Her hair holds what it held and each petal caught as it lands.
 */
function blow(act: Act, u: number, pose: Pose): void {
  const air: Spot[] = []
  let caught = 0
  let landed = 0
  let watched: readonly [number, number] | undefined
  let crossed = false
  for (let k = 0; k < act.fates.length; k++) {
    const fate = act.fates[k]!
    const goal: Spot | undefined = fate === 'h' ? SLOTS[Math.min(SLOTS.length - 1, act.from + caught)] : fate === 'n' ? NOSE : undefined
    if (fate === 'h') caught++
    const uk = u - k * SPACING
    if (uk < -EDGE) continue
    const flight = fate === 'n' ? ON_NOSE : fate === 'h' ? CATCH : PAST
    if (uk >= flight - EDGE) {
      if (fate === 'h') landed++
      continue
    }
    const at = petalAt(act, k, Math.max(0, uk), goal)
    watched = at
    const spot: Spot = [Math.floor(at[0]), Math.floor(at[1])]
    if (inBox(spot)) air.push(spot)
    if (fate === 'n' && uk >= ON_NOSE - 0.3 - EDGE) crossed = true
  }
  pose.air = [...pose.air, ...air]
  pose.worn = hair(act.from + landed)
  if (crossed) pose.eyes = 'cross'
  else if (watched !== undefined && u >= 0.3125 - EDGE) {
    // Her lids stay as heavy as they were: a drowsy eye follows half shut.
    const eyes = eyesOn(watched[0], watched[1])
    pose.eyes = pose.eyes === 'half' || pose.eyes === 'lowered' ? (eyes === 'down' ? 'lowered' : 'half') : eyes
  }
}

/** Lays an act on `pose`, `u` seconds in: pure, so the studio can pose any moment of one. */
export function perform(act: Act, u: number, pose: Pose): void {
  if (u < -EDGE) return
  switch (act.kind) {
    case 'blink': {
      // Her lids drop most of the way and linger two frames, then close for three: her two-stage blink. Not over crossed or squeezed eyes.
      if (pose.eyes === 'cross' || pose.eyes === 'squeeze') break
      const low = act.side > 0 || pose.eyes === 'down' || pose.eyes === 'lowered'
      pose.eyes = u < 0.125 - EDGE ? (low ? 'lowered' : 'half') : 'shut'
      break
    }
    case 'droop':
      // A drowsy half-blink that never closes.
      if (pose.eyes === 'cross' || pose.eyes === 'squeeze') break
      pose.eyes = act.side > 0 || pose.eyes === 'down' || pose.eyes === 'lowered' ? 'lowered' : 'half'
      break
    case 'giggle':
      // "> <", her mouth fluttering open and shut four times a second, "he-he", her shoulders hopping three times.
      if (u < 0.0625 - EDGE) break
      pose.eyes = u < 2.125 - EDGE ? 'squeeze' : pose.eyes
      pose.mouth = u >= 0.25 - EDGE && u < 2 - EDGE ? (Math.floor((u - 0.25) * 8 + EDGE) % 2 === 0 ? 'laugh' : 'smile') : u < 2.3125 - EDGE ? 'smile' : pose.mouth
      if ((u >= 0.125 - EDGE && u < 0.25 - EDGE) || (u >= 0.4375 - EDGE && u < 0.5625 - EDGE) || (u >= 0.8125 - EDGE && u < 0.875 - EDGE)) pose.breath = 1
      break
    case 'gust':
      blow(act, u, pose)
      break
    case 'nose': {
      lay(NOSE_SCRIPT, u, pose)
      // The petal on her nose, and those in her hair, until she blows: then they fly off, the one on her nose up toward her bubble.
      const step = BLOWN.filter(at => at <= u + EDGE).length
      if (step >= BLOWN.length) {
        pose.worn = []
        break
      }
      const flying: Spot[] = hair(act.from).map(([x, y], k) => [x + AWAY[k]! * step, y + Math.floor(step * step * 0.4)] as const)
      flying.push([NOSE[0] - 2 * step, NOSE[1] - step])
      pose.worn = flying.filter(inBox)
      break
    }
    case 'shower': {
      lay(SCRIPTS.shower, u, pose)
      // Petals fall round her, each its own column and its own start, a whole pixel at a time.
      const s = u / act.length
      const air: Spot[] = []
      for (const [x, delay] of SHOWER) {
        const v = (s - delay) / 0.5
        if (v <= 0 || v >= 1) continue
        const spot: Spot = [x, Math.floor(v * 14 + EDGE) - 1]
        if (inBox(spot)) air.push(spot)
      }
      pose.air = [...pose.air, ...air]
      break
    }
    case 'smile':
    case 'hum':
    case 'doze':
    case 'peek':
      lay(SCRIPTS[act.kind], u, pose)
      break
  }
}

/** Her chest up a pixel at `t`: at the top of every fifth breath, a sigh. */
export function sighAt(t: number, isBusy: boolean): number {
  const period = isBusy ? BREATH_BUSY : BREATH_IDLE
  const breath = Math.floor(t / period + EDGE)
  const phase = t / period - breath
  return breath % 5 === 3 && phase >= SIGH[0] - EDGE && phase < SIGH[1] - EDGE ? 1 : 0
}

/** Her mouth `u` seconds into talking: her syllables in turn, each open for its first 58%. */
export function syllableAt(u: number): Mouth {
  let left = ((u % RHYTHM) + RHYTHM) % RHYTHM
  for (const length of SYLLABLES) {
    if (left < length - EDGE) return left < length * 0.58 - EDGE ? 'open' : 'rest'
    left -= length
  }
  return 'rest'
}

/** Her eyes while she thinks, `u` seconds in: down, then to the lock on her right, then her lids lowered. */
export const ponderAt = (u: number): Eyes => (u < 0.25 - EDGE ? 'down' : u < 2.25 - EDGE ? 'right' : 'lowered')

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

type Track = 'face' | 'gust' | 'peek' | 'glance' | 'blink'

export class SakuraPixelDirector implements Directing<Pose> {
  private readonly seed: number
  private count = 0
  /** Her last frame's time; undefined before her first. */
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  private acts: Act[] = []
  private due: Record<Track, number> = { face: 0, gust: 0, peek: 0, glance: 0, blink: 0 }
  private glance: Glance = { kind: 'you', x: 0, at: 0 }
  /** The news waiting its turn. */
  private queue: ('giggle' | 'shower')[] = []
  /** Petals caught in her hair, 0 to 3: her story, kept until she blows them off. */
  private petals: number
  /** When the petal on its way to her nose lands, if one is. */
  private noseAt: number | undefined
  /** Since when she has been left alone (her drowsiness counts from it; each doze starts it over). */
  private idleFrom = 0
  /** No bigger moment before this. */
  private calmUntil = 0

  constructor(seed: number, start: { petals: number } = { petals: 0 }) {
    this.seed = seed | 0
    this.petals = clamp(start.petals, 0, SLOTS.length)
  }

  private roll(): number {
    return hash(this.seed, this.count++, SALT)
  }

  private span(a: number, b: number): number {
    return a + (b - a) * this.roll()
  }

  private playing(kinds: ReadonlySet<Kind>): Act | undefined {
    return this.acts.find(act => kinds.has(act.kind))
  }

  private play(kind: Exclude<Kind, 'gust'>, at: number, side = 0): void {
    this.acts.push({ kind, at, length: LENGTH[kind], roll: this.roll(), from: this.petals, fates: '', side })
    if (BIG.has(kind)) this.calmUntil = Math.max(this.calmUntil, at + LENGTH[kind] + CALM)
    // Her hair is empty once she has blown; the act shows it happen.
    if (kind === 'nose') this.petals = 0
  }

  /** A gust: one petal (40%), two (40%) or three; each in turn may land on her nose (16%, ending the gust), catch in her hair while it has room (46%), or blow past; its wind from either side. */
  private blowGust(t: number): void {
    const count = this.roll() < 0.4 ? 1 : this.roll() < 0.67 ? 2 : 3
    let fates = ''
    let room = SLOTS.length - this.petals
    for (let k = 0; k < count; k++) {
      const r = this.roll()
      if (r < 0.16) {
        fates += 'n'
        break
      }
      if (room > 0 && r < 0.62) {
        fates += 'h'
        room--
      } else fates += 'p'
    }
    const side = this.roll() < 0.5 ? -1 : 1
    const act: Act = { kind: 'gust', at: t, length: gustLength(fates), roll: this.roll(), from: this.petals, fates, side }
    this.acts.push(act)
    // What her hair holds once it is done, and when a petal reaches her nose; the act shows them land.
    this.petals = Math.min(SLOTS.length, this.petals + [...fates].filter(fate => fate === 'h').length)
    if (fates.endsWith('n')) this.noseAt = act.at + act.length
  }

  /** Where she looks next, for her mood: idle at you 40%, up at her blossom 20%, spacing out 22%, after a petal 18%; busy at the work. */
  private aim(t: number): void {
    if (this.mood === 'busy') {
      this.glance = { kind: 'work', x: this.span(-0.55, -0.35), at: t }
      return
    }
    const pick = this.roll()
    this.glance = pick < 0.4 ? { kind: 'you', x: 0, at: t } : pick < 0.6 ? { kind: 'pin', x: 0, at: t } : pick < 0.82 ? { kind: 'space', x: 0, at: t } : { kind: 'petal', x: this.span(-0.5, 0.5), at: t }
  }

  /** Her next gap on `track`, in the mood she is in. */
  private gap(track: Track): number {
    const mood = this.mood
    switch (track) {
      case 'face':
        return mood === 'idle' ? this.span(35, 75) : this.span(50, 100)
      case 'gust':
        return this.span(45, 95)
      case 'peek':
        return this.span(12, 24)
      case 'glance':
        return mood === 'busy' ? this.span(3, 6) : this.span(4.5, 11)
      case 'blink':
        return mood === 'busy' ? this.span(5, 10) : mood === 'talk' ? this.span(2.5, 5.5) : this.span(4, 9)
    }
  }

  /** Starts over: first, or after a gap (hidden, asleep): her first times drawn afresh, no act playing, the petals in her hair and the news still queued kept. */
  private resync(t: number): void {
    this.acts = []
    this.noseAt = undefined
    this.calmUntil = t
    this.idleFrom = t
    this.due = {
      face: t + this.span(15, 35),
      gust: t + this.span(10, 22),
      peek: t + this.span(5, 12),
      glance: t + this.span(1.5, 5),
      blink: t + this.span(1.2, 3.5),
    }
    this.glance = { kind: this.mood === 'busy' ? 'work' : 'you', x: this.mood === 'busy' ? this.span(-0.55, -0.35) : 0, at: t }
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (cue.mood !== this.mood) {
      // A new mood: her eyes go where it looks at once, the work or you.
      this.mood = cue.mood
      if (!isFresh && (this.mood === 'busy' || this.mood === 'idle')) {
        this.glance = this.mood === 'busy' ? { kind: 'work', x: this.span(-0.55, -0.35), at: t } : { kind: 'you', x: 0, at: t }
        this.due.glance = t + this.gap('glance')
      }
    }
    if (isFresh) this.resync(t)
    this.last = t
    const mood = this.mood
    if (mood !== 'idle') this.idleFrom = t
    this.acts = this.acts.filter(act => t < act.at + act.length - EDGE)

    // The news, told once: a giggle for each turn finished, in order; a long turn's spectacle earns the shower in its giggle's place.
    for (let k = 0; k < (cue.spectacle ? cue.turnsEnded - 1 : cue.turnsEnded); k++) this.queue.push('giggle')
    if (cue.spectacle) this.queue.push('shower')
    // One at a time, once no other big moment plays and no petal is on its way to her nose; it waits for no calm.
    const news = this.playing(BIG) === undefined && this.noseAt === undefined ? this.queue.shift() : undefined
    if (news !== undefined) this.play(news, news === 'giggle' ? t + NEWS_DELAY : t)

    // What comes next: quiet is judged once, then each track in turn.
    const isQuiet = t >= this.calmUntil && !this.acts.some(act => BIG.has(act.kind) || act.kind === 'gust')
    if (t >= this.due.face) {
      if (mood === 'idle' && isQuiet) {
        const pick = this.roll()
        this.play(pick < 0.45 ? 'hum' : pick < 0.8 ? 'smile' : 'giggle', t)
      }
      this.due.face = t + this.gap('face')
    }
    if (t >= this.due.gust) {
      if (mood === 'idle' && isQuiet) this.blowGust(t)
      this.due.gust = t + this.gap('gust')
    }
    if (this.noseAt !== undefined && t >= this.noseAt - EDGE) {
      this.noseAt = undefined
      this.play('nose', t)
    }
    if (mood === 'idle' && t - this.idleFrom > DOZE_AFTER && isQuiet) {
      this.play('doze', t)
      this.idleFrom = t
    }
    if (mood === 'busy' && t >= this.due.peek) {
      if (isQuiet) this.play('peek', t)
      this.due.peek = t + this.gap('peek')
    }
    if (t >= this.due.glance) {
      this.aim(t)
      this.due.glance = t + this.gap('glance')
    }
    // Blinks: seldom; three in four her two-stage blink, one in four a droop; none while her eyes are held, nor just after.
    if (this.playing(HOLDS_BLINK) !== undefined) this.due.blink = Math.max(this.due.blink, t + HOLD_OFF)
    if (t >= this.due.blink) {
      this.play(this.roll() * 4 < 3 ? 'blink' : 'droop', t, mood === 'busy' || mood === 'ponder' ? 1 : 0)
      this.due.blink = t + this.gap('blink')
    }

    // Her pose: rest and the petals in her hair, her mood's eyes and mouth, her breath; her acts over them, blinks last.
    const pose: Pose = { ...REST, worn: hair(this.petals), air: [] }
    if (mood === 'idle') {
      // Left alone, her lids grow heavy; spacing out, heavier.
      const look = lookOf(this.glance, t - this.glance.at)
      const drowsy = clamp((t - this.idleFrom - DROWSY_FROM) / DROWSY_OVER, 0, 1)
      const lid = 0.1 + 0.36 * drowsy + (this.glance.kind === 'space' ? 0.22 : 0)
      pose.eyes = lid >= 0.425 ? (look === 'down' ? 'lowered' : 'half') : look
    } else if (mood === 'busy') pose.eyes = lookOf(this.glance, t - this.glance.at)
    else if (mood === 'ponder') pose.eyes = ponderAt(cue.since)
    else pose.mouth = syllableAt(cue.since)
    pose.breath = sighAt(t, mood === 'busy')
    for (const act of this.acts) if (act.kind !== 'blink' && act.kind !== 'droop') perform(act, t - act.at, pose)
    for (const act of this.acts) if (act.kind === 'blink' || act.kind === 'droop') perform(act, t - act.at, pose)
    return pose
  }
}
