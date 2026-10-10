// Nightcat: a black cat on a rooftop, against the moon.
//
// The cat is never drawn. The moon is: a disc of dots with a soft dithered
// glow, cut off by a roofline. The cat is the hole in it, the place where the
// dots aren't, and its two eyes, the only dots of it, glow green. When it
// walks off the edge of the moon it is gone, all but its eyes in the dark;
// then it comes back and sits down again.
//
// Moods: idle, it sits, swishes its tail, blinks, flicks an ear, glances,
// and now and then goes for a walk off the moon and back. Busy, it watches
// your work (eyes left, tail twitching). Pondering, it tilts its head and
// looks up. Talking, it bobs and blinks slowly at you: the cat "I love you".
//
// The glow is an ordered (Bayer) threshold anchored to the canvas, so nothing
// boils: only the dots the cat covers or uncovers change between ticks.
import { bayer } from '../util'
import { cellsOf, Dots, hash, runsOf } from './dots'
import type { Drawing, ExperimentalPet, Moment } from './pet'

const MOON = 1
const EYE = 2
const PALETTE = [{}, { color: 'warning', dim: true as const }, { color: 'success', bold: true as const }]
/**
 * On a light theme a black cat that is a hole would be a white cat, so the
 * scene brings its own night: every cell gets the theme's `text` (near black
 * there) as background, the moon is drawn in `inverseText` and the eyes in a raw bright green (the patch is always dark).
 */
const NIGHT = [{ bg: 'text' }, { color: 'inverseText', dim: true as const, bg: 'text' }, { color: '#9be564', bold: true as const, bg: 'text' }]

const COLS = 17
const ROWS = 4
/** The rising moon: a disc centred on the roofline, so half of it shows; centre and radius in dots. */
const MX = 17
const MR = 15.5
/** Dots are about 1.1 times as tall as wide here (12 x 13.25 px at 40 px), so the disc is squashed to stay round. */
const ASPECT = 1.1
const GLOW = 3
/** The roofline: no moonlight at or below it. */
const ROOF = 15
const MY = ROOF

function moon(d: Dots): void {
  for (let y = 0; y < ROOF; y++) {
    for (let x = 0; x < d.w; x++) {
      const r = Math.hypot(x - MX, (y - MY) * ASPECT)
      const level = r <= MR ? 1 : Math.max(0, 1 - (r - MR) / GLOW) * 0.5
      if (level > 0 && bayer(x, y) < level) d.set(x, y, MOON)
    }
  }
}

// The cat, sitting, head facing you. '#' cat (a hole in the moon), '.' not cat.
// Its base sits on the roof. The head is a full cell row (art rows 2-5), so
// the eyes' cells hold no moonlight and can glow a colour of their own.
const SIT = [
  '.#......#.', // 0 ear tips
  '.##....##.', // 1
  '.########.', // 2 head
  '##########', // 3 eyes on this row and the next
  '##########', // 4
  '.########.', // 5
  '..######..', // 6 chin
  '...####...', // 7 chest
  '..######..', // 8
  '.########.', // 9
  '.########.', // 10
  '##########', // 11
  '##########', // 12 haunches
]
const SIT_EARFLICK = ['.#........', '.##....##.', ...SIT.slice(2)]
const SIT_TILT = ['..#.....#.', '.##....##.', ...SIT.slice(2)]
/** Eye dots of the sitting cat, relative to the art: two, each 1 wide and 2 tall. */
const SIT_EYES = [[2, 3], [7, 3]] as const

/** Tails from the right haunch, curling up against the moon: swish frames (rows from ROOF - 5). */
const TAILS = [
  ['............#', '...........##', '...........#.', '..........##.', '..........#..'],
  ['.............', '............#', '...........##', '..........##.', '..........#..'],
  ['.............', '.............', '............#', '..........###', '..........#..'],
  ['.............', '.............', '.............', '.............', '..........###'],
]

// Walking, side view, facing right, tail up; two strides.
const WALK = [
  [
    '#...............',
    '#...........#.#.',
    '#...........###.',
    '.#..........####',
    '.#..........###.',
    '..##########.##.',
    '..############..',
    '..###########...',
    '..#.##....#.##..',
    '..#..#....#..#..',
  ],
  [
    '.#..............',
    '#...........#.#.',
    '#...........###.',
    '#...........####',
    '.#..........###.',
    '..##########.##.',
    '..############..',
    '..###########...',
    '...#.#...##.#...',
    '...#..#..#..#...',
  ],
]
const WALK_EYE = [14, 3] as const

type Pose =
  | { kind: 'sit'; x: number; tail: number; ear?: boolean; tilt?: boolean; eyes: 'open' | 'shut' | 'slow'; look: -1 | 0 | 1 }
  | { kind: 'walk'; x: number; stride: number; flip: boolean }
  /** Gone behind the chimney: only its eyes show, at the chimney's edge (or not at all). */
  | { kind: 'hidden'; eyes: boolean }

/** A chimney on the roof, another hole in the moon: somewhere to go. */
const CHIMNEY = ['########', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.', '.######.']
const CHIMNEY_X = 24

function drawCat(p: Pose): Dots {
  const d = new Dots(COLS, ROWS)
  moon(d)
  d.stamp(CHIMNEY, CHIMNEY_X, ROOF - CHIMNEY.length, { '#': 0 })
  if (p.kind === 'sit') {
    const art = p.tilt ? SIT_TILT : p.ear ? SIT_EARFLICK : SIT
    const top = ROOF - art.length
    d.stamp(art, p.x, top, { '#': 0 })
    d.stamp(TAILS[p.tail]!, p.x, ROOF - 5, { '#': 0 })
    if (p.eyes !== 'shut') {
      SIT_EYES.forEach(([ex, ey], i) => {
        // a glance moves the eye on the far side one dot: each eye stays in its own cell
        const x = p.x + ex + (i === 1 && p.look < 0 ? -1 : 0) + (i === 0 && p.look > 0 ? 1 : 0)
        const y = top + ey - (p.tilt && i === 1 ? 1 : 0)
        d.set(x, y + 1, EYE)
        // a slow blink is half-shut: one dot instead of two
        if (p.eyes === 'open') d.set(x, y, EYE)
      })
    }
  } else if (p.kind === 'walk') {
    const art = WALK[p.stride % WALK.length]!
    const top = ROOF - art.length
    d.stamp(art, p.x, top, { '#': 0 }, p.flip)
    const ex = p.flip ? art[0]!.length - 1 - WALK_EYE[0] : WALK_EYE[0]
    d.set(p.x + ex, top + WALK_EYE[1], EYE)
  } else if (p.eyes) {
    // two eyes in the chimney's shadow (each in a cell of its own, so no moonlight turns green)
    for (const x of [CHIMNEY_X + 2, CHIMNEY_X + 5]) {
      d.set(x, 9, EYE)
      d.set(x, 10, EYE)
    }
  }
  return d
}

const HOME = 8

/** Idle, a 128-tick loop (32 s): sit, swish, blink, glance; every other loop, it goes behind the chimney and back. */
function idle(m: Moment): Pose {
  const loop = Math.floor(m.tick / 128)
  const k = m.tick % 128
  const walks = hash(loop, 11) < 0.5
  const tail = [0, 0, 1, 2, 3, 3, 2, 1][Math.floor(m.tick / 3) % 8]!
  const sit: Pose = { kind: 'sit', x: HOME, tail, eyes: 'open', look: 0 }
  if (walks && k >= 60 && k < 124) {
    const s = k - 60
    // up and along the roof to the chimney, one dot a tick, and into its shadow
    if (s < 16) return { kind: 'walk', x: HOME - 3 + s, stride: Math.floor(s / 2), flip: false }
    // gone; then eyes at the chimney's edge, blinking
    if (s < 28) return { kind: 'hidden', eyes: false }
    if (s < 44) return { kind: 'hidden', eyes: s !== 33 && s !== 40 }
    // and back out, the other way
    if (s < 60) return { kind: 'walk', x: HOME + 13 - (s - 44), stride: Math.floor(s / 2), flip: true }
    return { ...sit, eyes: 'shut' }
  }
  if (k === 12 || k === 50 || k === 51) return { ...sit, eyes: 'shut' }
  if (k >= 20 && k < 30) return { ...sit, look: -1 }
  if (k >= 30 && k < 33) return { ...sit, ear: true }
  if (k >= 40 && k < 46) return { ...sit, look: 1 }
  if (k >= 90 && k < 92) return { ...sit, ear: true }
  if (k === 100) return { ...sit, eyes: 'shut' }
  return sit
}

function draw(m: Moment): Drawing {
  let pose: Pose
  if (m.mood === 'busy') {
    // watching your work: eyes to the left, the tail-tip twitching quicker
    const tail = [0, 1, 0, 1, 2, 1][m.since % 6]!
    pose = { kind: 'sit', x: HOME, tail, eyes: m.since % 40 === 17 ? 'shut' : 'open', look: -1 }
  } else if (m.mood === 'ponder') {
    pose = { kind: 'sit', x: HOME, tail: 0, tilt: true, eyes: 'open', look: m.since % 6 < 3 ? 0 : 1 }
  } else if (m.mood === 'talk') {
    // slow blinks at you (a cat's "I like you"), an ear flick, the tail going
    const s = m.since
    pose = { kind: 'sit', x: HOME, tail: [0, 1, 2, 1][Math.floor(s / 2) % 4]!, ear: s % 8 === 5, eyes: s % 6 < 3 ? 'slow' : 'open', look: 0 }
  } else {
    pose = idle(m)
  }
  return { band: runsOf(cellsOf(drawCat(pose)), m.isLight ? NIGHT : PALETTE) }
}

export const pet: ExperimentalPet = {
  id: 'nightcat',
  name: 'Nightcat',
  persona: 'a black cat sitting on a rooftop in front of the moon, visible only as a cat-shaped gap in the moonlight',
  blurb: 'a cat made of the dots that are not there',
  color: 'warning',
  ownsBubble: false,
  rows: { rest: ROWS, most: ROWS },
  draw,
}
