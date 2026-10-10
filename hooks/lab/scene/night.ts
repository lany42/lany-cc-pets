// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Owl Night: an October night over a sleeping valley, the width of the
// terminal. The stars turn about a pole above the frame at the real sky's own
// pace (a dot every minute or two), a slant of Milky Way among them; the real
// moon of tonight hangs over the hills in its true phase, lit toward the sun
// below the horizon, earthshine on its dark limb; a thin cloud drifts across
// it now and then. At the right an old oak reaches a branch over the hills,
// and on it sleeps a small tawny owl. The band is that strip: stars, the
// moon, the hills with a hamlet's few lit windows, the oak's trunk and the owl.
//
// A taller room grows the world round the strip, its extra rows split 70 / 30
// between the sky and the meadow below it:
//   sky, near    two ridges, the far one with firs and a windmill; between them
//                a village on the slope: roofs in the moonlight (brighter when
//                the moon is), windows that light and go dark on slow clocks,
//                fewer as the night wears on, chimney smoke, a church spire,
//                poplars; a round tree or two on the near hill; the oak's
//                crown over it all, its last leaves in gold and rust
//   sky, middle  the moon, cloud streaks, the Milky Way
//   sky, far     the zenith's stars; every few minutes a satellite
//   meadow       a post-and-rail fence with a gate, grass and seed heads, the
//                oak's roots and toadstools, and the leaves that fell tonight
//
//   idle    it sleeps: eyes shut, breathing; now and then one eye peeks; a
//           leaf lets go now and then, and a twig stirs. After a minute of
//           quiet a moth comes by; after two, a fox may cross the meadow;
//           after three, another owl answers from the church tower, and this
//           one peeks that way
//   busy    the wind gets up: gusts curl across, leaves fly, the twigs and the
//           grass lean, the cloud hurries, smoke bends, the windmill turns; the
//           owl is awake, big amber eyes, glancing about and blinking. It sits
//           still on its branch (only the twig at the branch's tip nods)
//   ponder  it looks up, and a constellation draws itself, star to star, in
//           open sky: the Plough, Cassiopeia, the Swan or a mouse
//   talk    it hoots its words: beak open and shut, eyes on the bubble
//   spectacle (a long turn just ended)  a shooting star crosses the whole sky
//           and the owl's eyes follow it, a smaller one after; in a tall room
//           a few more fall from the same radiant
import { clamp } from '../util'
import type { Dots as DotsT, Frame, Ink, SceneDef, SceneInput, SceneInstance } from './kit'
import { bayer, Dots, drawBubble, hash, ink, moonPhase, noise1, packFast } from './kit'

const P = {
  starDim: 1, star: 2, starBright: 3, starWarm: 4, starCool: 5, halo: 6, rim: 7, maria: 8, moon: 9,
  cloud: 10, wind: 11, ridgeFar: 12, ridgeMid: 13, hill: 14, roof: 15, roofLit: 16, lamp: 17,
  tree: 18, treeDim: 19, leafGold: 20, leafRust: 21, grass: 22, line: 23,
  owlTex: 24, owl: 25, tuft: 26, talon: 27, beak: 28, eyeShut: 29, eye: 30,
  moth: 31, meteor: 32, border: 33, words: 34, disc: 35, pupil: 36,
} as const

const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
PALETTE[P.starDim] = ink(0x343e55, 0xcdd2da)
PALETTE[P.star] = ink(0x66728e, 0xa3abb8, 1.1)
PALETTE[P.starBright] = ink(0xc6d0e6, 0x6c7688, 1.5)
PALETTE[P.starWarm] = ink(0xe6d4a0, 0x9b8143, 1.6)
PALETTE[P.starCool] = ink(0xa6c4ee, 0x4f78ad, 1.6)
PALETTE[P.halo] = ink(0x45443a, 0xddd6bc)
PALETTE[P.rim] = ink(0x3e4456, 0xc4c9d4, 0.8)
PALETTE[P.maria] = ink(0xa39c80, 0xb0a46e, 1.9)
PALETTE[P.moon] = ink(0xefe9cc, 0x8d7f45, 2)
PALETTE[P.cloud] = ink(0x4a5068, 0xa9b0be, 1.2)
PALETTE[P.wind] = ink(0x56647c, 0x98a4b5, 1)
PALETTE[P.ridgeFar] = ink(0x252e3c, 0xd3d9de)
PALETTE[P.ridgeMid] = ink(0x2b3a45, 0xc0cacf)
PALETTE[P.hill] = ink(0x2f4148, 0xb6c2c4)
PALETTE[P.roof] = ink(0x4c5464, 0xa3aab5, 1.1)
PALETTE[P.roofLit] = ink(0x6b7487, 0x87909e, 1.2)
PALETTE[P.lamp] = ink(0xf0b860, 0xc07a18, 4)
PALETTE[P.tree] = ink(0x5d4c3e, 0x7d6652, 1.6)
PALETTE[P.treeDim] = ink(0x3e342c, 0xb5a796, 1.2)
PALETTE[P.leafGold] = ink(0xa8843c, 0xb07f1c, 1.8)
PALETTE[P.leafRust] = ink(0x98563a, 0xa4502c, 1.8)
PALETTE[P.grass] = ink(0x354a3d, 0xa9b9a8)
PALETTE[P.line] = ink(0x7083b0, 0x6d80a5, 1.4)
PALETTE[P.owlTex] = ink(0x6b5642, 0xb9a487, 1.6)
PALETTE[P.owl] = ink(0xa68765, 0x7c5c3c, 2)
PALETTE[P.tuft] = ink(0xb89770, 0x6f5032, 2.2)
PALETTE[P.talon] = ink(0x8a7a60, 0x6a5a40, 2)
PALETTE[P.beak] = ink(0xe0cf96, 0x9c8530, 4)
PALETTE[P.eyeShut] = ink(0xb48c50, 0x8a6420, 4)
PALETTE[P.eye] = ink(0xf2b33d, 0xc27a00, 5)
PALETTE[P.moth] = ink(0xc8c0ac, 0x7d7564, 3)
PALETTE[P.meteor] = ink(0xf4f6ff, 0x3a4a78, 6)
PALETTE[P.border] = ink(0xf2b33d, 0xb07010, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)
PALETTE[P.disc] = ink(0x5e4c3c, 0xc4b3a0, 1.2)
PALETTE[P.pupil] = ink(0xfff4d0, 0x3a2a10, 9)

const TAU = Math.PI * 2
/** The sky turns once a sidereal day, as the real one does: radians a 250 ms tick. */
const SIDEREAL = TAU / (86164 * 4)
/** How far the moon's lit limb leans down toward the sun under the horizon. */
const TILT = 0.18

// ---------------------------------------------------------------- the owl
// 21 x 19 dots, facing you. O outline, T ear tufts, D the rims of its facial
// discs, w folded wings, v breast marks, F talons; the eyes (E rings around a
// p pupil, s shut lids) and the beak (B) are stamped on.
const HEAD = [
  '..T...............T..',
  '..TT.............TT..',
  '...TOO..OOOOO..OOT...',
  '..O..DDD.....DDD..O..',
  '.O..D...D...D...D..O.',
  'O..D.....D.D.....D..O',
  'O..D.....D.D.....D..O',
  'O..D.....D.D.....D..O',
  '.O..D...D...D...D..O.',
  '.O...DDD.....DDD...O.',
]
const BODY_OUT = [
  'O..w..v...v...v..w..O',
  'O..w.v.v.v.v.v.v.w..O',
  'O..w..v...v...v..w..O',
  '.O..w.v.v.v.v.v.w..O.',
  '.O...w.........w...O.',
  '..O...w.......w...O..',
  '...OO...........OO...',
  '.....OOFFOOOFFOO.....',
  '.......F.....F.......',
]
// breathing in: the sides draw in a dot
const BODY_IN = [
  '.O.w..v...v...v..w.O.',
  '.O.w.v.v.v.v.v.v.w.O.',
  '.O.w..v...v...v..w.O.',
  '.O..w.v.v.v.v.v.w..O.',
  '..O..w.........w..O..',
  '..O...w.......w...O..',
  '...OO...........OO...',
  '.....OOFFOOOFFOO.....',
  '.......F.....F.......',
]
const BEAK_SHUT = ['BBB', '.B.']
const BEAK_OPEN = ['BBB', '...', '.B.']
const EYES: Record<string, readonly string[]> = {
  open: ['.EEE.', 'E...E', 'E.p.E', 'E...E', '.EEE.'],
  left: ['.EEE.', 'E...E', 'Ep..E', 'E...E', '.EEE.'],
  right: ['.EEE.', 'E...E', 'E..pE', 'E...E', '.EEE.'],
  up: ['.EEE.', 'E.p.E', 'E...E', 'E...E', '.EEE.'],
  half: ['.....', 'EEEEE', 'E.p.E', 'E...E', '.EEE.'],
  halfLeft: ['.....', 'EEEEE', 'Ep..E', 'E...E', '.EEE.'],
  shut: ['.....', '.....', 'sssss', '.s.s.', '.....'],
  blink: ['.....', '.....', 'sssss', '.....', '.....'],
}
const OWL_MAP = { O: P.owl, T: P.tuft, D: P.disc, w: P.owlTex, v: P.owlTex, F: P.talon, B: P.beak, E: P.eye, s: P.eyeShut, p: P.pupil }

// ---------------------------------------------------------------- the fox
// 17 x 7 dots, trotting right: two strides. b body, h head, t brush, l legs, n nose.
const FOX = [
  [
    '.............h.h.',
    '............hhhh.',
    '..tt.bbbbbbbhhhhn',
    'ttttbbbbbbbbbh...',
    '.ttt.bb....bb....',
    '.....l.l...l.l...',
    '....l...l.l...l..',
  ],
  [
    '.............h.h.',
    '............hhhh.',
    '..tt.bbbbbbbhhhhn',
    'ttttbbbbbbbbbh...',
    '.ttt.bb....bb....',
    '......ll....ll...',
    '......ll....ll...',
  ],
]
const FOX_MAP = { b: P.leafRust, h: P.leafRust, t: P.leafRust, l: P.treeDim, n: P.treeDim }

// ---------------------------------------------------------------- the moon
/** The near side's seas in the moon's unit disc (x right, y down), as ellipses: x, y, rx, ry. */
const MARIA: readonly (readonly [number, number, number, number])[] = [
  [-0.3, -0.36, 0.26, 0.22], // Imbrium
  [0.17, -0.37, 0.16, 0.15], // Serenitatis
  [0.3, -0.06, 0.2, 0.15], // Tranquillitatis
  [0.67, -0.25, 0.12, 0.11], // Crisium
  [0.55, 0.15, 0.1, 0.16], // Fecunditatis
  [0.32, 0.26, 0.09, 0.09], // Nectaris
  [-0.6, 0.02, 0.22, 0.42], // Procellarum
  [-0.2, 0.43, 0.17, 0.12], // Nubium
]
const isMare = (u: number, v: number): boolean => MARIA.some(([x, y, rx, ry]) => ((u - x) / rx) ** 2 + ((v - y) / ry) ** 2 < 1)

/**
 * Tonight's moon in its real phase, drawn as the lit part of a sphere: the
 * sun's direction follows the phase (lit on the right while it waxes, on the
 * left as it wanes) and leans down toward the horizon, so the terminator is a
 * crisp ellipse and the sunward limb is always whole, however thin. The dark
 * side keeps a faint limb, and a big crescent a little earthshine; seas and a
 * halo show once it is more than half lit. Within a day of new moon only the
 * earthshine disc.
 */
function drawNightMoon(d: DotsT, cx: number, cy: number, r: number, phase: number): void {
  const th = phase * TAU
  const lit = (1 - Math.cos(th)) / 2
  const s = Math.sin(th)
  const lx = s * Math.cos(TILT), ly = Math.abs(s) * Math.sin(TILT), lz = -Math.cos(th)
  const seen = lit > 0.008
  const big = r >= 7
  const seas = lit > 0.45
  const earth = !seen ? (big ? 0.07 : 0) : big && lit < 0.4 ? 0.11 : 0
  const R = r + 0.2
  const glow = r + Math.max(2, Math.round(r * 0.45))
  for (let y = -glow; y <= glow; y++) {
    const yy = y * 1.05
    for (let x = -glow; x <= glow; x++) {
      const dd = Math.hypot(x, yy)
      const X = cx + x, Y = cy + y
      if (dd <= R) {
        const u = x / r, v = yy / r
        const z = Math.sqrt(Math.max(0, 1 - u * u - v * v))
        const limb = dd > r - 0.85
        if (seen && (u * lx + v * ly + z * lz > 0 || (limb && x * lx + yy * ly > 0))) {
          // the seas, once it is more than half lit: a greyer tint, never a hole in its shape
          d.set(X, Y, seas && !limb && isMare(u, v) ? P.maria : P.moon)
        } else if (limb ? bayer(X, Y) < (seen ? 0.7 : 0.45) : bayer(X, Y) < earth) d.set(X, Y, P.rim)
      } else if (dd <= glow && lit > 0.5) {
        // a halo once it is more than half lit, fuller as it fills
        const fall = 1 - (dd - r) / (glow - r + 0.6)
        if (bayer(X, Y) < fall * fall * (lit - 0.3) * 0.5) d.set(X, Y, P.halo)
      }
    }
  }
}

// ---------------------------------------------------------------- constellations
/** What it draws in the sky while it thinks: stars in a unit box and the lines between them, in drawing order. */
type Figure = { pts: readonly (readonly [number, number])[]; segs: readonly (readonly [number, number])[] }
const FIGURES: readonly Figure[] = [
  // the Plough: Alkaid, Mizar, Alioth, Megrez, Phecda, Merak, Dubhe
  { pts: [[0, 0.3], [0.17, 0.08], [0.33, 0.06], [0.5, 0.16], [0.52, 0.55], [0.88, 0.62], [0.92, 0.16]], segs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  // Cassiopeia's W
  { pts: [[0, 0.15], [0.24, 0.85], [0.5, 0.4], [0.74, 0.95], [1, 0.25]], segs: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  // the Swan, the Northern Cross, high on an October evening: Deneb, Sadr, Eta, Albireo, and its wings
  { pts: [[0.92, 0.08], [0.62, 0.4], [0.36, 0.66], [0.04, 0.96], [0.3, 0.1], [0.98, 0.72]], segs: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]] },
  // a mouse, nose to tail
  { pts: [[0, 0.8], [0.12, 0.45], [0.2, 0.05], [0.3, 0.42], [0.55, 0.3], [0.75, 0.6], [0.8, 0.95], [0.9, 0.72], [1, 0.95]], segs: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8]] },
]

// ---------------------------------------------------------------- layout

/** Where everything goes in a room, in dots. The core strip (6 rows) is the band; extra rows go 70 / 30 to the sky and the meadow. */
type Layout = {
  W: number; H: number; above: number; below: number; top: number
  trunk: number; tw: number; branchY: number; owlX: number; owlY: number; horizon: number
  r: number; moonX: number; moonY: number; poleX: number; poleY: number
}

function layoutOf(cols: number, rows: number): Layout {
  const W = cols * 2, H = rows * 4
  const extra = Math.max(0, rows - 6)
  const above = Math.round(extra * 0.7)
  const below = extra - above
  const top = above * 4
  // the oak: a thicker trunk in a taller room, the owl's branch where the band has it
  const tw = 4 + Math.min(3, Math.floor(above / 7))
  const trunk = W - Math.max(6, Math.round(W * 0.025)) - (tw - 4)
  const branchY = top + 21
  const owlX = trunk - 19, owlY = branchY - 18
  const horizon = top + 22
  const r = Math.max(5, Math.min(12, Math.round(H * 0.065)))
  const moonX = Math.max(r + 6, Math.round(W * 0.2))
  const moonY = Math.max(r + 2, Math.round(horizon * (above > 0 ? 0.32 : 0.3)))
  return { W, H, above, below, top, trunk, tw, branchY, owlX, owlY, horizon, r, moonX, moonY, poleX: W * 0.35, poleY: -(60 + H * 0.4) }
}

// ---------------------------------------------------------------- the still world, once a room

/** A tuft of leaves at a twig's end, which the wind can push a dot. */
type Cluster = { x: number; y: number; dots: readonly number[]; ink: number; ph: number; id: number; fixed: boolean; oak: boolean }
/** A window that lights and goes dark on its own slow clock. */
type Lamp = { x: number; y: number; w: number; h: number; id: number; period: number; ph: number }
type Blade = { x: number; y: number; h: number; ph: number; lean: number; head: boolean }
type Streak = { y: number; len: number; rows: number; speed: number; off: number; slope: number; dens: number; k: number }
type Still = {
  size: string
  L: Layout
  /** The first land dot down each column: the stars stay above it. */
  sky: Int16Array
  hill: Int16Array
  /** The angles about the pole the frame can show. */
  aLo: number
  aHi: number
  /** The stars: radius and angle about the pole at tick 0, kind (0 the Milky Way's glow, 1 faint, 3 star, 4-6 bright), twinkle phase. */
  sr: Float32Array
  sa: Float32Array
  sk: Uint8Array
  sp: Uint8Array
  /** Where each star is now (x -1 when out of sight), placed again in turn; `fresh` until all have been placed once. */
  sx: Int16Array
  sy: Int16Array
  cursor: number
  fresh: boolean
  /** Still layers, as (dot index << 6) | ink. */
  land: Int32Array
  oak: Int32Array
  /** Cells where no star shows: among the trees. */
  bare: Uint8Array
  ground: Int32Array
  clusters: Cluster[]
  lamps: Lamp[]
  chimneys: { x: number; y: number; id: number }[]
  blades: Blade[]
  streaks: Streak[]
  mill: { x: number; y: number; len: number } | undefined
  belfry: { x: number; y: number } | undefined
  /** The meadow the fox trots across, or -1 for none; the leaves that land stay. */
  foxY: number
  litterMost: number
}

function layerOf(g: DotsT): Int32Array {
  let n = 0
  for (let i = 0; i < g.dot.length; i++) if (g.dot[i] !== 0) n++
  const out = new Int32Array(n)
  let k = 0
  for (let i = 0; i < g.dot.length; i++) if (g.dot[i] !== 0) out[k++] = (i << 6) | g.dot[i]!
  return out
}

function blit(d: DotsT, layer: Int32Array): void {
  const dot = d.dot
  for (let k = 0; k < layer.length; k++) {
    const v = layer[k]!
    dot[v >> 6] = v & 63
  }
}

function build(cols: number, rows: number, seed: number, moonlit: boolean): Still {
  const L = layoutOf(cols, rows)
  const { W, H } = L
  const roofInk = moonlit ? P.roofLit : P.roof
  const g = new Dots(cols, rows)

  // ---- the land, back to front
  const hill = new Int16Array(W), mid = new Int16Array(W), far = new Int16Array(W)
  const riseM = L.above >= 3 ? Math.round(Math.min(34, Math.max(7, L.top * 0.32))) : 0
  const riseF = L.above >= 6 ? Math.round(Math.min(64, L.top * 0.55)) : 0
  for (let x = 0; x < W; x++) {
    const wx = W - x // fixed to the right edge, so a wider terminal shows more valley on the left
    hill[x] = L.horizon - Math.round(1 + 2.5 * noise1(wx / 31, 7) + noise1(wx / 11, 8))
    far[x] = riseF > 0 ? L.horizon - riseF - Math.round(riseF * 0.8 * (0.5 * noise1(wx / 90, 41) + 0.3 * noise1(wx / 31, 42) + 0.2 * noise1(wx / 11, 43) - 0.5)) : H
    mid[x] = riseM > 0 ? clamp(L.horizon - riseM - Math.round(riseM * 0.7 * (0.65 * noise1(wx / 57, 33) + 0.35 * noise1(wx / 19, 34) - 0.5)), far[x]! + 3, hill[x]! - 2) : H
  }
  if (riseF > 0) {
    for (let x = 0; x < W; x++) {
      const wx = W - x
      g.set(x, far[x]!, P.ridgeFar)
      for (let y = far[x]! + 1; y < mid[x]!; y++) if (hash(wx, y, 44) < 0.01) g.set(x, y, P.ridgeFar)
    }
    // firs along the far crest, in stands
    for (let c = 0; c < W / 5; c++) {
      const wx = c * 5 + 2
      if (noise1(c / 4, 45) < 0.55 || hash(c, 46) < 0.3) continue
      const x = W - wx
      if (x < 2 || x >= W - 2) continue
      const h = 2 + Math.floor(hash(c, 47) * 3)
      const y0 = far[x]! - h
      for (let k = 0; k <= h; k++) {
        const half = Math.floor(k * 0.6)
        g.set(x - half, y0 + k, P.ridgeFar)
        g.set(x + half, y0 + k, P.ridgeFar)
      }
    }
  }
  let mill: Still['mill']
  if (riseF > 0 && L.above >= 14) {
    // a windmill on the far ridge, its tower and cap; the sails are drawn each tick
    const mx = Math.round(W * 0.085)
    const base = far[mx]! + 1
    const th = 11
    for (let y = base - th - 2; y <= base; y++) for (let x = mx - 4; x <= mx + 4; x++) g.set(x, y, 0)
    g.line(mx - 3, base, mx - 1, base - th, roofInk)
    g.line(mx + 3, base, mx + 1, base - th, roofInk)
    g.line(mx - 2, base - th, mx, base - th - 2, roofInk)
    g.line(mx, base - th - 2, mx + 2, base - th, roofInk)
    g.set(mx, base - 1, P.ridgeMid)
    g.set(mx, base - 2, P.ridgeMid)
    mill = { x: mx, y: base - th - 1, len: 7 }
  }
  if (riseM > 0) {
    for (let x = 0; x < W; x++) {
      const wx = W - x
      for (let y = mid[x]! + 1; y < H; y++) g.set(x, y, 0)
      g.set(x, mid[x]!, P.ridgeMid)
      if (x < W * 0.2 || x > W * 0.68) for (let y = mid[x]! + 1; y < hill[x]!; y++) if (hash(wx, y, 35) < 0.012) g.set(x, y, P.ridgeMid)
    }
  }

  // ---- the village (or, in the band, a hamlet's few windows on the hill)
  const lamps: Lamp[] = []
  const chimneys: Still['chimneys'] = []
  let belfry: Still['belfry']
  const s = L.above >= 18 ? 2 : L.above >= 8 ? 1.5 : 1
  type House = { x0: number; w: number; base: number; wallH: number; roofH: number; hip: boolean; church: boolean; id: number }
  const houses: House[] = []
  const slope = (x: number, wallH: number, roofH: number, u: number): number => {
    const lo = mid[x]! + wallH + roofH + 2, hi = hill[x]! - 1
    return riseM > 0 && hi > lo ? Math.round(lo + (hi - lo) * u) : hi
  }
  if (riseM > 0) {
    const vx0 = Math.round(W * 0.24)
    const vx1 = Math.min(L.owlX - 30, vx0 + Math.round(Math.min(W * 0.4, 220)))
    const n = Math.max(3, Math.min(18, Math.round((vx1 - vx0) / (8.5 * s))))
    const churchAt = s >= 1.5 && n >= 5 ? Math.floor(n * 0.45) : -1
    for (let i = 0; i < n; i++) {
      const church = i === churchAt
      const w = church ? Math.round(9 * s) : Math.max(5, Math.round((5 + Math.floor(hash(i, seed, 101) * 4)) * s))
      const wallH = Math.round((church ? 3 : 2 + hash(i, 102) * 1.5) * s)
      const roofH = Math.max(2, Math.round(w * (0.32 + 0.12 * hash(i, 103))))
      const x0 = Math.round(vx0 + ((i + 0.15 + 0.7 * hash(i, 104)) * (vx1 - vx0)) / n - w / 2)
      const xc = clamp(x0 + (w >> 1), 0, W - 1)
      houses.push({ x0, w, base: slope(xc, wallH, roofH, church ? 0.3 : 0.2 + 0.8 * hash(i, 105)), wallH, roofH, hip: hash(i, 106) < 0.3, church, id: i })
    }
    // farmsteads out in the wider valley, so a wide room has no empty stretch
    for (let k = 0; k < Math.floor(W / 160); k++) {
      const x0 = Math.round(W * 0.03 + hash(k, seed, 111) * (W * 0.12)) + (k % 2 === 1 ? vx1 + 20 - Math.round(W * 0.03) : 0)
      if (x0 + 12 >= L.owlX - 24 || x0 < 2) continue
      const w = Math.round(6 * s)
      const xc = clamp(x0 + (w >> 1), 0, W - 1)
      houses.push({ x0, w, base: slope(xc, Math.round(2 * s), Math.max(2, Math.round(w * 0.4)), 0.6), wallH: Math.round(2 * s), roofH: Math.max(2, Math.round(w * 0.4)), hip: false, church: false, id: 50 + k })
    }
  } else {
    // the band: two or three cottages on the hill line, their windows lit
    const n = W >= 110 ? 3 : 2
    const x0 = Math.round(W * 0.43)
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 7 + Math.floor(hash(i, seed, 107) * 2)
      houses.push({ x0: x, w: 4, base: hill[x + 2]! - 1, wallH: 1, roofH: 2, hip: false, church: false, id: i })
    }
  }
  houses.sort((a, b) => a.base - b.base)
  for (const h of houses) {
    const x1 = h.x0 + h.w - 1
    const yw = h.base - h.wallH, yp = yw - h.roofH
    const xm = (h.x0 + x1) / 2
    const roofY = (x: number): number => (h.hip ? Math.max(yp, yw - Math.min(x - (h.x0 - 1), x1 + 1 - x)) : Math.round(yp + (Math.abs(x - xm) * h.roofH) / (h.w / 2 + 1)))
    // what it stands in front of
    for (let x = h.x0 - 1; x <= x1 + 1; x++) for (let y = roofY(x); y <= h.base; y++) g.set(x, y, 0)
    if (h.hip) {
      g.line(h.x0 - 1, yw, h.x0 - 1 + h.roofH, yp, roofInk)
      g.line(h.x0 - 1 + h.roofH, yp, x1 + 1 - h.roofH, yp, roofInk)
      g.line(x1 + 1 - h.roofH, yp, x1 + 1, yw, roofInk)
    } else {
      g.line(h.x0 - 1, yw, Math.floor(xm), yp, roofInk)
      g.line(Math.ceil(xm), yp, x1 + 1, yw, roofInk)
    }
    for (let y = yw + 1; y <= h.base; y++) {
      if (((y + h.base) & 1) === 0) { g.set(h.x0, y, roofInk); g.set(x1, y, roofInk) }
    }
    const ww = s >= 2 ? 2 : 1, wh = s >= 1.5 && h.wallH >= 4 ? 2 : 1
    const wy = yw + (h.wallH >= wh + 4 ? 3 : Math.min(2, Math.max(1, h.wallH - wh)))
    const at = h.w >= 7 ? [h.x0 + 2, x1 - 1 - ww] : [Math.round(xm - (ww - 1) / 2)]
    const lit = 1100 + Math.floor(hash(h.id, seed, 108) * 2400)
    at.forEach((x, k) => lamps.push({ x, y: wy, w: ww, h: wh, id: h.id * 4 + k, period: h.church ? 2400 : lit + k * 300, ph: Math.floor(hash(h.id, k, 109) * 4000) }))
    if (h.roofH >= 3 && hash(h.id, 110) < 0.65 && !h.church) {
      const xc = Math.round(h.x0 + h.w * 0.72)
      const yr = roofY(xc)
      g.line(xc, yr - 1, xc, yr - 2 - (s > 1 ? 1 : 0), roofInk)
      chimneys.push({ x: xc, y: yr - 3 - (s > 1 ? 1 : 0), id: h.id })
    }
    if (h.church) {
      // its tower at the left end, a spire and a cross; the belfry where an owl may sit
      const tw = Math.round(3 * s) | 1
      const tx0 = h.x0 - tw, tx1 = h.x0 - 1, txm = (tx0 + tx1) >> 1
      const tt = yw - Math.round(5 * s)
      const sp = tt - Math.round(6 * s)
      for (let y = sp; y <= h.base; y++) for (let x = tx0 - 1; x <= tx1 + 1; x++) if (y >= tt || Math.abs(x - txm) <= ((y - sp) * (tw / 2 + 1)) / (tt - sp)) g.set(x, y, 0)
      g.line(tx0, tt, tx0, h.base, roofInk)
      g.line(tx1, tt, tx1, h.base, roofInk)
      g.line(tx0 - 1, tt, txm, sp, roofInk)
      g.line(txm, sp, tx1 + 1, tt, roofInk)
      g.line(txm, sp - 1, txm, sp - 3, roofInk)
      g.set(txm - 1, sp - 2, roofInk)
      g.set(txm + 1, sp - 2, roofInk)
      belfry = { x: txm, y: tt + 2 }
    }
  }
  // poplars among the houses
  if (riseM > 0 && s >= 1.5) {
    const n = Math.max(1, Math.round(W / 110))
    for (let k = 0; k < n; k++) {
      const x = Math.round(W * 0.22 + hash(k, seed, 121) * Math.max(10, L.owlX - 40 - W * 0.22))
      const h = Math.round((9 + hash(k, 122) * 5) * (s / 1.5))
      const base = slope(x, 2, 2, 0.4 + 0.5 * hash(k, 123))
      for (let j = 0; j <= h; j++) {
        // a Lombardy poplar: a feathery spike, its twigs thinning to a point
        const u = j / h
        const full = Math.pow(u < 0.2 ? u / 0.2 : (1 - u) / 0.8, 0.6)
        for (let x2 = x - 2; x2 <= x + 2; x2++) g.set(x2, base - j, 0)
        if (u < 0.12 || hash(k, j, 124) < 0.8) g.set(x, base - j, roofInk)
        for (const side of [-1, 1]) {
          if (hash(k, j * side, 125) < 0.55 * full) g.set(x + side, base - j, roofInk)
          if (hash(k, j * side, 126) < 0.3 * full - 0.05) g.set(x + side * 2, base - j, roofInk)
        }
      }
    }
  }

  // the near hills: clear what they hide, then their line and the meadow below it
  for (let x = 0; x < W; x++) {
    const wx = W - x
    for (let y = hill[x]! + 1; y < H; y++) g.dot[y * W + x] = 0
    g.set(x, hill[x]!, P.hill)
    if (hash(wx, hill[x]!, 9) < 0.08) g.set(x, hill[x]! + 1, P.hill)
    if (L.below > 0) {
      const fence = L.below >= 4 ? Math.round(hill[x]! + (H - hill[x]!) * 0.3) + 6 : -99
      for (let y = hill[x]! + 3; y < H; y++) {
        if ((y > fence - 9 && y < fence + 3) || x > L.trunk - 16) continue // the fence and the oak's foot stand clear
        const depth = (y - hill[x]!) / Math.max(1, H - hill[x]!)
        if (hash(wx, y, 21) < 0.01 + 0.05 * depth) g.set(x, y, P.grass)
      }
    }
  }
  const sky = new Int16Array(W)
  for (let x = 0; x < W; x++) {
    let y = 0
    while (y < H && g.dot[y * W + x] === 0) y++
    sky[x] = y
  }
  // no star sits among the windmill's sails
  if (mill !== undefined) for (let x = mill.x - mill.len - 1; x <= mill.x + mill.len + 1; x++) if (x >= 0 && x < W) sky[x] = Math.min(sky[x]!, mill.y - mill.len - 1)
  const land = layerOf(g)

  // ---- trees with leaves: one or two round trees on the near hill, and the oak's crown
  const clusters: Cluster[] = []
  const tr = new Dots(cols, rows)
  let cid = 0
  const tuft = (x: number, y: number, oak: boolean, big: number, hue = -1): void => {
    const id = cid++
    const roll = hash(id, seed, 131)
    if (roll < 0.14) return // bare: it is October
    // gold and rust in patches, as a tree turns, with a few leaves already brown
    const warm = hue >= 0 ? hue : noise1((x + y * 0.7) / 22, 136 + seed % 7)
    const inkOf = roll > 0.92 ? P.treeDim : warm < 0.55 ? P.leafGold : P.leafRust
    const dots: number[] = []
    const n = 4 + Math.floor(hash(id, 132) * (3 + big))
    for (let k = 0; k < n * 3 && dots.length < n * 2; k++) {
      const dx = Math.round((hash(id, k, 133) - 0.5) * (5 + big)), dy = Math.round((hash(id, k, 134) - 0.5) * (3 + big * 0.6))
      if (dots.some((v, j) => j % 2 === 0 && v === dx && dots[j + 1] === dy)) continue
      dots.push(dx, dy)
    }
    const fixed = x > L.owlX - 8 && y > L.owlY - 12
    clusters.push({ x: Math.round(x), y: Math.round(y), dots, ink: inkOf, ph: hash(id, 135) * TAU, id, fixed, oak })
  }
  if (L.above >= 8 && W >= 160) {
    // round trees on the near hill: a short trunk, a few boughs, a dome of leaves
    const spots = W >= 300 ? [0.04, 0.12] : [0.06]
    spots.forEach((f, k) => {
      const x = Math.round(W * f)
      const base = hill[x]!
      const k2 = s / 1.5
      const th = Math.round((5 + hash(k, seed, 141) * 3) * k2)
      const rx = Math.round(8 * k2), ry = Math.round(6 * k2)
      const cy = base - th - ry + 1
      tr.line(x, base, x, base - th, P.tree)
      tr.line(x + 1, base, x + 1, base - th + 2, P.tree)
      for (const [fx, fy] of [[-0.7, 0.1], [0.65, -0.1], [-0.2, -0.75], [0.25, -0.6]] as const) tr.line(x, base - th, x + fx * rx * 0.8, cy + fy * ry * 0.8, P.tree)
      const n = Math.round(9 * k2)
      for (let j = 0; j < n; j++) {
        const a = Math.PI * (0.9 + (1.2 * j) / (n - 1)) + (hash(j, k, 142) - 0.5) * 0.3
        tuft(x + Math.cos(a) * rx * 0.85, cy + Math.sin(a) * ry * 0.85, false, 1, k === 0 ? 0.8 : 0.2)
      }
      for (let j = 0; j < 3; j++) tuft(x + (hash(j, k, 143) - 0.5) * rx, cy + (hash(j, k, 144) - 0.3) * ry * 0.6, false, 0, k === 0 ? 0.8 : 0.2)
    })
  }

  // the oak: its trunk, the whole height, as the band draws it in the core
  // strip; above it, leaning in over the valley; below, its foot flaring
  const coreAt = (y: number): number => L.trunk + Math.round((L.top + 24 - y) * 0.06) + (y > L.top + 20 ? y - L.top - 20 : 0)
  const foot = coreAt(L.top + 23)
  const trunkAt = (y: number): number =>
    y < L.top ? coreAt(L.top) - Math.round((L.top - y) * 0.1) : y < L.top + 24 ? coreAt(y) : foot - Math.round(((y - L.top - 23) / Math.max(1, H - L.top - 23)) ** 1.5 * 8)
  for (let y = 0; y < H; y++) {
    const x0 = trunkAt(y)
    const x1 = y < L.top + 24 ? x0 + L.tw : foot + L.tw
    tr.set(x0, y, P.tree)
    tr.set(x1, y, P.tree)
    if (hash(y, 51) < 0.35) tr.set(x0 + 1 + Math.floor(hash(y, 52) * (x1 - x0 - 1)), y, P.tree)
    if (x1 - x0 > 4 && hash(y, 53) < 0.25) tr.set(x0 + 1 + Math.floor(hash(y, 54) * (x1 - x0 - 1)), y, P.tree)
  }
  if (L.above >= 6) {
    // a few great limbs reaching out over the valley, each a gentle curve that
    // forks, thinning, toward twigs and the last of the leaves
    const owlBox = (x: number, y: number) => x > L.owlX - 6 && y > L.owlY - 8
    const grow = (x: number, y: number, a: number, len: number, depth: number, k: number, thick: boolean): void => {
      let px = x, py = y, pa = a
      for (let i = 0; i < 3; i++) {
        pa += (hash(k, i, 151) - 0.5) * 0.4 + (-Math.PI / 2 - pa) * 0.07
        const nx = px + (Math.cos(pa) * len) / 3, ny = py + (Math.sin(pa) * len) / 3
        if (owlBox(nx, ny)) return
        const c = P.tree
        tr.line(px, py, nx, ny, c)
        if (thick) tr.line(px, py + 1, nx, ny + 1, c)
        if (depth <= 1 && i >= 1 && hash(k, i, 152) < (L.above >= 20 ? 0.7 : 0.35)) tuft(nx, ny, true, i === 2 ? 1 : 0)
        px = nx
        py = ny
      }
      if (depth === 0 || py < -4 || px < W * 0.38) {
        tuft(px, py, true, 2)
        if (L.above >= 20) tuft(px + Math.cos(pa + 1.2) * 4, py + Math.sin(pa + 1.2) * 3, true, 1)
        return
      }
      const spread = 0.42 + 0.25 * hash(k, 153)
      for (let j = 0; j < 2; j++) grow(px, py, pa + (j === 0 ? -spread : spread * 0.8), len * (0.62 + 0.12 * hash(k, j, 156)), depth - 1, k * 3 + j + 1, false)
    }
    const len = clamp(Math.min(W * 0.16, L.top * 0.42), 12, 46)
    const depth = L.above >= 20 ? 3 : 2
    grow(trunkAt(L.owlY - 6), L.owlY - 6, -2.9, len, depth, 7, true)
    const y2 = Math.round(L.owlY - 6 - L.top * 0.45)
    if (y2 > 6) grow(trunkAt(y2), y2, -2.45, len * 0.9, depth, 104, true)
    const y3 = Math.round(L.owlY - 6 - L.top * 0.8)
    if (y3 > 2) grow(trunkAt(y3), y3, -2.0, len * 0.7, depth - 1, 201, false)
  }
  const oak = layerOf(tr)
  // the stars behind the trees' wood and leaves stay hidden: no star cell between twigs
  const bare = new Uint8Array(cols * rows)
  const hide = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const c = (y >> 2) * cols + (x >> 1)
    for (let k = Math.max(0, (x >> 1) - 2); k <= Math.min(cols - 1, (x >> 1) + 2); k++) bare[c - (x >> 1) + k] = 1
  }
  for (let k = 0; k < oak.length; k++) { const i = oak[k]! >> 6; hide(i % W, Math.floor(i / W)) }
  for (const cl of clusters) for (let k = 0; k < cl.dots.length; k += 2) { hide(cl.x + cl.dots[k]! - 1, cl.y + cl.dots[k + 1]!); hide(cl.x + cl.dots[k]! + 1, cl.y + cl.dots[k + 1]!) }

  // ---- the meadow: a fence, grass and seed heads, roots and toadstools
  const gr = new Dots(cols, rows)
  const blades: Blade[] = []
  let foxY = -1
  if (L.below > 0) {
    const depthOf = (x: number) => H - hill[x]!
    let fenceFoot = H
    if (L.below >= 4) {
      // a post-and-rail fence along the meadow, its rails sagging a little, and a gate
      const fy = (x: number) => Math.round(hill[clamp(x, 0, W - 1)]! + depthOf(clamp(x, 0, W - 1)) * 0.3) + 6
      const end = L.trunk - 10
      const gate = Math.round(W * 0.46)
      const posts: number[] = []
      for (let x = 1 + Math.floor(hash(seed, 160) * 6); x < end; x += 13 + Math.floor(hash(x, seed, 161) * 6)) {
        if (Math.abs(x - gate) < 12) continue
        posts.push(x)
      }
      posts.push(gate - 9, gate + 9)
      posts.sort((a, b) => a - b)
      for (let k = 0; k < posts.length; k++) {
        const x = posts[k]!
        const lean = hash(x, 162) < 0.25 ? 1 : 0 // an old post leans
        gr.line(x, fy(x) + 1, x + lean, fy(x) - 7, P.treeDim)
        const nx = posts[k + 1]
        if (nx === undefined || (x === gate - 9 && nx === gate + 9)) continue
        if (hash(x, 163) < 0.12) continue // a rail is down here
        for (const drop of [5, 2]) {
          for (let x2 = x + 1; x2 < nx; x2++) {
            const u = (x2 - x) / (nx - x)
            const y = Math.round(fy(x) + (fy(nx) - fy(x)) * u) - drop + Math.round(Math.sin(u * Math.PI) * 0.8)
            gr.set(x2, y, P.treeDim)
          }
        }
      }
      // the gate: five bars and a brace
      const g0 = gate - 8, g1 = gate + 8
      for (let b = 0; b < 3; b++) gr.line(g0, fy(g0) - 1 - b * 3, g1, fy(g1) - 1 - b * 3, P.treeDim)
      gr.line(g0, fy(g0) - 1, g1, fy(g1) - 7, P.treeDim)
      fenceFoot = Math.round(H - (H - hill[gate]!) * 0.7) + 8
      if (H - fenceFoot >= 12 && W >= 100) foxY = Math.round(fenceFoot + (H - fenceFoot) * 0.35)
    }
    // the oak's roots and toadstools at its foot
    const rootX = trunkAt(H - 1)
    for (let k = 0; k < 3; k++) {
      const x2 = rootX - 8 - k * 7 - Math.floor(hash(k, 171) * 5)
      gr.line(rootX + 2, H - 3 - k, x2, H - 1 - (k === 1 ? 1 : 0), P.tree)
    }
    if (L.below >= 5) {
      for (let k = 0; k < 3; k++) {
        const x = rootX - 22 - k * 6 - Math.floor(hash(k, 172) * 4)
        const y = H - 3 - Math.floor(hash(k, 173) * 3)
        gr.stamp(k === 1 ? ['.rr.', 'rrrr', '.m..'] : ['.rrr.', 'rrrrr', '..m..', '..m..'], x, y - 3, { r: P.leafRust, m: P.moth })
      }
    }
    // the grass, swaying while the wind blows
    const tall = L.below >= 4 ? Math.min(9, Math.round((H - fenceFoot) * 0.5) + 2) : 3
    for (let x = 0; x < W; x += 2) {
      if (hash(x, seed, 181) < 0.3 || noise1(x / 11, 188) < 0.3 || (x > rootX - 30 && x < rootX + L.tw + 2)) continue
      const bx = x + Math.floor(hash(x, 182) * 2)
      const deep = Math.floor(hash(x, 183) * Math.max(1, Math.min(8, (H - fenceFoot) * 0.5)))
      const h = 2 + Math.floor(hash(x, 184) * (tall - 1))
      blades.push({ x: bx, y: H - 1 - deep, h, ph: hash(x, 185) * TAU, lean: hash(x, 186) - 0.5, head: h >= 6 && hash(x, 187) < 0.15 })
    }
  }
  const ground = layerOf(gr)

  // ---- the sky
  const rMin = -L.poleY - 2
  const rMax = Math.hypot(Math.max(L.poleX, W - L.poleX), H - L.poleY)
  const aLo = Math.atan2(-L.poleY, W - L.poleX) - 0.02, aHi = Math.atan2(-L.poleY, -L.poleX) + 0.02
  // the Milky Way, as it lies at tick 0: low on the left, high over the oak
  const mx0 = 0, my0 = L.horizon * 0.8, mx1 = W * 0.8, my1 = -L.horizon * 0.25
  const mlen = Math.hypot(mx1 - mx0, my1 - my0)
  const nx = -(my1 - my0) / mlen, ny = (mx1 - mx0) / mlen
  const half = Math.max(4, L.horizon * 0.13)
  const glowShare = L.above >= 3 ? 0.13 : 0.03
  const R: number[] = [], A: number[] = [], K: number[] = [], Ph: number[] = []
  const keep = (x: number, y: number, kind: number, i: number): void => {
    const dx = x - L.poleX, dy = y - L.poleY
    const rr = Math.hypot(dx, dy)
    if (rr < rMin || rr > rMax) return
    R.push(rr)
    A.push(Math.atan2(dy, dx))
    K.push(kind)
    Ph.push(Math.floor(hash(i, 4) * 256))
  }
  // the field: stars all round the pole, at every angle the sky can turn to
  const n = Math.round(Math.PI * (rMax * rMax - rMin * rMin) * 0.0126)
  for (let i = 0; i < n; i++) {
    const rr = Math.sqrt(rMin * rMin + hash(i, seed, 1) * (rMax * rMax - rMin * rMin))
    const base = hash(i, seed, 2) * TAU
    const q = hash(i, 6) * 0.0126, k = hash(i, 3)
    keep(L.poleX + Math.cos(base) * rr, L.poleY + Math.sin(base) * rr, q < 0.0006 ? (k < 0.14 ? 5 : k < 0.28 ? 6 : 4) : q < 0.0017 ? 3 : 1, i)
  }
  // the Milky Way: more faint stars and its glow, sampled only in a strip
  // about its spine (it turns out of the frame over a few hours)
  const len0 = -mlen * 0.5, len1 = mlen * 1.5, wide = half * 2.6
  const m = Math.round((len1 - len0) * wide * 2 * (0.03 + glowShare))
  for (let i = 0; i < m; i++) {
    const along = len0 + hash(i, seed, 7) * (len1 - len0)
    const across0 = (hash(i, seed, 8) * 2 - 1) * wide
    const wob = (noise1(along / 23, 11) - 0.5) * half * 0.9
    const across = across0 - wob
    const off = Math.abs(across) / (half * (0.7 + 0.6 * noise1(along / 41, 12)))
    if (off >= 1.6) continue
    const band = Math.exp(-off * off * 1.6)
    // the Great Rift: a dark lane down the band's middle for part of its length
    const rift = Math.abs(across + half * 0.1) < half * 0.16 && noise1(along / 60, 13) > 0.4 ? 0.3 : 1
    const q = hash(i, 9) * (0.03 + glowShare)
    const kind = q < 0.03 * band * rift ? 1 : q < 0.03 + glowShare * band * band * rift && q >= 0.03 ? 0 : -1
    if (kind < 0) continue
    const x = mx0 + ((mx1 - mx0) / mlen) * along + nx * across0, y = my0 + ((my1 - my0) / mlen) * along + ny * across0
    keep(x, y, kind, n + i)
  }

  // ---- cloud: thin streaks; one crosses at the moon's height
  const streaks: Streak[] = []
  const nS = L.above >= 10 ? (W > 300 ? 3 : 2) : 1
  for (let k = 0; k < nS; k++) {
    const y = k === 0 ? L.moonY + Math.round(L.r * 0.35) : k === 1 ? Math.round(L.horizon * 0.12) : Math.round(L.horizon * 0.5)
    streaks.push({ y, len: Math.round(Math.max(30, W * (0.22 + 0.1 * hash(k, seed, 191)))), rows: L.above >= 10 ? 3 : 2, speed: 0.8 + 0.4 * k, off: hash(k, 192) * W * 2, slope: (hash(k, 193) - 0.5) * 0.04, dens: L.above >= 3 ? 0.55 : 0.4, k })
  }

  return {
    size: '',
    L, sky, hill, aLo, aHi,
    sr: Float32Array.from(R), sa: Float32Array.from(A), sk: Uint8Array.from(K), sp: Uint8Array.from(Ph),
    sx: new Int16Array(R.length).fill(-1), sy: new Int16Array(R.length), cursor: 0, fresh: true,
    land, oak, bare, ground, clusters, lamps, chimneys, blades, streaks, mill, belfry, foxY,
    litterMost: L.below > 0 ? Math.round(W / 3) : 0,
  }
}

// ---------------------------------------------------------------- the scene

type Meteor = { x: number; y: number; vx: number; vy: number; age: number; life: number; trail: [number, number][] }
type Moth = { x: number; y: number; vx: number; t0: number }
type Leaf = { x: number; y: number; ph: number; age: number; ink: number; land: number }
type Fox = { x: number; t0: number; rest: number }

/** The share of the village's windows lit at this hour of the night, by the person's own clock. */
function litShare(now: number): number {
  const h = new Date(now).getHours()
  return h >= 17 && h < 22 ? 0.72 : h >= 22 ? 0.5 : h < 5 ? 0.2 : h < 8 ? 0.4 : 0.55
}

class Night implements SceneInstance {
  private d: DotsT = new Dots(1, 1)
  private out: Frame | undefined
  private seed: number
  private still: Still | undefined
  private last = -1
  private mood = 'idle'
  private moodFor = 0
  private calmFor = 0
  private eyes = 'shut'
  /** One eye opens alone: 1 the left, 2 the right; the other stays shut. */
  private peekEye = 0
  private eyeHold = 0
  private peekAt = 120
  private wind = 0
  private drift = 0
  private sails = 0
  private meteors: Meteor[] = []
  private moth: Moth | undefined
  private fox: Fox | undefined
  private answerAt = -100
  private nextAnswer = 0
  private lastSpectacle: number | undefined
  private constellation: { fig: Figure; x: number; y: number; w: number; h: number } | undefined
  private leaves: Leaf[] = []
  private litter: number[] = []
  /** Where the bubble was last drawn, in dots with a two-cell margin: nothing there moves but the owl. */
  private hush: { x0: number; y0: number; x1: number; y1: number } | undefined
  private lit = { at: -1, share: 0.5 }
  private moon: { key: string; layer: Int32Array } = { key: '', layer: new Int32Array(0) }

  constructor(seed: number) {
    this.seed = seed
  }

  frame(input: SceneInput): Frame {
    if (this.d.cols !== input.cols || this.d.rows !== input.rows) {
      this.d = new Dots(input.cols, input.rows)
      this.out = undefined
      this.leaves = []
      this.litter = []
      this.fox = undefined
      this.moth = undefined
      this.hush = undefined
    }
    const steps = this.last < 0 ? 1 : Math.max(0, Math.min(8, input.tick - this.last))
    for (let k = 0; k < steps; k++) this.step(input, input.tick - steps + 1 + k)
    this.last = input.tick
    this.draw(input)
    this.out = packFast(this.d, PALETTE, this.out)
    return this.out
  }

  private stillAt(cols: number, rows: number, now: number): Still {
    const lit = (1 - Math.cos(moonPhase(now) * TAU)) / 2
    const size = `${cols}x${rows}:${lit > 0.5 ? 1 : 0}`
    if (this.still?.size !== size) this.still = { ...build(cols, rows, this.seed, lit > 0.5), size }
    return this.still
  }

  /** Near the owl or its bubble, where nothing but the owl may move. */
  private hushed(L: Layout, x: number, y: number): boolean {
    if (x > L.owlX - 4 && x < L.trunk + L.tw + 2 && y > L.owlY - 8 && y < L.branchY + 8) return true
    const h = this.hush
    return h !== undefined && x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1
  }

  private step(input: SceneInput, t: number): void {
    const S = this.stillAt(input.cols, input.rows, input.now)
    const L = S.L
    const mood = input.mood
    if (mood !== this.mood) { this.mood = mood; this.moodFor = 0 } else this.moodFor++
    this.calmFor = mood === 'idle' ? this.calmFor + 1 : 0
    const busy = mood === 'busy'

    // the wind: still at rest, gusts while Claude works
    this.wind = busy ? 0.5 + noise1(t / 10, 3) : 0
    this.drift += 0.025 + this.wind * 0.3
    if (busy && this.wind > 0.75 && t % 6 === 1) this.sails = (this.sails + 1) % 16

    if (input.spectacle !== undefined && input.spectacle !== this.lastSpectacle && t >= input.spectacle) {
      this.lastSpectacle = input.spectacle
      const y0 = 1 + hash(t, 5) * (L.above >= 8 ? L.top * 0.12 : 3)
      this.meteors.push({ x: L.owlX - 6, y: y0, vx: -Math.max(8, L.W / 22), vy: 0.5 + (L.H > 30 ? 1 : 0.25), age: 0, life: 40, trail: [] })
      this.meteors.push({ x: L.owlX - 30, y: 0, vx: -6, vy: 0.8, age: -14, life: 26, trail: [] })
      if (L.above >= 8) {
        // a few more from the same radiant, high in the sky
        const rx = L.W * 0.5, ry = L.top * 0.08
        for (let k = 0; k < 4; k++) {
          const a = Math.PI * (0.12 + 0.76 * hash(t, k, 6))
          const v = 4 + hash(t, k, 7) * 2
          this.meteors.push({ x: rx + Math.cos(a) * 10, y: ry + Math.sin(a) * 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, age: -(44 + k * 26), life: 9, trail: [] })
        }
      }
    }
    for (const m of this.meteors) {
      m.age++
      if (m.age <= 0) continue
      if (m.x > -4 && m.x < L.W + 4) {
        m.trail.push([m.x, m.y])
        m.x += m.vx
        m.y += m.vy * (1 + m.age * 0.05)
      }
    }
    this.meteors = this.meteors.filter(m => m.age < m.life)
    const shown = this.meteors.find(m => m.age > 0)

    // the owl's eyes; they wait out the tick its breath turns, so the two never move together
    if (this.eyeHold > 0) this.eyeHold--
    const turning = t % (mood === 'idle' ? 10 : 6) === 0 || (busy && t % 6 === 3)
    if (shown !== undefined) {
      this.eyes = shown.age < 2 ? 'open' : shown.vx < 0 ? 'left' : 'up'
      this.peekEye = 0
    } else if (mood === 'idle') {
      if (this.moodFor === 0) { this.eyes = 'half'; this.peekEye = 0; this.eyeHold = 8 }
      else if (this.eyeHold === 0 && !turning) {
        if (S.belfry !== undefined && this.calmFor > 720 && t >= this.nextAnswer) {
          // another owl answers from the church tower; this one peeks that way
          this.answerAt = t
          this.nextAnswer = t + 600 + Math.floor(hash(t, 11) * 900)
          this.eyes = 'halfLeft'
          this.peekEye = 1
          this.eyeHold = 14
        } else if (t >= this.peekAt) {
          // a peek: one eye, one long look, then back to sleep
          this.eyes = 'half'
          this.peekEye = hash(t, 6) < 0.5 ? 1 : 2
          this.eyeHold = 6 + Math.floor(hash(t, 7) * 6)
          this.peekAt = t + 160 + Math.floor(hash(t, 8) * 240)
        } else { this.eyes = 'shut'; this.peekEye = 0 }
      }
    } else if (busy) {
      this.peekEye = 0
      if (this.eyeHold === 0 && !turning) {
        const roll = hash(t, this.seed, 9)
        this.eyes = this.eyes === 'blink' ? 'open' : roll < 0.12 ? 'blink' : roll < 0.3 ? 'left' : roll < 0.42 ? 'right' : 'open'
        this.eyeHold = this.eyes === 'blink' ? 1 : 6 + Math.floor(hash(t, 10) * 10)
      }
    } else if (mood === 'ponder') {
      this.eyes = 'up'
      this.peekEye = 0
    } else {
      this.eyes = this.moodFor % 9 === 8 ? 'blink' : 'left'
      this.peekEye = 0
    }

    // ponder: a figure of stars near its head, joined one line at a time
    if (mood === 'ponder' && this.moodFor === 0) {
      const fig = FIGURES[Math.floor(hash(t, this.seed, 21) * FIGURES.length)]!
      const clear = L.moonX + L.r + Math.max(2, Math.round(L.r * 0.45)) + 3
      if (L.above < 6) {
        // the band: between the moon and the bubble's margin, left of its head
        const x1 = L.owlX - 23
        const w = clamp(x1 - clear, 10, 36)
        this.constellation = { fig, x: x1 - w, y: 2, w, h: Math.min(14, L.horizon - 8) }
      } else {
        // a window: the patch of open sky with the fewest twigs and no land in it
        const w = clamp(Math.round(L.W * 0.2), 30, 64), h = Math.round(w * 0.5)
        const y = Math.max(3, Math.round(L.top * 0.15))
        let best = clear, score = Infinity
        for (let x = clear; x + w < L.W - 4; x += 6) {
          let n = 0
          for (let c = x >> 1; c <= (x + w) >> 1; c++) {
            for (let r = y >> 2; r <= (y + h) >> 2; r++) n += S.bare[r * input.cols + c]!
            if (S.sky[c * 2]! < y + h + 4) n += 8
          }
          if (n + (L.owlX - x) * 0.01 < score) { score = n + (L.owlX - x) * 0.01; best = x }
        }
        this.constellation = { fig, x: best, y, w, h }
      }
    }
    if (mood !== 'ponder' && this.moodFor > 6) this.constellation = undefined

    // a moth, after a minute of quiet, once in a while: it flutters in and away up before the owl
    if (this.moth === undefined && this.calmFor > 240 && hash(t, this.seed, 12) < 0.004) {
      const top = L.above > 0 ? Math.max(4, L.top - 20) : 3
      this.moth = { x: -2, y: top + hash(t, 13) * Math.max(4, L.above > 0 ? 20 : L.H * 0.4), vx: 0.55, t0: t }
    }
    if (this.moth !== undefined) {
      const m = this.moth
      m.x += m.vx
      m.y += Math.sin((t - m.t0) / 3) * 0.5 - (m.x > L.owlX - 30 ? 0.8 : 0)
      if (m.x > L.owlX - 12 || m.y < -3 || !(mood === 'idle' || mood === 'talk')) this.moth = undefined
    }

    // a fox, after two minutes of quiet, across the meadow; it stops halfway to look up
    if (S.foxY >= 0 && this.fox === undefined && mood === 'idle' && this.calmFor > 480 && hash(t, this.seed, 14) < 0.003) this.fox = { x: -18, t0: t, rest: 0 }
    if (this.fox !== undefined) {
      const f = this.fox
      if (mood !== 'idle') this.fox = undefined
      else if (f.rest > 0) f.rest--
      else if ((t - f.t0) % 2 === 0) {
        f.x++
        if (f.x === Math.round(L.W * 0.38)) f.rest = 16
        if (f.x > L.W + 2) this.fox = undefined
      }
    }

    // leaves let go: from the twigs in a tall room, from the unseen crown above in the band
    const room = Math.sqrt((L.W * L.H) / 3168)
    const most = Math.round(Math.min(12, 3 * room))
    if (this.leaves.length < most && hash(t, this.seed, 15) < (busy ? 0.07 : 0.009) * room) {
      const free = S.clusters.filter(c => !c.fixed)
      let x: number, y: number
      if (free.length > 0) { const c = free[Math.floor(hash(t, 16) * free.length)]!; x = c.x; y = c.y }
      else { x = L.W * 0.25 + hash(t, 17) * Math.max(4, L.owlX - 18 - L.W * 0.25); y = -1 }
      const xi = clamp(Math.round(x), 0, L.W - 1)
      const land = L.below > 0 ? S.hill[xi]! + 3 + hash(t, 18) * Math.max(1, L.H - S.hill[xi]! - 5) : S.hill[xi]! - 1
      if (y < land - 2) this.leaves.push({ x, y, ph: hash(t, 19) * TAU, age: 0, ink: hash(t, 20) < 0.55 ? P.leafGold : P.leafRust, land })
    }
    for (const f of this.leaves) {
      f.age++
      const flutter = Math.sin(f.age / 4 + f.ph)
      f.x += busy ? -(0.55 + this.wind * 0.8) + flutter * 0.3 : -0.04 + flutter * 0.28
      f.y += busy ? 0.3 : 0.2
      if (f.y >= f.land) {
        if (S.litterMost > 0) {
          this.litter.push(((Math.round(f.land) * L.W + clamp(Math.round(f.x), 0, L.W - 1)) << 6) | f.ink)
          if (this.litter.length > S.litterMost) this.litter.shift()
        }
        f.age = -1
      }
    }
    this.leaves = this.leaves.filter(f => f.age >= 0 && f.x > -2 && f.x < L.W + 2 && !this.hushed(L, f.x, f.y))
  }

  private draw(input: SceneInput): void {
    const d = this.d
    const S = this.stillAt(input.cols, input.rows, input.now)
    const L = S.L
    const { W, H } = L
    const t = input.tick
    const busy = input.mood === 'busy'
    const quiet = input.bubble !== undefined
    d.clear()
    const dot = d.dot

    // ---- the sky: glow and stars, turning with the real sky. A star moves a
    // dot a minute or so, so each is placed again only every 32 ticks, a 32nd
    // of them a tick: the work and the motion are spread thin.
    const n = S.sr.length
    const each = S.fresh ? n : Math.ceil(n / 32)
    S.fresh = false
    const rot = -SIDEREAL * t
    for (let k = 0; k < each; k++) {
      const i = (S.cursor + k) % n
      let a = S.sa[i]! + rot
      a -= TAU * Math.floor(a / TAU)
      if (a < S.aLo || a > S.aHi) { S.sx[i] = -1; continue }
      const rr = S.sr[i]!
      S.sx[i] = Math.round(L.poleX + Math.cos(a) * rr)
      S.sy[i] = Math.round(L.poleY + Math.sin(a) * rr)
    }
    S.cursor = (S.cursor + each) % n
    const keep = (L.r + Math.max(2, Math.round(L.r * 0.45)) + 1) ** 2
    const c = this.constellation
    for (let i = 0; i < n; i++) {
      const x = S.sx[i]!, y = S.sy[i]!
      if (x < 0 || x >= W || y < 0 || y >= S.sky[x]! - 1) continue
      const dx = x - L.moonX, dy = y - L.moonY
      if (dx * dx + dy * dy < keep || S.bare[(y >> 2) * input.cols + (x >> 1)] === 1) continue
      // while a figure draws itself, the sky round it keeps out of its way
      if (c !== undefined && L.above >= 3 && this.moodFor >= 1 && x >= c.x - 4 && x <= c.x + c.w + 4 && y >= c.y - 4 && y <= c.y + c.h + 4) continue
      const kind = S.sk[i]!
      const ph = S.sp[i]!
      const at = y * W + x
      // one ink for the faint and the glow (fewer runs); a faint star brightens now and then
      if (kind <= 1) dot[at] = kind > 0 && hash(i, Math.floor((t + ph * 3) / 160)) > 0.96 ? P.star : P.starDim
      else if (kind === 3) {
        // a brighter star: in the band its own ink; in a window two faint dots (no extra run)
        if (L.above >= 3) { dot[at] = P.starDim; if (y + 1 < S.sky[x]! - 1) dot[at + W] = P.starDim } else dot[at] = P.star
      }
      else {
        dot[at] = kind === 5 ? P.starWarm : kind === 6 ? P.starCool : P.starBright
        // a bright star flares now and then into a little cross
        if (hash(i, Math.floor((t + ph * 2) / 70), 5) < 0.4) { d.set(x - 1, y, P.starDim); d.set(x + 1, y, P.starDim) }
      }
    }

    // a satellite, every few minutes, high up
    if (L.above >= 12) {
      const every = 1600
      const slot = Math.floor(t / every)
      const age = t - slot * every - Math.floor(hash(slot, this.seed, 71) * 300)
      const dur = Math.round((W + 20) / 0.4)
      if (hash(slot, 72) < 0.7 && age >= 0 && age < dur) {
        const ya = 3 + hash(slot, 73) * L.top * 0.3, yb = ya + (hash(slot, 74) - 0.5) * 24
        const right = hash(slot, 75) < 0.5
        const u = age / dur
        const x = Math.round(right ? -10 + (W + 20) * u : W + 10 - (W + 20) * u), y = Math.round(ya + (yb - ya) * u)
        if (x >= 0 && x < W && y >= 0 && y < S.sky[x]! - 2 && (x - L.moonX) ** 2 + (y - L.moonY) ** 2 > keep) dot[y * W + x] = P.starBright
      }
    }

    // the constellation, a line every two ticks
    if (c !== undefined) {
      const { fig } = c
      const pts = fig.pts.map(([u, v]) => [Math.round(c.x + u * c.w), Math.round(c.y + v * c.h)] as const)
      const shown = this.mood === 'ponder' ? Math.min(fig.segs.length, Math.floor(this.moodFor / 2)) : fig.segs.length
      const bright = new Set<number>()
      for (let k = 0; k < shown; k++) {
        const [a, b] = fig.segs[k]!
        d.line(pts[a]![0], pts[a]![1], pts[b]![0], pts[b]![1], P.line, 2)
        bright.add(a)
        bright.add(b)
      }
      if (shown === 0) bright.add(fig.segs[0]![0])
      for (const k of bright) d.set(pts[k]![0], pts[k]![1], P.starBright)
    }

    // ---- the moon, and the cloud across it
    // the moon changes shape over days: it is drawn once a phase step and laid on
    const phase = moonPhase(input.now)
    const mk = `${S.size}:${Math.round(phase * 600)}`
    if (this.moon.key !== mk) {
      const m = new Dots(input.cols, input.rows)
      drawNightMoon(m, L.moonX, L.moonY, L.r, phase)
      this.moon = { key: mk, layer: layerOf(m) }
    }
    blit(d, this.moon.layer)
    const R2 = (L.r + 0.35) ** 2
    for (const st of S.streaks) {
      const span = W + st.len * 2
      const xs = ((((this.drift * st.speed + st.off) % span) + span) % span) - st.len
      for (let x = Math.max(0, Math.ceil(xs)); x < Math.min(W, xs + st.len); x++) {
        const u = (x - xs) / st.len
        const dens = Math.pow(Math.sin(u * Math.PI), 0.8) * (0.3 + 0.7 * noise1((x - xs) / 9 + st.k * 13, 61 + st.k)) * st.dens
        for (let j = 0; j < st.rows; j++) {
          const y = st.y + j + Math.round((x - xs) * st.slope)
          if (y < 0 || y >= S.sky[x]! - 1) continue
          const dj = dens * (j === 1 || st.rows === 1 ? 1 : 0.5)
          const inMoon = (x - L.moonX) ** 2 + ((y - L.moonY) * 1.05) ** 2 <= R2
          if (inMoon) { if (bayer(x, y) < dj * 1.2) dot[y * W + x] = 0 }
          else {
            if (dj > 0.12) dot[y * W + x] = 0
            if (hash(x, y, 63) < dj * 0.42) dot[y * W + x] = P.cloud
          }
        }
      }
    }

    // ---- meteors, behind the land
    for (const m of this.meteors) {
      if (m.age <= 0) continue
      const pts = m.trail.slice(-6)
      for (let k = 0; k < pts.length; k++) {
        const [x0, y0] = pts[k]!
        const [x1, y1] = pts[k + 1] ?? [m.x, m.y]
        const fade = m.age - (m.trail.length - pts.length + k)
        if (fade < 10) d.line(x0, y0, x1, y1, P.line, k < pts.length - 2 ? 2 : 1)
      }
      if (m.x > -4) { d.set(m.x, m.y, P.meteor); d.set(m.x + 1, m.y, P.meteor) }
    }

    // ---- the land, the village's lights, smoke and sails
    blit(d, S.land)
    if (this.lit.at !== Math.floor(input.now / 60_000)) this.lit = { at: Math.floor(input.now / 60_000), share: litShare(input.now) }
    for (const w of S.lamps) {
      if (hash(w.id, Math.floor((t + w.ph) / w.period), this.seed) >= this.lit.share) continue
      for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) d.set(w.x + i, w.y + j, P.lamp)
    }
    if (S.belfry !== undefined && input.mood === 'idle' && t - this.answerAt < 16) {
      d.set(S.belfry.x - 1, S.belfry.y, P.eye)
      d.set(S.belfry.x + 1, S.belfry.y, P.eye)
    }
    if (L.above >= 8) {
      // smoke from a few chimneys, rising a dot every few ticks; the wind bends it
      const lean = busy ? -(0.5 + this.wind * 0.7) : -0.12
      const rise = Math.floor(t / 6)
      for (const ch of S.chimneys.slice(0, 3)) {
        const n = 12
        for (let k = 0; k < n; k++) {
          if (hash(ch.id, k + rise, 201) > 0.85 - k * 0.05) continue
          const x = ch.x + Math.round(lean * Math.pow(k, 1.25) + Math.sin((k + rise) / 2.5) * 0.7), y = ch.y - k
          if (y >= 0 && !this.hushed(L, x, y)) d.set(x, y, P.cloud)
        }
      }
    }
    if (S.mill !== undefined) {
      // four sails about the hub
      const { x, y, len } = S.mill
      for (let k = 0; k < 4; k++) {
        const a = (this.sails / 16) * (Math.PI / 2) + (k * Math.PI) / 2 + 0.4
        d.line(x + Math.cos(a), y + Math.sin(a), x + Math.cos(a) * len, y + Math.sin(a) * len, P.roofLit)
      }
    }

    // ---- the round trees on the near hill
    const sway = (cl: Cluster): number => {
      if (quiet || cl.fixed) return 0
      if (busy) return this.wind * Math.sin(t * 0.3 + cl.ph) + this.wind * 0.3 > 0.6 ? -1 : 0
      // at rest, a breath of air stirs one twig now and then
      return hash(cl.id, Math.floor((t + cl.ph * 7) / 37), this.seed) < 0.04 ? -1 : 0
    }
    const tufts = (oak: boolean): void => {
      for (const cl of S.clusters) {
        if (cl.oak !== oak) continue
        const ox = cl.x + sway(cl)
        for (let k = 0; k < cl.dots.length; k += 2) d.set(ox + cl.dots[k]!, cl.y + cl.dots[k + 1]!, cl.ink)
      }
    }
    tufts(false)

    // ---- gusts while it blows: a streak runs along a wavering path and curls up at its end
    if (busy) {
      // two in a wide band, more in a window, never crowding it
      const n = L.above === 0 ? (W >= 120 ? 2 : 1) : Math.max(1, Math.round((W * H) / 6500))
      const life = 40
      for (let k = 0; k < n; k++) {
        const off = Math.floor((k * life) / n + hash(k, 31) * 6)
        const born = Math.floor((t + off) / life) * life - off
        const age = t - born
        const x0 = 10 + hash(born, k, 41) * (W - 10)
        const y0 = 2 + hash(born, k, 42) * (L.above > 0 ? H - 8 : H * 0.6)
        const run = 26 + Math.floor(hash(born, k, 43) * 30)
        const amp = 1 + hash(born, k, 44) * 1.5, lam = 5 + hash(born, k, 45) * 4, ph = hash(born, k, 46) * TAU
        const xe = x0 - run, ye = y0 + amp * Math.sin(run / lam + ph)
        const curl = 12
        const head = age * 3
        for (let j = Math.max(0, head - 15); j <= Math.min(head, run + curl); j++) {
          if (j % 4 === 3) continue
          let x: number, y: number
          if (j <= run) { x = x0 - j; y = y0 + amp * Math.sin(j / lam + ph) }
          else { const f = (j - run) / 2.6; x = xe - 2.6 * Math.sin(f); y = ye - 2.6 * (1 - Math.cos(f)) }
          const xi = Math.round(x), yi = Math.round(y)
          if (xi < 0 || xi >= W || yi < 0 || yi >= H || dot[yi * W + xi] !== 0 || this.hushed(L, xi, yi)) continue
          dot[yi * W + xi] = P.wind
        }
      }
    }

    // ---- the oak and the owl's branch; the branch's tip twig nods in a gust
    blit(d, S.oak)
    tufts(true)
    const nod = busy && !quiet && this.wind * Math.sin(Math.floor((t + 3) / 6) * 1.7) > 0.45 ? 1 : 0
    const x0 = L.trunk, x1 = L.owlX - 8
    for (let x = x1; x <= x0; x++) {
      const u = (x0 - x) / (x0 - x1)
      const y = L.branchY + Math.round(u * u * 1.5)
      d.set(x, y, P.tree)
      if (u < 0.7) d.set(x, y + 1, P.tree)
    }
    const tip = L.branchY + 1
    d.line(x1 + 2, tip, x1 - 3 - nod, tip - 4 + nod, P.tree)
    d.line(x1 + 6, tip, x1 + 4, tip + 2, P.tree)
    const twigY = Math.max(4, L.owlY - 2)
    d.line(L.trunk + 1, twigY, L.trunk + 6, twigY - 5, P.tree)
    d.line(L.trunk + 4, twigY - 3, L.trunk + 2, twigY - 7, P.tree)

    // ---- the meadow
    if (L.below > 0) {
      blit(d, S.ground)
      for (const b of S.blades) {
        const bend = busy && !quiet && b.h >= 4 ? (this.wind * Math.sin(t * 0.27 + b.ph) + b.lean > 0.5 ? -1 : 0) : 0
        const top = b.y - b.h + 1
        for (let y = b.y; y >= top; y--) {
          const hi = (b.y - y) / b.h
          d.set(b.x + Math.round(b.lean * hi * 2) + (hi > 0.55 ? bend : 0), y, P.grass)
        }
        if (b.head) {
          const hx = b.x + Math.round(b.lean * 2) + bend
          d.set(hx - 1, top - 1, P.treeDim)
          d.set(hx, top - 2, P.treeDim)
          d.set(hx + 1, top - 1, P.treeDim)
        }
      }
      for (const v of this.litter) dot[v >> 6] = v & 63
      if (this.fox !== undefined && S.foxY >= 0) {
        const f = this.fox
        const stride = f.rest > 0 ? 1 : Math.floor((t - f.t0) / 4) % 2
        d.stamp(FOX[stride]!, f.x, S.foxY - 6, FOX_MAP)
      }
    }

    // ---- falling leaves
    for (const f of this.leaves) {
      const x = Math.round(f.x), y = Math.round(f.y)
      d.set(x, y, f.ink)
      if (Math.floor(f.age / 3) % 2 === 0) d.set(x + 1, y, f.ink)
      else d.set(x, y + 1, f.ink)
    }

    this.drawOwl(L, input)

    if (this.moth !== undefined) {
      const m = this.moth
      const open = (t - m.t0) % 2 === 0
      d.stamp(open ? ['m.m', '.m.'] : ['.m.', 'mmm'], m.x, m.y, { m: P.moth })
    }

    if (input.bubble !== undefined) {
      const head = { c: Math.floor((L.owlX + 2) / 2), r: Math.max(0, Math.floor((L.owlY + 8) / 4)) }
      const box = drawBubble(d, input.bubble, head, { c0: Math.floor(L.owlX / 2) - 1, r0: Math.max(0, Math.floor(L.owlY / 4)), c1: input.cols, r1: input.rows }, P.border, P.words, P.border, input.asciiBorders === true)
      this.hush = box === undefined ? undefined : { x0: box.c0 * 2 - 4, y0: box.r0 * 4 - 8, x1: box.c1 * 2 + 4, y1: box.r1 * 4 + 8 }
    } else this.hush = undefined
  }

  private drawOwl(L: Layout, input: SceneInput): void {
    const d = this.d
    const t = input.tick
    const ox = L.owlX, oy = L.owlY
    // breathing: in and out over five seconds asleep, three awake
    const breath = input.mood === 'idle' ? Math.floor(t / 10) % 2 : Math.floor(t / 6) % 2
    // ponder tips the head one dot toward the bubble
    const tilt = input.mood === 'ponder' ? -1 : 0
    // clear the owl's silhouette so stars and twigs don't show through it
    for (let y = 2; y < 18; y++) for (let x = 1; x < 20; x++) d.set(ox + x, oy + y, 0)
    d.stamp(breath === 0 ? BODY_IN : BODY_OUT, ox, oy + 10, OWL_MAP)
    d.stamp(HEAD, ox + tilt, oy, OWL_MAP)
    const eyes = EYES[this.eyes] ?? EYES.open!
    d.stamp(this.peekEye === 2 ? EYES.shut! : eyes, ox + 4 + tilt, oy + 3, OWL_MAP)
    d.stamp(this.peekEye === 1 ? EYES.shut! : eyes, ox + 12 + tilt, oy + 3, OWL_MAP)
    const talking = input.mood === 'talk' && Math.floor(t / 2) % 2 === 0
    d.stamp(talking ? BEAK_OPEN : BEAK_SHUT, ox + 9 + tilt, oy + 7, OWL_MAP)
  }
}

export const night: SceneDef = {
  id: 'owl-night',
  name: 'Owl Night',
  persona: 'a small tawny owl dozing on an oak branch above a sleeping village, under a slowly turning night sky',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 6,
  create: seed => new Night(seed),
}
