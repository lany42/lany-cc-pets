// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The hamster's director: the clock, its mood and the news in, a pose out, 16
// times a second. Its moments come at irregular holds drawn from its seed
// (`hash`, never Math.random), so the same seed and cues give the same poses.
//
// - idle: it sits; blinks every 3-7 s (a fifth of them doubled), sniffs in
//   short bursts, glances at its bubble or away, pricks an ear; grooms its face
//   now and then when all is quiet; after 90 s alone it dozes, its z's
//   rising and its belly breathing slowly.
// - busy: it nibbles a seed held upright in its paws, in bursts of 1.2-2.6 s
//   with pauses between.
// - ponder: it pops up on its haunches, paws held up, and sniffs the air.
// - talk: it looks toward its bubble and squeaks in syllables.
// - a turn finished: it stuffs a seed into its cheek pouches, which puff out
//   a step; with them full, it first pushes them empty, the seeds flying out
//   one by one onto its hoard, each landing where it lies (nine fill it).
// - a long turn's spectacle: a happy hop.
//
// Moments wait for each other (news first, in order), so nothing crowds.
// Pure: imports nothing at run time but the shared hash and its art's sizes.
import { hash } from '../motion'
import type { Mouth, Pose } from './hamster'
import { CHEEKS_FULL, HOARD, MIDDLE, PILE_MOST, REST } from './hamster'
import type { Cue, Directing } from './pet'

/** Its frames a tick (its definition's `frames`), and so a second: one constant, so its acts' frames and its clock's agree. */
export const FRAMES = 4
export const FPS = FRAMES * 4
/** Its rolls' salt, its own. */
const SALT = 0x4a57

/** Its acts, and their lengths in seconds (a sniff's and a glance's are drawn). */
export type Kind = 'blink' | 'sniff' | 'glance' | 'ear' | 'groom' | 'stuff' | 'empty' | 'hop'
export const LENGTH: Readonly<Record<Kind, number>> = { blink: 0.25, sniff: 0.5, glance: 2, ear: 0.375, groom: 2.5, stuff: 1, empty: 2.75, hop: 1 }
/** The news it plays, one at a time, in order. */
const NEWS: readonly Kind[] = ['stuff', 'empty', 'hop']

/** An act playing: its kind, when it began, how long it lasts, and a roll drawn as it began. */
export type Act = { kind: Kind; at: number; length: number; roll: number }

/** Seconds alone before it dozes. */
export const DOZE_AFTER = 90
/** Seconds after grooming before it may groom again (or anything else big). */
const CALM = 6
/** A seed flies from its mouth to its hoard in this long, and the next leaves this long after. */
const FLIGHT = 0.45
const NEXT_SEED = 0.6

/** Its tracks: each due at a time, then due again a span later. */
type Track = 'blink' | 'sniff' | 'glance' | 'ear' | 'groom'

/** Where a flying seed is, `s` of the way from its mouth to where it lands on a hoard of `pile` seeds (on top, once full): an arc three pixels high. */
export function seedAt(s: number, pile: number): readonly [number, number] {
  const [x1, y1] = HOARD[Math.min(pile, PILE_MOST - 1)]!
  const x = Math.round(MIDDLE + (x1 - MIDDLE) * s)
  const y = Math.round(7 + (y1 - 7) * s - 12 * s * (1 - s))
  return [x, y]
}

/** Lays an act on `pose`, `u` seconds in, given what its cheeks and hoard held as it began: pure, so the studio can pose any moment of it. */
export function perform(act: Act, u: number, pose: Pose, held: { cheeks: number; pile: number }): void {
  switch (act.kind) {
    case 'blink':
      // Shut in a frame, held a frame, open in one more.
      pose.eyes = u < 1 / FPS ? 'half' : u < 3 / FPS ? 'shut' : 'half'
      break
    case 'sniff':
      // Its nostrils flared and back every frame.
      pose.nose = Math.floor(u * FPS + 1e-6) % 2 === 0 ? 1 : 0
      break
    case 'glance':
      pose.eyes = act.roll < 0.7 ? 'left' : 'right'
      break
    case 'ear':
      pose.ear = 1
      break
    case 'groom': {
      // Paws up, rubbing cheeks and eyes in turn four times a second, eyes shut; then paws down.
      const step = Math.floor(u * 4 + 1e-6)
      pose.eyes = 'shut'
      pose.paws = u < 0.25 || u >= act.length - 0.25 ? 'down' : step % 2 === 1 ? 'groom' : 'rub'
      pose.mouth = 'rest'
      break
    }
    case 'stuff': {
      // A seed to its mouth, in, and the cheek pops out a step past where it settles.
      const after = Math.min(CHEEKS_FULL, held.cheeks + 1)
      pose.paws = u < 0.125 || u >= 0.5 ? 'down' : 'seed'
      pose.turn = u < 0.3 ? 0 : 1
      pose.mouth = 'rest'
      pose.cheeks = u < 0.5 ? held.cheeks : u < 0.5 + 2 / FPS && after < CHEEKS_FULL ? after + 1 : after
      if (u >= 0.5 && u < 0.875) pose.eyes = 'happy'
      break
    }
    case 'empty': {
      // Paws on its cheeks, it pushes the seeds out one by one; each flies onto its hoard, landing where it lies.
      pose.paws = u < 2.2 ? 'push' : 'down'
      pose.mouth = 'rest'
      let out = 0
      let landed = 0
      for (let k = 0; k < held.cheeks; k++) {
        const launch = 0.3 + k * NEXT_SEED
        if (u < launch) continue
        out += 1
        if (u < launch + 0.15) pose.mouth = 'open'
        const s = (u - launch) / FLIGHT
        if (s < 1) pose.flying = seedAt(s, held.pile + k)
        else landed += 1
      }
      pose.cheeks = held.cheeks - out
      pose.pile = Math.min(PILE_MOST, held.pile + landed)
      if (u >= 2.2) pose.eyes = 'happy'
      break
    }
    case 'hop': {
      // Up a pixel and down, then a shorter bounce, eyes happy all through.
      const at = Math.floor(u * FPS + 1e-6)
      pose.hop = (at >= 1 && at < 6) || (at >= 9 && at < 11) ? 1 : 0
      pose.eyes = 'happy'
      pose.paws = 'tuck'
      break
    }
  }
}

export class HamsterDirector implements Directing<Pose> {
  private readonly seed: number
  private count = 0
  /** Its last frame's time; undefined before its first. */
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  private acts: Act[] = []
  private due: Record<Track, number> = { blink: 0, sniff: 0, glance: 0, ear: 0, groom: 0 }
  /** The news waiting its turn. */
  private queue: Kind[] = []
  /** What the news will leave its cheeks holding, once all of it has played. */
  private planned: number
  private cheeks: number
  private pile: number
  /** What its cheeks and hoard held as the news act playing began. */
  private held = { cheeks: 0, pile: 0 }
  /** No big moment before this. */
  private calmUntil = 0
  /** Busy: a nibbling burst or a pause, and when it ends. */
  private chew = { on: false, at: 0, until: 0 }
  /** Talking: the syllable it is on, when it began, how long it lasts, and its mouth. */
  private syllable = { at: 0, length: 0, open: 0.6, mouth: 'open' as Mouth }
  /** When it dozed off, and its z's' cycle. */
  private dozeAt: number | undefined
  private zCycle = 4.8

  constructor(seed: number, start: { cheeks: number; pile: number } = { cheeks: 0, pile: 0 }) {
    this.seed = seed
    this.cheeks = start.cheeks
    this.pile = start.pile
    this.planned = start.cheeks
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

  /** Its next gap on `track`, in the mood it is in. */
  private gap(track: Track): number {
    const mood = this.mood
    switch (track) {
      case 'blink':
        return mood === 'busy' ? this.span(2, 4.5) : mood === 'talk' ? this.span(2.5, 5) : this.span(3, 7)
      case 'sniff':
        return mood === 'ponder' ? this.span(1.2, 2.4) : this.span(4, 11)
      case 'glance':
        return this.span(6, 16)
      case 'ear':
        return this.span(14, 40)
      case 'groom':
        return this.span(35, 70)
    }
  }

  /** Starts over: first, or after a gap (hidden, asleep): its first times drawn afresh, no act playing, its cheeks and hoard kept. */
  private resync(t: number): void {
    this.acts = []
    this.queue = []
    this.planned = this.cheeks
    this.calmUntil = t
    this.dozeAt = undefined
    this.due = {
      blink: t + this.span(0.8, 2.4),
      sniff: t + this.span(2, 5),
      glance: t + this.span(4, 9),
      ear: t + this.span(8, 20),
      groom: t + this.span(20, 35),
    }
    this.chew = { on: false, at: t, until: t + 0.25 }
    this.syllable = { at: t, length: 0, open: 0.6, mouth: 'open' }
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (cue.mood !== this.mood) {
      this.mood = cue.mood
      this.chew = { on: false, at: t, until: t + 0.25 }
      this.syllable = { at: t, length: 0, open: 0.6, mouth: 'open' }
    }
    if (isFresh) this.resync(t)
    this.last = t

    // The news: a seed a turn finished, the cheeks pushed empty first when full; a spectacle's hop after.
    for (let k = 0; k < cue.turnsEnded; k++) {
      if (this.planned >= CHEEKS_FULL) {
        this.queue.push('empty')
        this.planned = 0
      }
      this.queue.push('stuff')
      this.planned += 1
    }
    if (cue.spectacle) this.queue.push('hop')

    // Acts that have ended leave what they did: a seed in its cheek, its cheeks emptied onto its hoard.
    for (const act of this.acts) {
      if (t < act.at + act.length) continue
      if (act.kind === 'stuff') this.cheeks = Math.min(CHEEKS_FULL, this.held.cheeks + 1)
      if (act.kind === 'empty') {
        this.cheeks = 0
        this.pile = Math.min(PILE_MOST, this.held.pile + this.held.cheeks)
      }
    }
    this.acts = this.acts.filter(act => t < act.at + act.length)
    let news = this.acts.find(act => NEWS.includes(act.kind))
    if (news === undefined && this.queue.length > 0) {
      const kind = this.queue.shift()!
      // News interrupts a groom, and waits for no calm.
      this.acts = this.acts.filter(act => act.kind !== 'groom')
      news = { kind, at: t, length: LENGTH[kind], roll: this.roll() }
      this.held = { cheeks: this.cheeks, pile: this.pile }
      this.acts.push(news)
      this.calmUntil = t + LENGTH[kind] + 2
      this.dozeAt = undefined
    }

    const mood = this.mood
    const since = cue.since
    const groom = this.playing('groom')
    // Dozing: alone long enough, nothing to do.
    const isDozing = mood === 'idle' && since >= DOZE_AFTER && news === undefined && groom === undefined
    if (isDozing && this.dozeAt === undefined) {
      this.dozeAt = t
      this.zCycle = this.span(4.4, 5.6)
    }
    if (!isDozing) this.dozeAt = undefined
    const isQuiet = t >= this.calmUntil && news === undefined && groom === undefined

    // Its tracks, in a fixed order: each due one plays if it may, else it waits a second.
    const ask = (track: Track, kind: Kind, may: boolean, length: () => number) => {
      if (t < this.due[track]) return
      if (!may) {
        this.due[track] = t + 1
        return
      }
      this.acts.push({ kind, at: t, length: length(), roll: this.roll() })
      const act = this.acts[this.acts.length - 1]!
      if (kind === 'groom') this.calmUntil = t + act.length + CALM
      this.due[track] = t + this.gap(track)
      // A fifth of its blinks come twice.
      if (kind === 'blink' && this.roll() < 0.2) this.due[track] = t + 0.4
    }
    const eyesFree = news === undefined && groom === undefined && !isDozing && this.playing('glance') === undefined
    ask('blink', 'blink', eyesFree && this.playing('blink') === undefined, () => LENGTH.blink)
    ask('sniff', 'sniff', !isDozing && groom === undefined && this.playing('sniff') === undefined, () => (mood === 'ponder' ? 0.375 : this.span(0.375, 0.625)))
    ask('glance', 'glance', mood === 'idle' && eyesFree && this.playing('blink') === undefined, () => this.span(1.2, 3.2))
    ask('ear', 'ear', !isDozing && this.playing('ear') === undefined, () => LENGTH.ear)
    ask('groom', 'groom', mood === 'idle' && isQuiet && !isDozing, () => LENGTH.groom)

    // The mood's own pose.
    const pose: Pose = { ...REST, cheeks: this.cheeks, pile: this.pile }
    if (mood === 'busy') {
      // A seed up to its mouth, then nibbling in bursts, lowered with its mouth open and up to it every other frame; pausing between, the seed held up.
      if (t >= this.chew.until) {
        const isChewing = !this.chew.on
        this.chew = { on: isChewing, at: t, until: t + (isChewing ? this.span(1.2, 2.6) : this.span(0.6, 1.8)) }
      }
      pose.paws = since < 0.125 ? 'down' : 'seed'
      pose.turn = this.chew.on ? Math.floor((t - this.chew.at) * (FPS / 2) + 1e-6) % 2 : 1
    } else if (mood === 'ponder') {
      pose.lift = 1
      pose.paws = 'tuck'
    } else if (mood === 'talk') {
      pose.eyes = 'left'
      // Syllables: open for the first part of each, a few of them wide.
      if (t >= this.syllable.at + this.syllable.length) {
        this.syllable = { at: t, length: this.span(0.19, 0.31), open: this.span(0.5, 0.7), mouth: this.roll() < 0.25 ? 'wide' : 'open' }
      }
      pose.mouth = t < this.syllable.at + this.syllable.length * this.syllable.open ? this.syllable.mouth : 'rest'
    } else if (isDozing) {
      // Its z's rise and go; its belly breathes in with the first of them.
      const phase = (t - this.dozeAt!) % this.zCycle
      pose.eyes = 'shut'
      pose.z = phase < 1.2 ? 1 : phase < 2.4 ? 2 : phase < 3.2 ? 3 : 0
      pose.breath = phase < 2.4 ? 1 : 0
    }

    // Its small moments over the mood, then the news over all.
    for (const act of this.acts) if (!NEWS.includes(act.kind)) perform(act, t - act.at, pose, this.held)
    if (news !== undefined) {
      pose.lift = 0
      perform(news, t - news.at, pose, this.held)
    }
    return pose
  }
}
