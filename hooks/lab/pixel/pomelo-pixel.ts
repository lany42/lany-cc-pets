// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Pomelo Pixel: Pomelo, the pink axolotl, front-on in hand-drawn pixel art
// 24 pixels wide and 12 tall: a broad head, three feathery gills a side, dot
// eyes with one shine and a wide shallow smile, its hands at the bottom
// edge, and three rows of clear water above its crown. Now and then it lets
// go one bubble, which swells in its mouth, rises up the middle of its face
// as a ring its skin shows through, hangs swollen above its head and pops
// in a ring of dashes, its eyes on it all the way and its gills flicking at
// the pop. Each gill is a pick of its own, so a tilt or a wave can move one
// side; its eyes look by whole pixels and its head leans by one.
//
// It paints by letter onto the kind's pixel surface (pixels.ts), one pixel a
// column and two a row, which refuses a fraction, so every frame is whole
// pixels. Its director is pomelo-pixel-director.ts and pomelo-pixel-pet.ts
// ties the two together. Pure: imports nothing at run time but the surface's
// `mirror`.
import type { Patch, Pixels } from './pixels'
import { mirror } from './pixels'

/** Its box in cells: 24 x 12 pixels, the water above its crown its top three rows, its hands the bottom one. */
export const COLUMNS = 24
export const ROWS = 6
/** Its crown's pixel row at rest: the head is rows 3-10, its hands row 11. */
const CROWN = 3
/** Its mouth's cell, from the box's top left. */
export const MOUTH = { c: 10, r: 4 } as const

/** Its lids: open; lidded (the lid's edge over its shine); half shut; shut (a lid line); happy (the lower lids up, a dark arc). */
export type Lids = 'open' | 'lidded' | 'half' | 'shut' | 'happy'
/** Its mouth: the wide shallow smile; a deep smile; ajar; open (talking); oh (round, holding a bubble). */
export type Mouth = 'rest' | 'smile' | 'ajar' | 'open' | 'oh'
/** A gill's spread: folded back, at rest, perked (spread a little), fanned wide. */
export type Fan = 'fold' | 'rest' | 'perk' | 'wide'
/** One side's gills, top to low. */
export type Gills = readonly [top: Fan, mid: Fan, low: Fan]

/** What it shows: every pick a whole state or a whole number of pixels. */
export type Pose = {
  lids: Lids
  /** Where its eyes look, in whole pixels: -1 left or up, 1 right or down. */
  lookX: number
  lookY: number
  mouth: Mouth
  /** Its cheeks flushed (1) or not (0). */
  blush: number
  /** Its gills on the box's left and right, top to low. */
  left: Gills
  right: Gills
  /** Its head leant a pixel left (-1) or right (1) over its shoulders. */
  lean: number
  /** Its head lifted a pixel on a stretched neck (1), or not (0). */
  breath: number
  /** The bubble's step (`BUBBLE`, from 1), or 0 for none. */
  bubble: number
}

const RESTING: Gills = ['rest', 'rest', 'rest']
export const REST: Pose = { lids: 'open', lookX: 0, lookY: 0, mouth: 'rest', blush: 0, left: RESTING, right: RESTING, lean: 0, breath: 0, bubble: 0 }

/** Its colors by letter, 0xRRGGBB; '.' is bare. */
export const INK: Readonly<Record<string, number>> = {
  // Pale skin and its shaded side and neck, outlined in a deeper rose that reads on both grounds (4.6:1 dark, 3.4:1 light).
  S: 0xf8c6bf,
  H: 0xe69499,
  O: 0xc86a83,
  // The gills: lit tips, coral, the fringe's shade, the plum stalk.
  T: 0xf89f96,
  G: 0xe56180,
  g: 0xc3418b,
  d: 0x84397d,
  // Its eyes, dark with one shine; the mouth; the cheeks' flush.
  P: 0x180e20,
  W: 0xfffdf5,
  M: 0x6f2a47,
  R: 0xf58493,
  // The bubble: its body, and its ring, which reads on both grounds (4.1:1 dark, 3.8:1 light).
  B: 0x85c2d6,
  D: 0x5581be,
}

/** Its head, left half (columns 0-11 of the box), from its crown to its chin: mirrored for the right. */
const HEAD_LEFT = [
  '.......OOOOO',
  '......OSSSSS',
  '.....OSSSSSS',
  '.....OSSSSSS',
  '.....OSSSSSS',
  '.....OSSSSSS',
  '......OOSSSS',
  '........OOOO',
]
const HEAD = HEAD_LEFT.map(row => row + mirror(row))
/** Its two hands, outlined, and its neck in the shade under its chin, at the box's bottom: they stay when its head leans or lifts. */
const HANDS = ['.....OO.....', '....OSSOOHHH'].map(row => row + mirror(row))
/** Its neck, laid under its chin when its head lifts, so the head stretches up and never gaps. */
const NECK = ['........OHHH'].map(row => row + mirror(row))

/** Its gills on the box's left, by tier and spread: letter rows, their place in columns and in rows from the crown. The right's are their mirror. */
const GILLS: Readonly<Record<'top' | 'mid' | 'low', Readonly<Record<Fan, Patch>>>> = {
  top: {
    fold: { art: ['.TGg', '..ggd'], x: 1, y: 0 },
    rest: { art: ['TG...', '.TGg.', '..ggd'], x: 1, y: -2 },
    perk: { art: ['T....', 'TG...', '.TGg.', '..ggd'], x: 1, y: -3 },
    wide: { art: ['.T...', '.G...', '.TGg.', '..ggd'], x: 1, y: -3 },
  },
  mid: {
    fold: { art: ['.TGTd', '..ggd'], x: 1, y: 1 },
    rest: { art: ['TGTGd', '.gggd'], x: 1, y: 1 },
    perk: { art: ['TG...', '.TGTd', '..ggd'], x: 1, y: 0 },
    wide: { art: ['T....', '.GTGd', '.gggd'], x: 1, y: 0 },
  },
  low: {
    fold: { art: ['.gggd', '..TGd'], x: 1, y: 3 },
    rest: { art: ['.gggd', 'TGTG.'], x: 1, y: 4 },
    perk: { art: ['..ggd', '.TGg.', 'TG...'], x: 1, y: 4 },
    wide: { art: ['..ggd', 'TGTgd', 'TG...'], x: 1, y: 4 },
  },
}
const TIERS = ['top', 'mid', 'low'] as const

/** Its eyes by lids: one eye's letters, stamped twice (its shine on the same side), set wide on its broad head at columns 7 and 15, two rows under its crown. A patch's `x` places it on the left eye; the right eye's is mirrored, so a patch three pixels wide reaches past both eyes on the same side, out (the happy dome) or in (the shut line). */
const EYES: Readonly<Record<Lids, Patch>> = {
  open: { art: ['WP', 'PP'], x: 0, y: 0 },
  // The lid slides down: its edge over the shine, then skin over the eye's top, then shut: a lid line, wider than the eye.
  lidded: { art: ['OO', 'PP'], x: 0, y: 0 },
  half: { art: ['SS', 'PP'], x: 0, y: 0 },
  shut: { art: ['MMM'], x: 0, y: 1 },
  // Its lower lids up: only the dark top of each eye shows, a dome a pixel wider than the eye.
  happy: { art: ['PPP', 'P.P'], x: -1, y: 0 },
}
const EYE = { left: 7, right: 15, y: 2 }

/** Its mouths, their place in columns and in rows from its crown: a clear row under its eyes, so they never meet. */
const MOUTHS: Readonly<Record<Mouth, Patch>> = {
  rest: { art: ['M....M', '.MMMM.'], x: 9, y: 5 },
  smile: { art: ['M......M', '.MMMMMM.'], x: 8, y: 5 },
  // Open under its line, down to its chin: a little, then wide enough to show its tongue.
  ajar: { art: ['M....M', '.MMMM.', '..MM..'], x: 9, y: 5 },
  open: { art: ['M....M', '.MGGM.', '..MM..'], x: 9, y: 5 },
  // Round lips, small, in the clear row under its eyes and clear of its chin: blowing (the bubble swells inside them) or yawning.
  oh: { art: ['.MM.', 'M..M', '.MM.'], x: 10, y: 4 },
}
/** Its cheeks' flush, two pixels wide beside each corner of its mouth, clear of its eyes. */
const BLUSH = { left: 6, right: 16, y: 5 }

/** The bubble's life, step by step: swelling inside its round lips, let go, a dot with its shine rising between its eyes, then swollen to a ring its skin shows through, its pale side up, over its brow and crown, drifting right, and hanging in the clear water above its head, wobbling a pixel each way; then its pop, a ring of dashes spreading. Steps 1-3 are at its mouth and move with its head. */
export const BUBBLE: readonly Patch[] = [
  { art: ['BB'], x: 11, y: 8 },
  { art: ['WD', 'DD'], x: 11, y: 7 },
  { art: ['WD', 'DD'], x: 11, y: 6 },
  { art: ['WD', 'DD'], x: 11, y: 5 },
  { art: ['.BD.', 'D..D', '.DD.'], x: 10, y: 3 },
  { art: ['.BD.', 'D..D', '.DD.'], x: 11, y: 2 },
  { art: ['.BD.', 'D..D', '.DD.'], x: 12, y: 0 },
  { art: ['.BD.', 'D..D', '.DD.'], x: 13, y: 0 },
  { art: ['D.DD.D', '......', 'D....D'], x: 11, y: 0 },
  { art: ['D......D', '........', '.D....D.'], x: 10, y: 0 },
]
/** The steps at its mouth, which move with its head. */
const HELD = 3
/** The first step of its pop. */
export const POP = 9
/** Where its eyes look at each step of the bubble: down at its mouth, ahead as it leaves, up once it is over its brow. */
export const ON_BUBBLE: readonly (readonly [x: number, y: number])[] = [
  [0, 1],
  [0, 1],
  [0, 0],
  [0, 0],
  [0, -1],
  [0, -1],
  [0, -1],
  [0, -1],
  [0, -1],
  [0, -1],
]

/** Paints it at `pose` onto its box's pixels (COLUMNS x ROWS cells), cleared before. */
export function paint(pixels: Pixels, pose: Pose): void {
  const hx = pose.lean
  const top = CROWN - pose.breath
  pixels.stamp(HANDS, 0, 10)
  if (pose.breath > 0) pixels.stamp(NECK, hx, top + HEAD.length)
  pixels.stamp(HEAD, hx, top)
  // The shade down its right side, away from the light.
  for (let y = 2; y < 6; y++) pixels.set(17 + hx, top + y, 'H')
  // Its gills, top to low on each side: the right side the left's mirror. They grow from behind its head: its outline stays whole beside its eyes.
  TIERS.forEach((tier, k) => {
    const left = GILLS[tier][pose.left[k]!]
    pixels.stamp(left.art, left.x + hx, left.y + top)
    const right = GILLS[tier][pose.right[k]!]
    pixels.stamp(right.art.map(mirror), COLUMNS - right.x - right.art[0]!.length + hx, right.y + top)
  })
  for (let y = 2; y < 6; y++) {
    pixels.set(5 + hx, top + y, 'O')
    pixels.set(18 + hx, top + y, 'O')
  }
  if (pose.blush > 0) {
    pixels.stamp(['RR'], BLUSH.left + hx, top + BLUSH.y)
    pixels.stamp(['RR'], BLUSH.right + hx, top + BLUSH.y)
  }
  // Its eyes, one stamped twice so its shine stays upper left, moved whole pixels to look: up only straight up, and the happy dome, two rows and a pixel wider, never up or aside, so they stay inside its head.
  const eye = EYES[pose.lids]
  const isHappy = pose.lids === 'happy'
  const lookX = pose.lookY < 0 || isHappy ? 0 : pose.lookX
  const lookY = isHappy ? Math.max(0, pose.lookY) : pose.lookY
  const ey = top + EYE.y + eye.y + lookY
  pixels.stamp(eye.art, EYE.left + eye.x + hx + lookX, ey)
  pixels.stamp(eye.art, EYE.right - eye.x - (eye.art[0]!.length - 2) + hx + lookX, ey)
  const mouth = MOUTHS[pose.mouth]
  pixels.stamp(mouth.art, mouth.x + hx, mouth.y + top)
  // The bubble last, over all: at its mouth it moves with its head; let go, it is the water's.
  const bubble = BUBBLE[pose.bubble - 1]
  if (bubble !== undefined) {
    const held = pose.bubble <= HELD
    pixels.stamp(bubble.art, bubble.x + (held ? hx : 0), bubble.y + (held ? -pose.breath : 0))
  }
}
