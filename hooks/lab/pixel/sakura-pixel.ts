// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura Pixel: Sakura's chibi as a pixel pet of its own. The anime girl
// with pastel pink hair, a blunt fringe and a blossom pinned at her right,
// in a spring kimono, in hand-drawn pixel art 16 pixels wide and 12 tall,
// on whole pixels. Her eyes droop, a two-pixel iris with the lash at its
// outer, lower corner (or "> <", crossed, wide); her round brows are a pixel
// each; her mouth is an "ω" when she smiles; petals are single pixels, blown
// past her, caught in her hair, on her nose, flying off when she blows, and
// showered round her in a deeper rose when a long turn ends. Her head moves
// a whole pixel at most, and her chest rises a whole pixel or not at all, as
// no cell draws part of one.
//
// It paints by letter onto the kind's pixel surface (pixels.ts). Its pose is
// picks: her eyes, mouth, brows and cheeks, the petals on her, in the air
// and in her shower as pixels, a breath, her head's bob and lean. Its
// director is sakura-pixel-director.ts; sakura-pixel-pet.ts ties the two
// together; a rig look's band form (hooks/lab/rig-pets/sakura-band.ts) sets
// the same picks from the rig's pose. Pure: imports nothing at run time
// (her colors are copied here, so she stands apart from her rig).
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
  /** The spectacle's petals showering round her, in a deeper rose that reads on her hair, passing behind her face: each a pixel of the box (`showerAt`). */
  shower: readonly Spot[]
  /** Her chest risen a pixel, breathing in (1), or at rest (0). */
  breath: number
  /** Pixel rows her head is lowered: -1 raised, 0, 1 lowered. */
  bob: number
  /** Columns her head is leaned: -1 left, 0, 1 right. */
  lean: number
}

/** Her at rest: eyes open, mouth at rest, no petals. */
export const REST: Pose = { eyes: 'open', mouth: 'rest', brows: 'rest', puff: 0, worn: [], air: [], shower: [], breath: 0, bob: 0, lean: 0 }

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
  [12, 0.03],
  [6, 0.07],
  [15, 0.11],
  [3, 0.15],
  [9, 0.19],
  [0, 0.23],
  [13, 0.27],
  [7, 0.31],
  [4, 0.35],
  [14, 0.39],
  [10, 0.43],
  [2, 0.47],
  [11, 0.5],
]

/**
 * The shower's petals `progress` into it (0 to 1, as her director plays it
 * and her band form reads her rig's `shower`): each falls from just above
 * her box to just below it, a pixel row at a time, and sways a column in
 * toward her middle and back every three rows; the pixels in her box.
 */
export function showerAt(progress: number): Spot[] {
  const out: Spot[] = []
  SHOWER.forEach(([x, delay], k) => {
    const v = (progress - delay) / 0.5
    if (v <= 0 || v >= 1) return
    const y = Math.floor(v * 14 + 1e-6) - 1
    const sway = Math.floor((y + 1) / 3 + k) % 2
    if (y >= 0 && y < ROWS * 2) out.push([x < COLUMNS / 2 ? x + sway : x - sway, y])
  })
  return out
}

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
  // Lashes, iris, its deep and its light low band (a mid tone, so the eye reads as a dark square on her skin), the shine.
  E: 0x3b1a2c,
  I: 0x8f3b68,
  i: 0x5a2148,
  g: 0xc8669a,
  W: 0xffffff,
  // The white of her eye below an iris looking up, and the lid over one looking down.
  w: 0xe6cfd9,
  n: 0x9c4d72,
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

/**
 * Her head: her crown, the blunt fringe, the side panels cut at the jaw, the face; pixel rows 0-9. The pin is at the right.
 * The fringe ends in a straight row of hair shade, parted into three locks by two strands that run down from her crown to
 * a notch of skin, and both side panels meet her face in shade, so her hair reads apart from her skin (the two pinks are
 * near in value) and her fringe as hair, not a band.
 */
const HEAD = [
  '.....dPPPPLd....',
  '...dpPPPPPPLLd..',
  '..dpPPpPPpPPLFRF',
  '.dpPPPpPPpPPPTFd',
  '.pppppSppSppppPd',
  'dppSSSSSSSSSSpPd',
  'dppSSSSSSSSSSpPd',
  'dppBBSSSSSSBBpPd',
  'dppsSSSSSSSSspPd',
  'dpddsSSSSSSsddLd',
]
/** Her face's pixels in her head, as "x,y": its skin, where her eyes, blush and mouth lie. Her shower's petals pass behind it. */
const FACE: ReadonlySet<string> = new Set(HEAD.flatMap((row, y) => [...row].flatMap((letter, x) => ('SsB'.includes(letter) ? [`${x},${y}`] : []))))
/** Her body: the kimono, its collar crossing in a "y", her long locks over her shoulders; pixel rows 10-12 (the last shows only as she breathes in). */
const BODY = [
  'ppKKkKCSSSCJJKPL',
  'pdkkKKKCSCJKKKPL',
  'pkkKKKKKCJKKFKKP',
]
/** Her body's top row at rest, in pixel rows of the box: under her head's last. */
const BODY_Y = 10

/**
 * Her eyes, laid at pixel row 5 over columns 3-6 (her right) and 9-12 (her left): drooping, the lash at the outer lower
 * corner; a third row reaches her cheeks. The iris is dark above with a shine and a mid rose below, so at true size each
 * eye is a dark square; alight, its whole lower row lit in the mid rose under the one shine, so it glows and stays an eye.
 * Looking aside, both eyes are the same square at that side, each with its lash at its outer lower corner; up, the iris
 * over the white of her eye; down, a lid over it, its shine low; wide, the iris a row taller. Crossed, the irises go in
 * and the lashes keep the eyes' outer corners.
 */
const EYES: Readonly<Record<Eyes, readonly [readonly string[], readonly string[]]>> = {
  open: [['.iW.', 'EIg.'], ['.iW.', '.IgE']],
  left: [['iW..', 'EI..'], ['iW..', 'IE..']],
  right: [['..iW', '..EI'], ['..iW', '..IE']],
  up: [['.iW.', 'Eww.'], ['.iW.', '.wwE']],
  down: [['.nn.', 'EiW.'], ['.nn.', '.iWE']],
  half: [['.EE.', 'EIg.'], ['.EE.', '.IgE']],
  lowered: [['.EE.', 'EiW.'], ['.EE.', '.iWE']],
  shut: [['....', '.EE.', 'E...'], ['....', '.EE.', '...E']],
  squeeze: [['E...', '.EE.', 'E...'], ['...E', '.EE.', '...E']],
  cross: [['..iW', 'E.Ig'], ['iW..', 'Ig.E']],
  wide: [['.iW.', 'EIg.', '.Ig.'], ['.iW.', '.IgE', '.Ig.']],
  sparkle: [['.iW.', 'Egg.'], ['.iW.', '.ggE']],
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

/** Paints her at `pose` onto her box's pixels, cleared before: her kimono, then her head over it, leaned and bobbed, its face and the petals on her; the petals in the air over all, and her shower's over all but her face. */
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
  // Her shower falls round her and passes behind her face, which stays clear for her lit eyes and her "oh".
  for (const [c, r] of pose.shower) if (!FACE.has(`${c - x},${r - y}`)) pixels.set(c, r, 'R')
}
