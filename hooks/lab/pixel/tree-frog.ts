// The tree frog: a red-eyed tree frog sitting front-on on a twig, in
// hand-drawn pixel art 12 pixels wide and 7 tall, with air at its left,
// toward its bubble, for the flies it catches. Each finished turn a fly
// buzzes in and it snaps it out of the air with its tongue, then gulps with
// its eyes shut. While Claude works it watches for flies, its eyes darting
// and its throat pumping; to think it rolls its eyes up; it croaks toward
// its bubble, its vocal sac blown up.
//
// It paints by letter onto the kind's pixel surface (pixels.ts), one pixel a
// column and two a row, which refuses a fraction, so every frame is whole
// pixels. Its director is tree-frog-director.ts; tree-frog-pet.ts ties the
// two together. Pure: imports nothing at run time but the surface's
// `mirror`.
import type { Pixels } from './pixels'
import { mirror } from './pixels'

/** Its box in cells: 18 x 8 pixels, its twig the bottom row, the air its flies come through at its left, a column bare at its right. */
export const COLUMNS = 18
export const ROWS = 4
/** The pixel column its body's left edge is at (its 12 pixels wide). */
const BX = 5
/** Where its tongue starts, the middle of its mouth line: it reaches left, toward its bubble. */
export const MOUTH = { x: BX + 5, y: 4 }

export type Eyes = 'open' | 'left' | 'right' | 'up' | 'half' | 'shut'
export type Mouth = 'rest' | 'open'

/** What it shows: every pick a whole pixel or a whole state. */
export type Pose = {
  eyes: Eyes
  mouth: Mouth
  /** Its throat: 0 at rest, 1 pumping (a small puff under its chin), 2 its vocal sac blown up to croak. */
  throat: number
  /** Pixels its tongue reaches left of its mouth (0 none). */
  tongue: number
  /** A fly in the air: its pixel in the box, or none. */
  fly?: readonly [x: number, y: number]
  /** The fly's wings up (1) or down (0): it buzzes, a frame each. */
  buzz: number
  /** Pixels its body is off its twig, hopping (0 or 1). */
  hop: number
}

export const REST: Pose = { eyes: 'open', mouth: 'rest', throat: 0, tongue: 0, buzz: 0, hop: 0 }

/** Its colors by letter, 0xRRGGBB; '.' is bare. */
export const INK: Readonly<Record<string, number>> = {
  // Green skin, outlined in a deeper green that reads on a dark and a light terminal (about 4:1 on each).
  G: 0x5cb84a,
  g: 0x3a8f45,
  // Its pale throat and belly, always inside the outline.
  Y: 0xe2f0b0,
  // Red eyes, black pupils.
  R: 0xe8402f,
  E: 0x141414,
  // Orange toes; its twig.
  O: 0xd2691e,
  b: 0xa0703c,
  // Its tongue; a fly, and its wings.
  T: 0xe86a7a,
  F: 0x6b6f78,
  w: 0xa8adb6,
}

/** Its body front-on, pixel rows 0-6 of the box (row 0 bare, for a hop); its eyes and mouth are laid over it. */
const BODY = [
  '............',
  '..RR....RR..',
  '.gRRggggRRg.',
  '.gGGGGGGGGg.',
  'gGGggggggGGg',
  'gGYYYYYYYYGg',
  '.OggggggggO.',
]
/** Its twig, pixel row 7 from column 3: it stays when the frog hops. */
const TWIG = 'bbbbbbbbbbbbbbb'

/** Its eyes: the left one at its body's column 2, the right one (the left one's mirror, but for where its pupil looks) ending at column 9, their top at pixel row `y`. */
const EYES: Readonly<Record<Eyes, { art: readonly string[]; y: number }>> = {
  // Pupils low and in, looking at the person.
  open: { art: ['RR', 'RE'], y: 1 },
  // Toward its bubble, and away.
  left: { art: ['RR', 'ER'], y: 1 },
  right: { art: ['RR', 'RE'], y: 1 },
  // Rolled up: the eye a pixel taller and the brow between them lifted, so the pupil never meets bare ground (it vanishes on dark).
  up: { art: ['RR.', 'REg', 'RR.'], y: 0 },
  // Lids of green skin closing top-down.
  half: { art: ['gg', 'RE'], y: 1 },
  shut: { art: ['gg', 'gg'], y: 1 },
}
/** Its throat by `throat`: a pump under its chin, or its vocal sac blown up to croak, filling its chin from toe to toe (never over its twig). */
const THROATS: readonly (readonly { art: readonly string[]; x: number; y: number }[])[] = [
  [],
  [{ art: ['YYYY'], x: 4, y: 6 }],
  [{ art: ['YYYYYYYY'], x: 2, y: 6 }],
]

/** Paints it at `pose` onto its box's pixels (COLUMNS x ROWS cells), cleared before. */
export function paint(pixels: Pixels, pose: Pose): void {
  pixels.stamp([TWIG], 3, 7)
  const dy = -pose.hop
  pixels.stamp(BODY, BX, dy)
  // Its eyes: the right one the left one's mirror, but for where its pupil looks.
  const eye = EYES[pose.eyes]
  pixels.stamp(eye.art, BX + 2, eye.y + dy)
  const other = pose.eyes === 'left' || pose.eyes === 'right' ? eye.art : eye.art.map(mirror)
  pixels.stamp(other, BX + 10 - eye.art[0]!.length, eye.y + dy)
  // Its throat, pale over its chin's outline.
  for (const patch of THROATS[pose.throat] ?? []) pixels.stamp(patch.art, BX + patch.x, patch.y + dy)
  // Its mouth open: a pink pixel pair in its mouth line.
  if (pose.mouth === 'open') pixels.stamp(['TT'], BX + 5, 4 + dy)
  // Its tongue, reaching left from its mouth toward its bubble.
  for (let k = 1; k <= pose.tongue; k++) pixels.set(MOUTH.x + 1 - k, MOUTH.y + dy, 'T')
  if (pose.fly !== undefined) {
    pixels.set(pose.fly[0], pose.fly[1], 'F')
    // Its wings, a frame up, a frame gone.
    if (pose.buzz > 0) pixels.set(pose.fly[0], pose.fly[1] - 1, 'w')
  }
}
