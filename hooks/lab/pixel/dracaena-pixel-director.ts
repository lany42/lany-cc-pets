// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Dracaena Pixel's director: the clock, her mood and the news in, a pose
// out, 16 times a second. Her moments come at irregular holds drawn from her
// seed (`hash`, never Math.random), so the same seed and cues give the same
// poses.
//
// - idle: still, composed; a slow blink that closes into her haughty lash
//   curve every 6-9 s, now and then a flutter of her lashes after it; every
//   7-16 s one act from a pool of fourteen, drawn by weight from those not
//   among the last four played (so none repeats soon). Her story's warmth,
//   `thaw` 0-3, shows as her blush at rest, and the warmer she is the more
//   and the longer she steals peeks at the person.
// - busy: she reads a spellbook, her eyes running along its lines, a blink
//   as they return to each new one, turning a page now and then, peeking
//   over it at the bubble.
// - ponder: a finger at her lips, eyes up.
// - talk: half-lidded, her wand pointing at the bubble (cool); looking away
//   twirling her lock (warm).
// - a turn finished: by her thaw, a hmph, a peek-hmph, a fluster, or an
//   honest smile that she catches herself in; each warms her a step but the
//   last, which cools her back to 0. News that lands mid-peek catches her:
//   startled, then hmph.
// - a long turn's spectacle: the heart spell, a grand hair flip and ohoho,
//   rotated without a repeat, the heart spell first.
// - long quiet: a blushing yawn that ends in a real smile (90-130 s), then
//   a doze (160-210 s) she wakes from with a start (anything at all, or
//   after 45-90 s by herself, when the quiet starts over); every 4-6 minutes
//   without news she pats her cheeks and cools a step.
//
// Pure: imports nothing at run time but the shared hash and her art.
import { hash } from '../motion'
import type { Gaze, Pose, Spark } from './dracaena-pixel'
import { REST } from './dracaena-pixel'
import type { Cue, Directing } from './pet'

/** Her frames a tick, and so a second (four ticks a second). */
export const FRAMES = 4
export const FPS = FRAMES * 4
/** Her rolls' salt, her own. */
const SALT = 0xd4ac

export type Kind =
  | 'blink'
  | 'flutter'
  // The idle pool.
  | 'peek'
  | 'roll'
  | 'smirk'
  | 'pout'
  | 'sigh'
  | 'cross'
  | 'nails'
  | 'tie'
  | 'twirl'
  | 'tuck'
  | 'practice'
  | 'spark'
  | 'flip'
  | 'sneeze'
  // Quiet and the story.
  | 'yawn'
  | 'wake'
  | 'cool'
  // Busy.
  | 'page'
  | 'over'
  // News.
  | 'hmph'
  | 'peekHmph'
  | 'fluster'
  | 'dere'
  | 'caught'
  // Spectacles.
  | 'spell'
  | 'grand'
  | 'ohoho'

/** Each act's length in seconds (a peek's grows with her thaw, an over-the-book peek's is drawn). */
export const LENGTH: Readonly<Record<Kind, number>> = {
  blink: 0.3125,
  flutter: 0.125,
  peek: 1.6,
  roll: 1.5,
  smirk: 2.2,
  pout: 1.8,
  sigh: 1.5,
  cross: 3.5,
  nails: 2.6,
  tie: 1.4,
  twirl: 3.0,
  tuck: 1.4,
  practice: 2.6,
  spark: 2.4,
  flip: 1.6,
  sneeze: 1.6,
  yawn: 4.0,
  wake: 1.2,
  cool: 1.6,
  page: 0.375,
  over: 1.0,
  hmph: 2.4,
  peekHmph: 3.0,
  fluster: 3.2,
  dere: 4.4,
  caught: 2.6,
  spell: 5.0,
  grand: 2.5,
  ohoho: 2.5,
}

/** The idle pool and each act's weight (a peek's grows with her thaw). */
export const POOL: readonly { kind: Kind; weight: number }[] = [
  { kind: 'peek', weight: 2 },
  { kind: 'roll', weight: 2 },
  { kind: 'smirk', weight: 2 },
  { kind: 'pout', weight: 2 },
  { kind: 'sigh', weight: 2 },
  { kind: 'cross', weight: 2 },
  { kind: 'nails', weight: 1.5 },
  { kind: 'tie', weight: 1.5 },
  { kind: 'twirl', weight: 1.5 },
  { kind: 'tuck', weight: 1.5 },
  { kind: 'practice', weight: 1 },
  { kind: 'spark', weight: 1 },
  { kind: 'flip', weight: 1 },
  { kind: 'sneeze', weight: 0.5 },
]
/** How many of the last acts played the next may not be. */
export const NOT_AGAIN = 4

/** News: one at a time, cutting a small act short, waiting for no calm. */
const NEWS: ReadonlySet<Kind> = new Set<Kind>(['hmph', 'peekHmph', 'fluster', 'dere', 'caught', 'spell', 'grand', 'ohoho', 'wake'])
/** Big acts: a calm follows each. */
export const BIG: ReadonlySet<Kind> = new Set<Kind>([...NEWS, 'flip', 'yawn'])
/** The acts that change her story's warmth when they end. */
const STORY: ReadonlySet<Kind> = new Set<Kind>(['hmph', 'peekHmph', 'fluster', 'dere', 'caught', 'cool'])
/** Her spectacles, rotated without a repeat, the heart spell first. */
export const SHOWS: readonly Kind[] = ['spell', 'grand', 'ohoho']
/** The news act a finished turn plays at each thaw. */
const BY_THAW: readonly Kind[] = ['hmph', 'peekHmph', 'fluster', 'dere']

export type Act = { kind: Kind; at: number; length: number; roll: number; held: number }

/** Whole frames into an act `u` seconds in, safe at a frame's edge. */
const frameOf = (u: number): number => Math.floor(u * FPS + 1e-6)
const warmer = (thaw: number, by = 1): number => Math.min(3, thaw + by)

/** While a peek's eyes are on the person: news then catches her. */
export function isStealing(act: Act, u: number): boolean {
  return act.kind === 'peek' && u >= 0.4 && u < act.length - 0.5
}

/** Her thaw once `act` (begun at `held`) has ended. */
export function thawAfter(kind: Kind, held: number): number {
  switch (kind) {
    case 'hmph':
    case 'peekHmph':
    case 'fluster':
      return warmer(held)
    case 'dere':
      return 0
    case 'caught':
      return held === 3 ? 0 : warmer(held)
    case 'cool':
      return Math.max(0, held - 1)
    default:
      return held
  }
}

/** Chin up, face turned away, eyes shut proudly, a pout, arms crossed. */
function hmph(pose: Pose): void {
  pose.lids = 'proud'
  pose.turn = 1
  pose.tilt = -1
  pose.mouth = 'pout'
  pose.arms = 'crossed'
}

/** The long lock's flip by seconds in: lifting, flung, back through lifting, settling, hanging. */
function flipStage(v: number, flung = 0.4): number {
  if (v < 0) return 0
  if (v < 0.2) return 1
  if (v < 0.2 + flung) return 2
  if (v < 0.35 + flung) return 1
  if (v < 0.7 + flung) return 3
  return 0
}

/** The heart spell's fountain at her wand's tip, a pair of frames each. */
const FOUNTAIN: readonly (readonly Spark[])[] = [
  [[2, 2, 1]],
  [[2, 2, 2]],
  [
    [1, 1, 1],
    [2, 2, 0],
  ],
  [
    [0, 2, 1],
    [3, 0, 0],
  ],
  [
    [1, 0, 1],
    [2, 2, 1],
  ],
  [
    [3, 1, 1],
    [0, 3, 0],
  ],
  [[2, 2, 2]],
  [
    [1, 1, 1],
    [3, 2, 0],
  ],
]

/** The heart swiped into sparks flying out of the box, two pixels a frame. */
function burst(v: number): Spark[] {
  const k = frameOf(v)
  return [
    [1 - 2 * k, 1 - k, 1],
    [3 - k, 1 - 2 * k, 1],
    [2 - 2 * k, 3, 0],
  ]
}

/** Lays an act on `pose`, `u` seconds in, the story as it was when it began (`held`): pure, so a still can pose any moment of it. */
export function perform(act: Act, u: number, pose: Pose): void {
  const { held, length } = act
  switch (act.kind) {
    case 'blink': {
      // Half, then three frames shut in her proud curve (lashes down, a flick at the corner), then half.
      const f = frameOf(u)
      pose.lids = f === 0 || f >= 4 ? 'half' : 'proud'
      break
    }
    case 'flutter':
      // Her lashes dip once more, half shut for two frames.
      pose.lids = 'half'
      break
    case 'peek':
      // Turned away, her eyes slide back to the person and stay; then away again, as if they never had.
      pose.turn = 1
      if (u < 0.4) {
        pose.gaze = 'right'
        pose.mouth = 'pout'
      } else if (u < length - 0.5) {
        pose.gaze = 'left'
        pose.mouth = 'soft'
        if (held > 0) pose.blush = warmer(held)
      } else if (u < length - 0.2) {
        pose.gaze = 'right'
        pose.mouth = 'pout'
      } else {
        pose.turn = 0
        pose.gaze = 'right'
      }
      break
    case 'roll':
      pose.mouth = 'pout'
      if (u < 0.4) {
        pose.lids = 'half'
        pose.gaze = 'left'
      } else if (u < 0.9) pose.gaze = 'up'
      else if (u < 1.3) {
        pose.lids = 'half'
        pose.gaze = 'right'
      } else pose.lids = 'half'
      break
    case 'smirk':
      pose.lids = 'half'
      pose.gaze = 'left'
      if (u >= 0.2 && u < 2.0) {
        pose.mouth = 'smirk'
      }
      break
    case 'pout':
      pose.lids = 'half'
      pose.gaze = 'right'
      pose.mouth = 'pout'
      if (u >= 0.25 && u < 1.55) {
        pose.puff = 1
        pose.blush = warmer(held)
      }
      break
    case 'sigh':
      pose.lids = 'half'
      if (u >= 0.2 && u < 1.2) {
        pose.tilt = 1
        pose.gaze = 'down'
      }
      if (u >= 0.3 && u < 1.0) pose.mouth = 'o'
      break
    case 'cross':
      pose.arms = 'crossed'
      if (u >= 0.25 && u < length - 0.3) {
        pose.lids = 'half'
        pose.gaze = 'right'
        pose.tilt = -1
        pose.mouth = 'pout'
      }
      break
    case 'nails':
      if (u < length - 0.3) {
        pose.arms = 'nails'
        pose.lids = 'half'
        pose.gaze = 'left'
      }
      if (u >= 1.2 && u < 1.6) {
        // A glance to see if anyone noticed.
        pose.gaze = 'front'
        pose.mouth = 'smirk'
      }
      break
    case 'tie':
      // She looks herself over, head bowed; then chin up, pleased.
      if (u < 0.9) {
        pose.gaze = 'down'
        pose.tilt = 1
      } else {
        pose.lids = 'half'
        pose.tilt = -1
        pose.mouth = 'smirk'
      }
      break
    case 'twirl':
      pose.arms = u < length - 0.25 ? (frameOf(u) % 16 < 8 ? 'twirl' : 'twirl2') : 'down'
      pose.lids = 'half'
      pose.gaze = 'down'
      pose.mouth = 'pout'
      pose.blush = warmer(held)
      break
    case 'tuck':
      pose.lids = 'half'
      pose.gaze = 'right'
      if (u < 0.8) pose.arms = 'tuck'
      else if (u < 1.0) pose.glint = 1
      else pose.gaze = 'front'
      break
    case 'practice':
      // A look round, a secret honest smile, then caught by herself.
      if (u < 0.5) pose.gaze = 'left'
      else if (u < 0.8) pose.gaze = 'right'
      else if (u < 1.6) {
        pose.lids = 'happy'
        pose.mouth = 'smile'
        pose.blush = warmer(held)
      } else if (u < 1.9) {
        pose.lids = 'wide'
        pose.mouth = 'o'
        pose.blush = warmer(held)
      } else {
        pose.lids = 'half'
        pose.gaze = 'right'
        pose.mouth = 'pout'
      }
      break
    case 'spark': {
      // Her wand up, one spark twinkling at its tip: a dot, a star, a big star, a star, a dot.
      pose.arms = 'wand'
      pose.lids = 'half'
      pose.gaze = 'left'
      if (u >= 0.3 && u < 1.8) {
        pose.mouth = 'smirk'
        const size = [0, 1, 2, 1, 0, -1][Math.floor((u - 0.3) / 0.25 + 1e-6)] ?? -1
        if (size >= 0) pose.sparks = [[2, 2, size]]
      }
      break
    }
    case 'flip':
      pose.lids = 'proud'
      pose.tilt = -1
      pose.mouth = 'smirk'
      pose.hair = flipStage(u - 0.1)
      break
    case 'sneeze':
      if (u < 0.3) {
        pose.lids = 'half'
        pose.mouth = 'o'
      } else if (u < 0.5) {
        pose.lids = 'squeeze'
        pose.mouth = 'o'
        pose.turn = -1
        pose.tilt = 1
      } else if (u < 1.4) {
        // Who saw?
        pose.gaze = u < 1.0 ? 'left' : 'right'
        pose.blush = warmer(held, 2)
      }
      break
    case 'yawn':
      pose.blush = warmer(held)
      if (u < 0.3) pose.lids = 'half'
      else if (u < 2.0) {
        pose.lids = 'shut'
        pose.mouth = 'yawn'
        pose.tilt = -1
        if (u >= 0.8) pose.tear = 1
      } else if (u < 2.4) {
        pose.lids = 'shut'
        pose.tear = 1
      } else if (u < 3.6) pose.mouth = 'smile'
      else {
        pose.lids = 'half'
        pose.gaze = 'right'
      }
      break
    case 'wake':
      if (u < 0.5) {
        pose.lids = 'wide'
        pose.mouth = 'o'
        pose.mark = 'bang'
        pose.blush = warmer(held, 2)
      } else {
        pose.gaze = u < 0.85 ? 'left' : 'right'
        pose.mouth = 'pout'
        pose.blush = warmer(held)
      }
      break
    case 'cool':
      // She composes herself, eyes shut and chin up, a breath out; the blush fades a level.
      if (u < 1.2) {
        pose.lids = 'shut'
        pose.tilt = -1
        pose.mouth = u >= 0.4 && u < 0.9 ? 'o' : 'pout'
      }
      pose.blush = u < 0.8 ? held : thawAfter('cool', held)
      break
    case 'page':
      if (pose.arms === 'book') pose.page = frameOf(u) < 3 ? 1 : 2
      break
    case 'over':
      pose.lids = 'open'
      pose.gaze = 'left'
      if (held >= 2) pose.blush = warmer(held)
      break
    case 'hmph':
      if (u < 0.4) pose.gaze = 'left'
      else if (u < 0.6) {
        pose.arms = 'crossed'
        pose.gaze = 'right'
      } else if (u < 2.1) hmph(pose)
      else {
        pose.arms = 'crossed'
        pose.lids = 'half'
      }
      pose.blush = u < 1.2 ? held : warmer(held)
      break
    case 'peekHmph':
      if (u < 0.4) pose.gaze = 'left'
      else if (u < 1.6 || u >= 2.6) hmph(pose)
      else {
        // Her eyes slide back to the person: caught, and away again.
        pose.turn = 1
        pose.arms = 'crossed'
        if (u < 2.4) {
          pose.gaze = 'left'
          pose.mouth = 'soft'
        } else {
          pose.lids = 'squeeze'
          pose.mouth = 'o'
        }
      }
      pose.blush = u < 1.8 ? held : warmer(held)
      break
    case 'fluster':
      if (u < 0.5) {
        pose.gaze = 'left'
        pose.mouth = 'soft'
      } else if (u < 1.0) {
        pose.lids = 'happy'
        pose.mouth = 'smile'
      } else if (u < 1.3) {
        pose.lids = 'wide'
        pose.mouth = 'o'
      } else if (u < 2.8) {
        pose.gaze = 'right'
        pose.mouth = 'wobbly'
      } else {
        pose.lids = 'half'
        pose.gaze = 'right'
        pose.mouth = 'pout'
      }
      pose.blush = u < 1.0 ? held : 3
      break
    case 'dere': {
      // An honest smile; a little heart floats up from her toward the bubble; she sees it, and is caught.
      if (u < 0.4) pose.gaze = 'left'
      else if (u < 2.0) {
        pose.lids = 'happy'
        pose.mouth = 'smile'
      } else if (u < 2.6) {
        pose.lids = 'wide'
        pose.mouth = 'o'
        pose.mark = 'bang'
      } else if (u < 4.0) {
        hmph(pose)
        pose.hair = flipStage(u - 2.6)
      } else {
        pose.arms = 'crossed'
        pose.lids = 'half'
      }
      pose.blush = u < 3.6 ? 3 : u < 4.0 ? 2 : 1
      const k = frameOf(u - 0.8)
      if (k >= 0 && k < 10) pose.love = [k < 4 ? 1 : 0, 6 - k]
      break
    }
    case 'caught':
      if (u < 0.6) {
        pose.lids = 'wide'
        pose.mouth = 'o'
        pose.mark = 'bang'
      } else if (u < 2.2) {
        hmph(pose)
        pose.hair = flipStage(u - 0.6)
      } else {
        pose.arms = 'crossed'
        pose.lids = 'half'
      }
      pose.blush = u < 2.2 ? warmer(held, 2) : held === 3 ? 1 : warmer(held)
      break
    case 'spell':
      if (u < 3.6) pose.arms = 'wand'
      if (u < 2.4) {
        pose.lids = 'half'
        pose.gaze = 'left'
        pose.mouth = 'smirk'
      } else if (u < 2.6) pose.gaze = 'up'
      else if (u < 3.2) {
        pose.lids = 'wide'
        pose.mouth = 'o'
        pose.mark = 'bang'
      } else if (u < 3.6) {
        pose.lids = 'squeeze'
        pose.mouth = 'wobbly'
      } else hmph(pose)
      // The sparks: a fountain at the tip, the heart, pink as she blushes, burst when she swipes.
      if (u >= 0.4 && u < 1.4) pose.sparks = FOUNTAIN[Math.floor(frameOf(u - 0.4) / 2)] ?? []
      else if (u >= 1.4 && u < 2.6) pose.heart = 1
      else if (u >= 2.6 && u < 3.2) pose.heart = 2
      else if (u >= 3.2 && u < 3.6) pose.sparks = burst(u - 3.2)
      pose.blush = u < 2.6 ? held : u < 4.4 ? 3 : warmer(held)
      break
    case 'grand':
      pose.lids = u < 2.1 ? 'proud' : 'half'
      pose.tilt = -1
      pose.mouth = 'smirk'
      pose.hair = flipStage(u - 0.3, 0.6)
      if (u >= 0.6 && u < 1.2) pose.sparks = [[2, 1, frameOf(u) % 4 < 2 ? 1 : 2]]
      break
    case 'ohoho':
      pose.tilt = -1
      if (u < 2.2) pose.arms = 'cover'
      if (u < 0.3) pose.lids = 'half'
      else if (u < 2.2) {
        pose.lids = 'proud'
        pose.mouth = frameOf(u - 0.3) % 6 < 3 ? 'laugh' : 'grin'
      } else {
        pose.lids = 'half'
        pose.mouth = 'smirk'
      }
      break
  }
}

type Track = 'blink' | 'idle' | 'page' | 'over' | 'z'
type Item = 'turn' | 'spectacle' | 'wake'

/** Her eyes along a spellbook's line: left, middle, right, then the next line. */
const READ: readonly Gaze[] = ['left', 'front', 'right']

export class DracaenaDirector implements Directing<Pose> {
  private readonly seed: number
  /** A gallery card's director: a peek that gets caught, first thing. */
  private readonly isDemo: boolean
  private count = 0
  private last: number | undefined
  private mood: Cue['mood'] = 'idle'
  private acts: Act[] = []
  private due: Record<Track, number> = { blink: 0, idle: 0, page: 0, over: 0, z: 0 }
  private queue: Item[] = []
  private calmUntil = 0
  /** Her story: warmth 0-3, and the spectacles' rotation. */
  private thaw = 0
  private deck: Kind[] = []
  private shown: Kind | undefined
  /** The last acts from the idle pool, newest last. */
  private recent: Kind[] = []
  private flutter = false
  /** Quiet: since when, when she yawns and dozes, whether she has yawned, whether she dozes; when she cools. */
  private quietSince = 0
  private yawnAt = 0
  private dozeAt = 0
  private yawned = false
  private dozing = false
  private wakeAt = 0
  private zFrom = -1
  private coolAt = 0
  /** A gallery card's: the news that catches its peek, and the peek it starts with. */
  private demoNewsAt: number | undefined
  private forced: Kind | undefined
  /** Busy: where her eyes are on the line; ponder: where she looks; talk: its style, its syllable or pause, the syllables left in its phrase. */
  private read = { step: 0, until: 0 }
  private muse = { gaze: 'right' as Gaze, until: 0 }
  private talk = { style: 'lecture' as 'lecture' | 'mumble', at: 0, length: 0, open: 0.5, left: 4, first: true }
  /** A doze's z: since when, and how long each of its two shows. */
  private zLength = 1.2

  constructor(seed: number, isDemo = false) {
    this.seed = seed
    this.isDemo = isDemo
  }

  /** Her story's warmth now, 0-3: her blush at rest. */
  get warmth(): number {
    return this.thaw
  }

  /** The idle pool's acts she played last, newest last: the next is none of them. */
  get recentActs(): readonly Kind[] {
    return this.recent
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

  private start(kind: Kind, t: number, length = LENGTH[kind]): Act {
    const act = { kind, at: t, length, roll: this.roll(), held: this.thaw }
    this.acts.push(act)
    return act
  }

  /** The quiet starts over (news, another mood, a resync): its yawn and doze drawn afresh. */
  private hush(t: number): void {
    this.quietSince = t
    this.yawnAt = t + this.span(90, 130)
    this.dozeAt = t + this.span(160, 210)
    this.yawned = false
  }

  /** The next idle act: by weight, from the pool less the last few played. */
  private choose(): Kind {
    const open = POOL.filter(one => !this.recent.includes(one.kind))
    const weight = (one: { kind: Kind; weight: number }) => (one.kind === 'peek' ? one.weight + this.thaw : one.weight)
    let roll = this.roll() * open.reduce((sum, one) => sum + weight(one), 0)
    for (const one of open) {
      roll -= weight(one)
      if (roll < 0) return one.kind
    }
    return open[open.length - 1]!.kind
  }

  /** The next spectacle: the heart spell first, then each of the three once a round, never the same twice running. */
  private nextShow(): Kind {
    if (this.deck.length === 0) {
      const rest = this.shown === undefined ? SHOWS.slice(1) : [...SHOWS]
      for (let k = rest.length - 1; k > 0; k--) {
        const j = Math.floor(this.roll() * (k + 1))
        ;[rest[k], rest[j]] = [rest[j]!, rest[k]!]
      }
      if (rest[0] === this.shown) [rest[0], rest[1]] = [rest[1]!, rest[0]!]
      this.deck = this.shown === undefined ? ['spell', ...rest] : rest
    }
    const show = this.deck.shift()!
    this.shown = show
    return show
  }

  /** An act ends: what it did to her story kept, a calm after a big one. */
  private end(act: Act): void {
    if (STORY.has(act.kind)) this.thaw = thawAfter(act.kind, act.held)
    if (BIG.has(act.kind)) this.calmUntil = act.at + act.length + this.span(7.5, 9.5)
  }

  /** Starts over: first, after a gap or a jump back: no act playing, first times drawn afresh; her thaw, the news queued and the spectacles' rotation kept. */
  private resync(t: number): void {
    for (const act of this.acts) if (NEWS.has(act.kind) || act.kind === 'cool') this.end(act)
    this.acts = []
    this.calmUntil = t
    this.due = { blink: t + this.span(2.5, 4.5), idle: t + this.span(4, 9), page: t + this.span(5, 11), over: t + this.span(9, 18), z: t }
    this.flutter = false
    this.dozing = false
    this.zFrom = -1
    this.coolAt = t + this.span(240, 360)
    this.hush(t)
    this.restartMood(t)
    if (this.isDemo && this.last === undefined) {
      this.forced = 'peek'
      this.due.idle = t + 0.5
      this.demoNewsAt = t + 1.25
    }
  }

  private restartMood(t: number): void {
    this.read = { step: 0, until: t + this.span(1.0, 2.0) }
    this.muse = { gaze: 'right', until: t + this.span(1, 2) }
    this.talk = { style: this.thaw >= 2 ? 'mumble' : 'lecture', at: t, length: 0, open: 0.5, left: 3 + Math.floor(this.roll() * 3), first: true }
  }

  pose(cue: Cue): Pose {
    const { t } = cue
    const isFresh = this.last === undefined || t < this.last || t - this.last > 2
    if (isFresh) this.resync(t)
    if (cue.mood !== this.mood) {
      // Another mood: its rhythms start over, and the last mood's small acts end (a cut cooling still cools).
      this.mood = cue.mood
      for (const act of this.acts) if (act.kind === 'cool') this.end(act)
      this.acts = this.acts.filter(act => NEWS.has(act.kind) || act.kind === 'blink')
      this.restartMood(t)
      this.hush(t)
      this.due.page = t + this.span(5, 11)
      this.due.over = t + this.span(9, 18)
    }
    this.last = t
    const mood = this.mood

    // The news: a finished turn each, a spectacle; any of it wakes her first.
    if (this.demoNewsAt !== undefined && t >= this.demoNewsAt) {
      this.demoNewsAt = undefined
      this.queue.push('turn')
    }
    for (let k = 0; k < cue.turnsEnded; k++) this.queue.push('turn')
    if (cue.spectacle) this.queue.push('spectacle')
    if (this.dozing && (this.queue.length > 0 || mood !== 'idle' || cue.spoke || t >= this.wakeAt)) {
      this.dozing = false
      this.queue.unshift('wake')
    }
    if (cue.turnsEnded > 0 || cue.spectacle) this.hush(t)
    if (cue.turnsEnded > 0) this.coolAt = t + this.span(240, 360)

    // Acts that have run their length end.
    for (const act of this.acts) if (t >= act.at + act.length) this.end(act)
    this.acts = this.acts.filter(act => t < act.at + act.length)
    let news = this.acts.find(act => NEWS.has(act.kind))
    if (news === undefined && this.queue.length > 0) {
      const item = this.queue.shift()!
      const peek = this.playing('peek')
      const kind: Kind =
        item === 'wake' ? 'wake' : item === 'spectacle' ? this.nextShow() : peek !== undefined && isStealing(peek, t - peek.at) ? 'caught' : BY_THAW[this.thaw]!
      // A news act cuts every small act short; a cut cooling still cools. Waking starts the quiet over.
      for (const act of this.acts) if (act.kind === 'cool') this.end(act)
      this.acts = []
      if (kind === 'wake') this.hush(t)
      news = this.start(kind, t)
    }

    // Her tracks, in a fixed order: each due one plays if it may, else it waits a second.
    const isCalm = t >= this.calmUntil
    const isFree = news === undefined && this.acts.every(act => act.kind === 'blink' || act.kind === 'flutter' || act.kind === 'page')
    const isQuiet = mood === 'idle' && !this.dozing && news === undefined && this.acts.length === 0 && isCalm && this.queue.length === 0
    // Her blink, unhurried, out of a book (reading, she blinks as her eyes return to a new line: below).
    if (t >= this.due.blink && mood !== 'busy') {
      if (isFree && !this.dozing && this.playing('blink') === undefined && this.playing('flutter') === undefined) {
        // A blink; a fifth of them followed by a flutter of her lashes.
        const gap = () => this.span(6, 9)
        if (this.flutter) {
          this.flutter = false
          this.start('flutter', t)
          this.due.blink = t + gap()
        } else {
          this.start('blink', t)
          this.flutter = this.roll() < 0.2
          this.due.blink = t + (this.flutter ? this.span(0.31, 0.44) : gap())
        }
      } else {
        this.flutter = false
        this.due.blink = t + 1
      }
    }
    // Long quiet: the yawn, then the doze; and every few minutes without news, a step cooler.
    if (t >= this.coolAt) {
      if (this.thaw === 0) this.coolAt = t + this.span(240, 360)
      else if (this.dozing) {
        this.thaw -= 1
        this.coolAt = t + this.span(240, 360)
      } else if (isQuiet) {
        this.start('cool', t)
        this.coolAt = t + this.span(240, 360)
      }
    }
    if (isQuiet && this.acts.length === 0 && !this.yawned && t >= this.yawnAt) {
      this.yawned = true
      this.start('yawn', t)
    }
    if (isQuiet && this.acts.length === 0 && this.yawned && t >= this.dozeAt) {
      this.dozing = true
      this.wakeAt = t + this.span(45, 90)
      this.due.z = t + this.span(1.5, 3)
    }
    if (t >= this.due.idle) {
      if (isQuiet && this.acts.length === 0 && !this.dozing) {
        const kind = this.forced ?? this.choose()
        this.forced = undefined
        this.recent = [...this.recent, kind].slice(-NOT_AGAIN)
        const length = kind === 'peek' ? LENGTH.peek + 0.4 * this.thaw + 0.4 * this.roll() : LENGTH[kind]
        this.start(kind, t, length)
        this.due.idle = t + length + this.span(7, 16)
      } else this.due.idle = t + 1
    }
    if (mood === 'busy' && news === undefined) {
      if (t >= this.due.page) {
        if (this.playing('over') === undefined) {
          this.start('page', t)
          this.due.page = t + this.span(5, 11)
        } else this.due.page = t + 1
      }
      if (t >= this.due.over) {
        if (isFree) {
          const length = this.span(1.0, 1.6)
          this.start('over', t, length)
          this.due.over = t + length + this.span(9, 18)
        } else this.due.over = t + 1
      }
    }
    if (this.dozing && t >= this.due.z) {
      this.zFrom = t
      this.zLength = this.span(0.9, 1.5)
      this.due.z = t + this.span(6, 10)
    }

    // Her pose: rest and her warmth, the mood's picks, the small acts, the news over all.
    const pose: Pose = { ...REST, blush: this.thaw }
    if (mood === 'busy') {
      if (t >= this.read.until) {
        this.read = { step: (this.read.step + 1) % READ.length, until: t + this.span(1.0, 2.0) }
        // Her eyes back to the start of a new line: a blink.
        if (this.read.step === 0 && isFree && this.playing('blink') === undefined) this.start('blink', t)
      }
      pose.arms = 'book'
      pose.lids = 'half'
      pose.gaze = READ[this.read.step]!
    } else if (mood === 'ponder') {
      if (t >= this.muse.until) this.muse = { gaze: this.muse.gaze === 'right' ? 'up' : 'right', until: t + this.span(1, 2) }
      pose.arms = 'chin'
      pose.lids = 'half'
      pose.gaze = this.muse.gaze
    } else if (mood === 'talk') {
      // In phrases of 3-5 syllables, a pause after each.
      const talk = this.talk
      if (t >= talk.at + talk.length) {
        if (talk.length > 0) talk.first = false
        if (talk.left <= 0) Object.assign(talk, { at: t, length: this.span(0.4, 0.7), open: 0, left: 3 + Math.floor(this.roll() * 3) })
        else Object.assign(talk, { at: t, length: this.span(0.28, 0.4), open: this.span(0.52, 0.64), left: talk.left - 1 })
      }
      const isOpen = t < talk.at + talk.length * talk.open
      pose.lids = 'half'
      if (talk.style === 'lecture') {
        pose.arms = 'wand'
        pose.gaze = 'left'
        pose.mouth = isOpen ? 'o' : 'rest'
        if (talk.first) pose.sparks = [[2, 2, 1]]
      } else {
        pose.arms = 'twirl'
        pose.gaze = 'right'
        pose.mouth = isOpen ? 'open' : 'pout'
        pose.blush = warmer(this.thaw)
      }
    } else if (this.dozing) {
      pose.lids = 'shut'
      pose.tilt = 1
      if (this.zFrom >= 0 && t - this.zFrom < 2 * this.zLength) pose.mark = t - this.zFrom < this.zLength ? 'z' : 'zz'
    }
    for (const act of this.acts) if (act !== news) perform(act, t - act.at, pose)
    if (news !== undefined) perform(news, t - news.at, pose)
    return pose
  }
}
