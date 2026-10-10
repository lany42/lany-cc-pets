// Momiji Pixel: Momiji's chibi as a pixel pet of its own. The anime girl in
// an orange knit beanie with a maple leaf pinned to its rib and an orange
// hoodie, in hand-drawn pixel art 16 pixels wide and 12 tall, on whole
// pixels. Her head moves a whole pixel at most, and her chest rises a whole
// pixel or not at all, as no cell draws part of one. Raised, her neck
// stretches to meet her chin, so no bare row cuts her in two; leaned, her
// hair keeps its edges in her box, neither side cut off nor left a bare
// notch; and her happy arcs sit over both her eyes.
//
// It paints by letter onto the kind's pixel surface (pixels.ts). Its pose is
// picks: her eyes, mouth and stray strand, a breath, her head's bob and
// lean. Its director is momiji-pixel-director.ts; momiji-pixel-pet.ts ties
// the two together; a rig look's band form (hooks/lab/rig-pets/momiji-band.ts)
// sets the same picks from the rig's pose. Pure: imports nothing at run time
// (her colors are copied here, so she stands apart from her rig).
import type { Pixels } from './pixels'

/** Her box in cells: 16 columns, 6 rows (16 x 12 pixels), her head rows 0-9 and her hoodie 10-11. */
export const COLUMNS = 16
export const ROWS = 6
/** Her mouth's cell, from the box's top left: pixel rows 8-9, columns 6-9. */
export const MOUTH = { c: 6, r: 4 } as const

export type Eyes = 'open' | 'left' | 'right' | 'half' | 'shut' | 'happy' | 'wink'
export type Mouth = 'rest' | 'smile' | 'smirk' | 'open' | 'wide'
/** The stray strand over her left eye (the viewer's right): hanging over it, half swept, or swept aside. */
export type Strand = 'over' | 'half' | 'aside'

/** What she shows: every pick a whole state or a whole pixel. */
export type Pose = {
  eyes: Eyes
  mouth: Mouth
  strand: Strand
  /** Her chest risen a pixel, breathing in (1), or at rest (0). */
  breath: number
  /** Pixel rows her head is lowered: -1 raised, 0, 1 lowered. */
  bob: number
  /** Columns her head is leaned: -1 left, 0, 1 right. */
  lean: number
}

/** Her at rest: eyes open, mouth at rest, the strand swept aside. */
export const REST: Pose = { eyes: 'open', mouth: 'rest', strand: 'aside', breath: 0, bob: 0, lean: 0 }

/** Her colors by letter, 0xRRGGBB, her palette; '.' is bare. All but her blush (`B`) are colors of her rig's palette (her rig document's `palette`). */
export const INK: Readonly<Record<string, number>> = {
  // The beanie: its light, its orange, its shade; the rib's dark stripes, its shade at the edge; the maple leaf.
  L: 0xf28b45,
  O: 0xe06a28,
  o: 0xb04a1c,
  R: 0xc2561f,
  r: 0xb04a1c,
  F: 0xf8d39e,
  // Her brown hair, its shade and its deepest.
  H: 0x6e4430,
  h: 0x4f2f25,
  k: 0x34201d,
  // Skin, its shade, her blush.
  S: 0xfbe3d4,
  s: 0xf0bfac,
  B: 0xf6a99e,
  // Lashes, iris, its top, the shine.
  E: 0x2a1514,
  I: 0x9a3b22,
  i: 0x5a1e14,
  W: 0xffffff,
  // Her mouth and its inside.
  M: 0x8e3f3a,
  m: 0xb4434a,
  // The hoodie, its shade, its deepest, its light; the cords.
  Q: 0xf39a3d,
  q: 0xcf7428,
  D: 0x9f4e1e,
  U: 0xffb566,
  c: 0xf4e6d0,
}

/** Her head: the beanie, hair and face, pixel rows 0-9; the eyes, mouth and strand are laid over it. */
const HEAD = [
  '....LLOOOOo.....',
  '..LOOOOOOOOOOo..',
  '.ROROROROROFRORr',
  '.ROROROROROROROr',
  'khHHHhHHHHhHHHhk',
  'hHHSHHSSSHHSSHHh',
  'hHSSSSSSSSSSSSHh',
  'hHSSSSSSSSSSSSHh',
  'hhBSSSSSSSSSSBhh',
  'khhsSSSSSSSSshhk',
]
/** Her body: the hoodie, its hood and cords, pixel rows 10-12 (the last shows only as she breathes in). */
const BODY = [
  'hkQUQDsSSsDQQqkh',
  'QQQQUQcDDcQQQQqq',
  'QQQQQQcQQcQQQqqq',
]
/** Her body's top row at rest, in pixel rows of the box: under her head's last. */
const BODY_Y = 10

/** Her eyes, laid at pixel row 6 over columns 3-5 and 10-12: open, looking, half shut, shut, happy arcs, a wink. */
const EYES: Readonly<Record<Eyes, readonly string[]>> = {
  open: ['EEE....EEE', 'iWI....iWI'],
  left: ['EEE....EEE', 'Wii....WIi'],
  right: ['EEE....EEE', 'iIW....iIW'],
  half: ['SSS....SSS', 'EEE....EEE'],
  shut: ['SSS....SSS', 'sEE....EEs'],
  // Arcs over both eyes' places, columns 3-5 and 10-12.
  happy: ['.E......E.', 'E.E....E.E'],
  wink: ['EEE....SSS', 'iWI....EEs'],
}
/** Her mouth, at pixel rows 8-9 over columns 6-9: resting, a smile, a smirk, open, wide. */
const MOUTHS: Readonly<Record<Mouth, readonly string[]>> = {
  rest: ['....', '.MM.'],
  smile: ['M..M', '.MM.'],
  smirk: ['M...', '.MM.'],
  open: ['....', '.mm.'],
  wide: ['.MM.', 'MmmM'],
}
/** The stray strand over her left eye, columns 10-12, pixel rows 5-7, by how far it is swept. */
const STRANDS: Readonly<Record<Strand, readonly string[]>> = {
  over: ['HH.', '.HH', '.H.'],
  half: ['HH.', '.H.', '...'],
  aside: [],
}

/** Her head's outer columns, its hair's edges: they stay at her box's edges when she leans. */
const EDGES = [
  { art: HEAD.map(row => row[0]!), x: 0 },
  { art: HEAD.map(row => row[row.length - 1]!), x: COLUMNS - 1 },
] as const

/** Paints her at `pose` onto her box's pixels, cleared before: her hoodie, then her head over it, leaned and bobbed, and its face. */
export function paint(pixels: Pixels, pose: Pose): void {
  const top = BODY_Y - pose.breath
  pixels.stamp(BODY, 0, top)
  const x = pose.lean
  const y = pose.bob
  // Raised, her neck stretches to meet her chin: her hood's top row again under her head, never a bare row across her.
  for (let row = y + HEAD.length; row < top; row++) pixels.stamp([BODY[0]!], 0, row)
  pixels.stamp(HEAD, x, y)
  // Leaned, her hair keeps its edges in her box: the side she leans toward is pressed a column, the other stretched, and none is cut or left bare.
  if (x !== 0) for (const edge of EDGES) pixels.stamp(edge.art, edge.x, y)
  pixels.stamp(EYES[pose.eyes], x + 3, y + 6)
  pixels.stamp(MOUTHS[pose.mouth], x + 6, y + 8)
  pixels.stamp(STRANDS[pose.strand], x + 10, y + 5)
}
