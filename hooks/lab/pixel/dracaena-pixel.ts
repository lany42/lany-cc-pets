// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Dracaena Pixel: a young witch in a black robe lined in green, a white
// collar, a striped green tie and a gray sweater, drawn front-on as a chibi
// bust in pixel art 23 pixels wide and 12 tall. Long pale-blonde hair, parted
// high on her left (the box's right) and swept across to a lock down her
// right temple; her left ear bare with a small silver hoop; icy blue eyes
// under heavy dark lashes. The air at the box's left, toward the bubble, is
// where her wand points and her green sparks fly.
//
// Her face is built from parts, each a pick: lids, gaze, mouth, blush, a
// turn and a tilt that move the face a whole pixel inside her hair (her head
// turning, her chin up or down); her arms, her hair's flip and the things in
// flight are picks too.
//
// It paints by letter onto the kind's pixel surface (pixels.ts), one pixel a
// column and two a row, which refuses a fraction, so every frame is whole
// pixels. Its director is dracaena-pixel-director.ts; dracaena-pixel-pet.ts
// ties the two together. Pure: imports nothing at run time.
import type { Letter, Patch, Pixels } from './pixels'

/** Its box in cells: 23 x 12 pixels, the free air at its left (toward the bubble) for her wand, sparks and hair. */
export const COLUMNS = 23
export const ROWS = 6
/** Her mouth's cell, from the box's top left. */
export const MOUTH = { c: 14, r: 3 } as const

/** Her eyelids: `open`; `half` (bored, smug); `shut` (a blink, a doze); `happy` (arcs); `proud` (shut, curving down: hmph); `glare` (slanting down to the nose); `squeeze` (`> <`); `wide` (startled); `wink`. */
export type Lids = 'open' | 'half' | 'shut' | 'happy' | 'proud' | 'glare' | 'squeeze' | 'wide' | 'wink'
/** Where her irises are: at the person, toward the bubble, away, rolled up, down. */
export type Gaze = 'front' | 'left' | 'right' | 'up' | 'down'
export type Mouth = 'rest' | 'soft' | 'smile' | 'grin' | 'smirk' | 'scoff' | 'frown' | 'pout' | 'open' | 'o' | 'yawn' | 'wobbly' | 'laugh'
/** Her arms: hidden in her robe; crossed; the wand up; a hand at her mouth (`cover`), at her lips (`chin`), at the lock by her face (`twirl`, and `twirl2` a turn of it later), at her ear (`tuck`), held up to look at her nails, at her tie, holding a spellbook, both at her cheeks. */
export type Arms = 'down' | 'crossed' | 'wand' | 'cover' | 'chin' | 'twirl' | 'twirl2' | 'tuck' | 'nails' | 'tie' | 'book' | 'cheeks'
/** Letters written into bare cells: a startled `!`, a doze's z or two. */
export type Mark = 'none' | 'bang' | 'z' | 'zz'
/** A green spark in flight: its centre pixel and its size (0 a dot, 1 a small star, 2 a big one). */
export type Spark = readonly [x: number, y: number, size: number]

/** What she shows: every pick a whole state or a whole number of pixels. */
export type Pose = {
  lids: Lids
  gaze: Gaze
  mouth: Mouth
  /** 0 none; 1 a pixel on each cheek; 2 two; 3 deeper, spreading toward the eyes. */
  blush: number
  /** Her face a pixel toward the bubble (-1) or away from it (1), inside her hair: her head turning. */
  turn: number
  /** Her face a pixel up (-1: chin up) or down (1: head bowed), inside her hair. */
  tilt: number
  /** A cheek puffed out past her face's edge (1): a pout. */
  puff: number
  /** A tear at her eye's corner (1): a yawn's. */
  tear: number
  /** Her hoop catching the light (1). */
  glint: number
  arms: Arms
  /** The long lock at her right (the box's left): 0 hanging, 1 lifting, 2 flung out, 3 settling. */
  hair: number
  /** The spellbook's page: 0 open, 1 lifting, 2 turning over. */
  page: number
  sparks: readonly Spark[]
  /** The heart her spell makes in the air at the left: 0 none, 1 green, 2 pink. */
  heart: number
  /** A small pink heart in flight: its top left pixel. */
  love?: readonly [x: number, y: number]
  mark: Mark
}

export const REST: Pose = {
  lids: 'open',
  gaze: 'front',
  mouth: 'rest',
  blush: 0,
  turn: 0,
  tilt: 0,
  puff: 0,
  tear: 0,
  glint: 0,
  arms: 'down',
  hair: 0,
  page: 0,
  sparks: [],
  heart: 0,
  mark: 'none',
}

/** Its colors by letter, 0xRRGGBB, the same in both themes; '.' is bare. */
export const INK: Readonly<Record<string, number>> = {
  // Hair: pale blonde, its strand shade and shine, and its outline, a mid tone that reads on both grounds.
  H: 0xebdcb2,
  h: 0xd3bd9c,
  Q: 0xfaf5e0,
  O: 0x8b7464,
  // Skin, its shade (her ear), blush and deep blush. Her hands are skin edged in her hair's outline.
  S: 0xfcebe3,
  f: 0xf0cdc8,
  p: 0xf3a6b0,
  P: 0xe2788e,
  // Eyes: lashes, iris light and deep, a startled pupil, the catchlight.
  K: 0x241c26,
  I: 0xa9c3d3,
  i: 0x6f8fa6,
  D: 0x22324a,
  F: 0xffffff,
  // Mouth line, open mouth.
  m: 0xb5606a,
  M: 0x6e2a36,
  // The silver hoop, a mid tone so it reads against her hair.
  J: 0x8c90a0,
  // Robe; `r` her own sleeve step, so an arm reads over the robe; lining; tie and its stripe; collar; sweater and `g` its V, her own.
  R: 0x34323c,
  r: 0x4a4856,
  L: 0x4d9468,
  T: 0x1f6f55,
  w: 0xe9eee8,
  W: 0xf6f6f2,
  G: 0x9a99a1,
  g: 0x7e7c88,
  // Wand; green sparks and their mint cores.
  N: 0xa67c5a,
  z: 0x1e9a55,
  Z: 0xd4ffe2,
  // The spellbook's cover and pages.
  B: 0x2f7049,
  Y: 0xf4ecd2,
}

/** Her at rest, the whole box: hair, face (no features), uniform. */
const BASE = [
  '..........OOOOOOO......',
  '........OOQQHHHHhO.....',
  '.......OHHHHHHHhSSO....',
  '......OHHHSSSSSSSSHO...',
  '......OHHHSSSSSSSSfHO..',
  '......OHHHSSSSSSSSfHO..',
  '......OHHHSSSSSSSSJHO..',
  '......OHHHHSSSSSSHHhO..',
  '......OHRRLWSSSSWLRRO..',
  '......OHRRLgWTTWgLRRhO.',
  '......ORRRLGgwTgGLRRRO.',
  '.....OHRRRLGGTwGGLRRRHO',
]

/** Her irises by gaze (2 wide, laid in the 3-wide eye): light from the top right, the icy light half up by it, the deep half below, so nothing pale runs under an eye. */
const IRIS: Readonly<Record<Gaze, readonly [string, string]>> = {
  front: ['IF', 'ii'],
  left: ['IF', 'ii'],
  right: ['IF', 'ii'],
  up: ['ii', 'FF'],
  down: ['..', 'iF'],
}

type Side = 'L' | 'R'

/** An iris's two rows in its eye: looking at the person, both sit toward her nose; looking aside, both to that side. */
function irisRows(side: Side, gaze: Gaze): [string, string] {
  const at = gaze === 'left' ? 0 : gaze === 'right' ? 1 : side === 'L' ? 1 : 0
  const [top, bottom] = IRIS[gaze]
  return at === 0 ? [`${top}.`, `${bottom}.`] : [`.${top}`, `.${bottom}`]
}

/** One eye (the box's left one is `L`), its top row at the lash line: '.' leaves her face, or her fringe, as it is. */
function eye(side: Side, lids: Lids, gaze: Gaze): Patch {
  const x = side === 'L' ? 10 : 15
  const isL = side === 'L'
  const [top, bottom] = irisRows(side, gaze)
  switch (lids) {
    case 'open':
      return { art: ['KKK', top, bottom], x, y: 3 }
    case 'half':
      return { art: ['...', 'KKK', bottom], x, y: 3 }
    case 'shut':
      return { art: ['...', '...', 'KKK'], x, y: 3 }
    case 'happy':
      return { art: ['.K.', 'K.K'], x, y: 3 }
    case 'proud':
      return { art: ['...', 'KKK', isL ? 'K..' : '..K'], x, y: 3 }
    case 'glare':
      return { art: isL ? ['K..', '.KK', bottom] : ['..K', 'KK.', bottom], x, y: 3 }
    case 'squeeze':
      return { art: isL ? ['K..', '.K.', 'K..'] : ['..K', '.K.', '..K'], x, y: 3 }
    case 'wide':
      // Lashes up a row, a small dark pupil in the whites; nothing below them.
      return { art: ['KKK', 'FDF'], x, y: 2 }
    case 'wink':
      return eye(side, isL ? 'happy' : 'open', gaze)
  }
}

/** Her mouths, grown from the one pixel at rest. */
const MOUTHS: Readonly<Record<Mouth, Patch>> = {
  rest: { art: ['m'], x: 14, y: 7 },
  soft: { art: ['m.m', '.m.'], x: 13, y: 6 },
  smile: { art: ['m..m', '.mm.'], x: 12, y: 6 },
  grin: { art: ['m.m', '.M.'], x: 13, y: 6 },
  smirk: { art: ['..m', 'mm.'], x: 13, y: 6 },
  scoff: { art: ['mm.', '..m'], x: 13, y: 6 },
  frown: { art: ['.m.', 'm.m'], x: 13, y: 6 },
  pout: { art: ['mm'], x: 14, y: 7 },
  open: { art: ['M'], x: 14, y: 7 },
  o: { art: ['m', 'M'], x: 14, y: 6 },
  yawn: { art: ['MM', 'MM'], x: 13, y: 6 },
  wobbly: { art: ['.m.m', 'm.m.'], x: 12, y: 6 },
  laugh: { art: ['mMMm'], x: 12, y: 7 },
}

/** Her cheek puffed out over the lock at her temple, rounded by her skin's edge. */
const PUFF = ['OS', 'OS', '.OS']

/** Her arms (and the wand), laid over her uniform and her hair. */
const ARMS: Readonly<Record<Arms, readonly Patch[]>> = {
  down: [],
  // Elbows out past the robe, one forearm over the other, a hand tucked at each end by a green cuff.
  crossed: [{ art: ['.rrrrrrrrLSr.', '.rSLrrrrrrrrr'], x: 7, y: 10 }],
  // Her right hand up at the box's left, the wand pointing up toward the bubble.
  wand: [
    { art: ['N...', '.N..', '..N.', '...N'], x: 3, y: 3 },
    { art: ['.OO', 'OSS', '.LL', '.rr', '.rr'], x: 6, y: 6 },
  ],
  // The back of her hand raised beside her face, over her hair at the bubble's side: an ohoho.
  cover: [{ art: ['.OO.', 'OSSO', 'OSSO', '.LL.', '..rr'], x: 6, y: 5 }],
  // Her hand at her cheek, one finger up: thinking.
  chin: [{ art: ['..O.', '.OSO', 'OSSO', 'OSSO', '.LL.', '..rr'], x: 6, y: 4 }],
  // Her hand at the lock by her right temple, curling it.
  twirl: [{ art: ['.h.', 'OSS', 'OSS', '.LL', '..r', '..r'], x: 7, y: 5 }],
  twirl2: [{ art: ['h..', 'OSS', 'OSS', '.LL', '..r', '..r'], x: 7, y: 5 }],
  // Her hand at her left ear, tucking her hair behind it.
  tuck: [{ art: ['.OO.', 'OSSO', 'OSSO', '.LL.', '.r..', '.r..'], x: 18, y: 3 }],
  // Her right hand held up in the air at the box's left, the forearm crossing her hair.
  nails: [{ art: ['.OO...', 'OSSO..', 'OSSO..', '.LLr..', '....rr'], x: 3, y: 4 }],
  // Her hand at the knot of her tie.
  tie: [{ art: ['OSSO', 'OSSO', '.LL.'], x: 12, y: 9 }],
  // A spellbook held up open in both hands (its pages are `page`'s).
  book: [{ art: ['BYYYYYYB', 'BYgYYgYB', 'BBBBBBBB'], x: 10, y: 9 }],
  // Both hands at her face, over her hair on either side.
  cheeks: [
    { art: ['.OO.', 'OSSO', 'OSSO', '.LL.'], x: 6, y: 5 },
    { art: ['.OO.', 'OSSO', 'OSSO', '.LL.'], x: 17, y: 4 },
  ],
}

/** The spellbook's page turning over, laid on the book's pages. */
const PAGES: readonly (readonly Patch[])[] = [
  [],
  [{ art: ['WWY', 'YWY'], x: 14, y: 9 }],
  [{ art: ['YWW', 'YWY'], x: 11, y: 9 }],
]

/** The long lock at the box's left by `hair`: the bare pixels it leaves, then where it is. */
const LOCK_GONE: readonly (readonly [number, number])[] = [
  [6, 8],
  [6, 9],
  [6, 10],
  [5, 11],
  [6, 11],
]
const LOCK: readonly (readonly Patch[])[] = [
  [],
  // Lifting: its end swings out and up.
  [
    { art: ['O', 'O', 'O', 'O'], x: 7, y: 8 },
    { art: ['..OO', '.OHH', 'OHHO', 'OOO.'], x: 3, y: 8 },
  ],
  // Flung out toward the bubble.
  [
    { art: ['O', 'O', 'O', 'O'], x: 7, y: 8 },
    { art: ['.OOO', 'OHHH', 'OHHO', '.OO.'], x: 3, y: 3 },
    { art: ['OHH', '.OO'], x: 5, y: 7 },
  ],
  // Settling: hanging again, its end still flared out a pixel.
  [{ art: ['..O', '..O', '.OH', 'OHH'], x: 4, y: 8 }],
]

/** Her sparks by size: a dot, a small four-point star, a big one with a mint core. */
const SPARKS: readonly (readonly string[])[] = [['z'], ['.z.', 'zZz', '.z.'], ['..z..', '..z..', 'zzZzz', '..z..', '..z..']]

/** The heart her spell makes on her wand's tip: green, then pink as she blushes. */
const HEARTS: readonly (readonly string[])[] = [[], ['zz.zz', 'zzzZz', '.zzz.', '..z..'], ['mm.mm', 'mmmpm', '.mmm.', '..m..']]
const HEART_AT = { x: 0, y: 0 } as const
/** A little pink heart: the spell's shape, in her blush's rose. */
const LOVE = ['mm.mm', 'mmmpm', '.mmm.', '..m..']

/** Her blush: a pixel on each cheek, two, then spreading up to the eyes' outer corners (down, it read as a tear); under happy eyes it sits a row higher and spreads down. */
function paintBlush(pixels: Pixels, pose: Pose, dx: number, dy: number): void {
  if (pose.blush <= 0) return
  const y = (pose.lids === 'happy' ? 5 : 6) + dy
  if (pose.blush === 1) {
    pixels.set(10 + dx, y, 'p')
    pixels.set(17 + dx, y, 'p')
  } else {
    pixels.stamp(['pP'], 10 + dx, y)
    pixels.stamp(['Pp'], 16 + dx, y)
  }
  if (pose.blush >= 3) {
    const by = pose.lids === 'happy' ? y + 1 : y - 1
    pixels.set(10 + dx, by, 'p')
    pixels.set(17 + dx, by, 'p')
  }
}

/** Paints her at `pose` onto her box's pixels (COLUMNS x ROWS cells), cleared before. */
export function paint(pixels: Pixels, pose: Pose): void {
  pixels.stamp(BASE, 0, 0)
  // The long lock at the box's left, lifted or flung.
  if (pose.hair > 0) {
    for (const [x, y] of LOCK_GONE) pixels.erase(x, y)
    for (const patch of LOCK[pose.hair] ?? []) pixels.stamp(patch.art, patch.x, patch.y)
  }
  // Her face, a whole pixel turned or tilted inside her hair.
  const dx = pose.turn
  const dy = pose.tilt
  for (const side of ['L', 'R'] as const) {
    const patch = eye(side, pose.lids, pose.gaze)
    pixels.stamp(patch.art, patch.x + dx, patch.y + dy)
  }
  if (pose.puff > 0) pixels.stamp(PUFF, 8 + dx, 5 + dy)
  paintBlush(pixels, pose, dx, dy)
  const mouth = MOUTHS[pose.mouth]
  pixels.stamp(mouth.art, mouth.x + dx, mouth.y + dy)
  if (pose.tear > 0) pixels.set(11 + dx, 5 + dy, 'I')
  if (pose.glint > 0) pixels.set(18, 6, 'F')
  // Her arms over all that, the spellbook's page on its book.
  for (const patch of ARMS[pose.arms]) pixels.stamp(patch.art, patch.x, patch.y)
  if (pose.arms === 'book') for (const patch of PAGES[pose.page] ?? []) pixels.stamp(patch.art, patch.x, patch.y)
  // Anything in flight, last.
  const heart = HEARTS[pose.heart] ?? []
  if (heart.length > 0) pixels.stamp(heart, HEART_AT.x, HEART_AT.y)
  if (pose.love !== undefined) pixels.stamp(LOVE, pose.love[0], pose.love[1])
  for (const [x, y, size] of pose.sparks) {
    const art = SPARKS[size] ?? SPARKS[0]!
    const half = (art.length - 1) / 2
    pixels.stamp(art, x - half, y - half)
  }
}

/** The ink of her written letters: a startled `!!` in a bright pink on dark and her mouth's rose on light, a doze's z in her iris's steel blue; each reads on its ground. */
const BANG_INK = { dark: 0xff8fa3, light: 0xb5606a } as const
const Z_INK = 0x6f8fa6

/** Her written letters, each in a cell bare at that moment: `!!` by her crown's left, z's rising at its right. */
export function letters(pose: Pose, isLight = false): readonly Letter[] {
  const bang = isLight ? BANG_INK.light : BANG_INK.dark
  switch (pose.mark) {
    case 'none':
      return []
    case 'bang':
      return [
        { cp: 0x21, c: 6, r: 0, ink: bang },
        { cp: 0x21, c: 7, r: 0, ink: bang },
      ]
    case 'z':
      return [{ cp: 0x7a, c: 20, r: 1, ink: Z_INK }]
    case 'zz':
      return [
        { cp: 0x7a, c: 20, r: 1, ink: Z_INK },
        { cp: 0x5a, c: 21, r: 0, ink: Z_INK },
      ]
  }
}
