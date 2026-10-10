// The hamster: a golden hamster sitting up front-on, in hand-drawn pixel art
// 13 pixels wide and 11 tall, beside the little hoard of sunflower seeds it
// keeps. Each finished turn it stuffs a seed into its cheek pouches, which
// puff out a step at a time; when they are full it pushes them empty onto
// its hoard, the seeds flying out one by one. While Claude works it nibbles
// a seed held up in its paws; to think it sits up on its haunches; it
// squeaks toward its bubble; left alone long enough it dozes off.
//
// It paints by letter onto the kind's pixel surface (pixels.ts), one pixel a
// column and two a row, so every move is a whole pixel, as pixel art's are.
// Its director is hamster-director.ts, and hamster-pet.ts ties the two
// together. Pure: imports nothing at run time but the surface's `mirror`.
import type { Letter, Patch, Pixels } from './pixels'
import { mirror } from './pixels'

/** Its box in cells: its hoard at the left, itself at the right, two columns in. */
export const COLUMNS = 22
export const ROWS = 6
/** The pixel column of its body's left edge in the box (its 13 pixels wide), and its middle. */
const BX = 7
export const MIDDLE = BX + 6
/** Seeds its cheeks hold: a puff a seed. */
export const CHEEKS_FULL = 3
/** The most seeds its hoard holds: a mound five wide and three high. */
export const PILE_MOST = 9

export type Eyes = 'open' | 'left' | 'right' | 'half' | 'shut' | 'happy'
export type Mouth = 'rest' | 'open' | 'wide'
export type Paws = 'down' | 'tuck' | 'seed' | 'groom' | 'rub' | 'push'

/** What it shows: every pick a whole pixel or a whole state. */
export type Pose = {
  eyes: Eyes
  mouth: Mouth
  paws: Paws
  /** The seed in its paws: under its open mouth (0), or its tip in its mouth (1). */
  turn: number
  /** Its cheek pouches' puff: 0 to CHEEKS_FULL. */
  cheeks: number
  /** Pixels its head and chest are raised, sitting up (0 or 1). */
  lift: number
  /** Pixels its whole body is off the ground, hopping (0 or 1). */
  hop: number
  /** A sniff: its nostrils flared a pixel each side of its nose. */
  nose: number
  /** Its left ear pricked up a pixel. */
  ear: number
  /** A dozing breath in: its belly a pixel wider each side. */
  breath: number
  /** Seeds in its hoard: 0 to PILE_MOST. */
  pile: number
  /** A seed flying from its mouth to its hoard: its pixel in the box, or none. */
  flying?: readonly [x: number, y: number]
  /** Its z's while it dozes: 0 none, 1 a "z", 2 a "z" and a "Z" above it, 3 the "Z" alone. */
  z: number
}

/** It at rest, as idle holds it between its moments. */
export const REST: Pose = { eyes: 'open', mouth: 'rest', paws: 'down', turn: 0, cheeks: 0, lift: 0, hop: 0, nose: 0, ear: 0, breath: 0, pile: 0, z: 0 }

/** Its colors by letter, 0xRRGGBB, its palette; '.' is bare. */
export const INK: Readonly<Record<string, number>> = {
  // Golden fur, its outline a deeper gold that reads on a dark and a light terminal.
  O: 0xe9a352,
  o: 0xb8692b,
  d: 0x6e3b1c,
  // Cream cheeks, muzzle and belly.
  W: 0xfff3df,
  // Pink inner ears and nose; paws, their toes a deeper pink.
  P: 0xf29aa3,
  p: 0xf5b8b0,
  q: 0xe08a8f,
  // Black eyes with a shine.
  E: 0x24140f,
  S: 0xffffff,
  // An open mouth.
  M: 0x8c3a3f,
  // Sunflower seeds: a grey-brown hull, a pale stripe; a mid tone, so they read on a dark and a light terminal.
  n: 0x8c806e,
  h: 0xc4b8a2,
}

/** Its body front-on, pixel rows 0-11 of the box, columns BX to BX + 12; the face's features are laid over it. Rows 0-8 are its head and chest, which sit up; 9-11 its belly and feet. */
const BODY = [
  '.............',
  '..oo.....oo..',
  '.oPPoOOOoPPo.',
  '.oOOOOOOOOOo.',
  'oOOOOOOOOOOOo',
  'oOOOOOOOOOOOo',
  'oOWWWWPWWWWOo',
  'oOWWWWWWWWWOo',
  '.oWWWWWWWWWo.',
  '.oOWWWWWWWOo.',
  '.oOWWWWWWWOo.',
  '..oppoooppo..',
]
/** Where its head and chest end: pixel rows above this sit up with `lift`. */
const CHEST = 9

/** Its eyes, a pair of 2 x 2 pixels at columns 3 and 8 of its body (the happy arcs 3 wide, a column further out), pixel row 4. */
const EYES: Readonly<Record<Eyes, { art: readonly string[]; x: number; y: number; gap: number }>> = {
  open: { art: ['ES', 'EE'], x: 3, y: 4, gap: 5 },
  // Toward its bubble, at the left; and away.
  left: { art: ['ES', 'EE'], x: 2, y: 4, gap: 5 },
  right: { art: ['ES', 'EE'], x: 4, y: 4, gap: 5 },
  // Half shut: the lid's fur over its top row.
  half: { art: ['OO', 'EE'], x: 3, y: 4, gap: 5 },
  shut: { art: ['..', 'dd'], x: 3, y: 4, gap: 5 },
  happy: { art: ['.d.', 'd.d'], x: 2, y: 4, gap: 6 },
}

/** Its mouth under its nose: a pixel open, its tongue under it when wide. */
const MOUTHS: Readonly<Record<Mouth, readonly Patch[]>> = {
  rest: [],
  open: [{ art: ['M'], x: 6, y: 7 }],
  wide: [{ art: ['M', 'q'], x: 6, y: 7 }],
}

/** Its front paws, a pink pixel over its toes, either side of its middle. */
const PAWS: Readonly<Record<Paws, readonly Patch[]>> = {
  // Together on its chest.
  down: [{ art: ['p.p', 'q.q'], x: 5, y: 8 }],
  // Held up, sat up.
  tuck: [{ art: ['p.p', 'q.q'], x: 5, y: 7 }],
  // Round the seed it nibbles (`SEEDS` lays them with it).
  seed: [],
  // Grooming: rubbing its muzzle, then its eyes.
  groom: [{ art: ['p.p', 'q.q'], x: 5, y: 6 }],
  rub: [{ art: ['p', 'q'], x: 4, y: 4 }, { art: ['p', 'q'], x: 8, y: 4 }],
  // Pressing its full cheeks empty.
  push: [{ art: ['p', 'q'], x: 0, y: 6 }, { art: ['p', 'q'], x: 12, y: 6 }],
}

/** The seed it nibbles, upright in its paws: lowered, its mouth open and its nostrils flared; then up, its tip in its mouth. */
const SEEDS: readonly Patch[] = [
  { art: ['q.q', '.M.', 'pnp', 'qhq', '.n.'], x: 5, y: 6 },
  { art: ['.n.', 'php', 'qnq'], x: 5, y: 7 },
]

/** Its left cheek pouch's puff by seeds held, pixel rows 5-8, columns -2 to 1 of its body; mirrored on its right. */
const CHEEKS: readonly (readonly string[])[] = [
  [],
  ['....', '.oO.', '.oO.', '....'],
  ['.oO.', '.oO.', '.oO.', '..oO'],
  ['.oO.', 'oOO.', 'oOO.', '..oO'],
]

/** Where each seed of its hoard lies, in the order they land, column and pixel row of the box, and whether its stripe faces up: a mound, from the middle of the ground up. */
export const HOARD: readonly (readonly [x: number, y: number, isLit: boolean])[] = [
  [2, 11, false], [3, 11, true], [1, 11, false], [4, 11, false], [0, 11, false],
  [2, 10, false], [1, 10, false], [3, 10, true],
  [2, 9, true],
]

/** Paints it at `pose` onto its box's pixels (COLUMNS x ROWS cells), cleared before. */
export function paint(pixels: Pixels, pose: Pose): void {
  // Its hoard: hulls, a stripe here and there.
  HOARD.slice(0, pose.pile).forEach(([x, y, isLit]) => pixels.set(x, y, isLit ? 'h' : 'n'))
  // Its belly and feet, off the ground while it hops; its head and chest higher still while it sits up.
  const low = -pose.hop
  // Sat up, its belly stretches to meet its chest: its top row again, raised as far, under it.
  const high = low - pose.lift
  if (pose.lift > 0) pixels.stamp([BODY[CHEST]!], BX, CHEST + high)
  pixels.stamp(BODY.slice(CHEST), BX, CHEST + low)
  // A dozing breath in: its belly's sides out a pixel.
  if (pose.breath > 0) for (const y of [9, 10]) pixels.stamp(['oO.........Oo'], BX, y + low)
  pixels.stamp(BODY.slice(0, CHEST), BX, high)
  const cheek = CHEEKS[pose.cheeks] ?? []
  pixels.stamp(cheek, BX - 2, 5 + high)
  pixels.stamp(cheek.map(mirror), BX + 11, 5 + high)
  // Its left ear pricked up a pixel.
  if (pose.ear > 0) pixels.stamp(['.oo.', 'oPPo', 'oOOO'], BX + 1, high)
  const eyes = EYES[pose.eyes]
  pixels.stamp(eyes.art, BX + eyes.x, eyes.y + high)
  pixels.stamp(eyes.art, BX + eyes.x + eyes.gap, eyes.y + high)
  // A sniff: its nostrils flared.
  if (pose.nose > 0) pixels.stamp(['q.q'], BX + 5, 6 + high)
  for (const patch of [...MOUTHS[pose.mouth], ...PAWS[pose.paws]]) pixels.stamp(patch.art, BX + patch.x, patch.y + high)
  if (pose.paws === 'seed') {
    const seed = SEEDS[pose.turn > 0 ? 1 : 0]!
    pixels.stamp(seed.art, BX + seed.x, seed.y + high)
  }
  if (pose.flying !== undefined) pixels.set(pose.flying[0], pose.flying[1], 'n')
}

/** Its z's while it dozes, rising up and away from its head toward its bubble: a "z", then a "Z" above it. */
export function letters(pose: Pose, isLight: boolean): Letter[] {
  const ink = isLight ? 0x7a7f8a : 0x9aa1ad
  const out: Letter[] = []
  if (pose.z === 1 || pose.z === 2) out.push({ cp: 0x7a, c: BX - 1, r: 1, ink })
  if (pose.z === 2 || pose.z === 3) out.push({ cp: 0x5a, c: BX - 2, r: 0, ink })
  return out
}
