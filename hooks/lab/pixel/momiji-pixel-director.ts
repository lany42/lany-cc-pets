// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Momiji Pixel's director: the clock, her mood and the news in, a pose out,
// 16 times a second. She plays Momiji's acts, those of the rig pet `momiji`
// but its nod, timed to her own frames: each act's picks are written out
// here by time, frame by frame. Her moments come at irregular holds drawn
// from her seed (`hash`, never Math.random), so the same seed and cues give
// the same poses.
//
// - idle: she rests; blinks every 2.5-6 s (now and then twice); glances at
//   the person, aside or toward her bubble, holding each look 2.5-7 s; every
//   half minute or so a face (a smirk, a soft smile, or a beam with her eyes
//   shut in happy arcs). Her stray strand of bangs slips down over her left
//   eye a step at a time, and once it hangs there she tosses her head and it
//   flies back aside. Left alone long enough, she yawns.
// - busy: she reads along the prompt, her eyes on it in saccades; quicker
//   blinks; her strand keeps slipping.
// - ponder: she looks aside (her eyes have no pick for up).
// - talk: she looks at the person and talks, her mouth in syllables
//   (`syllable`) from when her line lands.
// - a turn finished: a soft smile; a long turn's spectacle: a wink.
//
// She does not breathe at rest: her director never sets `breath`, as a
// breath under a whole pixel draws nothing. Pure: imports nothing at run
// time but the shared hash and her art.
import { hash } from '../motion'
import type { Eyes, Mouth, Pose, Strand } from './momiji-pixel'
import { REST } from './momiji-pixel'
import type { Cue, Directing } from './pet'

/** Her frames a tick (her definition's `frames`), and so a second: one constant, so her acts' frames and her clock's agree. */
export const FRAMES = 4
export const FPS = FRAMES * 4
/** Her rolls' salt, her own. */
const SALT = 0x6d6a

/** Her acts, and their lengths in seconds; her blink, three of her frames. */
export type Kind = 'blink' | 'smile' | 'beam' | 'smirk' | 'slip' | 'toss' | 'yawn' | 'wink'
export const LENGTH: Readonly<Record<Kind, number>> = { blink: 3 / FPS, smile: 3.2, beam: 2.9, smirk: 3.4, slip: 0.9, toss: 1.25, yawn: 3.4, wink: 2.2 }

/** An act playing: its kind, when it begins, how long it lasts, and a roll drawn as it began. */
export type Act = { kind: Kind; at: number; length: number; roll: number }

/** Her bigger moments: after each, a calm (seconds) before the next. The news sets one too. */
export const BIG: readonly Kind[] = ['smile', 'beam', 'smirk', 'toss', 'yawn']
export const CALM = 6
/** Acts that hold her eyes: no blink of hers while they play. */
const HOLDS_EYES: readonly Kind[] = ['beam', 'toss', 'yawn', 'wink']
/** Her faces, which the news cuts short. */
const FACES: readonly Kind[] = ['smile', 'beam', 'smirk', 'yawn']
/** Seconds alone in idle before she yawns, and at most one yawn in this long. */
export const YAWN_AFTER = 75
const YAWN_EVERY = 300
/** A finished turn's smile comes this long after it: six of her frames, 0.375 s. */
export const NEWS_AFTER = 6 / FPS

type Track = 'blink' | 'glance' | 'face' | 'hair'

/** Whole frames into an act `u` seconds in, safe at a frame's edge. */
const frameOf = (u: number): number => Math.floor(u * FPS + 1e-6)

/** The strand a step further down over her eye: aside, half, over. */
export const slipped = (strand: Strand): Strand => (strand === 'aside' ? 'half' : 'over')

/** Her mouth `u` seconds into her line: syllables about four a second, wavering, in phrases; open while a syllable opens past 0.35. */
export function syllable(u: number): Mouth {
  const beat = Math.max(0, Math.sin(u * Math.PI * 2 * 4.3 + Math.sin(u * 2.3) * 1.5))
  const open = 0.62 * beat ** 0.8 * (0.65 + 0.35 * Math.sin(u * 1.9 + 1))
  return open > 0.35 ? 'open' : 'rest'
}

/** The toss's eyes by frame: open, then a dip half shut, shut through the toss, half, open. */
const TOSS_EYES: readonly (Eyes | undefined)[] = [undefined, undefined, 'half', 'shut', 'shut', 'shut', 'shut', 'half', 'half']

/** Lays an act on `pose`, `u` seconds in: pure, so the studio can pose any moment of it. Each pick is set by whole frames into the act. */
export function perform(act: Act, u: number, pose: Pose): void {
  if (u < 0) return
  const f = frameOf(u)
  switch (act.kind) {
    case 'blink':
      // Half, shut, half: a frame each.
      pose.eyes = f === 1 ? 'shut' : 'half'
      break
    case 'smile':
      // A soft smile, eyes open.
      if (f >= 3 && f < 48) pose.mouth = 'smile'
      break
    case 'beam':
      // The mouth first, then her eyes closed in happy arcs; released eyes first, mouth last.
      if (f >= 3 && f < 42) pose.eyes = 'happy'
      if (f >= 2 && f < 44) pose.mouth = 'smile'
      break
    case 'smirk':
      // A glance at the person first, then the corner of her mouth up.
      if (f >= 1 && f < 53) pose.eyes = 'open'
      if (f >= 2 && f < 50) pose.mouth = 'smirk'
      break
    case 'slip':
      // The strand slides a step further down over her eye.
      if (f >= 5) pose.strand = slipped(pose.strand)
      break
    case 'toss': {
      // A dip, her head tossed up and aside, eyes shut, the strand flung back aside; half the time she's pleased with it.
      pose.strand = f < 5 ? 'over' : f < 6 ? 'half' : 'aside'
      pose.eyes = TOSS_EYES[f] ?? pose.eyes
      pose.bob = f === 2 ? 1 : f === 4 ? -1 : 0
      pose.lean = f >= 4 && f < 7 ? 1 : 0
      if (act.roll < 0.5 && f >= 13 && f < 17) pose.mouth = 'smile'
      break
    }
    case 'yawn':
      // Eyes closing as her mouth opens wide, held, and released.
      if (f >= 3 && f < 37) pose.eyes = f < 5 || f >= 34 ? 'half' : f < 33 ? 'shut' : 'half'
      if (f >= 3 && f < 34) pose.mouth = f >= 6 && f < 31 ? 'wide' : 'open'
      break
    case 'wink':
      // Her left eye winked shut, and a smile.
      if (f >= 1 && f < 17) pose.eyes = 'wink'
      if (f >= 2 && f < 32) pose.mouth = 'smile'
      break
  }
}

export class MomijiPixelDirector implements Directing<Pose> {
  private readonly seed: number
  private count = 0
  /** Her last frame's time; undefined before her first. */
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  /** Her own acts playing (blinks, faces, the strand's, a yawn); the news is apart. */
  private acts: Act[] = []
  /** The news act playing, and the news waiting its turn. */
  private news: Act | undefined
  private queue: Kind[] = []
  private due: Record<Track, number> = { blink: 0, glance: 0, face: 0, hair: 0 }
  /** Where her eyes rest between acts: the last glance's (idle) or reading saccade's (busy). */
  private gaze: Eyes = 'open'
  /** The stray strand as it rests between acts: her story, kept across a restart. */
  private strand: Strand
  /** No bigger moment before this. */
  private calmUntil = 0
  private lastYawn = -Infinity
  /** Whether the blink due is the second of a double. */
  private isDouble = false

  constructor(seed: number, start: { strand: Strand } = { strand: 'aside' }) {
    this.seed = seed
    this.strand = start.strand
  }

  private roll(): number {
    return hash(this.seed, this.count++, SALT)
  }

  private span(a: number, b: number): number {
    return a + (b - a) * this.roll()
  }

  private playing(kinds: readonly Kind[], t: number): boolean {
    return this.acts.some(act => kinds.includes(act.kind) && t >= act.at) || (this.news !== undefined && kinds.includes(this.news.kind) && t >= this.news.at)
  }

  private start(kind: Kind, t: number): void {
    this.acts.push({ kind, at: t, length: LENGTH[kind], roll: this.roll() })
    if (BIG.includes(kind)) this.calmUntil = Math.max(this.calmUntil, t + LENGTH[kind] + CALM)
  }

  /** What an act leaves when it ends (or is cut short by a restart): a slip its step down, a toss the strand aside. */
  private commit(act: Act): void {
    if (act.kind === 'slip') this.strand = slipped(this.strand)
    if (act.kind === 'toss') this.strand = 'aside'
  }

  /** Starts over: first, or after a gap (hidden, asleep): the acts cut short committed, her first times drawn afresh; her strand and the news still queued kept. */
  private resync(t: number): void {
    for (const act of this.acts) this.commit(act)
    this.acts = []
    // A news act cut short has been told; what waits is kept.
    this.news = undefined
    this.calmUntil = t
    this.gaze = 'open'
    this.isDouble = false
    this.due = {
      blink: t + this.span(0.8, 2.5),
      glance: t + this.span(3, 8),
      face: t + this.span(9, 18),
      // Hanging over her eye, it is tossed soon.
      hair: t + (this.strand === 'over' ? this.span(2, 5) : this.span(10, 22)),
    }
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (cue.mood !== this.mood) {
      this.mood = cue.mood
      // A new mood looks anew: busy reads, idle glances.
      this.due.glance = t
    }
    if (isFresh) this.resync(t)
    this.last = t

    // The news: a smile a finished turn, a spectacle's wink after them.
    for (let k = 0; k < cue.turnsEnded; k++) this.queue.push('smile')
    if (cue.spectacle) this.queue.push('wink')

    // Acts that have ended leave what they did.
    for (const act of this.acts) if (t >= act.at + act.length) this.commit(act)
    this.acts = this.acts.filter(act => t < act.at + act.length)
    if (this.news !== undefined && t >= this.news.at + this.news.length) this.news = undefined
    if (this.news === undefined && this.queue.length > 0) {
      const kind = this.queue.shift()!
      // News first: it cuts short a face or a yawn and waits for no calm, then sets one.
      this.acts = this.acts.filter(act => !FACES.includes(act.kind))
      const at = kind === 'smile' ? t + NEWS_AFTER : t
      this.news = { kind, at, length: LENGTH[kind], roll: this.roll() }
      this.calmUntil = Math.max(this.calmUntil, at + LENGTH[kind] + CALM)
    }

    const mood = this.mood
    const isQuiet = () => t >= this.calmUntil && this.news === undefined && !this.acts.some(act => BIG.includes(act.kind) || act.kind === 'slip')
    // Her tracks, in a fixed order: each due one plays if it may, else it waits.
    const ask = (track: Track, may: boolean, wait: number, play: () => void) => {
      if (t < this.due[track]) return
      if (may) play()
      else this.due[track] = t + wait
    }
    ask('blink', !this.playing(HOLDS_EYES, t) && !this.playing(['blink'], t), 0.6, () => {
      this.start('blink', t)
      // Now and then twice, the second 0.45-0.52 s on; never three times.
      if (!this.isDouble && this.roll() < 0.15) {
        this.isDouble = true
        this.due.blink = t + this.span(0.45, 0.52)
      } else {
        this.isDouble = false
        this.due.blink = t + (mood === 'busy' ? this.span(2, 4.5) : this.span(2.5, 6))
      }
    })
    ask('glance', true, 1, () => {
      if (mood === 'busy') {
        // Reading along the prompt, down and toward her bubble, in saccades.
        this.gaze = this.roll() < 0.67 ? 'left' : 'open'
        this.due.glance = t + this.span(0.9, 2.6)
      } else {
        // At the person most of the time; aside; toward her bubble or down at the prompt.
        const r = this.roll()
        this.gaze = r < 0.55 ? 'open' : r < 0.75 ? 'right' : 'left'
        this.due.glance = t + this.span(2.5, 7)
      }
    })
    if (t >= this.due.face) {
      // Idle and quiet only: due in another mood, it is put off 40-80 s; due before she is quiet, a second.
      if (mood !== 'idle') this.due.face = t + this.span(40, 80)
      else if (!isQuiet()) this.due.face = t + 1
      else {
        this.start(this.roll() < 0.5 ? 'smirk' : this.roll() < 0.55 ? 'smile' : 'beam', t)
        this.due.face = t + this.span(22, 55)
      }
    }
    ask('hair', (mood === 'idle' || mood === 'busy') && isQuiet(), 1, () => {
      // Hanging over her eye, it is tossed aside; else it slips a step further down.
      const kind: Kind = this.strand === 'over' ? 'toss' : 'slip'
      const after = kind === 'toss' ? 'aside' : slipped(this.strand)
      this.start(kind, t)
      this.due.hair = t + (after === 'over' ? this.span(10, 24) : this.span(24, 48))
    })
    // Left alone long enough, now and then, she yawns.
    if (mood === 'idle' && cue.since >= YAWN_AFTER && t - this.lastYawn >= YAWN_EVERY && isQuiet()) {
      this.start('yawn', t)
      this.lastYawn = t
    }

    // The mood's own pose, from rest and her strand.
    const pose: Pose = { ...REST, strand: this.strand }
    if (mood === 'idle' || mood === 'busy') pose.eyes = this.gaze
    else if (mood === 'ponder') pose.eyes = 'right'
    else pose.mouth = syllable(cue.since)

    // Her acts over the mood, her blinks over them unless an act holds her eyes, then the news over all.
    const holdsEyes = this.playing(HOLDS_EYES, t)
    for (const act of this.acts) if (act.kind !== 'blink') perform(act, t - act.at, pose)
    if (!holdsEyes) for (const act of this.acts) if (act.kind === 'blink') perform(act, t - act.at, pose)
    if (this.news !== undefined) perform(this.news, t - this.news.at, pose)
    return pose
  }
}
