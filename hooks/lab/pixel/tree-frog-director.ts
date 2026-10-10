// The tree frog's director: the clock, its mood and the news in, a pose out,
// 16 times a second. Its moments come at irregular holds drawn from its seed
// (`hash`, never Math.random), so the same seed and cues give the same poses.
//
// - idle: it sits; blinks every 3-8 s; glances at its bubble or away; now and
//   then its throat pumps.
// - busy: it watches for flies, its eyes darting every 0.6-1.6 s, its throat
//   pumping in bursts.
// - ponder: it rolls its eyes up.
// - talk: it looks toward its bubble and croaks, its vocal sac blowing up
//   for each.
// - a turn finished: a fly buzzes in from its bubble's side and it snaps it
//   out of the air with its tongue, then gulps, its eyes shut.
// - a long turn's spectacle: a hop.
//
// Pure: imports nothing at run time but the shared hash and its art.
import { hash } from '../motion'
import type { Eyes, Pose } from './tree-frog'
import { MOUTH, REST } from './tree-frog'
import type { Cue, Directing } from './pet'

/** Its frames a tick, and so a second (four ticks a second): one constant, so its acts' frames are its clock's. */
export const FRAMES = 4
export const FPS = FRAMES * 4
/** Its rolls' salt, its own. */
const SALT = 0x7f09

export type Kind = 'blink' | 'glance' | 'throat' | 'snap' | 'hop'
export const LENGTH: Readonly<Record<Kind, number>> = { blink: 0.25, glance: 2, throat: 0.5, snap: 1.3, hop: 0.75 }
const NEWS: readonly Kind[] = ['snap', 'hop']

export type Act = { kind: Kind; at: number; length: number; roll: number }

/** Where its snapped fly hangs when its tongue shoots: in front of it, on its mouth's line. */
const CATCH = { x: 2, y: MOUTH.y }
/** The fly's flight in, in seconds; then its tongue, frame by frame: out halfway, on the fly, back, nearly in; then the gulp. */
const FLIGHT = 0.8
const SHOT = [0.5, 1, 0.6, 0.2] as const

/** Whole frames into an act `u` seconds in, safe at a frame's edge. */
const frameOf = (u: number): number => Math.floor(u * FPS + 1e-6)

/** Lays an act on `pose`, `u` seconds in: pure, so the studio can pose any moment of it. */
export function perform(act: Act, u: number, pose: Pose): void {
  switch (act.kind) {
    case 'blink':
      // Half, shut, shut, half.
      pose.eyes = frameOf(u) === 0 || frameOf(u) >= 3 ? 'half' : 'shut'
      break
    case 'glance':
      pose.eyes = act.roll < 0.6 ? 'left' : 'right'
      break
    case 'throat':
      pose.throat = 1
      break
    case 'snap': {
      // A fly buzzes in from the left, wobbling, to just in front of it; it watches it come.
      pose.eyes = 'left'
      if (u < FLIGHT) {
        const s = u / FLIGHT
        pose.fly = [Math.round(CATCH.x * s), Math.round(1 + (CATCH.y - 1) * s + Math.sin(u * 14))]
        pose.buzz = frameOf(u) % 2
        break
      }
      // Its tongue shoots out to it, touches it, and comes back with it; then it gulps, eyes shut.
      const reach = MOUTH.x + 1 - CATCH.x
      const shot = frameOf(u - FLIGHT)
      if (shot < SHOT.length) {
        pose.mouth = 'open'
        pose.tongue = Math.round(reach * SHOT[shot]!)
        if (shot <= 1) {
          pose.fly = [CATCH.x, CATCH.y]
          pose.buzz = frameOf(u) % 2
        }
      } else pose.eyes = 'shut'
      break
    }
    case 'hop':
      // Up a pixel for four frames, mouth open, eyes on the person.
      pose.hop = frameOf(u) >= 1 && frameOf(u) < 5 ? 1 : 0
      pose.mouth = 'open'
      pose.eyes = 'open'
      pose.throat = 0
      break
  }
}

type Track = 'blink' | 'glance' | 'throat'

export class FrogDirector implements Directing<Pose> {
  private readonly seed: number
  private count = 0
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  private acts: Act[] = []
  private due: Record<Track, number> = { blink: 0, glance: 0, throat: 0 }
  private queue: Kind[] = []
  /** Busy: where its eyes are, and when they dart next; its throat's burst, on or off, until when. */
  private watch = { eyes: 'open' as Eyes, until: 0 }
  private pulse = { on: false, at: 0, until: 0 }
  /** Talking: the syllable it is on. */
  private syllable = { at: 0, length: 0, open: 0.5 }

  constructor(seed: number) {
    this.seed = seed
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
        return this.mood === 'busy' ? this.span(2, 5) : this.span(3, 8)
      case 'glance':
        return this.span(7, 15)
      case 'throat':
        return this.span(9, 20)
    }
  }

  /** Starts over: first, or after a gap (hidden, asleep): no act playing, its first times drawn afresh; the news still queued kept, so no turn's fly is lost. */
  private resync(t: number): void {
    this.acts = []
    this.due = { blink: t + this.span(1, 3), glance: t + this.span(4, 9), throat: t + this.span(6, 12) }
    this.watch = { eyes: 'open', until: t }
    this.pulse = { on: false, at: t, until: t + 0.5 }
    this.syllable = { at: t, length: 0, open: 0.5 }
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (cue.mood !== this.mood) {
      this.mood = cue.mood
      this.watch = { eyes: 'open', until: t }
      this.pulse = { on: false, at: t, until: t + 0.5 }
      this.syllable = { at: t, length: 0, open: 0.5 }
    }
    if (isFresh) this.resync(t)
    this.last = t

    // The news: a fly a finished turn; a spectacle's hop after.
    for (let k = 0; k < cue.turnsEnded; k++) this.queue.push('snap')
    if (cue.spectacle) this.queue.push('hop')
    this.acts = this.acts.filter(act => t < act.at + act.length)
    let news = this.acts.find(act => NEWS.includes(act.kind))
    if (news === undefined && this.queue.length > 0) {
      const kind = this.queue.shift()!
      news = { kind, at: t, length: LENGTH[kind], roll: this.roll() }
      this.acts.push(news)
    }

    const mood = this.mood
    // Its tracks, in a fixed order: each due one plays if it may, else it waits a second.
    const ask = (track: Track, kind: Kind, may: boolean, length: () => number) => {
      if (t < this.due[track]) return
      if (!may) {
        this.due[track] = t + 1
        return
      }
      this.acts.push({ kind, at: t, length: length(), roll: this.roll() })
      this.due[track] = t + this.gap(track)
    }
    const eyesFree = news === undefined && this.playing('glance') === undefined && this.playing('blink') === undefined
    ask('blink', 'blink', eyesFree, () => LENGTH.blink)
    ask('glance', 'glance', mood === 'idle' && eyesFree, () => this.span(1, 2.5))
    ask('throat', 'throat', mood === 'idle' && news === undefined && this.playing('throat') === undefined, () => LENGTH.throat)

    const pose: Pose = { ...REST }
    if (mood === 'busy') {
      // Watching for flies: its eyes dart, held between; its throat pulses in bursts.
      if (t >= this.watch.until) {
        const r = this.roll()
        this.watch = { eyes: r < 0.4 ? 'left' : r < 0.7 ? 'right' : 'open', until: t + this.span(0.6, 1.6) }
      }
      pose.eyes = this.watch.eyes
      if (t >= this.pulse.until) {
        const on = !this.pulse.on
        this.pulse = { on, at: t, until: t + (on ? this.span(1.2, 2.4) : this.span(1.5, 3)) }
      }
      pose.throat = this.pulse.on ? Math.floor((t - this.pulse.at) * 4 + 1e-6) % 2 : 0
    } else if (mood === 'ponder') {
      pose.eyes = 'up'
    } else if (mood === 'talk') {
      pose.eyes = 'left'
      if (t >= this.syllable.at + this.syllable.length) this.syllable = { at: t, length: this.span(0.22, 0.38), open: this.span(0.4, 0.65) }
      // Its vocal sac blown up for the first part of each croak.
      pose.throat = t < this.syllable.at + this.syllable.length * this.syllable.open ? 2 : 0
    }

    for (const act of this.acts) if (!NEWS.includes(act.kind)) perform(act, t - act.at, pose)
    if (news !== undefined) perform(news, t - news.at, pose)
    return pose
  }
}
