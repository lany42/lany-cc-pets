// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura Pixel: Sakura's chibi as a pixel pet of its own. The anime girl
// with pastel pink hair, a blunt fringe and a blossom pinned at her right,
// in a spring kimono, in hand-drawn pixel art 16 pixels wide and 12 tall,
// on whole pixels. Her eyes droop, a two-pixel iris with the lash at its
// outer, lower corner (or "> <", crossed, wide); her round brows are a pixel
// each; her mouth is an "ω" when she smiles; petals are single pixels, blown
// past her, caught in her hair, on her nose, flying off when she blows. Her
// head moves a whole pixel at most, and her chest rises a whole pixel or not
// at all, as no cell draws part of one.
//
// It paints by letter onto the kind's pixel surface (pixels.ts). Its pose is
// picks: her eyes, mouth, brows and cheeks, the petals on her and in the air
// as pixels, a breath, her head's bob and lean. Its director is
// sakura-pixel-director.ts; sakura-pixel-pet.ts ties the two together; a rig
// look's band form (hooks/lab/rig-pets/sakura-band.ts) sets the same picks
// from the rig's pose. Pure: imports nothing at run time (her colors are
// copied here, so she stands apart from her rig).
import type { Pixels } from './pixels'

/** Her box in cells: 16 columns, 6 rows (16 x 12 pixels), her head rows 0-9 and her kimono 10-11. */
export const COLUMNS = 16
export const ROWS = 6
/** Her mouth's cell, from the box's top left: pixel rows 8-9, her face's middle column. */
export const MOUTH = { c: 7, r: 4 } as const

export type Eyes = 'open' | 'left' | 'right' | 'up' | 'down' | 'half' | 'lowered' | 'shut' | 'squeeze' | 'cross' | 'wide' | 'sparkle'
export type Mouth = 'rest' | 'smile' | 'open' | 'laugh' | 'purse'
/** Her round brows: at rest on her fringe, raised a row, or knit a column closer. */
export type Brows = 'rest' | 'up' | 'knit'
/** A pixel: its column and pixel row. */
export type Spot = readonly [x: number, y: number]

/** What she shows: every pick a whole state or a whole pixel. */
export type Pose = {
  eyes: Eyes
  mouth: Mouth
  brows: Brows
  /** Her cheeks puffed out past her side panels, flushed (1), or not (0). */
  puff: number
  /** Petals on her, caught in her hair or on her nose: each a pixel of her head (column and pixel row from its top left), so they move with it. */
  worn: readonly Spot[]
  /** Petals in the air round her: each a pixel of the box. */
  air: readonly Spot[]
  /** Her chest risen a pixel, breathing in (1), or at rest (0). */
  breath: number
  /** Pixel rows her head is lowered: -1 raised, 0, 1 lowered. */
  bob: number
  /** Columns her head is leaned: -1 left, 0, 1 right. */
  lean: number
}

/** Her at rest: eyes open, mouth at rest, no petals. */
export const REST: Pose = { eyes: 'open', mouth: 'rest', brows: 'rest', puff: 0, worn: [], air: [], breath: 0, bob: 0, lean: 0 }

/** Where petals catch in her hair, pixels of her head: her crown, by her pin, her left side panel. */
export const SLOTS: readonly Spot[] = [
  [5, 1],
  [9, 0],
  [1, 7],
]
/** The petal on her nose, a pixel of her head. */
export const NOSE: Spot = [8, 7]
/** The spectacle's shower in her box: each petal's column and its delay into the shower (of 1), falling the box's height in half the shower. */
export const SHOWER: readonly (readonly [x: number, delay: number])[] = [
  [1, 0],
  [12, 0.04],
  [6, 0.1],
  [15, 0.15],
  [3, 0.21],
  [10, 0.27],
  [0, 0.33],
  [8, 0.38],
  [14, 0.44],
  [4, 0.5],
]

/** Her colors by letter, 0xRRGGBB, her palette; '.' is bare. Each is a color of her rig's palette (her rig document's `palette`). */
export const INK: Readonly<Record<string, number>> = {
  // Pink hair, its shade, its deepest, its light; her brows.
  P: 0xf6bfd2,
  p: 0xdc93bd,
  d: 0xa45c92,
  L: 0xffdfe3,
  b: 0x8c4a78,
  // Skin, its shade, her blush.
  S: 0xfde6e2,
  s: 0xf2c0c2,
  B: 0xf79ab0,
  // Lashes, iris, its deep and its glow, the shine.
  E: 0x3b1a2c,
  I: 0x8f3b68,
  i: 0x5a2148,
  G: 0xf0a9cb,
  W: 0xffffff,
  // Her mouth and its inside.
  M: 0xb04a66,
  m: 0xcc5a74,
  // The kimono, its shade, its light; the collar.
  K: 0xf19c9c,
  k: 0xd4788f,
  J: 0xffcab4,
  C: 0xfff4e6,
  // The blossom in her hair, its heart, its twig; a cherry petal.
  F: 0xfff3f7,
  R: 0xe0527e,
  T: 0x6e3b44,
  r: 0xee7aa2,
}

/** Her head: her crown, the blunt fringe, the side panels cut at the jaw, the face; pixel rows 0-9. The pin is at the right. */
const HEAD = [
  '.....dPPPPLd....',
  '...dpPPPPPPLLd..',
  '..dpPPPPPPPPLFRF',
  '.dpPPPPPPPPPPTFd',
  '.ppPpPPpPPpPPpPd',
  'dppSSSSSSSSSSPLd',
  'dppSSSSSSSSSSPLd',
  'dppBBSSSSSSBBPLd',
  'dppsSSSSSSSSsPLd',
  'dpddsSSSSSSsddLd',
]
/** Her body: the kimono, its collar crossing in a "y", her long locks over her shoulders; pixel rows 10-12 (the last shows only as she breathes in). */
const BODY = [
  'ppKKkKCSSSCJJKPL',
  'pdkkKKKCSCJKKKPL',
  'pkkKKKKKCJKKFKKP',
]
/** Her body's top row at rest, in pixel rows of the box: under her head's last. */
const BODY_Y = 10

/** Her eyes, laid at pixel row 5 over columns 3-6 (her right) and 9-12 (her left): drooping, the lash at the outer lower corner; a third row reaches her cheeks. */
const EYES: Readonly<Record<Eyes, readonly [readonly string[], readonly string[]]>> = {
  open: [['.iW.', 'EIG.'], ['.iW.', '.IGE']],
  left: [['iW..', 'IG..'], ['iW..', 'IG.E']],
  right: [['..iW', 'E.IG'], ['..iW', '..IG']],
  up: [['.iW.', 'E...'], ['.iW.', '...E']],
  down: [['....', 'EiW.'], ['....', '.iWE']],
  half: [['.EE.', 'EIG.'], ['.EE.', '.IGE']],
  lowered: [['.EE.', 'EiW.'], ['.EE.', '.iWE']],
  shut: [['....', '.EE.', 'E...'], ['....', '.EE.', '...E']],
  squeeze: [['E...', '.EE.', 'E...'], ['...E', '.EE.', '...E']],
  cross: [['..iW', 'E.IG'], ['iW..', 'IG.E']],
  wide: [['.iW.', 'EIG.', '.ii.'], ['.iW.', '.IGE', '.ii.']],
  sparkle: [['.WW.', 'EIG.'], ['.WW.', '.IGE']],
}
/** Her mouth, at pixel rows 8-9 over columns 5-10: resting, an "ω" smile, open, laughing, pursed. */
const MOUTHS: Readonly<Record<Mouth, readonly string[]>> = {
  rest: ['..mm..', '......'],
  smile: ['M.MM.M', '.M..M.'],
  open: ['..MM..', '..mm..'],
  laugh: ['.MmmM.', '..mm..'],
  purse: ['...M..', '......'],
}
/** Her cheeks puffed out over her side panels, flushed, from pixel row 7. */
const PUFF = ['..SBB......BBS..', '..S..........S..']
/** Her brows' columns, at rest and knit, and their pixel row, at rest and raised. */
const BROWS: Readonly<Record<Brows, { columns: readonly number[]; y: number }>> = {
  rest: { columns: [4, 11], y: 3 },
  up: { columns: [4, 11], y: 2 },
  knit: { columns: [5, 10], y: 3 },
}

/** Paints her at `pose` onto her box's pixels, cleared before: her kimono, then her head over it, leaned and bobbed, its face and the petals on her; the petals in the air over all. */
export function paint(pixels: Pixels, pose: Pose): void {
  pixels.stamp(BODY, 0, BODY_Y - pose.breath)
  const x = pose.lean
  const y = pose.bob
  pixels.stamp(HEAD, x, y)
  if (pose.puff > 0) pixels.stamp(PUFF, x, y + 7)
  const brows = BROWS[pose.brows]
  for (const c of brows.columns) pixels.set(x + c, y + brows.y, 'b')
  const [left, right] = EYES[pose.eyes]
  pixels.stamp(left, x + 3, y + 5)
  pixels.stamp(right, x + 9, y + 5)
  pixels.stamp(MOUTHS[pose.mouth], x + 5, y + 8)
  for (const [c, r] of pose.worn) pixels.set(x + c, y + r, 'r')
  for (const [c, r] of pose.air) pixels.set(c, r, 'r')
}
