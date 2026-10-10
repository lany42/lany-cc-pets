// The chameleon: a panther chameleon in profile, facing its bubble, gripping
// a twig with its tail rolled in a coil, in hand-drawn pixel art 23 pixels
// long and 11 tall. Its one eye is a turret that roams on its own. Each
// finished turn a new color washes over it from snout to tail, and it keeps
// that color: six in a cycle, turquoise to blue. Left alone a long while it
// goes pale and shuts its eye, asleep.
//
// It is drawn once in template letters ('o' outline, 'f' fill, 'l' light)
// and tinted as it is painted: each pixel takes the letters of the skin its
// column is in, so a wash is one whole-pixel column, `wash.at`, moving
// across the box. It paints by letter onto the kind's pixel surface
// (pixels.ts), one pixel a column and two a row, so every frame is whole
// pixels. Its director is chameleon-director.ts; chameleon-pet.ts ties the
// two together. Pure: imports nothing at run time.
import type { Pixels } from './pixels'

/** Its box in cells: 24 x 12 pixels, its twig the bottom pixel row, a bare column at its left for its lean. */
export const COLUMNS = 24
export const ROWS = 6

/** Where its pupil looks, from its turret: out at the person, toward its bubble (fore), away (aft), and between. */
export type Eye = 'out' | 'fore' | 'aft' | 'up' | 'down' | 'fore-up' | 'fore-down' | 'aft-up' | 'aft-down'
/** Its turret's lid: open, pinched to a pinhole, shut (a line), or shut content (an arc). */
export type Lid = 'open' | 'pinch' | 'shut' | 'smile'
export type Mouth = 'shut' | 'open' | 'gape'
/** Its front foot: gripping the twig, or lifted and reaching, held over it. */
export type Foot = 'grip' | 'lift'
/** A new skin washing over it: every column from its snout up to `at` (or from `at` to its tail) is skin `to`. */
export type Wash = { readonly to: number; readonly at: number; readonly from: 'snout' | 'tail' }

/** What it shows: every pick a whole state or a whole pixel. */
export type Pose = {
  eye: Eye
  lid: Lid
  mouth: Mouth
  foot: Foot
  /** Pixels its body rocks toward its bubble, its feet on the twig (0 or 1). */
  lean: number
  /** Its back raised a pixel, displaying (0 or 1). */
  puff: number
  /** Dark bars down its flank, displaying (0 or 1). */
  bars: number
  /** Its skin: 0-5 a color of its cycle, 6 pale (asleep). */
  skin: number
  wash?: Wash
}

/** Colors in its cycle, and the pale it sleeps in. */
export const COLORS = 6
export const PALE = 6

export const REST: Pose = { eye: 'out', lid: 'open', mouth: 'shut', foot: 'grip', lean: 0, puff: 0, bars: 0, skin: 0 }

/** Each skin's letters: its outline, its fill and its light (its eye, its flank's stripe). */
const SKIN: readonly (readonly [o: string, f: string, l: string])[] = [
  ['A', 'H', 'O'],
  ['B', 'I', 'P'],
  ['C', 'J', 'Q'],
  ['D', 'K', 'R'],
  ['E', 'L', 'S'],
  ['F', 'M', 'T'],
  ['G', 'N', 'U'],
]

/** Its colors by letter, 0xRRGGBB; '.' is bare. Every outline reads at least 3:1 on a dark and a light terminal. */
export const INK: Readonly<Record<string, number>> = {
  // Turquoise, its first color.
  A: 0x1f7f7a, H: 0x3fc0b0, O: 0xb8f0dc,
  // Lime.
  B: 0x5a7f1c, I: 0x9fcf3a, P: 0xe2f2a6,
  // Gold.
  C: 0x9a7414, J: 0xf0c63c, Q: 0xfbeaa6,
  // Orange.
  D: 0xb04f16, K: 0xf28a3a, R: 0xfcd0a4,
  // Crimson.
  E: 0xc03850, L: 0xe8566a, S: 0xf8bcc4,
  // Blue.
  F: 0x3f6fc8, M: 0x7fa8f4, T: 0xd2e0fc,
  // Pale, asleep.
  G: 0x6f8a80, N: 0xd4e6dc, U: 0xf4faf6,
  // Its pupil, its open mouth, its twig.
  e: 0x101418,
  m: 0x6a2236,
  b: 0x9c6a3c,
}

/** Its body and head, pixel rows 0-8, its eye open with no pupil: row 0 bare, room for its back to rise. */
const BODY = [
  '........................',
  '......ooo...............',
  '.....offfooooooo........',
  '....ooofffffffffoo......',
  '...olllofffffffffoo.....',
  '..olllllofffffffffff....',
  '.oolllllofffffffffff....',
  '.ofolllolllllllllloo....',
  '..oooooooooooooooo......',
]
/** Rows 1-4 with its back raised a pixel from column 9 to its tail: its body a pixel taller, never gapped. */
const RAISED = [
  '......oooooooooo........',
  '.....offffffffffoo......',
  '....ooofffffffffffo.....',
  '...olllofffffffffffo....',
]

/** A part: letter rows, where they go, and how many of its last rows stand on the twig (they stay when it leans). */
type Part = { readonly art: readonly string[]; readonly x: number; readonly y: number; readonly planted: number }

/** Its tail, rolled in a coil beside its hip. */
const TAIL: Part = { art: ['ooo...', 'fffoo.', 'oooffo', '.o.ofo', '.of.fo', '..ooo.'], x: 18, y: 5, planted: 0 }
/** Its hind leg, back to its foot on the twig. */
const HIND: Part = { art: ['.offo.', '..offo', '..offo'], x: 12, y: 8, planted: 1 }
/** Its front leg: gripping, or lifted forward and held over the twig. */
const FRONT: Readonly<Record<Foot, Part>> = {
  grip: { art: ['..offo', '.offo.', 'offo..'], x: 7, y: 8, planted: 1 },
  lift: { art: ['...offo', '..offo.', '.ofo...', 'o......'], x: 4, y: 7, planted: 0 },
}
/** Its bars, displaying: columns of outline down its flank, by `puff` (its back's top is a row higher raised). */
const BARS: readonly (readonly { x: number; from: number }[])[] = [
  [{ x: 10, from: 3 }, { x: 13, from: 3 }, { x: 16, from: 4 }],
  [{ x: 10, from: 2 }, { x: 13, from: 2 }, { x: 16, from: 3 }],
]
const BARS_TO = 6

/** Its pupil's pixel in its turret, by where it looks. */
const PUPIL: Readonly<Record<Eye, readonly [x: number, y: number]>> = {
  out: [5, 5],
  fore: [3, 6],
  aft: [7, 5],
  up: [5, 4],
  down: [5, 7],
  'fore-up': [4, 4],
  'fore-down': [4, 7],
  'aft-up': [6, 4],
  'aft-down': [6, 7],
}
/** Its turret's lids over the pale of its eye (rows 4-7): pinched to a pinhole round the middle, shut as a line, shut content as an arc. */
const LIDS: Readonly<Record<Exclude<Lid, 'open'>, readonly string[]>> = {
  pinch: ['.fff', 'ffllf', 'flllf', '.fff'],
  shut: ['.fff', 'fffff', 'ooooo', '.fff'],
  smile: ['.fff', 'fooof', 'offfo', '.fff'],
}
const LID_X = 3
const LID_Y = 4
/** Pinched, its pupil shows through the pinhole only. */
const PINHOLE: readonly [x: number, y: number] = [5, 5]
/** Its mouth: open in a syllable, or agape displaying, its lower jaw dropped. */
const MOUTHS: Readonly<Record<Exclude<Mouth, 'shut'>, readonly string[]>> = {
  open: ['ommo', 'ooo.'],
  gape: ['ommmmo', 'ommmo', '.ooo'],
}
const MOUTH_X = 1
const MOUTH_Y = 8
/** Its twig, the bottom pixel row. */
const TWIG = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const TWIG_Y = 11

/** The skin column `x` shows at `pose`: the wash's where it has reached, else its own. */
function skinAt(pose: Pose, x: number): number {
  const { wash } = pose
  if (wash === undefined) return pose.skin
  return (wash.from === 'snout' ? x < wash.at : x >= wash.at) ? wash.to : pose.skin
}

/** Whether column `x` is a wash's leading edge: the new skin's first column, its fill shimmering in its light. */
function isEdge(pose: Pose, x: number): boolean {
  const { wash } = pose
  return wash !== undefined && x === (wash.from === 'snout' ? wash.at - 1 : wash.at)
}

/** Pixel `x`, `y` in template letter `t`: 'o', 'f' and 'l' take the letters of the skin its column is in; any other is its own. */
function put(pixels: Pixels, pose: Pose, x: number, y: number, t: string): void {
  const at = 'ofl'.indexOf(t)
  if (at < 0) pixels.set(x, y, t)
  else pixels.set(x, y, SKIN[skinAt(pose, x)]![t === 'f' && isEdge(pose, x) ? 2 : at]!)
}

/** Template rows with their top left at `x`, `y`, tinted as `put` does: '.' leaves what is there. */
function lay(pixels: Pixels, pose: Pose, art: readonly string[], x: number, y: number): void {
  for (let r = 0; r < art.length; r++) {
    const row = art[r]!
    for (let c = 0; c < row.length; c++) if (row[c] !== '.') put(pixels, pose, x + c, y + r, row[c]!)
  }
}

/** A part, its rows above its planted ones rocked `dx` with its body. */
function layPart(pixels: Pixels, pose: Pose, part: Part, dx: number): void {
  const moving = part.art.length - part.planted
  lay(pixels, pose, part.art.slice(0, moving), part.x + dx, part.y)
  lay(pixels, pose, part.art.slice(moving), part.x, part.y + moving)
}

/** Paints it at `pose` onto its box's pixels (COLUMNS x ROWS cells), cleared before. */
export function paint(pixels: Pixels, pose: Pose): void {
  pixels.stamp([TWIG], 0, TWIG_Y)
  const dx = -pose.lean
  lay(pixels, pose, BODY, dx, 0)
  if (pose.puff > 0) lay(pixels, pose, RAISED, dx, 1)
  layPart(pixels, pose, TAIL, dx)
  layPart(pixels, pose, HIND, dx)
  layPart(pixels, pose, FRONT[pose.foot], dx)
  if (pose.bars > 0) for (const bar of BARS[pose.puff > 0 ? 1 : 0]!) for (let y = bar.from; y <= BARS_TO; y++) put(pixels, pose, bar.x + dx, y, 'o')
  // Its eye: its pupil where it looks, or a lid over it.
  if (pose.lid === 'open') {
    const [x, y] = PUPIL[pose.eye]
    pixels.set(x + dx, y, 'e')
  } else {
    lay(pixels, pose, LIDS[pose.lid], LID_X + dx, LID_Y)
    if (pose.lid === 'pinch') pixels.set(PINHOLE[0] + dx, PINHOLE[1], 'e')
  }
  if (pose.mouth !== 'shut') lay(pixels, pose, MOUTHS[pose.mouth], MOUTH_X + dx, MOUTH_Y)
}
