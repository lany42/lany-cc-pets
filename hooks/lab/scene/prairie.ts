// Prairie Town: a black-tailed prairie dog town on the shortgrass prairie,
// drawn as a cutaway: the sky and the town above the ground line, the
// burrows below it. The pet sits up on the rim of its crater mound in the
// right third, keeping watch; its neighbours, farther back on their own
// mounds, peek out, graze and duck back in; flat-topped mesas stand on the
// far horizon, clouds drift (and melt away before they reach the pet), and
// at the right a soapweed yucca holds up its stalk of cream bells.
//
// The core is six rows: the sky with its clouds and buttes, the town on the
// ground line, and a strip of soil cut away under it where the shafts drop
// out of sight. A taller room adds sky above the core and earth below it,
// 42 to 58, and from 24 rows the pet and its mound are drawn twice the size:
//   above, the near sky   the receding prairie deepens, so the neighbours
//           stand farther back; a windpump turns far off on the horizon
//   above, the far sky    cumulus heaped up, their tops lit by the sun
//   above, the zenith     mare's tails of cirrus
//   below, the shallows   the dark topsoil, and the grass's roots hanging
//           fine and deep from it (blue grama's reach two metres); the
//           shafts, and a listening post off the pet's own
//   below, the burrows    the pet's burrow runs under the town, sagging, to
//           rise at a neighbour's mound, its other door; each neighbour's own
//           run ends in a chamber, one a den where an adult sleeps; off the
//           pet's, deeper, the nursery on its bed of dry grass, the pups
//           curled asleep and breathing
//   below, the floor      a spadefoot toad waiting out the dry in its cell;
//           a layer of chalky caliche; bedded sandstone
//
//   idle    it sits up and keeps watch, blinking now and then; every minute
//           or so it drops to graze a while, then sits up again
//   busy    the town gets to work: it digs at its mound and kicks the dirt
//           back, clods arcing out and settling as dust; the neighbours dig
//           and graze; below, an adult hauls a mouthful of grass along the
//           gallery to the nursery
//   ponder  it sits up with a grass seed head in its forepaws and nibbles it
//           down, bite by bite
//   talk    it barks at its words, mouth open, black-tipped tail flicking
//           with each bark; while its words are up it holds its place
//   spectacle (a long turn just ended)  the jump-yip wave: the whole town
//           comes up, even the far ones, specks on the horizon; from the far
//           end each prairie dog in turn stretches up tall, throws its
//           forepaws in the air and calls, the calls ringing up into the sky
//           and the grass nodding as the wave passes; it runs down the town
//           to the pet, which jump-yips twice, and the town answers back,
//           faster; below, the sleepers lift their heads (96 ticks, 24 s)
//   reward  after half a minute of quiet a pup peeks out of the burrow; after
//           a minute and a half it climbs out beside its parent and the two
//           greet with a kiss; it stays out, holding still while words are
//           up, and dives back in as soon as work starts
//
// Every creature is an actor: its pose is a target, and it reaches it a few
// dots a tick in an ordered-dither order, within what the room may change in
// a tick less what the world already changed (counted by the kit's
// `DotWatch`). The world moves on even ticks, the pet and the pup on odd ones.
import { clamp } from '../util'
import type { Dots as DotsT, Frame, Ink, Mood, SceneDef, SceneInput, SceneInstance } from './kit'
import { bayer, Dots, DotWatch, drawBubble, hash, ink, noise1, packFast, StillCache } from './kit'

const P = {
  cirrus: 1, cloud: 2, cloudLit: 3, butteFar: 4, butte: 5, farGrass: 6, pump: 7, soil: 8, soilTop: 9,
  soilDeep: 10, caliche: 11, wall: 12, bedding: 13, dust: 14, grass: 15, seed: 16, yucca: 17, bloom: 18,
  mound: 19, dirt: 20, call: 21, toad: 22, sleeper: 23, kin: 24, fur: 25, belly: 26, dark: 27, border: 28,
  words: 29,
} as const

const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
PALETTE[P.cirrus] = ink(0x48424c, 0xd2c6cc)
PALETTE[P.cloud] = ink(0x444a62, 0xb3b9d2)
PALETTE[P.cloudLit] = ink(0x7f786c, 0x9c8a68, 1.2)
PALETTE[P.butteFar] = ink(0x3b3135, 0xc6b2ae)
PALETTE[P.butte] = ink(0x523f3c, 0xaa8a80, 1.1)
PALETTE[P.farGrass] = ink(0x3b4331, 0xb2b896)
PALETTE[P.pump] = ink(0x4d4f56, 0x8a8c96, 1.1)
PALETTE[P.soil] = ink(0x4a3124, 0xc9a286)
PALETTE[P.soilTop] = ink(0x47372a, 0xa68e76)
PALETTE[P.soilDeep] = ink(0x3b3a3c, 0xa8a6a4)
PALETTE[P.caliche] = ink(0x6b655b, 0x968c7a, 1.4)
PALETTE[P.wall] = ink(0x634b37, 0x8e6e50, 1.3)
PALETTE[P.bedding] = ink(0x8b7949, 0x8e7636, 1.5)
PALETTE[P.dust] = ink(0x5d4d3d, 0xb2a08a)
PALETTE[P.grass] = ink(0x6b7941, 0x57692b, 1.2)
PALETTE[P.seed] = ink(0x99894f, 0x77672b, 1.4)
PALETTE[P.yucca] = ink(0x5b7757, 0x3d5b3f, 1.3)
PALETTE[P.bloom] = ink(0xd7d0a9, 0x8f875b, 1.8)
PALETTE[P.mound] = ink(0x8b6b4b, 0x8b653f, 1.2)
PALETTE[P.dirt] = ink(0xa17b53, 0x6f4d2b, 1.6)
PALETTE[P.call] = ink(0xd9d1b9, 0x5f5749, 2)
PALETTE[P.toad] = ink(0x6d7349, 0x5b6335, 2)
PALETTE[P.sleeper] = ink(0x8d6d4b, 0x9b6d3d, 2)
PALETTE[P.kin] = ink(0xb18b5d, 0x8f612f, 2.1)
PALETTE[P.fur] = ink(0xd5a569, 0x8b5723, 2.3)
PALETTE[P.belly] = ink(0xefd9ab, 0xb1874d, 2.2)
PALETTE[P.dark] = ink(0x7f5739, 0x3d2717, 3)
PALETTE[P.border] = ink(0x4782c8, 0x4782c8, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)

// ---------------------------------------------------------------- art
// Facing left. f fur, b belly, k claws, nose and the tail's black tip; '.' bare.
// The upright poses share their body: only what a pose moves differs.

type Art = readonly string[]
type PetPose = 'sit' | 'blink' | 'look' | 'graze' | 'chew' | 'dig' | 'kick' | 'nibble' | 'bite' | 'bark' | 'jump' | 'kiss'

const BODY: Art = [
  '....bbffffff...',
  '....bbffffff...',
  '....bbffffff...',
  '...bbbffffff...',
  '...bbbfffffk...',
  '..kk..ffff.kk..',
]

const CHEW: Art = ['........ffff...', '......ffffffff.', '....fffffffffff', '...ff.ffffffffk', '.kfffffffffff..', '..ffbbbbbbfff..', '...kk.....kk...']

const PET: Readonly<Record<PetPose, Art>> = {
  sit: ['.....fff.......', '....fffff......', '...ff.fff......', '..kff.ffff.....', '....ffffff.....', '....bbffff.....', '....bbfffff....', '...kbbfffff....', ...BODY],
  // over its shoulder, the way it came
  look: ['......fff......', '.....fffff.....', '.....fff.ff....', '....ffff.ffk...', '....ffffff.....', '....bbffff.....', '....bbfffff....', '...kbbfffff....', ...BODY],
  blink: ['.....fff.......', '....fffff......', '...ffffff......', '..kfffffff.....', '....ffffff.....', '....bbffff.....', '....bbfffff....', '...kbbfffff....', ...BODY],
  nibble: ['.....fff.......', '....fffff......', '...ff.fff......', '..kff.ffff.....', '..kkffffff.....', '...kbbffff.....', '....bbfffff....', '....bbfffff....', ...BODY],
  bite: ['...............', '.....fff.......', '....fffff......', '...ff.fff......', '..kkffffff.....', '...kbbffff.....', '....bbfffff....', '....bbfffff....', ...BODY],
  bark: [
    '.....fff.......', '....fffff......', '...ff.fff......', '..kff.ffff.....', '.....fffff.....', '...k.bffff.....', '....bbfffff....', '...kbbfffff....',
    '....bbffffff...', '....bbffffff...', '....bbffffffk..', '...bbbffffffk..', '...bbbffffff...', '..kk..ffff.....',
  ],
  // the jump-yip: up on its toes, forepaws flung wide, head thrown back
  jump: [
    '.k..........k..', '..f...kk...f...', '...f.ffff.f....', '....fff.fff....', '....fffffff....', '....bffffff....', '....bbffff.....', '....bbfffff....',
    '....bbfffff....', '....bbffffff...', ...BODY,
  ],
  graze: ['........ffff...', '......ffffffff.', '....fffffffffff', '...ff.ffffffffk', '..fffffffffff..', '.kffbbbbbbfff..', '...kk.....kk...'],
  chew: CHEW,
  // nose to nose with its pup
  kiss: CHEW,
  dig: ['.........fff...', '.......ffffff..', '.....fffffffk..', '....ffffffffkk.', '...ffffffffff..', '..ff.fffffff...', '.kffffbbffff...', 'kk..fff..fff...', '.........ff....', '.........kk....'],
  kick: ['.........fff...', '.......ffffff..', '.....fffffffk..', '....ffffffffkk.', '...ffffffffff..', '..ff.fffffff...', '.kffffbbffff...', 'kk..fff..ffff..', '..........fff..', '............kk.'],
}
const PET_W = 15
const PET_H = 17

type PupPose = 'none' | 'peek' | 'sit'
const PUP: Readonly<Record<Exclude<PupPose, 'none'>, Art>> = {
  peek: ['.ff...', 'f.ff..', 'kfff..'],
  sit: ['..ff..', '.f.ff.', 'kffff.', '..bff.', '..bfff', '.bbffk', 'k.fff.'],
}
const PUP_W = 6
const PUP_H = 7

type KinPose = 'down' | 'peek' | 'sit' | 'look' | 'graze' | 'dig' | 'kick' | 'jump'
const KIN_SIT: Art = ['..fff...', '.f.fff..', 'kfffff..', '...fff..', '..ffff..', '..fffff.', '..fffff.', '.ffffffk', 'k..fff.k']
const KIN: Readonly<Record<Exclude<KinPose, 'down'>, Art>> = {
  peek: KIN_SIT.slice(0, 3),
  sit: KIN_SIT,
  look: ['...fff..', '..fff.f.', '..fffffk', ...KIN_SIT.slice(3)],
  graze: ['....fff.', '..ffffff', '.f.ffffk', 'kffff.f.'],
  dig: ['.....ff.', '...fffff', '.ffffffk', 'k.ffff..', 'k....ff.'],
  kick: ['.....ff.', '...fffff', '.ffffffk', 'k.fffff.', 'k......f'],
  jump: ['k.....k.', '.f.k.f..', '..fff...', '..f.ff..', '..ffff..', '..fff...', '..ffff..', '..fffff.', '..fffff.', '.ffffffk', 'k..fff.k'],
}
const KIN_W = 8
const KIN_H = 11

const SLEEP: Art = ['.ffff.', 'ffffff', 'fff.ff', '.ffff.']
const SLEEP_IN: Art = ['..ff..', 'ffffff', 'fff.ff', '.ffff.']
const AWAKE: Art = ['ff....', 'f.fff.', 'ffffff', '.ffff.']
const TOAD: Art = ['.t....t.', 'tttttttt', 'tttttttt', 't.t..t.t']
const TOAD_SHUT: Art = ['........', 'tttttttt', 'tttttttt', 't.t..t.t']
const HAULER: Art = ['..ffff.', 'gfffff.', 'gf.f.f.']

const PET_MAP: Readonly<Record<string, number>> = { f: P.fur, b: P.belly, k: P.dark, s: P.seed }
const KIN_MAP: Readonly<Record<string, number>> = { f: P.kin, b: P.kin, k: P.kin }
const FOLK_MAP: Readonly<Record<string, number>> = { f: P.kin }
/** The town's far members, specks on the horizon who come up only for the wave: sitting, and jump-yipping. */
const FOLK_UP: Art = ['.f.', 'fff', 'fff', 'fff']
const FOLK_JUMP: Art = ['f.f', 'f.f', '.f.', '.f.', 'fff', 'fff', '...']
const SLEEP_MAP: Readonly<Record<string, number>> = { f: P.sleeper }
const TOAD_MAP: Readonly<Record<string, number>> = { t: P.toad }
const HAUL_MAP: Readonly<Record<string, number>> = { f: P.kin, g: P.bedding }

/** The spectacle's length in ticks, and when the pet jump-yips in it. */
const SHOW = 96
const PET_JUMPS: readonly (readonly [number, number])[] = [[60, 68], [74, 82]]
/** When the wave reaches x in the spectacle: from the town's far end (x 0) to the edge of the pet's mound in 50 ticks, however wide. */
const waveAt = (x: number, edge: number): number => 8 + Math.floor(50 * clamp(x / Math.max(1, edge), 0, 1))
/** And when the town's answer, set off by the pet's own jump-yip, runs back to x, faster. */
const answerAt = (x: number, edge: number): number => 64 + Math.floor(22 * (1 - clamp(x / Math.max(1, edge), 0, 1)))
const KIN_JUMP = 6

// ---------------------------------------------------------------- actors

/** The 4 x 4 ordered-dither rank of a dot (0-15): the order an actor's dots take their new places in. */
const rank = (x: number, y: number): number => Math.floor(bayer(x, y) * 16)

/**
 * A creature drawn from pixel art that reaches each new pose a few dots a
 * tick: `aim` sets the pose it wants, `advance` moves at most a budget of
 * dots there (an ink-only change is free), in ordered-dither order, which
 * reads as a blur of motion rather than a wipe.
 */
class Actor {
  readonly w: number
  readonly h: number
  readonly s: number
  readonly shown: Uint8Array
  readonly target: Uint8Array

  constructor(w: number, h: number, s: number) {
    this.w = w * s
    this.h = h * s
    this.s = s
    this.shown = new Uint8Array(this.w * this.h)
    this.target = new Uint8Array(this.w * this.h)
  }

  /** The pose it wants: `art` scaled by its size, standing on its grid's bottom row, mirrored if `flip`. */
  aim(art: Art | undefined, map: Readonly<Record<string, number>>, flip = false): void {
    const t = this.target, s = this.s, gw = this.w / s
    t.fill(0)
    if (art === undefined) return
    const top = this.h - art.length * s
    for (let y = 0; y < art.length; y++) {
      const row = art[y]!
      for (let x = 0; x < row.length; x++) {
        const v = map[row[x]!]
        if (v === undefined) continue
        const ax = flip ? gw - 1 - x : x
        for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) t[(top + y * s + sy) * this.w + ax * s + sx] = v
      }
    }
  }

  /** Sets one dot of the pose it wants, in its own grid's dots. */
  mark(x: number, y: number, v: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.target[y * this.w + x] = v
  }

  snap(): void {
    this.shown.set(this.target)
  }

  /** Moves up to `budget` dots toward its pose; returns the dots it toggled. */
  advance(budget: number): number {
    const a = this.shown, b = this.target, w = this.w, h = this.h
    for (let i = 0; i < a.length; i++) if (a[i] !== 0 && b[i] !== 0) a[i] = b[i]!
    let used = 0
    for (let level = 0; level < 16 && used < budget; level++) {
      for (let y = 0; y < h && used < budget; y++) {
        for (let x = 0; x < w && used < budget; x++) {
          const i = y * w + x
          if (a[i] === b[i] || rank(x, y) !== level) continue
          a[i] = b[i]!
          used++
        }
      }
    }
    return used
  }

  /** Draws it with its top-left at (ox, oy); with `edge`, clears a dot's width round it first, so it stands clear of the grass. */
  draw(d: DotsT, ox: number, oy: number, edge: boolean): void {
    const a = this.shown, w = this.w
    if (edge) {
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < w; x++) {
          if (a[y * w + x] === 0) continue
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) d.set(ox + x + i, oy + y + j, 0)
        }
      }
    }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] !== 0) d.set(ox + x, oy + y, a[y * w + x]!)
  }

  /** The rows its shown dots take, top first (its grid's h when bare). */
  topRow(): number {
    for (let i = 0; i < this.shown.length; i++) if (this.shown[i] !== 0) return Math.floor(i / this.w)
    return this.h
  }
}

// ---------------------------------------------------------------- the room

export type Layout = {
  W: number; H: number; cols: number; rows: number
  /** The pet's size: 1, or 2 (the hero) in a room of 24 rows and more. */
  S: number
  /** Extra rows above and below the core. */
  above: number; below: number
  /** The ground line (the cut), and the far horizon the mesas stand on (dots). */
  ground: number; far: number
  /** The pet's mound: its middle, its half-width, the crater's half-width, the rim's height. */
  mx: number; moundR: number; craterR: number; rimH: number
  /** The pet's grid, top-left (dots). */
  ox: number; oy: number
  /** The yucca's foot. */
  yx: number
}

export function layoutOf(cols: number, rows: number): Layout {
  const W = cols * 2, H = rows * 4
  const S = rows >= 24 ? 2 : 1
  const coreRows = Math.min(rows, 6 * S)
  const extra = rows - coreRows
  const above = Math.round(extra * 0.42), below = extra - above
  const ground = above * 4 + 19 * S
  const far = ground - 3 * S - Math.round(above * 4 * 0.12)
  const mx = W - 30 * S
  const moundR = (S > 1 ? 10 : 13) * S, craterR = 4 * S, rimH = 3 * S
  // the pet sits on the crater's right rim, clear of the hole, its belly on a cell's edge
  const ox = (mx + 2 * S) & ~1
  const oy = ground - rimH - PET_H * S
  return { W, H, cols, rows, S, above, below, ground, far, mx, moundR, craterR, rimH, ox, oy, yx: W - 7 * S }
}

/** The mound's height above the ground at x (dots), or -1 in its hole. */
function moundAt(L: Layout, x: number): number {
  const dx = Math.abs(x - L.mx)
  if (dx > L.moundR) return 0
  if (dx <= L.S + 0.5) return -1
  if (dx <= L.craterR) return L.rimH - 1 - Math.floor((L.craterR - dx) / (2 * L.S))
  const f = (L.moundR - dx) / (L.moundR - L.craterR)
  return Math.round(L.rimH * (1 - (1 - f) * (1 - f)))
}

type Kin = { x: number; base: number; flip: boolean; per: number; ph: number }
type Cloud = { x0: number; y: number; w: number; h: number; per: number; ph: number; bumps: Float32Array }
/** What never moves in a room, worked out once a size. */
type Still = {
  base: Uint8Array
  /** Seed heads on the ground line: x, the stem's top y. */
  seeds: Int16Array
  kin: Kin[]
  clouds: Cloud[]
  /** The windpump: foot x, foot y, tower height; empty for none. */
  pump: Int16Array
  /** Sleepers: x, y (top-left), and their size (the pups the pet's, an adult in its den 1). */
  sleepers: Int16Array
  /** The toad: x, y (top-left); empty for none. */
  toad: Int16Array
  /** The far townsfolk: x on the horizon of each. */
  folk: Int16Array
  /** The hauler's way: from a shaft's foot along the gallery to the nursery (x, y pairs); empty for none. */
  haul: Float32Array
}

/** Carves a capsule (a tunnel) into `hole`. */
function carve(hole: Uint8Array, W: number, H: number, x0: number, y0: number, x1: number, y1: number, r: number): void {
  const vx = x1 - x0, vy = y1 - y0, len2 = vx * vx + vy * vy || 1
  for (let y = Math.max(0, Math.floor(Math.min(y0, y1) - r)); y <= Math.min(H - 1, Math.ceil(Math.max(y0, y1) + r)); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(x0, x1) - r)); x <= Math.min(W - 1, Math.ceil(Math.max(x0, x1) + r)); x++) {
      const k = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / len2))
      const dx = x - (x0 + vx * k), dy = y - (y0 + vy * k)
      if (dx * dx + dy * dy <= r * r) hole[y * W + x] = 1
    }
  }
}

/** Carves an ellipse (a chamber) into `hole`, a flatter floor than roof. */
function chamber(hole: Uint8Array, W: number, H: number, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++) {
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(W - 1, Math.ceil(cx + rx)); x++) {
      const ey = y < cy ? (y - cy) / ry : (y - cy) / (ry * 0.7)
      const ex = (x - cx) / rx
      if (ex * ex + ey * ey <= 1) hole[y * W + x] = 1
    }
  }
}

function buildStill(cols: number, rows: number, seed: number): Still {
  const L = layoutOf(cols, rows)
  const { W, H, S, ground, far } = L
  const base = new Uint8Array(W * H)
  const put = (x: number, y: number, v: number): void => {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < W && y < H) base[y * W + x] = v
  }
  const soilH = H - 1 - ground

  // the neighbours: mounds farther back on the receding prairie, leftward from the pet's
  const kin: Kin[] = []
  let kx = L.mx - L.moundR - 14 - Math.floor(hash(seed, 31) * 6)
  for (let k = 0; kx > 7; k++) {
    const depth = hash(k, seed, 32)
    kin.push({ x: kx, base: far + 1 + Math.round(depth * Math.max(0, ground - far - 2)), flip: hash(k, seed, 33) < 0.35, per: 41 + Math.floor(hash(k, seed, 34) * 60), ph: Math.floor(hash(k, seed, 35) * 400) })
    kx -= 30 + Math.floor(hash(k, seed, 36) * 16)
  }

  // the far horizon: mesas standing on it at the left, each a flat cap of rock over a cliff and a
  // talus slope spreading to the plain; the prairie receding to it in rows that crowd toward it
  const seg = (x0: number, y0: number, x1: number, y1: number, v: number): void => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let k = 0; k <= n; k++) put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, v)
  }
  const mesa = (cx: number, tw: number, h: number, v: number): void => {
    const top = far - h, cliff = top + Math.max(2, Math.round(h * 0.45)), half = tw / 2
    const lean = (cliff - top) * 0.25, foot = h * 0.9
    seg(cx - half - lean - foot, far, cx - half - lean, cliff, v)
    seg(cx - half - lean, cliff, cx - half, top, v)
    seg(cx - half, top, cx + half, top, v)
    seg(cx + half, top, cx + half + lean, cliff, v)
    seg(cx + half + lean, cliff, cx + half + lean + foot * 1.2, far, v)
    // the cap rock's ledge, and the cliff's shadowed face hatched
    if (h >= 6) for (let x = Math.round(cx - half + 1); x < cx + half; x += 2) put(x, top + 2, v)
    if (h >= 8) for (let x = Math.round(cx + 1); x < cx + half; x += 3) for (let y = top + 4; y < cliff; y += 2) put(x + (y - top) * 0.25, y, v)
  }
  const bh = clamp(Math.round(far * 0.22), 4, 22)
  // in a short room a mesa stands only where no neighbour sits in front of it, else it is left out
  const standAt = (want: number, tw: number, h: number): number => {
    const half = tw / 2 + h * 1.1
    for (let d = 0; d < W * 0.2; d++) {
      for (const x of [want - d, want + d]) {
        if (x - half < 0 || x + half > (L.above >= 3 ? L.ox - 2 : L.mx - L.moundR - 2)) continue
        if (L.above >= 3 || !kin.some(kk => Math.abs(kk.x - x) < half + 6)) return x
      }
    }
    return -1
  }
  const stand = (want: number, tw: number, h: number, v: number): void => {
    const x = standAt(want, tw, h)
    if (x >= 0) mesa(x, tw, h, v)
  }
  if (W >= 150) stand(W * 0.07, Math.max(8, W * 0.05), Math.round(bh * 0.7), P.butteFar)
  if (W >= 70) stand(W * 0.28, Math.max(10, W * 0.09), bh, P.butte)
  if (W >= 110) stand(W * 0.43, Math.max(4, W * 0.03), Math.round(bh * 0.75), P.butteFar)
  if (ground - far >= 5) for (let x = 0; x < W; x += 2) if (hash(x, 37) < 0.8) put(x, far, P.farGrass)
  for (let k = 1, gap = 2; ground - far >= 5 && ground - k > far; k += gap, gap++) {
    const y = ground - k, f = k / (ground - far)
    for (let x = 0; x < W; x++) if (hash(x >> 1, y, 38) < 0.42 - f * 0.3) put(x, y, P.farGrass)
  }

  // the town's far members, on the horizon, between the neighbours and clear of the pump
  const folk: number[] = []
  const pumpX = L.above >= 3 && W >= 100 ? Math.round(W * 0.15) + 4 : -99
  for (let x = 3 + Math.floor(hash(seed, 71) * 6), k = 0; x < L.mx - L.moundR - 6; k++) {
    if (!kin.some(kk => Math.abs(kk.x - x) < 9) && Math.abs(x - pumpX) > 6) folk.push(x)
    x += 7 + Math.floor(hash(k, seed, 72) * 7)
  }

  // the windpump, far off on the horizon
  const pump = new Int16Array(L.above >= 3 && W >= 100 ? 3 : 0)
  if (pump.length > 0) {
    pump[0] = pumpX
    pump[1] = far
    pump[2] = Math.max(12, Math.round((far - 6) * 0.42))
    const px = pump[0], th = pump[2]
    for (let y = 0; y <= th; y++) {
      const k = y / th
      put(px - 3 + k * 2, far - y, P.pump)
      put(px + 3 - k * 2, far - y, P.pump)
      if (y > 0 && y % 4 === 0) for (let x = Math.round(px - 2 + k * 2); x <= Math.round(px + 2 - k * 2); x += 2) put(x, far - y, P.pump)
    }
    // the tail vane
    for (let x = 1; x <= 8; x++) put(px + x, far - th - 1, P.pump)
    for (let y = -2; y <= 1; y++) put(px + 8, far - th - 1 + y, P.pump)
  }

  // soil, cut away below the ground line: topsoil and roots, subsoil, caliche, sandstone
  const hole = new Uint8Array(W * H)
  const r = 1 + S
  /** Digs a tunnel through the points (x, y pairs), its line wandering a little, as a dug one does. */
  const dig = (pts: readonly number[], salt: number): void => {
    let px = pts[0]!, py = pts[1]!
    for (let k = 2; k < pts.length; k += 2) {
      const bx = pts[k]!, by = pts[k + 1]!
      const len = Math.hypot(bx - px, by - py) || 1, n = Math.max(1, Math.ceil(len / 6))
      const nx = -(by - py) / len, ny = (bx - px) / len
      let ax = px, ay = py
      for (let j = 1; j <= n; j++) {
        const f = j / n, wob = j < n ? (noise1(salt * 7 + k * 3 + j * 0.6, seed + 39) - 0.5) * 3 : 0
        const cx = px + (bx - px) * f + nx * wob, cy = py + (by - py) * f + ny * wob
        carve(hole, W, H, ax, ay, cx, cy, r)
        ax = cx; ay = cy
      }
      px = bx; py = by
    }
  }
  const depth = (f: number): number => ground + Math.max(4 * S + 2, Math.round(soilH * f))
  // the pet's burrow: its shaft drops nearly straight from the crater, turns, and runs left under
  // the town, sagging, to rise again at the nearest neighbour's mound: the coterie's other door
  const gy = depth(0.34)
  const turnX = L.mx - 7 * S
  const sleepers: number[] = []
  let haul: number[] = []
  dig([L.mx, ground - 1, L.mx - S, ground + Math.round((gy - ground) * 0.55), turnX, gy], 1)
  if (gy - ground >= 10) chamber(hole, W, H, L.mx + 3 * S + 2, ground + Math.round((gy - ground) * 0.38), 3 * S, 2 * S)
  // the other door: the nearest neighbour far enough off for the tunnel to run, not plunge
  const k0 = kin.find(kk => turnX - kk.x >= (gy - ground) * 1.6 + 10) ?? kin[0]
  let lowX = turnX, lowY = gy
  if (k0 !== undefined && soilH >= 12) {
    const ax = k0.x + 5, ay = depth(0.3), up = ground + Math.round((ay - ground) * 0.4)
    lowX = Math.round((turnX + ax) / 2)
    lowY = gy + Math.round(Math.min(5 * S, soilH * 0.07))
    dig([turnX, gy, lowX, lowY, ax, ay, k0.x + 1, up, k0.x, ground - 1], 2)
    haul = [k0.x + 1, up, ax, ay, lowX, lowY]
  } else if (k0 !== undefined) dig([k0.x, ground - 1, k0.x + 1, ground + 8], 2)
  // the nursery, deeper, off the tunnel's low point
  const ny = depth(0.66), nx = lowX - 4 * S, nfloor = ny + Math.floor(2.8 * S)
  const nursery = soilH >= 34 && nfloor < H - 3 && nx - 10 * S > 2
  if (nursery) {
    const midY = Math.round((lowY + ny) / 2)
    dig([lowX, lowY, lowX + 3 * S, midY, nx + 8 * S, ny - 2 * S], 3)
    chamber(hole, W, H, nx, ny, 10 * S, 4 * S)
    if (haul.length > 0) haul.push(lowX + 3 * S, midY, nx + 8 * S, ny - 2 * S, nx + 5 * S, ny)
    // the pups, a third of their parent's size, curled on the bed
    for (const left of S > 1 ? [-14, -3, 8] : [-7, 1]) sleepers.push(nx + left, nfloor - 4, 1)
  } else haul = []
  // each other neighbour's burrow: a shaft, a run one way or the other, a chamber at its end
  for (let k = 0; k < kin.length; k++) {
    if (kin[k] === k0) continue
    const kk = kin[k]!, way = hash(k, seed, 40) < 0.5 ? -1 : 1
    const fy = depth(0.2 + hash(k, seed, 41) * 0.14)
    const ex = kk.x + way * (7 + Math.floor(hash(k, seed, 42) * 8)), lean = Math.round((hash(k, seed, 43) - 0.5) * 6)
    dig([kk.x, ground - 1, kk.x + lean, fy - 3, kk.x + lean + way * 4, fy, ex, fy + 2], 10 + k)
    if (soilH >= 20) {
      chamber(hole, W, H, ex + way * 4, fy + 2, 5, 3)
      // the den: an adult asleep at the end of one of them
      if (k === (kin[1] === k0 ? 2 : 1) && soilH >= 28) sleepers.push(ex + way * 4 - 3, fy, 1)
    }
  }
  // the toad's cell: in solid ground, clear of every tunnel, toward the left
  let toadAt = -1
  const ty = ground + Math.round(soilH * 0.55)
  for (let x = Math.round(W * 0.08); soilH >= 44 && toadAt < 0 && x < W * 0.6; x += 3) {
    let clear = true
    for (let y = ty - 8; y <= ty + 10 && clear; y++) for (let xx = x - 6; xx <= x + 16 && clear; xx++) if (xx >= 0 && xx < W && hole[y * W + xx] === 1) clear = false
    if (clear) toadAt = x
  }
  const toad = new Int16Array(toadAt >= 0 ? 2 : 0)
  if (toad.length > 0) {
    toad[0] = toadAt
    toad[1] = ty
    chamber(hole, W, H, toad[0] + 4, toad[1] + 2, 7, 4)
  }
  const cal = ground + Math.round(soilH * 0.8)
  const rock = ground + Math.round(soilH * 0.9)
  for (let y = ground + 1; y < H; y++) {
    const dz = y - ground
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (hole[i] === 1) continue
      const edge = (x > 0 && hole[i - 1] === 1) || (x < W - 1 && hole[i + 1] === 1) || (y > 0 && hole[i - W] === 1) || (y < H - 1 && hole[i + W] === 1)
      if (edge) { base[i] = dz < 6 * S + 2 ? P.soilTop : P.wall; continue }
      const h = hash(x, y, seed + 42)
      // the cut's edge, then the dark topsoil and the roots hanging in it
      if (dz === 1) { base[i] = P.soilTop; continue }
      if (dz <= 3) { if (h < 0.3) base[i] = P.soilTop; continue }
      if (dz < 6 * S + 2) {
        if (hash(x, 43) < 0.08 && dz < 3 + hash(x, 44) * 5 * S) base[i] = P.soilTop
        else if (h < 0.1) base[i] = P.soilTop
        continue
      }
      if (soilH >= 44 && Math.abs(y - cal) < 3 && noise1(x / 5, 45) * (1 - Math.abs(y - cal) / 3) > 0.42) { base[i] = P.caliche; continue }
      if (soilH >= 44 && y >= rock) {
        if ((y - rock) % 5 === 0 && hash(x >> 2, y, 46) < 0.75) { if (x % 2 === 0) base[i] = P.soilDeep }
        else if (h < 0.07) base[i] = P.soilDeep
        continue
      }
      // the subsoil: a sparse grain, and pebbles
      if (h < 0.045 || hash(x >> 1, y >> 1, seed + 70) < 0.012) base[i] = P.soil
    }
  }
  // the prairie's roots: most of a grassland lives under it, fine and deep, cut where the tunnels run
  if (soilH >= 20) {
    for (let x0 = 2 + Math.floor(hash(seed, 74) * 5); x0 < W - 2; x0 += 5 + Math.floor(hash(x0, seed, 75) * 9)) {
      if (Math.abs(x0 - L.mx) <= L.moundR) continue
      const len = soilH * (0.25 + hash(x0, seed, 76) * 0.4)
      let x = x0
      for (let k = 0; k < len; k++) {
        const y = ground + 3 + k
        x += (noise1(k / 6, x0 + seed) - 0.5) * 0.9
        const xi = Math.round(x)
        if (y >= H || xi < 0 || xi >= W) break
        const i = y * W + xi
        if (hole[i] === 1 || base[i] === P.wall || k % 5 === 4) continue
        base[i] = y - ground < 6 * S + 2 ? P.soilTop : P.soil
      }
    }
  }

  // the nursery's bed of dry grass
  if (nursery) for (let x = nx - 10 * S; x <= nx + 10 * S; x++) if (hole[nfloor * W + x] === 1 && hash(x, nfloor, 47) < 0.8) put(x, nfloor, P.bedding)

  // the mounds: the pet's crater, and each neighbour's dome
  for (let x = L.mx - L.moundR; x <= L.mx + L.moundR; x++) {
    const h = moundAt(L, x)
    if (h < 0) {
      for (let y = ground - L.rimH; y <= ground; y++) put(x, y, 0)
      continue
    }
    for (let k = 0; k <= h; k++) {
      const y = ground - k
      if (k === h || (k === h - 1 && Math.abs(x - L.mx) > L.craterR)) put(x, y, P.mound)
      else if (hash(x, y, 48) < 0.3) put(x, y, P.mound)
      else put(x, y, 0)
    }
  }
  for (const kk of kin) {
    for (let x = kk.x - 6; x <= kk.x + 6; x++) {
      const dx = Math.abs(x - kk.x)
      if (dx <= 1) continue
      const h = dx <= 3 ? 2 : dx <= 5 ? 1 : 0
      put(x, kk.base - h, P.mound)
      for (let y = kk.base - h + 1; y <= kk.base; y++) if (hash(x, y, 49) < 0.4) put(x, y, P.mound); else put(x, y, 0)
    }
  }

  // grass on the ground line, and the seed heads that nod in a gust
  const seeds: number[] = []
  for (let x = 0; x < W; x++) {
    if (Math.abs(x - L.mx) <= L.moundR + 1) continue
    if (hash(x, seed, 50) < 0.32) {
      const h = 1 + Math.floor(hash(x, 51) * 3)
      const lean = hash(x, 52) < 0.5 ? -1 : 1
      for (let k = 1; k <= h; k++) put(x + (k === h && h > 1 ? lean : 0), ground - k, P.grass)
    }
    const nearPet = x > L.ox - 10 && x < L.ox + PET_W * S + 6
    if (!nearPet && x > 3 && x < L.yx - 8 && hash(x, seed, 53) < 0.06 && !kin.some(kk => Math.abs(kk.x - x) < 8)) {
      for (let k = 1; k <= 3; k++) put(x, ground - k, P.grass)
      seeds.push(x, ground - 4)
      x += 6
    }
  }

  // the yucca: a rosette of blades, and its stalk of bells
  {
    const yx = L.yx, foot = ground - 1
    const blade = 5 * S + 1
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.1 + 0.8 * (k / 8))
      const len = blade * (0.7 + 0.3 * Math.sin(a))
      for (let j = 1; j <= len; j++) put(yx + Math.cos(a) * j, foot - Math.sin(a) * j * 0.9, P.yucca)
    }
    const top = Math.max(2, L.oy + 3 * S)
    for (let y = foot - 3; y >= top; y--) put(yx, y, P.yucca)
    for (let y = top; y < top + Math.round((foot - top) * 0.55); y += 2) {
      put(yx - 1, y + 1, P.bloom)
      put(yx + 1, y, P.bloom)
    }
  }

  // clouds: a few, in the sky's upper part, each drifting on its own clock
  const clouds: Cloud[] = []
  const skyTop = L.above >= 7 ? Math.round(far * 0.3) : 1
  const skyBot = far - Math.max(5, Math.round(far * 0.22))
  if (skyBot - skyTop >= 4) {
    const n = Math.max(1, Math.round(W / (L.above >= 3 ? 70 : 60)))
    const h = Math.min(16, Math.max(4, Math.round((skyBot - skyTop) * 0.45)))
    for (let k = 0; k < n; k++) {
      const w = Math.round(h * (2.4 + hash(k, seed, 54) * 1.6))
      const nb = 3 + Math.floor(hash(k, seed, 55) * 3)
      const bumps = new Float32Array(nb * 3)
      for (let j = 0; j < nb; j++) {
        const f = (j + 0.5) / nb
        bumps[j * 3] = (f - 0.5) * w * 0.8
        bumps[j * 3 + 1] = h * (0.55 + 0.45 * Math.sin(f * Math.PI)) * (0.75 + 0.25 * hash(k, j, 56))
        bumps[j * 3 + 2] = w * 0.22 * (0.8 + 0.4 * hash(k, j, 57))
      }
      clouds.push({ x0: Math.round(((k + hash(k, seed, 58) * 0.6) / n) * W), y: skyTop + Math.round(hash(k, seed, 59) * (skyBot - skyTop - h)) + h, w, h, per: 47 + Math.floor(hash(k, seed, 60) * 40), ph: Math.floor(hash(k, seed, 61) * 999), bumps })
    }
  }

  // cirrus at the zenith: mare's tails, long fine streaks hooked up at one end
  if (L.above >= 7) {
    const n = Math.max(2, Math.round(W / 100))
    for (let k = 0; k < n; k++) {
      const x0 = ((k + 0.2 + hash(k, seed, 62) * 0.6) / n) * W, y0 = 3 + hash(k, seed, 63) * Math.max(2, far * 0.16)
      const len = 22 + hash(k, seed, 64) * 26
      for (let j = 0; j < len; j++) {
        const f = j / len
        const y = y0 + f * 3 - (f > 0.8 ? (f - 0.8) * 20 : 0)
        if (j % 4 !== 3) put(x0 + j, y, P.cirrus)
        if (j > 4 && j < len * 0.7 && j % 6 === 1) put(x0 + j - 3, y + 2, P.cirrus)
      }
    }
  }

  return { base, seeds: Int16Array.from(seeds), kin, folk: Int16Array.from(folk), clouds, pump, sleepers: Int16Array.from(sleepers), toad, haul: Float32Array.from(haul) }
}

/** Stamps pixel art at `s` times its size (`Dots.stamp` at 1). */
function stampAt(d: DotsT, art: Art, ox: number, oy: number, map: Readonly<Record<string, number>>, s: number, flip = false): void {
  if (s === 1) {
    d.stamp(art, ox, oy, map, flip)
    return
  }
  for (let y = 0; y < art.length; y++) {
    const row = art[y]!, n = row.length
    for (let x = 0; x < n; x++) {
      const v = map[row[flip ? n - 1 - x : x]!]
      if (v === undefined) continue
      for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) d.set(ox + x * s + sx, oy + y * s + sy, v)
    }
  }
}

/** The point `s` dots along a polyline (x, y pairs) into `out`, and the way it heads there (+1 right, -1 left). */
function along(poly: Float32Array, s: number, out: Float32Array): void {
  for (let k = 0; k + 3 < poly.length; k += 2) {
    const ax = poly[k]!, ay = poly[k + 1]!, bx = poly[k + 2]!, by = poly[k + 3]!
    const len = Math.hypot(bx - ax, by - ay)
    if (s <= len) {
      const f = len > 0 ? s / len : 0
      out[0] = ax + (bx - ax) * f
      out[1] = ay + (by - ay) * f
      out[2] = bx >= ax ? 1 : -1
      return
    }
    s -= len
  }
  out[0] = poly[poly.length - 2] ?? 0
  out[1] = poly[poly.length - 1] ?? 0
  out[2] = 1
}

function polyLength(poly: Float32Array): number {
  let n = 0
  for (let k = 0; k + 3 < poly.length; k += 2) n += Math.hypot(poly[k + 2]! - poly[k]!, poly[k + 3]! - poly[k + 1]!)
  return n
}

// ---------------------------------------------------------------- the scene

const PARTICLES = 24

class Prairie implements SceneInstance {
  private readonly seed: number
  private d: DotsT = new Dots(1, 1)
  private out: Frame | undefined
  private last = -1
  private mood: Mood = 'idle'
  private moodFor = 0
  private calmFor = 0
  private busyFor = 0
  private words: string | undefined
  private showAt = -1
  private lastSpectacle: number | undefined
  private stills: StillCache<Still, number>
  private watch = new DotWatch()
  // the actors
  private pet = new Actor(PET_W, PET_H, 1)
  private pup = new Actor(PUP_W, PUP_H, 1)
  private kin: Actor[] = []
  private petPose: PetPose = 'sit'
  private kinPose: KinPose[] = []
  private pupPose: PupPose = 'none'
  private fresh = true
  // the world's slow clocks: the clouds' drift (held while words are up), the windpump, a gust over the grass
  private drift = 0
  private wheel = 0
  private gust = -100
  /** Where the spectacle's wave is (x, dots; -100 none): the grass nods as it passes. */
  private front = -100
  // particles: dirt kicked from the mounds, settling as dust (x, y, vx, vy; age; kind 1 dirt, 2 dust, 0 none)
  private px = new Float32Array(PARTICLES)
  private py = new Float32Array(PARTICLES)
  private vx = new Float32Array(PARTICLES)
  private vy = new Float32Array(PARTICLES)
  private age = new Uint8Array(PARTICLES)
  private kind = new Uint8Array(PARTICLES)
  // the hauler in the gallery: how far along its way, or -1
  private hauled = -1
  private haulAt = -1000
  private at = new Float32Array(3)

  constructor(seed: number) {
    this.seed = seed
    this.stills = new StillCache<Still, number>((cols, rows) => buildStill(cols, rows, seed))
  }

  frame(input: SceneInput): Frame {
    if (this.d.cols !== input.cols || this.d.rows !== input.rows) {
      this.d = new Dots(input.cols, input.rows)
      this.out = undefined
      this.fresh = true
      const S = layoutOf(input.cols, input.rows).S
      this.pet = new Actor(PET_W, PET_H, S)
      this.pup = new Actor(PUP_W, PUP_H, S)
      this.kind.fill(0)
      this.hauled = -1
    }
    const steps = this.last < 0 ? 1 : Math.max(0, Math.min(8, input.tick - this.last))
    for (let k = 0; k < steps; k++) this.step(input, input.tick - steps + 1 + k)
    this.last = input.tick
    this.draw(input)
    this.out = packFast(this.d, PALETTE, this.out)
    return this.out
  }

  // ---------------------------------------------------------------- behaviour

  private step(input: SceneInput, t: number): void {
    const L = layoutOf(input.cols, input.rows)
    const mood = input.mood
    if (mood !== this.mood) { this.mood = mood; this.moodFor = 0 } else this.moodFor++
    const held = input.bubble !== undefined
    this.calmFor = mood === 'idle' && !held ? this.calmFor + 1 : 0
    this.busyFor = mood === 'busy' ? this.busyFor + 1 : 0

    if (input.spectacle !== undefined && input.spectacle !== this.lastSpectacle && t >= input.spectacle) {
      this.lastSpectacle = input.spectacle
      this.showAt = t
    }
    if (this.showAt >= 0 && t - this.showAt >= SHOW) this.showAt = -1

    if ((t & 1) !== 0) return
    // the world, on even ticks
    if (!held) this.drift += 2
    this.wheel += mood === 'busy' ? 0.05 : 0.03
    if (this.gust > -100 && !held) this.gust += 3
    if (this.gust > L.W + 20) this.gust = -100
    if (this.gust === -100 && (t / 2 + Math.floor(hash(this.seed, 8) * 89)) % 89 === 0 && noise1(t / 300, this.seed + 7) > 0.3) this.gust = -10

    // words up: the dust has settled (nothing moves near the pet while it speaks)
    if (held) this.kind.fill(0)
    for (let i = 0; i < PARTICLES; i++) {
      const k = this.kind[i]!
      if (k === 0) continue
      this.age[i] = this.age[i]! + 1
      if (k === 1) {
        this.px[i] = this.px[i]! + this.vx[i]!
        this.py[i] = this.py[i]! + this.vy[i]!
        this.vy[i] = this.vy[i]! + 0.45
        if (this.py[i]! >= L.ground - 1 || this.age[i]! > 9) { this.kind[i] = 2; this.age[i] = 0; this.py[i] = Math.min(this.py[i]!, L.ground - 1) }
      } else {
        this.px[i] = this.px[i]! + 0.5
        this.py[i] = this.py[i]! - 0.35
        if (this.age[i]! > 4) this.kind[i] = 0
      }
    }

    // the hauler: now and then while the town works, an adult carries grass down to the nursery
    const haul = this.stills.at(input.cols, input.rows, 0)!.haul
    if (this.hauled >= 0) this.hauled += 1.5
    if (this.hauled > polyLength(haul)) this.hauled = -1
    if (haul.length >= 4 && mood === 'busy' && this.hauled < 0 && t - this.haulAt > 160 && hash(t, this.seed, 9) < 0.05) { this.hauled = 0; this.haulAt = t }
  }

  /** Throws a clod of dirt from (x, y), back and up. */
  private throwDirt(x: number, y: number, way: number, t: number): void {
    for (let i = 0; i < PARTICLES; i++) {
      if (this.kind[i] !== 0) continue
      this.kind[i] = 1
      this.age[i] = 0
      this.px[i] = x
      this.py[i] = y
      this.vx[i] = way * (1 + hash(t, i, 10) * 1.2)
      this.vy[i] = -1.4 - hash(t, i, 11) * 0.8
      return
    }
  }

  /** The pose the pet wants this tick. */
  private petWants(input: SceneInput, t: number, S: number): PetPose {
    if (this.showAt >= 0) {
      const age = t - this.showAt
      for (const [a, b] of PET_JUMPS) if (age >= a && age < b) return 'jump'
      return 'sit'
    }
    const mood = input.mood
    // the hero (S 2) chews, barks and digs at half the pace: a bigger body moves no more of the room than the band's
    if (mood === 'ponder') return Math.floor(this.moodFor / (3 * S)) % 2 === 1 ? 'bite' : 'nibble'
    if (mood === 'talk' && this.moodFor < 12) return Math.floor(this.moodFor / (3 * S)) % 2 === 0 ? 'bark' : 'sit'
    if (input.bubble !== undefined) return 'sit'
    if (mood === 'busy') {
      // bursts of digging, with a look round between
      const lap = (this.busyFor + 20) % 112
      if (lap >= 92) return 'sit'
      return Math.floor(lap / (3 * S)) % 2 === 0 ? 'dig' : 'kick'
    }
    if (this.calmFor >= 380 && this.calmFor < 396) return 'kiss'
    // idle: keep watch, and every minute or so graze a while
    const lap = (t + Math.floor(hash(this.seed, 12) * 300)) % 283
    if (lap >= 214 && this.calmFor < 340) return Math.floor(lap / 7) % 3 === 0 ? 'chew' : 'graze'
    const glance = t + Math.floor(hash(this.seed, 17) * 97)
    if (glance % 97 >= 72 && glance % 97 < 88 && hash(Math.floor(glance / 97), this.seed, 18) < 0.7) return 'look'
    const blink = (t + Math.floor(hash(this.seed, 13) * 50)) % 37
    return blink < 2 && hash(Math.floor((t + 13) / 37), this.seed, 14) < 0.6 ? 'blink' : 'sit'
  }

  /**
   * The reward: the pup peeks out after half a minute of quiet and comes out
   * after a minute and a half; once out it stays until work starts. While
   * words are up it holds as it is.
   */
  private pupWants(input: SceneInput): PupPose {
    if (input.mood === 'busy' || this.showAt >= 0) return (this.pupPose = 'none')
    if (input.bubble !== undefined) return this.pupPose
    if (this.calmFor >= 360 || (this.pupPose === 'sit' && this.calmFor === 0)) return (this.pupPose = 'sit')
    if (this.calmFor < 120) return (this.pupPose = this.pupPose === 'sit' ? 'sit' : 'none')
    return (this.pupPose = (this.calmFor - 120) % 74 < 30 ? 'peek' : 'none')
  }

  /** What a neighbour does this tick. */
  private kinWants(k: number, kk: Kin, edge: number, mood: Mood, t: number): KinPose {
    if (this.showAt >= 0) {
      const age = t - this.showAt
      const at = waveAt(kk.x, edge), back = answerAt(kk.x, edge)
      if ((age >= at && age < at + KIN_JUMP) || (age >= back && age < back + KIN_JUMP)) return 'jump'
      return 'sit'
    }
    const slot = Math.floor((t + kk.ph) / kk.per)
    const r = hash(k, slot, this.seed + 15)
    if (mood === 'busy') {
      if (r < 0.25) return 'sit'
      if (r < 0.7) return Math.floor((t + k * 3) / 4) % 2 === 0 ? 'dig' : 'kick'
      return 'graze'
    }
    if (r < 0.38) return (t + k * 29) % 53 < 14 ? 'look' : 'sit'
    if (r < 0.58) return 'peek'
    if (r < 0.8) return 'graze'
    return 'down'
  }

  // ---------------------------------------------------------------- drawing

  private draw(input: SceneInput): void {
    const d = this.d
    const L = layoutOf(input.cols, input.rows)
    const still = this.stills.at(input.cols, input.rows, 0)!
    const t = input.tick
    const te = t - (t & 1)
    d.dot.set(still.base)
    d.glyph.fill(0)
    const show = this.showAt >= 0 ? t - this.showAt : -1
    const wordsMoved = input.bubble !== this.words
    this.words = input.bubble

    // clouds: outlines lit along the top, sparse hatching inside, drifting right
    for (const c of still.clouds) this.drawCloud(c, L)
    if (still.pump.length > 0) this.drawWheel(still.pump)
    const edge = L.mx - L.moundR
    this.front = show < 8 ? -100 : show < 58 ? ((show - 8) / 50) * edge : show >= 64 && show < 86 ? (1 - (show - 64) / 22) * edge : -100
    this.drawSeeds(still)
    this.drawBelow(still, L.S, te, show)
    if (show >= 0) this.drawFolk(still, L, show)
    for (let i = 0; i < PARTICLES; i++) {
      const k = this.kind[i]!
      if (k !== 0) d.set(this.px[i]!, this.py[i]!, k === 1 ? P.dirt : P.dust)
    }

    // what the world moved this tick: the creatures move only in what is left
    const moved = this.watch.toggled(d)
    const dots = L.W * L.H
    const share = show >= 0 ? 0.03 : input.mood === 'busy' ? 0.016 : input.mood === 'talk' ? 0.012 : input.mood === 'ponder' ? 0.008 : 0.01
    let budget = wordsMoved ? 0 : Math.max(6, Math.round(dots * share)) - moved

    // the neighbours (the world's, on even ticks)
    const n = still.kin.length
    if (this.kin.length !== n) {
      this.kin = still.kin.map(() => new Actor(KIN_W, KIN_H, 1))
      this.kinPose = still.kin.map((): KinPose => 'down')
    }
    for (let k = 0; k < n; k++) {
      const kk = still.kin[k]!
      const a = this.kin[k]!
      const pose = this.kinWants(k, kk, L.mx - L.moundR, input.mood, te)
      a.aim(pose === 'down' ? undefined : KIN[pose], KIN_MAP, kk.flip)
      if (this.fresh) a.snap()
      else if ((t & 1) === 0 && budget > 0 && input.bubble === undefined) {
        budget -= a.advance(budget)
        // a kick throws a clod back, away from the way it faces
        if (pose === 'kick' && this.kinPose[k] !== 'kick' && hash(t, k, 16) < 0.5) this.throwDirt(kk.x + (kk.flip ? -3 : 3), kk.base - 4, kk.flip ? -1 : 1, t)
      }
      if ((t & 1) === 0 || this.fresh) this.kinPose[k] = pose
      a.draw(d, kk.x - 4, kk.base - 2 - KIN_H, true)
    }

    // the pup and the pet (on odd ticks)
    const pupPose = this.pupWants(input)
    this.pup.aim(pupPose === 'none' ? undefined : PUP[pupPose], PET_MAP, true)
    const petPose = this.petWants(input, t, L.S)
    this.pet.aim(PET[petPose], PET_MAP)
    if (petPose === 'nibble' || petPose === 'bite') {
      // the seed head in its paws, nibbled shorter as it thinks
      const S = L.S, left = Math.max(1, 4 - Math.floor(this.moodFor / 6))
      const y0 = PET_H * S - 14 * S + 4 * S
      for (let k = 1; k <= left; k++) for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) this.pet.mark(S + i, y0 - k * S + j, P.seed)
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) this.pet.mark(i, y0 - left * S - S + j, P.seed)
    }
    if (this.fresh) {
      this.pet.snap()
      this.pup.snap()
    } else if ((t & 1) === 1 && budget > 0) {
      budget -= this.pet.advance(budget)
      if (budget > 0) this.pup.advance(budget)
      if (petPose === 'kick' && this.petPose !== 'kick' && input.mood === 'busy') this.throwDirt(L.ox + 12 * L.S, L.ground - L.rimH - 2 * L.S, 1, t)
    }
    if ((t & 1) === 1 || this.fresh) this.petPose = petPose
    this.fresh = false
    // the pup at the burrow's mouth: peeking up out of it, or sitting on its lip facing its parent
    this.pup.draw(d, L.mx - 3 * L.S, L.ground - PUP_H * L.S, true)
    this.pet.draw(d, L.ox, L.oy, true)

    // the spectacle's calls, ringing up from each jump-yip
    if (show >= 0) this.drawCalls(still, L, show)

    if (input.bubble !== undefined) {
      const S = L.S
      const top = L.oy + this.pet.topRow()
      const c0 = Math.floor(L.ox / 2), c1 = Math.ceil((L.ox + PET_W * S) / 2)
      drawBubble(d, input.bubble, { c: Math.floor((L.ox + 2 * S) / 2), r: Math.max(0, Math.floor((top + 3 * S) / 4)) }, { c0, r0: Math.max(0, Math.floor(top / 4)), c1, r1: input.rows }, P.border, P.words, P.border, input.asciiBorders === true)
    }
  }

  /**
   * A cumulus, engraved: its sunlit edge drawn whole, its body hatched in
   * dashes along every other row, anchored to the screen, so drifting a dot
   * changes only its ends.
   */
  private drawCloud(c: Cloud, L: Layout): void {
    const d = this.d
    const span = L.W + c.w * 2
    const x = ((((c.x0 + Math.floor((this.drift + c.ph) / c.per)) % span) + span) % span) - c.w
    // a cloud low enough to pass the pet's head melts away into its middle before it gets there, as
    // fair-weather cumulus do; it forms again off the left edge
    const shrink = c.y >= L.oy ? clamp((L.ox - 4 - (x + c.w * 0.6)) / 24, 0, 1) : 1
    if (shrink <= 0) return
    for (let px = Math.max(0, Math.floor(x - c.w * 0.6)); px <= Math.min(L.W - 1, Math.ceil(x + c.w * 0.6)); px++) {
      let ht = 0
      for (let j = 0; j < c.bumps.length; j += 3) {
        const dx = (px - x - c.bumps[j]! * shrink) / (c.bumps[j + 2]! * shrink)
        if (dx > -1 && dx < 1) ht = Math.max(ht, c.bumps[j + 1]! * Math.sqrt(1 - dx * dx))
      }
      ht *= shrink
      if (ht < 1) continue
      const top = Math.round(c.y - ht)
      for (let y = Math.max(0, top); y <= c.y && y < L.far - 2; y++) {
        if (y === top) d.set(px, y, P.cloudLit)
        else if ((c.y - y) % 2 === 0 && (px + y) % 5 !== 0) d.set(px, y, y - top <= 2 ? P.cloudLit : P.cloud)
      }
    }
  }

  private drawWheel(pump: Int16Array): void {
    const d = this.d
    const px = pump[0]!, cy = pump[1]! - pump[2]! - 1
    const R = 5
    // eight vanes, the angle in sixteenths of a turn
    const step = Math.floor((this.wheel * 16) / (2 * Math.PI))
    const a0 = (step * 2 * Math.PI) / 16
    for (let k = 0; k < 8; k++) {
      const a = a0 + (k * Math.PI) / 4
      for (let r = 2; r <= R; r++) d.set(px + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, P.pump)
    }
    d.set(px, cy, P.pump)
  }

  private drawSeeds(still: Still): void {
    const d = this.d
    for (let k = 0; k < still.seeds.length; k += 2) {
      const x = still.seeds[k]!, y = still.seeds[k + 1]!
      const nod = (this.gust > -100 && Math.abs(x - this.gust) < 6) || (this.front > -100 && Math.abs(x - this.front) < 5)
      // a blue grama flag, curled to one side of its stem
      if (nod) { d.set(x + 1, y + 1, P.grass); d.set(x + 2, y + 1, P.grass); d.set(x + 1, y, P.grass) }
      else { d.set(x, y, P.grass); d.set(x - 1, y, P.grass); d.set(x - 2, y + 1, P.grass) }
    }
  }

  private drawBelow(still: Still, S: number, te: number, show: number): void {
    const d = this.d
    // the sleepers, breathing slowly; in the spectacle they lift their heads as the wave passes over
    for (let k = 0; k < still.sleepers.length; k += 3) {
      const x = still.sleepers[k]!, y = still.sleepers[k + 1]!, size = still.sleepers[k + 2]!
      const awake = show >= 20 && show < 84 && (show + k * 4) % 30 < 22
      const breath = (te + k * 17) % (52 + k * 6) < 20
      stampAt(d, awake ? AWAKE : breath ? SLEEP : SLEEP_IN, x, y, SLEEP_MAP, size)
    }
    if (still.toad.length > 0) {
      const open = (show >= 30 && show < 80) || (te % 389) < 24
      d.stamp(open ? TOAD : TOAD_SHUT, still.toad[0]!, still.toad[1]!, TOAD_MAP)
    }
    // the hauler, a mouthful of grass ahead of it
    if (this.hauled >= 0 && still.haul.length >= 4) {
      along(still.haul, Math.floor(this.hauled / 3) * 3, this.at)
      stampAt(d, HAULER, this.at[0]! - 3 * S, this.at[1]! - 2 * S, HAUL_MAP, S, this.at[2]! > 0)
    }
  }

  /** One call: an arc travelling up and out from a caller's head, `age` ticks after it rose. */
  private ring(hx: number, hy: number, age: number, reach: number): void {
    const r0 = 3 + age * 2
    if (r0 > reach) return
    for (let a = -2.4; a <= -0.75; a += 1.3 / r0) this.d.set(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0 * 0.8, P.call)
  }

  /** The far townsfolk, up on the horizon for the wave as it passes them, jump-yipping when it reaches them. */
  private drawFolk(still: Still, L: Layout, show: number): void {
    const edge = L.mx - L.moundR
    for (let k = 0; k < still.folk.length; k++) {
      const x = still.folk[k]!
      const age = show - waveAt(x, edge), back = show - answerAt(x, edge)
      if (age < -7 || back >= 7) continue
      const art = (age >= 0 && age < 4) || (back >= 0 && back < 4) ? FOLK_JUMP : FOLK_UP
      this.d.stamp(art, x - 1, L.far - art.length, FOLK_MAP)
    }
  }

  private drawCalls(still: Still, L: Layout, show: number): void {
    const edge = L.mx - L.moundR
    const reach = clamp(Math.round((L.above * 4 + 10) * 0.45), 8, 16)
    for (const kk of still.kin) {
      for (const at of [waveAt(kk.x, edge), answerAt(kk.x, edge)]) {
        const age = show - at - 1
        if (age >= 0) this.ring(kk.x + (kk.flip ? 2 : -2), kk.base - 2 - KIN_H + 3, age, reach)
      }
    }
    for (const [a] of PET_JUMPS) {
      const age = show - a - 1
      if (age >= 0) this.ring(L.ox + 3 * L.S, L.oy + 3 * L.S, age, reach + 4 * L.S)
    }
  }
}

export const prairie: SceneDef = {
  id: 'prairie-town',
  name: 'Prairie Town',
  persona: 'a black-tailed prairie dog keeping watch from its mound in a prairie town above the prompt',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 6,
  create: seed => new Prairie(seed),
}
