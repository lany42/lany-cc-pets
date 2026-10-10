// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The chameleon's director: the clock, its mood and the news in, a pose out,
// 16 times a second. Its moments come at irregular holds drawn from its seed
// (`hash`, never Math.random), so the same seed and cues give the same poses.
//
// - idle: it holds still on its twig. Its eye roams on its own, now and then
//   to a new spot, where it stays (sometimes two quick steps, scanning); it
//   blinks rarely, its turret pinching shut; now and then it sways once
//   toward its bubble, a leaf in a breeze. After minutes of quiet it goes
//   pale from its tail to its snout and shuts its eye, asleep, until
//   something wakes it.
// - busy: its eye scans in quick pairs, and it walks in place: lifts its
//   front foot, rocks forward and back once or twice, and sets it down,
//   with pauses between.
// - ponder: its front foot lifted and held mid-step, its eye toward its
//   bubble.
// - talk: its mouth opens a syllable at a time, its eye toward its bubble.
// - a turn finished: its eye turns back along its body and a new color
//   washes over it from snout to tail; it shuts its eye content, and keeps
//   the color. Its colors go round a cycle of six, its first drawn from its
//   seed. Asleep, the news wakes it in the new color.
// - a long turn's spectacle: it displays, its back raised, dark bars down
//   its flank and its mouth agape.
//
// Pure: imports nothing at run time but the shared hash and its art.
import { hash } from '../motion'
import type { Eye, Pose } from './chameleon'
import { COLORS, COLUMNS, PALE, REST } from './chameleon'
import type { Cue, Directing } from './pet'

/** Its frames a tick, and so a second (four ticks a second): one constant, so its acts' frames are its clock's. */
export const FRAMES = 4
export const FPS = FRAMES * 4
/** Its rolls' salt, its own. */
const SALT = 0xc4a3

export type Kind = 'blink' | 'sway' | 'step' | 'wash' | 'display' | 'doze' | 'wake'
/** Each act's length in seconds; a sway's and a step's are drawn for each (these are their longest). */
export const LENGTH: Readonly<Record<Kind, number>> = { blink: 0.375, sway: 0.75, step: 2.5, wash: 4.25, display: 3, doze: 5.5, wake: 1.25 }
/** An act: its kind, when it began, how long it lasts, its roll, and the skins it goes from and to (a wash, a doze, a wake). */
export type Act = { kind: Kind; at: number; length: number; roll: number; from: number; to: number }

/** Seconds after a big act (a wash, a display, a wake: one at a time, each cutting its small acts short) before a sway or a doze may start. */
const CALM = 7
/** The blink, frame by frame: its turret pinches shut in a frame, holds, and opens slowly back through the pinhole. */
const BLINK = ['pinch', 'shut', 'shut', 'shut', 'pinch', 'pinch'] as const
/** A wash: its eye turns back first, the color crosses it a column a frame, it looks a second along its new tail, then it shuts its eye content. */
const WASH_LOOK = 4
const WASH_DONE = WASH_LOOK + COLUMNS
const WASH_SMILE = WASH_DONE + 16
/** A doze: the pale creeps from its tail to its snout a column every three frames (slow, and so well inside the flash guard from its darkest color), then its eye pinches and shuts. */
const DOZE_CREEP = 3
const DOZE_PINCH = COLUMNS * DOZE_CREEP
const DOZE_SHUT = DOZE_PINCH + 8
/** A wake: its eye pinches open, then its color comes back from its snout two columns a frame. */
const WAKE_LOOK = 4
const WAKE_DONE = WAKE_LOOK + COLUMNS / 2

/** Where its eye roams, each spot's weight: mostly out at the person, toward its bubble and away. */
const ROAM: readonly (readonly [Eye, number])[] = [
  ['out', 4],
  ['fore', 3],
  ['aft', 3],
  ['up', 1],
  ['down', 1],
  ['fore-up', 1],
  ['fore-down', 1],
  ['aft-up', 1],
  ['aft-down', 1],
]

/** Whole frames into an act `u` seconds in, safe at a frame's edge. */
const frameOf = (u: number): number => Math.floor(u * FPS + 1e-6)

/** The color after `skin` in its cycle. */
export const nextColor = (skin: number): number => (skin + 1) % COLORS

/** Lays an act on `pose`, `u` seconds in: pure, so the studio can pose any moment of it. */
export function perform(act: Act, u: number, pose: Pose): void {
  const f = frameOf(u)
  switch (act.kind) {
    case 'blink':
      if (f < BLINK.length) pose.lid = BLINK[f]!
      break
    case 'sway':
      // Toward its bubble a pixel, held, and back, its feet on the twig.
      pose.lean = u < act.length - 0.25 ? 1 : 0
      break
    case 'step': {
      // Its front foot lifted, rocking forward and back once or twice, then set down.
      const down = frameOf(act.length) - 6
      if (f < down) pose.foot = 'lift'
      const rocks = act.roll < 0.5 ? 1 : 2
      for (let k = 0; k < rocks; k++) if (f >= 6 + 8 * k && f < 10 + 8 * k) pose.lean = 1
      break
    }
    case 'wash':
      pose.lid = 'open'
      pose.skin = act.from
      if (f < WASH_LOOK) pose.eye = 'aft'
      else if (f < WASH_DONE) {
        const at = f - WASH_LOOK + 1
        pose.wash = { to: act.to, at, from: 'snout' }
        pose.eye = at < COLUMNS / 2 ? 'aft' : 'aft-down'
      } else {
        pose.skin = act.to
        if (f < WASH_SMILE) pose.eye = 'aft-down'
        else pose.lid = 'smile'
      }
      break
    case 'display':
      // Its back raised; dark bars down its flank; its mouth agape; its eye on its bubble.
      pose.eye = 'fore'
      pose.lid = 'open'
      if (f < 44) pose.puff = 1
      if (f >= 4 && f < 40) pose.bars = 1
      if (f >= 8 && f < 32) pose.mouth = 'gape'
      break
    case 'doze':
      pose.skin = act.from
      if (f < DOZE_PINCH) {
        pose.wash = { to: act.to, at: COLUMNS - Math.floor(f / DOZE_CREEP), from: 'tail' }
        pose.lid = 'open'
        pose.eye = 'down'
      } else {
        pose.skin = act.to
        pose.lid = f < DOZE_SHUT ? 'pinch' : 'shut'
      }
      break
    case 'wake':
      pose.skin = act.from
      if (f < WAKE_LOOK) pose.lid = 'pinch'
      else if (f < WAKE_DONE) {
        pose.lid = 'open'
        pose.wash = { to: act.to, at: 2 * (f - WAKE_LOOK + 1), from: 'snout' }
      } else {
        pose.lid = 'open'
        pose.skin = act.to
      }
      break
  }
}

type Track = 'blink' | 'roam' | 'sway' | 'step'

export class ChameleonDirector implements Directing<Pose> {
  private readonly seed: number
  /** Its gallery card's: a wash within its first seconds, and again every few seconds. */
  private readonly isDemo: boolean
  private count = 0
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  /** Its story state: the color it wears, and whether it is asleep (pale). */
  private skin: number
  private asleep = false
  /** When its quiet began, how long a quiet it dozes after, and when its calm after a big act ends. */
  private quiet = 0
  private dozeAfter = 180
  private calm = 0
  private acts: Act[] = []
  private big: Act | undefined
  private queue: ('wash' | 'display')[] = []
  /** Where its eye rests between roams. */
  private gaze: Eye = 'out'
  private due: Record<Track, number> = { blink: 0, roam: 0, sway: 0, step: 0 }
  /** Talking: the syllable it is on. */
  private syllable = { at: 0, length: 0, open: 0.5 }
  private nextDemo = 0

  constructor(seed: number, isDemo = false) {
    this.seed = seed
    this.isDemo = isDemo
    this.skin = isDemo ? 0 : Math.floor(this.roll() * COLORS) % COLORS
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

  /** Its quiet starts over: a fresh doze time drawn. */
  private hush(t: number): void {
    this.quiet = t
    this.dozeAfter = this.span(150, 210)
  }

  /** A new spot for its eye, never the one it is on. */
  private roamTo(): Eye {
    const spots = ROAM.filter(([eye]) => eye !== this.gaze)
    let r = this.roll() * spots.reduce((sum, [, weight]) => sum + weight, 0)
    for (const [eye, weight] of spots) if ((r -= weight) < 0) return eye
    return spots[0]![0]
  }

  private gap(track: Track): number {
    const busy = this.mood === 'busy'
    switch (track) {
      case 'blink':
        // Now and then a second blink right after the first.
        return this.roll() < 0.12 ? this.span(0.3, 0.6) : busy ? this.span(3, 6) : this.span(5.5, 9)
      case 'roam':
        // Busy, it scans in quick pairs of saccades with holds between; at rest a quarter of its roams are such a pair.
        if (busy) return this.roll() < 0.45 ? this.span(0.25, 0.4) : this.span(1.8, 3.4)
        return this.roll() < 0.25 ? this.span(0.35, 0.6) : this.span(9.5, 13)
      case 'sway':
        return this.span(70, 120)
      case 'step':
        return this.span(4.5, 8)
    }
  }

  /** An act ends: what it changed is kept. */
  private end(act: Act, t: number): void {
    if (act.kind === 'wash' || act.kind === 'wake') {
      this.skin = act.to
      this.asleep = false
    } else if (act.kind === 'doze') this.asleep = true
    if (act.kind !== 'doze') this.calm = act.at + act.length + CALM
    this.hush(t)
  }

  /** Starts over: first, or after a gap (hidden): no small act playing, its first times drawn afresh; its color, its sleep and the news still queued kept, and a big act cut short kept as if it had ended, so no turn's color is lost. */
  private resync(t: number): void {
    if (this.big !== undefined) this.end(this.big, t)
    this.big = undefined
    this.acts = []
    this.calm = t
    this.hush(t)
    this.due = { blink: t + this.span(2, 5), roam: t + this.span(2, 6), sway: t + this.span(25, 50), step: t + this.span(0.5, 2) }
    this.syllable = { at: t, length: 0, open: 0.5 }
    this.nextDemo = t + 1
  }

  /** A small act from `t`, `length` long: its length, for its track's next time. */
  private play(kind: Kind, t: number, length: number): number {
    this.acts.push({ kind, at: t, length, roll: this.roll(), from: 0, to: 0 })
    return length
  }

  private begin(kind: Kind, t: number, from: number, to: number): void {
    this.big = { kind, at: t, length: LENGTH[kind], roll: this.roll(), from, to }
    // A big act cuts its small acts short.
    this.acts = []
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (cue.mood !== this.mood) {
      this.mood = cue.mood
      this.syllable = { at: t, length: 0, open: 0.5 }
      // A mood's own rhythms start over: its first step soon after work starts, its eye's next move soon.
      this.due.step = Math.min(this.due.step, t + this.span(0.4, 1.2))
      this.due.roam = Math.min(this.due.roam, t + this.span(0.3, 0.9))
      this.hush(t)
    }
    if (isFresh) this.resync(t)
    this.last = t

    // The news: a new color a finished turn; a spectacle's display after.
    for (let k = 0; k < cue.turnsEnded; k++) this.queue.push('wash')
    if (cue.spectacle) this.queue.push('display')
    if (this.isDemo && t >= this.nextDemo && this.queue.length === 0 && this.big === undefined) {
      this.queue.push('wash')
      this.nextDemo = t + this.span(7, 10)
    }

    if (this.big !== undefined && t >= this.big.at + this.big.length) {
      this.end(this.big, t)
      this.big = undefined
    }
    this.acts = this.acts.filter(act => t < act.at + act.length)

    const mood = this.mood
    if (this.big === undefined) {
      const news = this.queue[0]
      if (this.asleep && (mood !== 'idle' || news !== undefined)) {
        // Woken: by a turn's news straight into its next color, else back into its own.
        if (news === 'wash') this.begin(this.queue.shift()!, t, PALE, nextColor(this.skin))
        else this.begin('wake', t, PALE, this.skin)
      } else if (news !== undefined) {
        this.queue.shift()
        this.begin(news, t, this.skin, news === 'wash' ? nextColor(this.skin) : this.skin)
      } else if (mood === 'idle' && !this.asleep && t >= this.quiet + this.dozeAfter && t >= this.calm && this.acts.length === 0) {
        this.begin('doze', t, this.skin, PALE)
      }
    }

    // Its tracks, in a fixed order: each due one plays if it may, else it waits a second.
    const awake = this.big === undefined && !this.asleep
    // An act's own length counts before its gap: its next comes a pause after it ends.
    const ask = (track: Track, may: boolean, start: () => number) => {
      if (t < this.due[track]) return
      if (!may) {
        this.due[track] = t + 1
        return
      }
      this.due[track] = t + start() + this.gap(track)
    }
    const blinking = this.playing('blink') !== undefined
    ask('blink', awake && !blinking, () => this.play('blink', t, LENGTH.blink))
    ask('roam', awake && !blinking && (mood === 'idle' || mood === 'busy'), () => {
      this.gaze = this.roamTo()
      return 0
    })
    ask('sway', awake && mood === 'idle' && t >= this.calm && this.acts.length === 0, () => this.play('sway', t, this.span(0.5, LENGTH.sway)))
    ask('step', awake && mood === 'busy', () => this.play('step', t, this.span(1.8, LENGTH.step)))

    const pose: Pose = { ...REST, skin: this.asleep ? PALE : this.skin, eye: this.gaze }
    if (this.asleep) pose.lid = 'shut'
    if (mood === 'ponder') {
      // Mid-step, deciding: its foot held up, its eye on its bubble.
      pose.foot = 'lift'
      pose.eye = 'fore'
    } else if (mood === 'talk') {
      pose.eye = 'fore'
      if (t >= this.syllable.at + this.syllable.length) this.syllable = { at: t, length: this.span(0.32, 0.4), open: this.span(0.4, 0.48) }
      if (t < this.syllable.at + this.syllable.length * this.syllable.open) pose.mouth = 'open'
    }
    for (const act of this.acts) perform(act, t - act.at, pose)
    if (this.big !== undefined) perform(this.big, t - this.big.at, pose)
    return pose
  }
}
