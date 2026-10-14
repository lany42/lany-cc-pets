// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Pomelo Pixel's director: the clock, its mood and the news in, a pose out,
// 16 times a second. Its moments come at irregular holds drawn from its seed
// (`hash`, never Math.random), so the same seed and cues give the same poses.
// Placid and underwater: it rests utterly still, and every number sits at
// the slow, steady end of its range.
//
// - idle: its eyes rest ahead, and now and then go to one thing and come
//   back: up toward the surface most often, else low to one side, else
//   level to one side. A slow blink, sometimes twice. Rarely a face:
//   content (its eyes happy, its cheeks flushed, its gills perking tier by
//   tier) or curious (its head leant to one side, that side's gills perked).
//   Left alone for minutes, a stretch: its gills fan wide tier by tier and
//   its head lifts, then it all folds back and settles.
// - busy: it looks down at the prompt, its eyes moving along it; its top
//   gills perked, and now and then a ripple down them.
// - ponder: its lower gills folded back, its eyes up, thinking.
// - talk: at you, its mouth opening in slow, even syllables.
// - a turn finished: it lets go one bubble, its story. The bubble swells in
//   its round mouth, rises up the middle of its face, hangs swollen above its
//   head, wobbling, and pops; its eyes follow it, and at the pop its gills
//   flick wide and its eyes smile. Turns finished together are bubbles one
//   after another (three at most).
// - a long turn's spectacle: a happy wiggle, its head swaying side to side
//   with its gills swinging after it like weed in water.
//
// Pure: imports nothing at run time but the shared hash and its art.
import { hash } from '../motion'
import type { Fan, Gills, Lids, Pose } from './pomelo-pixel'
import { ON_BUBBLE, POP, REST } from './pomelo-pixel'
import type { Cue, Directing } from './pet'

/** Its frames a tick, and so a second (four ticks a second): one constant, so its acts' frames are its clock's. */
export const FRAMES = 4
export const FPS = FRAMES * 4
/** Its rolls' salt, its own. */
const SALT = 0x6a1e

export type Kind = 'blink' | 'glance' | 'content' | 'curious' | 'ripple' | 'bubble' | 'wiggle' | 'stretch'
/** Each act's length in seconds (a glance's is drawn each time; this is its longest). */
export const LENGTH: Readonly<Record<Kind, number>> = { blink: 0.375, glance: 2.875, content: 3.25, curious: 2.5, ripple: 1, bubble: 3.5, wiggle: 4.25, stretch: 4.5 }
/** Acts the news plays: a bubble a finished turn, the wiggle a spectacle. */
const NEWS: readonly Kind[] = ['bubble', 'wiggle']
/** Big acts, each followed by its calm: seconds in which no face, ripple or stretch may start. */
const BIG: readonly Kind[] = ['content', 'curious', 'bubble', 'wiggle', 'stretch']
export const CALM = 8
/** Acts that hold its lids: no blink starts while one plays, nor this soon after. */
const HOLDS_LIDS: readonly Kind[] = ['content', 'bubble', 'wiggle', 'stretch']
const HOLD_OFF = 0.4
/** The most bubbles waiting at once: turns finished together beyond these are let go unseen. */
const QUEUE = 3
/** Alone this long in idle (drawn each time, seconds), it stretches; then not again for a while. */
export const STRETCH_AFTER: readonly [number, number] = [120, 165]
const STRETCH_GAP: readonly [number, number] = [360, 540]

export type Act = { kind: Kind; at: number; length: number; roll: number }

/** Whole frames into an act `u` seconds in, safe at a frame's edge. */
const frameOf = (u: number): number => Math.floor(u * FPS + 1e-6)

/** Its blink, frame by frame: slow and even, its lid's edge down over the shine, then half, shut a while, and back up the same way. */
const BLINK: readonly Lids[] = ['lidded', 'half', 'shut', 'shut', 'half', 'lidded']

/** Both sides' gills as one spread. */
const both = (fan: Fan): Gills => [fan, fan, fan]
/** One side's gills with `fan` in the tiers from the top down to `upTo` (0 top, 1 mid, 2 low; below 0 none), the rest as they are. */
function sweep(gills: Gills, fan: Fan, upTo: number): Gills {
  return [upTo >= 0 ? fan : gills[0], upTo >= 1 ? fan : gills[1], upTo >= 2 ? fan : gills[2]]
}
/** One side's gills with `fan` in tier `k` alone. */
const tier = (gills: Gills, k: number, fan: Fan): Gills => [k === 0 ? fan : gills[0], k === 1 ? fan : gills[1], k === 2 ? fan : gills[2]]
/** How many tiers a sweep starting at `start`, a tier every `step` seconds, has reached at `u`: -1 none yet, 2 all. */
const reached = (u: number, start: number, step: number): number => Math.min(2, Math.floor((u - start) / step + 1e-6))

/** The bubble, frame by frame from its start: its step at each frame (0 none), as the art numbers them. */
const BUBBLE_STEPS: readonly number[] = (() => {
  const steps: number[] = []
  const hold = (step: number, frames: number) => {
    for (let k = 0; k < frames; k++) steps.push(step)
  }
  // Its mouth rounds; the bubble swells in it, then bulges from its lips.
  hold(0, 3)
  hold(1, 8)
  hold(2, 8)
  // Let go: up the middle of its face, a pixel or two a frame.
  for (const step of [3, 4, 5, 6, 7]) hold(step, 1)
  // Swollen above its head, wobbling a pixel each way, slowly.
  for (const step of [8, 7]) hold(step, 6)
  // It pops: a ring of dashes, spreading, gone.
  hold(POP, 2)
  hold(POP + 1, 2)
  return steps
})()
/** The frame its bubble pops, from the act's start. */
export const POPS_AT = BUBBLE_STEPS.indexOf(POP)

/** Lays an act on `pose`, `u` seconds in: pure, so the studio can pose any moment of it. */
export function perform(act: Act, u: number, pose: Pose): void {
  const f = frameOf(u)
  const end = act.length - u
  switch (act.kind) {
    case 'blink':
      if (pose.lids === 'open') pose.lids = BLINK[f] ?? 'open'
      break
    case 'glance': {
      // To one thing and back: up toward the surface, low to one side (as at something sinking past), or level to one side.
      const r = act.roll
      if (r < 0.55) [pose.lookX, pose.lookY] = [0, -1]
      else if (r < 0.88) [pose.lookX, pose.lookY] = [r < 0.715 ? -1 : 1, 1]
      else [pose.lookX, pose.lookY] = [r < 0.94 ? -1 : 1, 0]
      break
    }
    case 'content':
      // A smile first, then its eyes happy and its cheeks flushed, its gills perking tier by tier; all of it going in its last half second.
      if (end < 0.5) break
      pose.mouth = 'smile'
      if (u >= 0.25) {
        pose.lids = 'happy'
        pose.blush = 1
      }
      pose.left = sweep(pose.left, 'perk', reached(u, 0.375, 0.125))
      pose.right = sweep(pose.right, 'perk', reached(u, 0.375, 0.125))
      break
    case 'curious': {
      // Its head leant to one side, its eyes that way, the gills on that side perked like an ear.
      if (u < 0.125 || end < 0.375) break
      const side = act.roll < 0.5 ? -1 : 1
      pose.lean = side
      pose.lookX = side
      pose.lookY = 0
      if (side < 0) pose.left = sweep(pose.left, 'perk', reached(u, 0.25, 0.125))
      else pose.right = sweep(pose.right, 'perk', reached(u, 0.25, 0.125))
      break
    }
    case 'ripple':
      // A ripple down its gills, top to low: each tier perked for a moment.
      for (let k = 0; k < 3; k++) {
        if (u >= k * 0.1875 && u < k * 0.1875 + 0.4375) {
          pose.left = tier(pose.left, k, 'perk')
          pose.right = tier(pose.right, k, 'perk')
        }
      }
      break
    case 'bubble': {
      const step = BUBBLE_STEPS[f] ?? 0
      pose.bubble = step
      if (f < POPS_AT) {
        // Its mouth round while the bubble is in it; its eyes on the bubble all the way.
        if (step <= 2) pose.mouth = 'oh'
        const look = ON_BUBBLE[Math.max(0, step - 1)]!
        pose.lookX = look[0]
        pose.lookY = look[1]
        break
      }
      // At the pop: its gills flick wide and settle, its eyes smile up, then it is itself again.
      const since = f - POPS_AT
      if (since < 20) {
        pose.lookX = 0
        pose.lookY = since < 6 ? -1 : 0
        pose.lids = since >= 2 ? 'happy' : pose.lids
        pose.mouth = 'smile'
      }
      const fan: Fan = since < 6 ? 'wide' : since < 14 ? 'perk' : 'rest'
      if (since < 20) {
        pose.left = both(fan)
        pose.right = both(fan)
      }
      break
    }
    case 'wiggle': {
      // A happy wiggle: its head swaying side to side, a pixel each way, its gills swinging after it; slowing, then still.
      if (end < 0.375) break
      pose.lids = 'happy'
      pose.mouth = u < 0.5 ? 'ajar' : 'smile'
      pose.blush = 1
      pose.lookX = 0
      pose.lookY = 0
      // Eight sways of seven frames, each leaning five and passing upright for two, as a head swinging through the middle does.
      const frames = frameOf(u - 0.25)
      const beat = Math.floor(frames / 7)
      const lean = u < 0.25 || beat >= 8 || frames % 7 >= 5 ? 0 : beat % 2 === 0 ? -1 : 1
      pose.lean = lean
      // The water swings its gills the other way: the side it leans to perks, the far side fans wide (and both fan wide when it is upright).
      const near: Gills = ['perk', 'perk', 'fold']
      pose.left = lean < 0 ? near : both('wide')
      pose.right = lean > 0 ? near : both('wide')
      break
    }
    case 'stretch': {
      // A long stretch: its gills fan wide tier by tier, its eyes shut and its mouth round; held; then they fold back tier by tier and its head lifts a pixel on its neck, eyes half shut; it settles, then its gills hang again, tier by tier.
      if (u < 2.75) {
        pose.left = sweep(pose.left, 'wide', reached(u, 0.25, 0.25))
        pose.right = sweep(pose.right, 'wide', reached(u, 0.25, 0.25))
      } else {
        const fold = reached(u, 2.75, 0.1875)
        const back = reached(u, 4, 0.125)
        const fan = (k: number): Fan => (back >= k ? 'rest' : fold >= k ? 'fold' : 'wide')
        pose.left = [fan(0), fan(1), fan(2)]
        pose.right = [fan(0), fan(1), fan(2)]
      }
      // Its eyes shut and its mouth round as it reaches, half shut as it settles.
      if (u >= 0.5 && u < 2.75) {
        pose.lids = 'shut'
        pose.mouth = u < 2.25 ? 'oh' : 'rest'
      } else if (u >= 2.75 && u < 3.875) pose.lids = 'half'
      if (u >= 3.25 && u < 3.875) pose.breath = 1
      break
    }
  }
}

type Track = 'blink' | 'glance' | 'face' | 'ripple'

export class PomeloPixelDirector implements Directing<Pose> {
  private readonly seed: number
  private readonly isDemo: boolean
  private count = 0
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  private acts: Act[] = []
  private due: Record<Track, number> = { blink: 0, glance: 0, face: 0, ripple: 0 }
  private queue: Kind[] = []
  /** When the last big act ends, plus its calm. */
  private calmUntil = Number.NEGATIVE_INFINITY
  /** When the last blink-holding act ends. */
  private lidsFree = Number.NEGATIVE_INFINITY
  /** Its stretch: alone how long it waits for it (drawn each time), and when it last stretched. */
  private stretch = { after: 150, gap: 450, last: Number.NEGATIVE_INFINITY }
  /** When the last news came: it is alone only since then. */
  private lastNews = Number.NEGATIVE_INFINITY
  /** Busy: where along the prompt its eyes are, and when they move next. */
  private reading = { x: 0, until: 0 }
  /** Talking: the syllable it is on. */
  private syllable = { at: 0, length: 0, open: 0.5, wide: false }
  /** Its card's: when the next bubble comes. */
  private nextDemo = 0

  constructor(seed: number, isDemo = false) {
    this.seed = seed
    this.isDemo = isDemo
  }

  private roll(): number {
    return hash(this.seed, this.count++, SALT)
  }

  private span(a: number, b: number): number {
    return a + (b - a) * this.roll()
  }

  private playing(kind: Kind): Act | undefined {
    return this.acts.find(act => act.kind === kind)
  }

  private gap(track: Track): number {
    switch (track) {
      case 'blink':
        return this.mood === 'busy' ? this.span(4, 6.5) : this.span(7, 9)
      case 'glance':
        // Its eyes rest ahead a while between looks: the look's own length is added when it starts.
        return this.span(7, 11)
      case 'face':
        return this.span(60, 80)
      case 'ripple':
        return this.span(8, 18)
    }
  }

  /** Starts a mood's own rhythms afresh: an idle glance ends with its mood. */
  private moodStarts(t: number): void {
    this.acts = this.acts.filter(act => act.kind !== 'glance')
    this.reading = { x: 0, until: t + this.span(0.6, 1.2) }
    this.syllable = { at: t + 0.3125, length: 0, open: 0.5, wide: false }
  }

  /** Starts over: first, or after a gap (hidden, asleep): no act playing, its first times drawn afresh and sooner; the news still queued kept. */
  private resync(t: number): void {
    this.acts = []
    this.due = { blink: t + this.span(0.6, 1.6), glance: t + this.span(5.5, 10), face: t + this.span(35, 55), ripple: t + this.span(3, 6) }
    this.stretch = { ...this.stretch, after: this.span(...STRETCH_AFTER), gap: this.span(...STRETCH_GAP) }
    this.nextDemo = t + 1
    this.moodStarts(t)
  }

  /** Plays `kind` from `t`, a big one setting the calm after it. */
  private start(kind: Kind, t: number, length = LENGTH[kind]): Act {
    const act = { kind, at: t, length, roll: this.roll() }
    this.acts.push(act)
    if (BIG.includes(kind)) this.calmUntil = Math.max(this.calmUntil, t + length + CALM)
    if (HOLDS_LIDS.includes(kind)) this.lidsFree = Math.max(this.lidsFree, t + length + HOLD_OFF)
    return act
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (cue.mood !== this.mood) {
      this.mood = cue.mood
      this.moodStarts(t)
    }
    if (isFresh) this.resync(t)
    this.last = t

    // The news: a bubble a finished turn (three waiting at most), a spectacle's wiggle; its card's own bubbles.
    for (let k = 0; k < cue.turnsEnded; k++) if (this.queue.filter(kind => kind === 'bubble').length < QUEUE) this.queue.push('bubble')
    if (cue.spectacle) this.queue.push('wiggle')
    if (cue.turnsEnded > 0 || cue.spectacle || cue.spoke) this.lastNews = t
    if (this.isDemo && t >= this.nextDemo) {
      this.queue.push('bubble')
      this.nextDemo = t + this.span(14, 18)
    }
    this.acts = this.acts.filter(act => t < act.at + act.length)
    let news = this.acts.find(act => NEWS.includes(act.kind))
    if (news === undefined && this.queue.length > 0) {
      // A news act cuts every other act short, and a doubled blink still to come with them: only a blink under way plays on.
      this.acts = this.acts.filter(act => act.kind === 'blink' && act.at <= t)
      news = this.start(this.queue.shift()!, t)
    }

    const mood = this.mood
    const quiet = news === undefined && t >= this.calmUntil && !this.acts.some(act => BIG.includes(act.kind))
    // Its tracks, in a fixed order: each due one plays if it may, else it tries again a second later; the next is due its gap after (after the act, for one that says how long it holds).
    const ask = (track: Track, may: boolean, play: () => number) => {
      if (t < this.due[track]) return
      if (!may) {
        this.due[track] = t + 1
        return
      }
      const holds = play()
      this.due[track] = t + holds + this.gap(track)
    }
    const eyesFree = t >= this.lidsFree && !this.acts.some(act => HOLDS_LIDS.includes(act.kind)) && this.playing('blink') === undefined
    ask('blink', eyesFree, () => {
      this.start('blink', t)
      // Sometimes twice.
      if (this.roll() < 0.1) this.acts.push({ kind: 'blink', at: t + this.span(0.6, 0.75), length: LENGTH.blink, roll: 0 })
      return 0
    })
    ask('glance', mood === 'idle' && news === undefined && this.playing('glance') === undefined && this.playing('curious') === undefined, () => {
      return this.start('glance', t, this.span(1.875, 2.875)).length
    })
    ask('face', mood === 'idle' && quiet, () => {
      this.acts = this.acts.filter(act => act.kind !== 'glance')
      this.start(this.roll() < 0.7 ? 'content' : 'curious', t)
      return 0
    })
    ask('ripple', mood === 'busy' && quiet && this.playing('ripple') === undefined, () => {
      this.start('ripple', t)
      return 0
    })
    // Left alone a long while (in idle, and no news since), a stretch: at most once in minutes.
    const alone = Math.min(cue.since, t - this.lastNews)
    if (mood === 'idle' && quiet && alone >= this.stretch.after && t - this.stretch.last >= this.stretch.gap) {
      this.acts = this.acts.filter(act => act.kind !== 'glance')
      this.start('stretch', t)
      this.stretch = { after: this.span(...STRETCH_AFTER), gap: this.span(...STRETCH_GAP), last: t }
    }

    const pose: Pose = { ...REST }
    if (mood === 'busy') {
      // Reading the prompt: its eyes down, moving along it now and then; its top gills perked.
      if (t >= this.reading.until) {
        // Always a new place: from the middle to either side, from a side mostly back to the middle.
        const r = this.roll()
        const x = this.reading.x === 0 ? (r < 0.5 ? -1 : 1) : r < 0.7 ? 0 : -this.reading.x
        this.reading = { x, until: t + this.span(1.25, 2.25) }
      }
      pose.lookX = this.reading.x
      pose.lookY = 1
      pose.left = ['perk', 'rest', 'rest']
      pose.right = ['perk', 'rest', 'rest']
    } else if (mood === 'ponder') {
      // Thinking: its middle and low gills folded back (its top ones still hang), its eyes up.
      pose.lookY = -1
      pose.left = ['rest', 'fold', 'fold']
      pose.right = ['rest', 'fold', 'fold']
    } else if (mood === 'talk') {
      // Slow, even syllables after a breath's pause, every other one a little wider.
      if (t >= this.syllable.at + this.syllable.length) this.syllable = { at: t, length: this.span(0.26, 0.3), open: this.span(0.6, 0.7), wide: !this.syllable.wide }
      const isOpen = t >= this.syllable.at && t < this.syllable.at + this.syllable.length * this.syllable.open
      pose.mouth = isOpen ? (this.syllable.wide ? 'open' : 'ajar') : 'rest'
    }

    for (const act of this.acts) if (!NEWS.includes(act.kind)) perform(act, t - act.at, pose)
    if (news !== undefined) perform(news, t - news.at, pose)
    return pose
  }
}
