// Sunken Dreamer: a storm sea at night, and rising out of it, so big that he
// is the sky, the Dreamer: a domed, tentacle-bearded head with a crest down
// its crown, two great eyes and a brow of small ones, shoulders under the
// waterline and two membrane wings spread across the whole room. Tonight's
// real moon shows through a gap in the clouds and rims his crown; sigils float
// round his head; drowned monoliths lean out of the water. He is drawn at
// every size from the same body: in the band he is the horizon, his eyes and
// the line of his head and beard over the sea; a tall window shows how far up
// he goes.
//
//   idle    he sleeps. Every minute or so, over many seconds, one eye opens a
//           crack, looks, and shuts again; the sigils breathe, a strand of his
//           beard shifts, the clouds roil very slowly, and once in a long while
//           a glimmer shows far off on the horizon. After half a minute of
//           quiet, pale dream lights rise off the water; now and then a ship
//           crosses, tiny beside him
//   busy    the storm: rain, a heavier sea, sheet lightning in the clouds and
//           now and then a bolt that lights his whole bulk; his eyes are open
//           and watching, the small ones too
//   ponder  a sigil writes itself in the sky beside his head, stroke by
//           stroke, and his eyes turn to it
//   talk    his eyes flare as he speaks, and his beard parts
//   spectacle (a long turn just ended)  the storm breaks over him: five
//           bolts, seconds apart, each lighting him from its own side; the
//           sigils kindle one by one and every eye opens; then he sleeps
//
// Past the other scenes it paints light (kit.ts, opt-in). His bulk, the
// clouds and the sea are always drawn in dim inks, and lightning only
// relights those cells (`relight`), by which way each faces the bolt: a flash
// crosses shapes that hold still and toggles no dots. Cells take background
// inks (`litFrame`): his eyes glow behind their own cells everywhere, and a
// tall window (16 rows and up) gets a painted night of its own, a `ramp` of
// washes from zenith to sea, his bulk and wings standing dark against it and
// a strike blooming in it. A strike is one rise and a fade over a second, and
// strikes come seconds apart (the spectacle's six, busy's twelve and more):
// nothing strobes. The band keeps to lines: each change of ink in a row is a
// Text run, so his texture shares his outline's ink and density does the
// shading.
//
// Layout: one body in units (an eye line, a dome, a jaw, shoulders), scaled
// to the room. The band shows all of his dome at a fixed scale; a taller room
// grows him until his crown nearly meets the sky's top and raises him out of
// the sea to the chest (extra rows: the sky gets about two thirds, the sea a
// third). The moon sits up left, where his left wing holds low under it; the
// wings stretch or fold to reach the room's edges; stones stand in the water
// left of him from 10 rows; the sigils crown him from 8.
import { smoothstep } from '../util'
import type { Dots as DotsT, Frame, Ink, Mood, SceneDef, SceneInput, SceneInstance } from './kit'
import { bayer, Dots, drawBubble, drawMoon, hash, ink, litFrame, moonPhase, packFast, ramp, relight } from './kit'

const P = {
  cloudDim: 1, cloudRim: 2, cloudMoon: 3, cloudLit1: 4, cloudLit2: 5, cloudLit3: 6,
  moon: 7, moonRim: 8, moonHalo: 9, maria: 10,
  skinRim: 11, outline: 12, brow: 13, skinLit1: 14, skinLit2: 15, skinLit3: 16,
  bone: 17, wingLit1: 18, wingLit2: 19, wingLit3: 20,
  seam: 21, lid: 22, iris: 23, irisCore: 24, flare: 25,
  sigilDim: 26, sigil: 27, sigilBright: 28, sigilBlaze: 29,
  seaFar: 30, sea: 31, seaNear: 32, foam: 33, seaLit1: 34, seaLit2: 35, seaLit3: 36, eyeRefl: 37, moonRefl: 38,
  stoneEdge: 39, carve: 40, stoneLit1: 41, stoneLit2: 42, stoneLit3: 43,
  rain: 44, bolt: 45, boltDim: 46, ship: 47, lantern: 48, mote: 49, moteDim: 50,
  border: 51, words: 52,
  // backgrounds only: a strike's bloom, the eyes' glow, his silhouette
  bloom1: 53, bloom2: 54, bloom3: 55, seaBloom1: 56, seaBloom2: 57, skinBloom1: 58, skinBloom2: 59, glow1: 60, glow2: 61, glow3: 62, shadow: 63, wingShadow: 64,
} as const
/** The night's wash in a tall room: the sky's, zenith to horizon, then the sea's, horizon to the bottom. */
const SKY = 65
const SKY_STEPS = 12
const DEEP = SKY + SKY_STEPS
const DEEP_STEPS = 6

const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
// the storm: a stipple of cloud, its edges, its moonlit tops; and the same lit by lightning
PALETTE[P.cloudDim] = ink(0x272b3d, 0xd3d5e0)
PALETTE[P.cloudRim] = ink(0x4b5068, 0xa3a7ba, 1.1)
PALETTE[P.cloudMoon] = ink(0x6c6c78, 0x8f8f9e, 1.2)
PALETTE[P.cloudLit1] = ink(0x4f5476, 0xa6a6c8)
PALETTE[P.cloudLit2] = ink(0x8082b2, 0x8682b8)
PALETTE[P.cloudLit3] = ink(0xc0bdea, 0x6456a8)
// tonight's moon, as the pond's
PALETTE[P.moon] = ink(0xefe9cc, 0x8d7f45, 2)
PALETTE[P.moonRim] = ink(0x6e6a52, 0xb9b08a, 1.3)
PALETTE[P.moonHalo] = ink(0x45443a, 0xddd6bc)
PALETTE[P.maria] = ink(0xbdb594, 0xa99d6c, 2)
// his hide: one ink for his outline and his texture (density shades it), the moon's rim in the band, and the same lit by lightning
PALETTE[P.skinRim] = ink(0x5a7c69, 0x7f9f8d, 1.2)
PALETTE[P.outline] = ink(0x4a6b58, 0x6a8a76, 1.6)
PALETTE[P.brow] = ink(0x648a72, 0x4f725c, 1.8)
PALETTE[P.skinLit1] = ink(0x40594a, 0xb2c3b7)
PALETTE[P.skinLit2] = ink(0x6f967d, 0x84a290)
PALETTE[P.skinLit3] = ink(0xb0dac0, 0x50785f)
// his wings
PALETTE[P.bone] = ink(0x58606c, 0x737b86, 1.4)
PALETTE[P.wingLit1] = ink(0x3d3f55, 0xbdbdce)
PALETTE[P.wingLit2] = ink(0x666884, 0x9696b0)
PALETTE[P.wingLit3] = ink(0xa0a2c2, 0x68688c)
// his eyes
PALETTE[P.seam] = ink(0x7a6a1c, 0x9c8630, 4)
PALETTE[P.lid] = ink(0x5f8066, 0x4f7058, 3)
PALETTE[P.iris] = ink(0xb2d03c, 0x638608, 5)
PALETTE[P.irisCore] = ink(0xe6ff86, 0x456600, 6)
PALETTE[P.flare] = ink(0xf8ffd2, 0x345200, 7)
// the sigils
PALETTE[P.sigilDim] = ink(0x3d315c, 0xc3badd, 3)
PALETTE[P.sigil] = ink(0x604c98, 0x9a84ce, 3.5)
PALETTE[P.sigilBright] = ink(0x9c7ce2, 0x6a42bc, 4)
PALETTE[P.sigilBlaze] = ink(0xdac6ff, 0x46169c, 5)
// the sea
PALETTE[P.seaFar] = ink(0x2b4150, 0xb2c2cc)
PALETTE[P.sea] = ink(0x2e4859, 0xa0b4c0)
PALETTE[P.seaNear] = ink(0x3c5c70, 0x86a0ae, 1.1)
PALETTE[P.foam] = ink(0x7d99aa, 0x567484, 1.6)
PALETTE[P.seaLit1] = ink(0x486a82, 0x8ea4b8)
PALETTE[P.seaLit2] = ink(0x7a98b8, 0x6c84a4)
PALETTE[P.seaLit3] = ink(0xb8cee4, 0x466084)
PALETTE[P.eyeRefl] = ink(0x6e7e28, 0x96a84c, 1.6)
PALETTE[P.moonRefl] = ink(0x8d896b, 0xa49868, 1.4)
// the drowned stones
PALETTE[P.stoneEdge] = ink(0x4a5352, 0x7f8888, 1.5)
PALETTE[P.carve] = ink(0x463b6a, 0xa99fce, 2)
PALETTE[P.stoneLit1] = ink(0x3f474b, 0xb4b8ba)
PALETTE[P.stoneLit2] = ink(0x6d777b, 0x889092)
PALETTE[P.stoneLit3] = ink(0xabb7bb, 0x586264)
// weather, a ship, dream lights
PALETTE[P.rain] = ink(0x3d4d63, 0x8696ac, 1.1)
PALETTE[P.bolt] = ink(0xf3efff, 0x5646a0, 9)
PALETTE[P.boltDim] = ink(0x8d87c4, 0x867cbc, 5)
PALETTE[P.ship] = ink(0x4c4740, 0x645c54, 2)
PALETTE[P.lantern] = ink(0xf0b860, 0xc07a18, 5)
PALETTE[P.mote] = ink(0x9de4c4, 0x359574, 4)
PALETTE[P.moteDim] = ink(0x4d7d6b, 0x86b6a2, 3)
PALETTE[P.border] = ink(0xaf87ff, 0x8700ff, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)
// backgrounds
PALETTE[P.bloom1] = ink(0x242236, 0xecebf7)
PALETTE[P.bloom2] = ink(0x2f2b48, 0xe2dff4)
PALETTE[P.bloom3] = ink(0x3d375c, 0xd6d1f0)
PALETTE[P.seaBloom1] = ink(0x1d2836, 0xe6ecf4)
PALETTE[P.seaBloom2] = ink(0x283848, 0xdae3f0)
PALETTE[P.skinBloom1] = ink(0x1f2621, 0xe6ebe7)
PALETTE[P.skinBloom2] = ink(0x27322c, 0xdbe4de)
PALETTE[P.glow1] = ink(0x212712, 0xf1f4d8)
PALETTE[P.glow2] = ink(0x2a3413, 0xe9f0c0)
PALETTE[P.glow3] = ink(0x354416, 0xe0eaa6)
// in a tall room his bulk and his wings stand dark against the night's wash
PALETTE[P.shadow] = ink(0x0d0f12, 0xd4dad5)
PALETTE[P.wingShadow] = ink(0x101118, 0xdadbe2)
ramp(ink(0x121220, 0xe3e2ec), ink(0x1f2534, 0xf3f4f5), SKY_STEPS).forEach((wash, k) => (PALETTE[SKY + k] = wash))
ramp(ink(0x17212a, 0xe8edf0), ink(0x10161b, 0xdee6ea), DEEP_STEPS).forEach((wash, k) => (PALETTE[DEEP + k] = wash))

/** What lightning makes of an ink at each level of light: [ink, level 1, 2, 3]; inks not named here keep their color. */
const LIFTS: readonly (readonly number[])[] = [
  [P.cloudDim, P.cloudLit1, P.cloudLit1, P.cloudLit2],
  [P.cloudRim, P.cloudLit2, P.cloudLit3, P.cloudLit3],
  [P.cloudMoon, P.cloudLit2, P.cloudLit3, P.cloudLit3],
  [P.skinRim, P.skinLit2, P.skinLit2, P.skinLit3],
  [P.outline, P.skinLit2, P.skinLit3, P.skinLit3],
  [P.brow, P.skinLit2, P.skinLit3, P.skinLit3],
  [P.bone, P.wingLit2, P.wingLit3, P.wingLit3],
  [P.seaFar, P.seaLit1, P.seaLit2, P.seaLit2],
  [P.sea, P.seaLit1, P.seaLit2, P.seaLit2],
  [P.seaNear, P.seaLit1, P.seaLit2, P.seaLit3],
  [P.foam, P.seaLit2, P.seaLit3, P.seaLit3],
  [P.rain, P.seaLit1, P.seaLit2, P.seaLit3],
  [P.stoneEdge, P.stoneLit2, P.stoneLit3, P.stoneLit3],
  [P.carve, P.sigil, P.sigilBright, P.sigilBright],
  [P.ship, P.stoneLit2, P.stoneLit3, P.stoneLit3],
]
const LIT: Uint8Array[] = [1, 2, 3].map(level => {
  const table = new Uint8Array(PALETTE.length)
  for (const lift of LIFTS) table[lift[0]!] = lift[level]!
  return table
})
/** A cell's glow behind it, by the ink it took: in the band, and in a bigger room. */
const GLOW: readonly Uint8Array[] = [0, 1].map(tall => {
  const table = new Uint8Array(PALETTE.length)
  table[P.iris] = tall ? P.glow2 : P.glow1
  table[P.irisCore] = P.glow2
  table[P.flare] = P.glow3
  if (tall) table[P.seam] = P.glow1
  return table
})

// ---------------------------------------------------------------- his body, in units
// One unit is a dot at scale 1 (the band draws him at 0.68); u runs right and v down
// from the middle of his eye line. Everything about him is a function of
// (u, v), so every room draws the same creature, only bigger or smaller.

const DOME = { cy: -4.5, rx: 25, ry: 17.5 }
const JAW = { cy: 3.4, rx: 21, ry: 5 }
const TORSO = { cy: 14, rx: 44, ry: 12.5 }
/** The sea line, in units below his eye line: in the band he is up to his chin in it, in a tall room up to his chest. */
const WATER_BAND = 8
const WATER_TALL = 14
/** His two great eyes, and the five small ones along his brow: centre, half width, half height. */
const EYES: readonly { u: number; v: number; a: number; b: number }[] = [
  { u: -10.5, v: 0.4, a: 4.7, b: 2.3 },
  { u: 10.5, v: 0.4, a: 4.7, b: 2.3 },
  { u: -7, v: -8.8, a: 1.8, b: 1 },
  { u: 7, v: -8.8, a: 1.8, b: 1 },
  { u: -16.5, v: -5.8, a: 1.5, b: 0.9 },
  { u: 16.5, v: -5.8, a: 1.5, b: 0.9 },
  { u: 0, v: -13.2, a: 1.6, b: 0.95 },
]
const STRANDS = 7
/** The beard's strands, outer first, so the inner ones lie over them. */
const BEARD_ORDER = Array.from({ length: STRANDS }, (_, k) => k).sort((a, b) => Math.abs(b - (STRANDS - 1) / 2) - Math.abs(a - (STRANDS - 1) / 2))

/** How far inside the dome (u, v) is: under 1 inside, with a slow wobble so the skull is lumpy, not drawn with a compass. */
function domeF(u: number, v: number): number {
  const px = u / DOME.rx, py = (v - DOME.cy) / DOME.ry
  const a = Math.atan2(py, px)
  const wob = 1 + 0.03 * Math.sin(a * 5 + 0.7) + 0.018 * Math.sin(a * 9 + 2.1)
  return (px * px + py * py) / (wob * wob)
}
const ellF = (u: number, v: number, e: { cy: number; rx: number; ry: number }): number => (u / e.rx) ** 2 + ((v - e.cy) / e.ry) ** 2

/** Which part of him (u, v) is in, above the sea line `water`: 1 his head, 2 his shoulders, 0 neither. */
function partAt(u: number, v: number, water: number): number {
  if (v > water + 0.5) return 0
  if ((v <= 4 && domeF(u, v) <= 1) || ellF(u, v, JAW) <= 1) return 1
  return ellF(u, v, TORSO) <= 1 ? 2 : 0
}

/** The outward normal of his skin at (u, v), as if each part were a smooth bulge toward you: [x, y, z]. */
function normalAt(u: number, v: number, part: number): [number, number, number] {
  const e = part === 2 ? TORSO : DOME
  const px = u / e.rx, py = (v - e.cy) / e.ry
  const z = Math.sqrt(Math.max(0, 1 - Math.min(1, px * px + py * py)))
  const n = Math.hypot(px, py, z) || 1
  return [px / n, py / n, z / n]
}

// ---------------------------------------------------------------- small helpers

function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
const fbm = (x: number, y: number, seed: number): number => (noise2(x, y, seed) * 4 + noise2(x * 2.1, y * 2.1, seed + 1) * 2 + noise2(x * 4.3, y * 4.3, seed + 2)) / 7

/** A Bresenham-ish run of dots from (x0, y0) to (x1, y1), as flat x, y pairs. */
function dotLine(x0: number, y0: number, x1: number, y1: number): number[] {
  const out: number[] = []
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let k = 0; k <= n; k++) out.push(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n))
  return out
}
function dotArc(x: number, y: number, r: number, a0: number, a1: number): number[] {
  const out: number[] = []
  const n = Math.max(6, Math.round(r * Math.abs(a1 - a0) * 1.3))
  for (let k = 0; k <= n; k++) {
    const a = a0 + ((a1 - a0) * k) / n
    out.push(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r))
  }
  return out
}

/**
 * A sigil: strokes of dots in a g x g box, made from its seed. A ring or a
 * pointed frame, a stem, branches ending in ticks, hooks or little rings, and
 * a crescent or a pair of dots: nobody's alphabet, the same one every time.
 */
function sigilStrokes(seed: number, g: number): number[][] {
  const strokes: number[][] = []
  const c = (g - 1) / 2
  const big = g >= 11
  const frame = hash(seed, 1)
  if (frame < 0.5) strokes.push(dotArc(c, c, c, 0, Math.PI * 2))
  else if (frame < 0.75 && big) strokes.push([...dotLine(c, 0, g - 1, c), ...dotLine(g - 1, c, c, g - 1), ...dotLine(c, g - 1, 0, c), ...dotLine(0, c, c, 0)])
  const top = big ? 2 : 1, bottom = g - (big ? 3 : 2)
  strokes.push(dotLine(c, top, c, bottom))
  const branches = 2 + Math.floor(hash(seed, 2) * (big ? 3 : 1))
  const mirrored = hash(seed, 8) < 0.5
  for (let k = 0; k < branches; k++) {
    const y = top + ((bottom - top) * (k + 0.6 + hash(seed, k, 3) * 0.5)) / (branches + 0.6)
    const side = k % 2 === 0 ? 1 : -1
    const ang = (0.35 + hash(seed, k, 4) * 0.7) * (hash(seed, k, 5) < 0.5 ? -1 : 1)
    const len = c * (0.55 + hash(seed, k, 6) * 0.35)
    const x1 = c + side * Math.cos(ang) * len, y1 = y - Math.sin(ang) * len
    const stroke = dotLine(c, y, x1, y1)
    const end = hash(seed, k, 7)
    if (big && end < 0.35) stroke.push(...dotArc(x1, y1, 1.3, 0, Math.PI * 2))
    else if (end < 0.7) stroke.push(...dotLine(x1 - side * 0.5, y1 - 1.5, x1 + side * 0.5, y1 + 1.5))
    else stroke.push(...dotLine(x1, y1, x1 + side * 1.5, y1 + 1.5))
    strokes.push(stroke)
    if (mirrored) strokes.push(dotLine(c, y, 2 * c - x1, y1))
  }
  if (hash(seed, 9) < 0.5) strokes.push(dotArc(c, top + (big ? 2 : 1), big ? 2.4 : 1.6, Math.PI * 1.1, Math.PI * 1.9))
  else strokes.push([Math.round(c - c * 0.55), g - 1, Math.round(c + c * 0.55), g - 1])
  return strokes.map(stroke => stroke.map(v => Math.max(0, Math.min(g - 1, v))))
}

// ---------------------------------------------------------------- the room

type Layout = ReturnType<typeof layoutOf>

function layoutOf(cols: number, rows: number) {
  const W = cols * 2, H = rows * 4
  const band = rows <= 7
  // the sea: a strip in the band, a third of a tall window
  const sea = H - Math.max(5, Math.round(5 + (H - 24) * 0.34))
  const skyTop = band ? 0 : Math.round((H - 24) * 0.09)
  // his scale: the band's own, and in a taller room as big as the sky lets him be, his crown under its top
  const water = band ? WATER_BAND : WATER_BAND + (WATER_TALL - WATER_BAND) * Math.min(1, (rows - 7) / 9)
  const s = band ? 0.68 : Math.max(0.68, Math.min((sea - skyTop) / (water + DOME.ry - DOME.cy), W / 64))
  const half = DOME.rx * s
  const cx = Math.round(Math.max(Math.min(W * 0.62, W - half * 0.92), Math.min(W / 2, half * 0.92)))
  const ey = sea - water * s
  // tonight's moon, up in the left of the sky, clear of his head
  const r = Math.max(4, Math.min(13, Math.round(H * 0.075)))
  const moon = { x: Math.max(r + 4, Math.round(W * (band ? 0.09 : 0.13))), y: Math.max(r + 1, skyTop + r + 2), r }
  const hasMoon = moon.x + r + 4 < cx - half * 0.85
  return { W, H, cols, rows, band, tall: rows >= 16, sea, skyTop, water, s, cx, ey, half, moon: hasMoon ? moon : undefined }
}

const U = (L: Layout, u: number): number => L.cx + u * L.s
const V = (L: Layout, v: number): number => L.ey + v * L.s

// ---------------------------------------------------------------- what never moves, per room

type Sigil = { x: number; y: number; g: number; strokes: number[][]; phase: number; period: number }
type Still = {
  /** Ink of every dot that never moves: his head, wings and shoulders, the moon, the far sea line. */
  base: Uint8Array
  /** What stands at a dot, so clouds and bolts keep behind it: 1 him, 2 a wing, 3 the moon, 4 a sigil, 5 a stone, 6 the air just round him. */
  solid: Uint8Array
  /** The open sky's dots, and for each its cloud field: a base density, two drifting modulations, its dither, which way it faces, whether the moon lights it. */
  sky: Uint32Array
  cb: Float32Array
  c1: Float32Array
  c2: Float32Array
  dither: Float32Array
  top: Uint8Array
  /** The stones in front of the sea, drawn over it: dot and ink (0 clears). */
  fore: Uint32Array
  foreInk: Uint8Array
  /** Per cell: what it is (0 sky, 1 hide, 2 wing, 3 sea, 4 stone, 5 never lit) and its normal, x100. */
  mat: Uint8Array
  /** Per cell, what mostly fills it: 1 his bulk, 2 a wing's membrane, 3 a stone: the silhouette a tall room paints. */
  shade: Uint8Array
  nx: Int8Array
  ny: Int8Array
  nz: Int8Array
  sigils: Sigil[]
}

/**
 * Every integer dot inside `poly` (even-odd, as a point-in-polygon test
 * per dot would find them) from row y0 to y1, a row at a time: each row's
 * crossings found once, then filled between, not each dot tested against
 * every edge.
 */
function fillPoly(poly: readonly (readonly [number, number])[], y0: number, y1: number, x0: number, x1: number, each: (x: number, y: number) => void): void {
  const cross: number[] = []
  for (let y = y0; y <= y1; y++) {
    cross.length = 0
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!
      if (yi > y !== yj > y) cross.push(((xj - xi) * (y - yi)) / (yj - yi) + xi)
    }
    cross.sort((a, b) => a - b)
    for (let k = 0; k + 1 < cross.length; k += 2) {
      for (let x = Math.max(x0, Math.ceil(cross[k]!)); x < Math.min(x1 + 1, Math.ceil(cross[k + 1]!)); x++) each(x, y)
    }
  }
}

/** Still layers by room and moon, shared by every Dreamer (they are one creature): a few rooms at most. */
const STILLS = new Map<string, Still>()

function stillAt(L: Layout, phase: number): Still {
  const light = 1 - Math.abs(phase - 0.5) * 2
  const key = `${L.cols}x${L.rows}:${Math.round(phase * 48) % 48}`
  const hit = STILLS.get(key)
  if (hit !== undefined) return hit
  const { W, H, s, cols, rows } = L
  const base = new Uint8Array(W * H)
  const solid = new Uint8Array(W * H)
  const inRoom = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
  const set = (x: number, y: number, v: number) => {
    x = Math.round(x); y = Math.round(y)
    if (inRoom(x, y)) base[y * W + x] = v
  }
  const line = (x0: number, y0: number, x1: number, y1: number, v: number, every = 1) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let k = 0; k <= n; k += every) set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, v)
  }
  const mat = new Uint8Array(cols * rows)
  const nsum = new Float32Array(cols * rows * 4)
  const wingDots = new Uint8Array(cols * rows)
  const cellOf = (x: number, y: number) => Math.floor(y / 4) * cols + Math.floor(x / 2)
  const sigils: Sigil[] = []
  // few inks to a row, as each change of ink starts a Text run: the wings' edges in their bones' ink, the hide's texture in one
  const EDGE = P.bone

  // --- the wings, behind everything of his
  const moonBar = L.moon !== undefined ? L.moon.y + L.moon.r + 3 : -1
  for (const side of [-1, 1]) {
    const reach = side < 0 ? L.cx : W - L.cx
    const fx = Math.max(0.3, Math.min(2.6, (reach / s + 8 - 24) / 74))
    const at = (u: number, v: number): [number, number] => [L.cx + side * (24 + (u - 24) * fx) * s, V(L, v)]
    const S = at(24, 5), E = at(40, -9)
    let wrist = at(60, -17), F1 = at(98, -21)
    const F2 = at(100, -3), F3 = at(86, 7), F4 = at(64, 9.5), back = at(26, 9.5)
    // on the moon's side, the wing holds low, under it
    if (side < 0 && moonBar > 0) {
      F1 = [F1[0], Math.max(F1[1], moonBar + 2)]
      wrist = [wrist[0], Math.max(wrist[1], moonBar + 3)]
    }
    const scallop = (a: [number, number], b: [number, number], depth: number): [number, number][] => {
      const mx = (a[0] + b[0]) / 2 + (wrist[0] - (a[0] + b[0]) / 2) * depth, my = (a[1] + b[1]) / 2 + (wrist[1] - (a[1] + b[1]) / 2) * depth
      const pts: [number, number][] = []
      for (let k = 0; k <= 20; k++) {
        const t = k / 20
        pts.push([(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * mx + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * my + t * t * b[1]])
      }
      return pts
    }
    const edgePts = [...scallop(F1, F2, 0.24), ...scallop(F2, F3, 0.26), ...scallop(F3, F4, 0.24), ...scallop(F4, back, 0.2)]
    const poly: [number, number][] = [S, E, wrist, F1, ...edgePts]
    let minX = W, maxX = 0, minY = H, maxY = 0
    for (const [x, y] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    fillPoly(poly, Math.max(0, Math.floor(minY)), Math.min(L.sea, Math.ceil(maxY)), Math.max(0, Math.floor(minX)), Math.min(W - 1, Math.ceil(maxX)), (x, y) => {
      solid[y * W + x] = 2
      const ci = cellOf(x, y)
      if (mat[ci] === 0) mat[ci] = 2
      wingDots[ci] = wingDots[ci]! + 1
    })
    for (let k = 0; k + 1 < edgePts.length; k++) {
      const [x0, y0] = edgePts[k]!, [x1, y1] = edgePts[k + 1]!
      line(x0, y0, x1, y1, EDGE)
    }
    const bones: [[number, number], [number, number], number][] = [[S, E, 1], [E, wrist, 1], [wrist, F1, 0.7], [wrist, F2, 0.45], [wrist, F3, 0.45], [E, F4, 0.45]]
    for (const [a, b, thick] of bones) {
      if (L.band && thick < 0.5 && b !== F2) continue
      line(a[0], a[1], b[0], b[1], P.bone)
      if (thick * s > 1.2) line(a[0], a[1] - 1, b[0], b[1] - 1, P.bone)
      if (thick * s > 2.4) line(a[0], a[1] + 1, b[0], b[1] + 1, EDGE)
    }
    // a claw at the wrist, knuckles down the fingers
    line(wrist[0], wrist[1], wrist[0] + side * 2 * s, wrist[1] - 3 * s, P.bone)
    line(wrist[0] + side * 2 * s, wrist[1] - 3 * s, wrist[0] + side * 3.2 * s, wrist[1] - 2.2 * s, P.bone)
    if (s >= 1.6) {
      for (const tip of [F2, F3]) for (const t of [0.38, 0.7]) {
        const kx = wrist[0] + (tip[0] - wrist[0]) * t, ky = wrist[1] + (tip[1] - wrist[1]) * t
        for (let a = 0; a < 6.3; a += 0.5) set(kx + Math.cos(a) * 1.2, ky + Math.sin(a) * 1.2, P.bone)
      }
    }
    if (s >= 1.6) {
      for (const [a, b] of [[F1, F2], [F2, F3], [F3, F4]] as const) {
        for (let k = 1; k <= 2; k++) {
          const t = k / 3
          const tx = a[0] + (b[0] - a[0]) * t, ty = a[1] + (b[1] - a[1]) * t
          line(wrist[0] + (tx - wrist[0]) * 0.3, wrist[1] + (ty - wrist[1]) * 0.3, wrist[0] + (tx - wrist[0]) * 0.88, wrist[1] + (ty - wrist[1]) * 0.88, EDGE, 3)
        }
      }
    }
  }

  // --- his head and shoulders: an outline, the moon on one side, a dim texture inside
  const moonDir = L.moon !== undefined ? [L.moon.x - L.cx, L.moon.y - L.ey] : [-1, -1]
  const md = Math.hypot(moonDir[0]!, moonDir[1]!) || 1
  const x0 = Math.max(0, Math.floor(U(L, -TORSO.rx) - 1)), x1 = Math.min(W - 1, Math.ceil(U(L, TORSO.rx) + 1))
  const y0 = Math.max(0, Math.floor(V(L, DOME.cy - DOME.ry * 1.06))), y1 = Math.min(L.sea, H - 1)
  // which part of him each dot is, worked out once (a dot round the box too, for the outline's neighbours)
  const mw = x1 - x0 + 3
  const parts = new Uint8Array(mw * (y1 - y0 + 3))
  for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) parts[(y - y0 + 1) * mw + x - x0 + 1] = partAt((x - L.cx) / s, (y - L.ey) / s, L.water)
  const partOf = (x: number, y: number): number => parts[(y - y0 + 1) * mw + x - x0 + 1]!
  const margin = L.band ? 2 : 3
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const u = (x - L.cx) / s, v = (y - L.ey) / s
      const part = partOf(x, y)
      if (part === 0) continue
      const i = y * W + x
      solid[i] = 1
      base[i] = 0
      const n = normalAt(u, v, part)
      const ci = cellOf(x, y)
      mat[ci] = 1
      nsum[ci * 4] = nsum[ci * 4]! + n[0]
      nsum[ci * 4 + 1] = nsum[ci * 4 + 1]! + n[1]
      nsum[ci * 4 + 2] = nsum[ci * 4 + 2]! + n[2]
      nsum[ci * 4 + 3] = nsum[ci * 4 + 3]! + 1
      const outside = partOf(x, y - 1) === 0 || partOf(x - 1, y) === 0 || partOf(x + 1, y) === 0
      const overShoulder = part === 1 && partOf(x, y + 1) === 2
      if (outside || overShoulder) {
        base[i] = P.outline
        // keep the air round his silhouette clear of cloud, so it reads
        if (outside) for (let dy = -margin; dy <= margin; dy++) for (let dx = -margin; dx <= margin; dx++) {
          const j = (y + dy) * W + x + dx
          if (inRoom(x + dx, y + dy) && solid[j] === 0) solid[j] = 6
        }
        continue
      }
      // moonlight on the side that faces it, fading with the phase
      const ml = (n[0] * moonDir[0]! + n[1] * moonDir[1]!) / md
      const rim = ((ml - 0.35) / 0.65) * (1 - n[2]) ** 1.2 * 1.6
      // (in the outline's ink: a denser stipple, not another color, keeps the runs down)
      if (L.moon !== undefined && rim > 0.04) {
        if (bayer(x, y) < rim * 0.55 * (0.3 + 0.7 * light)) base[i] = L.band ? P.skinRim : P.outline
        continue
      }
      // the hide: a dim stipple, thicker in rugose patches, that lightning brightens
      const rug = noise2(u / 2.2, v / 2.2, 33)
      if (!L.band && y < L.sea - 1 && bayer(x + 1, y) < 0.03 + 0.14 * smoothstep(0.52, 0.8, rug)) base[i] = P.outline
    }
  }
  const arcDome = (scale: number, from: number, to: number, inkOf: number, every: number) => {
    const steps = Math.round(DOME.rx * s * 3 * (to - from))
    for (let k = 0; k <= steps; k += every) {
      const a = from + ((to - from) * k) / steps
      set(U(L, Math.cos(a) * DOME.rx * scale), V(L, DOME.cy + Math.sin(a) * DOME.ry * scale * 0.96), inkOf)
    }
  }
  if (s >= 1.3) {
    // folds round the dome, like the rings of a shell: dotted, so fainter than his outline in the same ink
    arcDome(0.85, Math.PI * 1.07, Math.PI * 1.43, P.outline, 2)
    arcDome(0.85, Math.PI * 1.57, Math.PI * 1.93, P.outline, 2)
    arcDome(0.68, Math.PI * 1.1, Math.PI * 1.44, P.outline, 2)
    arcDome(0.68, Math.PI * 1.56, Math.PI * 1.9, P.outline, 2)
    arcDome(0.5, Math.PI * 1.18, Math.PI * 1.46, P.outline, 3)
    arcDome(0.5, Math.PI * 1.54, Math.PI * 1.82, P.outline, 3)
  }
  // the crest down the crown, with spines in a tall room
  line(U(L, 0), V(L, DOME.cy - DOME.ry * 0.97), U(L, 0), V(L, -15.4), P.brow)
  if (s >= 1.3) {
    line(U(L, 0) + 1, V(L, DOME.cy - DOME.ry * 0.95), U(L, 0) + 1, V(L, -15.6), P.outline)
    for (let v = DOME.cy - DOME.ry * 0.9; v < -16; v += 2.4) {
      line(U(L, 0), V(L, v), U(L, -1.1), V(L, v - 1.3), P.outline)
      line(U(L, 0) + 1, V(L, v), U(L, 1.1) + 1, V(L, v - 1.3), P.outline)
    }
  }
  // the brow: a heavy ridge over each great eye, low at the inside, a scowl
  for (const side of [-1, 1]) {
    const eu = 10.5 * side
    for (let k = 0; k <= 48; k++) {
      const t = k / 48
      const u = eu + side * (-6.2 + t * 12.4)
      const v = -0.9 - Math.sin(t * Math.PI) * 3 + (1 - t) * 1.1
      set(U(L, u), V(L, v), P.brow)
      if (s >= 1.3) set(U(L, u), V(L, v) - 1, P.brow)
      if (s >= 2.2) set(U(L, u), V(L, v) + 1, P.outline)
    }
    if (s >= 1.3) {
      // gill slits on his cheeks; a fold under each eye
      for (let k = 0; k < 3; k++) line(U(L, side * 19), V(L, -2.5 + k * 1.8), U(L, side * 22.5), V(L, -0.8 + k * 1.8), P.outline)
      for (let k = 0; k <= 24; k += 2) {
        const t = k / 24
        set(U(L, eu + side * (-4 + t * 8)), V(L, 3.1 + Math.sin(t * Math.PI) * 0.8), P.outline)
      }
    }
  }
  // clear his eyes' sockets: they are drawn each tick
  for (const e of EYES) {
    for (let y = Math.floor(V(L, e.v - e.b * 1.15)); y <= Math.ceil(V(L, e.v + e.b * 1.15)); y++) {
      for (let x = Math.floor(U(L, e.u - e.a)); x <= Math.ceil(U(L, e.u + e.a)); x++) {
        if (((x - U(L, e.u)) / (e.a * s)) ** 2 + ((y - V(L, e.v)) / (e.b * s * 1.15)) ** 2 <= 1 && inRoom(x, y)) base[y * W + x] = 0
      }
    }
  }

  // --- the moon, its halo kept clear of cloud
  if (L.moon !== undefined) {
    const m = L.moon
    const scratch = new Dots(cols, rows)
    drawMoon(scratch, m.x, m.y, m.r, phase, P.moon, P.moonRim, P.moonHalo, P.maria)
    for (let i = 0; i < base.length; i++) if (scratch.dot[i] !== 0) base[i] = scratch.dot[i]!
    for (let y = m.y - m.r - 4; y <= m.y + m.r + 4; y++) {
      for (let x = m.x - m.r - 4; x <= m.x + m.r + 4; x++) {
        if (Math.hypot(x - m.x, (y - m.y) * 1.05) <= m.r + 3.5 && inRoom(x, y)) {
          solid[y * W + x] = 3
          mat[cellOf(x, y)] = 5
        }
      }
    }
  }

  // --- the sigils: a crown of them round his head where the sky has room, else one either side
  const g = Math.max(7, (Math.round(4.6 * s) | 1))
  const spots: [number, number][] = []
  if (!L.band) {
    const n = 7
    for (let k = 0; k < n; k++) {
      const a = Math.PI * (0.9 + (1.2 * k) / (n - 1))
      spots.push([U(L, Math.cos(a) * (DOME.rx + 7.5)), V(L, DOME.cy + Math.sin(a) * (DOME.ry + 4))])
    }
  } else {
    spots.push([L.cx - L.half - g * 0.9 - 4, 1 + g / 2], [L.cx + L.half + g * 0.9 + 4, 1 + g / 2])
  }
  spots.forEach(([sx, sy], k) => {
    const x = Math.round(sx - g / 2), y = Math.round(sy - g / 2)
    if (x < 1 || y < 0 || x + g > W - 1 || y + g > L.ey - 4 * s) return
    if (L.moon !== undefined && Math.hypot(sx - L.moon.x, sy - L.moon.y) < L.moon.r + g) return
    sigils.push({ x, y, g, strokes: sigilStrokes(101 + k * 7, g), phase: Math.floor(hash(k, 61) * 400), period: 150 + Math.floor(hash(k, 62) * 130) })
    for (let yy = y - 1; yy <= y + g; yy++) for (let xx = x - 1; xx <= x + g; xx++) if (inRoom(xx, yy)) { base[yy * W + xx] = 0; solid[yy * W + xx] = 4; mat[cellOf(xx, yy)] = 5 }
  })

  // --- the far sea line, and the sea's cells
  for (let x = 0; x < W; x++) if (hash(x, 81) < 0.45 && solid[L.sea * W + x] !== 1) set(x, L.sea, L.band ? P.sea : P.seaFar)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (mat[r * cols + c] === 0 && r * 4 + 2 > L.sea) mat[r * cols + c] = 3

  // --- drowned stones in the water before him, in a room tall enough: leaning, cut at angles that are not right
  const fore: number[] = [], foreInk: number[] = []
  if (rows >= 10) {
    const room = L.cx - L.half * 1.05
    const depth = H - L.sea
    const count = Math.max(1, Math.min(3, Math.floor(room / Math.max(30, 20 * s))))
    for (let k = 0; k < count && room > 24; k++) {
      const near = k === 0
      const bx = room * ((k + 0.5) / count) + (hash(k, 91) - 0.5) * room * 0.15
      const by = L.sea + depth * (near ? 0.55 : 0.22) + hash(k, 92) * depth * 0.1
      const tall = (L.sea - L.skyTop) * (near ? 0.42 : 0.24) * (0.85 + 0.3 * hash(k, 93))
      const wide = tall * (0.34 + 0.14 * hash(k, 94))
      const lean = (hash(k, 95) - 0.5) * 0.5
      const side = wide * 0.45
      // its face, and a side face that recedes the wrong way
      const face: [number, number][] = [[bx - wide / 2, by], [bx + wide / 2, by], [bx + wide / 2 + lean * tall, by - tall * 0.82], [bx - wide / 2 + lean * tall, by - tall]]
      const flank: [number, number][] = [face[1]!, [face[1]![0] + side, by - side * 0.6], [face[2]![0] + side * 0.6, face[2]![1] + side * 0.4], face[2]!]
      for (const quad of [flank, face]) {
        let minX = W, maxX = 0, minY = H, maxY = 0
        for (const [qx, qy] of quad) { minX = Math.min(minX, qx); maxX = Math.max(maxX, qx); minY = Math.min(minY, qy); maxY = Math.max(maxY, qy) }
        const inQuad = (x: number, y: number) => {
          let inside = false
          for (let i = 0, j = 3; i < 4; j = i++) {
            const [xi, yi] = quad[i]!, [xj, yj] = quad[j]!
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
          }
          return inside
        }
        const isFace = quad === face
        for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
          for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(W - 1, Math.ceil(maxX)); x++) {
            if (!inQuad(x, y)) continue
            const edge = !inQuad(x - 1, y) || !inQuad(x + 1, y) || !inQuad(x, y - 1) || !inQuad(x, y + 1)
            fore.push(y * W + x)
            foreInk.push(edge || bayer(x, y + 2) < (isFace ? 0.06 : 0.14) ? P.stoneEdge : 0)
            if (y <= L.sea) solid[y * W + x] = 5
            const ci = cellOf(x, y)
            mat[ci] = 4
            nsum[ci * 4] = isFace ? -0.35 : 0.6; nsum[ci * 4 + 1] = -0.3; nsum[ci * 4 + 2] = isFace ? 0.85 : 0.5; nsum[ci * 4 + 3] = 1
          }
        }
      }
      // a sigil carved in its face
      const cg = Math.max(5, Math.round(wide * 0.55) | 1)
      if (tall > cg * 2.4) {
        const gx = Math.round(bx + lean * tall * 0.5 - cg / 2), gy = Math.round(by - tall * 0.58 - cg / 2)
        for (const stroke of sigilStrokes(301 + k, cg)) for (let j = 0; j < stroke.length; j += 2) {
          const ix = gx + stroke[j]!, iy = gy + stroke[j + 1]!
          if (inRoom(ix, iy)) { fore.push(iy * W + ix); foreInk.push(P.carve) }
        }
      }
    }
  }

  // --- the clouds: a stormy field whose density drifts between two others; the open sky only
  const sky: number[] = []
  for (let y = 0; y < L.sea; y++) for (let x = 0; x < W; x++) if (solid[y * W + x] === 0) sky.push(y * W + x)
  const count = sky.length
  const cb = new Float32Array(count), c1 = new Float32Array(count), c2 = new Float32Array(count), dither = new Float32Array(count), top = new Uint8Array(count)
  // the field, a value per 2 x 2 dots, each worked out the first time it is wanted, at the block's first dot asked
  const gw = (W >> 1) + 1
  const field = new Float32Array(gw * ((H >> 1) + 2) * 3)
  const known = new Uint8Array(gw * ((H >> 1) + 2))
  const fieldAt = (x: number, y: number): number => {
    const cell = (y >> 1) * gw + (x >> 1)
    if (known[cell] === 0) {
      known[cell] = 1
      const fx = (W - x) / 34, fy = y / 10
      field[cell * 3] = fbm(fx, fy, 11)
      field[cell * 3 + 1] = fbm(fx * 0.8 + 3, fy * 1.3, 21) - 0.5
      field[cell * 3 + 2] = fbm(fx * 0.7 + 7, fy * 1.2 + 5, 31) - 0.5
    }
    return cell * 3
  }
  const lift = (y: number) => 0.12 * (1 - y / Math.max(1, L.sea)) - (L.band ? 0.1 : 0)
  for (let k = 0; k < count; k++) {
    const i = sky[k]!
    const x = i % W, y = Math.floor(i / W)
    const f = fieldAt(x, y)
    let b = field[f]! + lift(y)
    if (L.moon !== undefined) {
      const dm = Math.hypot(x - L.moon.x, (y - L.moon.y) * 1.2) / (L.moon.r * 2.4)
      b -= 0.4 * Math.exp(-dm * dm)
      if (dm < 1.7) top[k] = 2
    }
    cb[k] = b
    c1[k] = field[f + 1]! * 0.55
    c2[k] = field[f + 2]! * 0.55
    dither[k] = bayer(x, y)
    // a cloud's top edge: denser below than above it (the moon lights the tops)
    if (top[k] === 0) {
      const below = field[fieldAt(x, Math.min(L.sea - 1, y + 2))]! + lift(y + 2), above = field[fieldAt(x, Math.max(0, y - 2))]! + lift(y - 2)
      top[k] = below > above + 0.01 ? 1 : 0
    }
  }

  // per cell: an average normal for relighting
  const nx = new Int8Array(cols * rows), ny = new Int8Array(cols * rows), nz = new Int8Array(cols * rows)
  const shade = new Uint8Array(cols * rows)
  for (let ci = 0; ci < cols * rows; ci++) {
    const c = nsum[ci * 4 + 3]!
    if (mat[ci] === 1 && c >= 4) shade[ci] = 1
    else if (mat[ci] === 2 && wingDots[ci]! >= 4) shade[ci] = 2
    else if (mat[ci] === 4) shade[ci] = 3
    if (c === 0) continue
    nx[ci] = Math.round((nsum[ci * 4]! / c) * 100)
    ny[ci] = Math.round((nsum[ci * 4 + 1]! / c) * 100)
    nz[ci] = Math.round((nsum[ci * 4 + 2]! / c) * 100)
  }
  const still: Still = { base, solid, sky: Uint32Array.from(sky), cb, c1, c2, dither, top, fore: Uint32Array.from(fore), foreInk: Uint8Array.from(foreInk), mat, shade, nx, ny, nz, sigils }
  if (STILLS.size >= 6) STILLS.delete(STILLS.keys().next().value!)
  STILLS.set(key, still)
  return still
}

// ---------------------------------------------------------------- the living scene

type Strike = { at: number; kind: 'bolt' | 'sheet' | 'far'; x: number; seed: number; power: number; path?: { key: string; dots: number[]; dim: number[] } }
type Mote = { x: number; y: number; born: number; life: number }

/** A strike's light over its ticks: one rise, then a fade over a second; strikes come seconds apart, so nothing strobes. */
const FLASH = [1, 0.62, 0.4, 0.22, 0.1]
const SHEET = [0.55, 0.3, 0.12]
/** The spectacle: its length, and the ticks its five bolts fall on. */
const SHOW_TICKS = 170
const SHOW_BOLTS = [14, 38, 62, 88, 112]

class Dreamer implements SceneInstance {
  private d: DotsT = new Dots(1, 1)
  private out: (Frame & { bg: Uint8Array }) | undefined
  private level = new Uint8Array(0)
  private seed: number
  private last = -1
  private mood: Mood = 'idle'
  private moodFor = 0
  private calmFor = 0
  // his eyes: how open (0..1), how open each wants to be, ticks a row, where the pupils look
  private open = new Float32Array(EYES.length)
  private want = new Float32Array(EYES.length)
  private pace = new Float32Array(EYES.length).fill(8)
  private look = 0
  private lookTo = 0
  private peekAt = 70
  private peekEye = -1
  private holdUntil = -1
  // the beard's sway, each strand on its own clock
  private sway = new Float32Array(STRANDS)
  // the weather: how stormy it is (0 calm, 1 the storm), eased so clouds gather and part over seconds
  private roil = 0
  private storm = 0
  private strikes: Strike[] = []
  private nextStrike = 40
  private motes: Mote[] = []
  private ponderAt = -1
  private ponderEnd = -1
  private ponderSigil: { key: string; strokes: number[][] } | undefined
  private showAt = -1
  private lastSpectacle: number | undefined

  constructor(seed: number) {
    this.seed = seed
    for (let k = 0; k < STRANDS; k++) this.sway[k] = hash(k, seed, 5) * 6
  }

  frame(input: SceneInput): Frame {
    if (this.d.cols !== input.cols || this.d.rows !== input.rows) {
      this.d = new Dots(input.cols, input.rows)
      this.out = undefined
      this.level = new Uint8Array(input.cols * input.rows)
      this.motes = []
    }
    const steps = this.last < 0 ? 1 : Math.max(0, Math.min(8, input.tick - this.last))
    for (let k = 0; k < steps; k++) this.step(input, input.tick - steps + 1 + k)
    this.last = input.tick
    return this.draw(input)
  }

  // ---------------------------------------------------------------- behaviour

  private eyeRows(L: Layout, e: number): number {
    return Math.max(1, Math.round(EYES[e]!.b * 2 * L.s))
  }

  private step(input: SceneInput, t: number): void {
    const L = layoutOf(input.cols, input.rows)
    const mood = input.mood
    if (mood !== this.mood) { this.mood = mood; this.moodFor = 0 } else this.moodFor++
    this.calmFor = mood === 'idle' ? this.calmFor + 1 : 0

    if (input.spectacle !== undefined && input.spectacle !== this.lastSpectacle && t >= input.spectacle) {
      this.lastSpectacle = input.spectacle
      if (this.showAt < 0) this.showAt = t
    }
    const show = this.showAt >= 0 ? t - this.showAt : -1
    if (show >= SHOW_TICKS) this.showAt = -1

    // the clouds roil: slowly at rest, faster in the storm, and gather while it lasts
    this.roil += mood === 'busy' ? 0.0024 : show >= 0 ? 0.002 : 0.0011
    const stormy = mood === 'busy' || show >= 0 ? 1 : 0
    this.storm += Math.max(-0.02, Math.min(0.02, stormy - this.storm))

    // ---- his eyes
    if (show >= 0) {
      const waking = show >= 4 && show < 128
      for (let e = 0; e < EYES.length; e++) {
        this.want[e] = waking && show >= 4 + e * 5 ? 1 : 0
        this.pace[e] = waking ? 2 : 4
      }
      this.lookTo = show < 128 ? Math.round(Math.sin(show / 23) * 2) / 2 : 0
    } else if (mood === 'busy') {
      for (const e of [0, 1]) { this.want[e] = 1; this.pace[e] = 1 }
      for (let e = 2; e < EYES.length; e++) {
        // the small ones open and shut on clocks of their own
        this.want[e] = hash(Math.floor((t + e * 37) / 60), e, 7) < 0.33 ? 1 : 0
        this.pace[e] = 3
      }
      if (t % 14 === 0) this.lookTo = Math.round((hash(t, this.seed, 9) * 2 - 1) * 4) / 4
    } else if (mood === 'ponder') {
      for (const e of [0, 1]) { this.want[e] = 0.6; this.pace[e] = 2 }
      for (let e = 2; e < EYES.length; e++) this.want[e] = 0
      this.lookTo = -1
    } else if (mood === 'talk' || (input.bubble !== undefined && input.bubble !== '...')) {
      for (const e of [0, 1]) { this.want[e] = 1; this.pace[e] = 1 }
      for (let e = 2; e < EYES.length; e++) this.want[e] = 0
      this.lookTo = -0.5
    } else {
      // asleep: now and then one eye opens a crack over many seconds, looks, and shuts
      if (this.peekEye < 0 && t >= this.peekAt) {
        const roll = hash(t, this.seed, 11)
        this.peekEye = roll < 0.65 ? (roll < 0.33 ? 0 : 1) : 2 + Math.floor(hash(t, 12) * (EYES.length - 2))
        this.holdUntil = -1
      }
      for (let e = 0; e < EYES.length; e++) {
        this.want[e] = e === this.peekEye ? (e < 2 ? 0.5 : 1) : 0
        // a full opening over about eight seconds, whatever the eye's size
        this.pace[e] = Math.max(1, Math.round(32 / this.eyeRows(L, e)))
      }
      if (this.peekEye >= 0) {
        const e = this.peekEye
        if (this.holdUntil < 0 && Math.abs(this.open[e]! - this.want[e]!) < 0.01) this.holdUntil = t + 40 + Math.floor(hash(t, 13) * 50)
        if (this.holdUntil >= 0 && t >= this.holdUntil) {
          this.want[e] = 0
          if (this.open[e]! <= 0.001) {
            this.peekEye = -1
            this.peekAt = t + 180 + Math.floor(hash(t, this.seed, 14) * 200)
          }
        }
      }
      if (t % 40 === 0) this.lookTo = Math.round((hash(t, 15) * 2 - 1) * 2) / 4
    }
    for (let e = 0; e < EYES.length; e++) {
      const rows = this.eyeRows(L, e)
      const pace = Math.max(1, Math.round(this.pace[e]!))
      if (t % pace !== 0) continue
      const o = this.open[e]!, w = this.want[e]!
      if (Math.abs(o - w) < 0.001) continue
      this.open[e] = o < w ? Math.min(w, o + 1 / rows) : Math.max(w, o - 1 / rows)
    }
    if (t % 2 === 0 && this.look !== this.lookTo) this.look += Math.sign(this.lookTo - this.look) * 0.25

    // ---- his beard: each strand re-poses on its own clock, a little at a time
    for (let k = 0; k < STRANDS; k++) {
      const clock = mood === 'busy' || show >= 0 ? 6 + (k % 4) * 2 : 34 + Math.floor(hash(k, 17) * 30)
      if ((t + k * 7) % clock === 0) this.sway[k] = this.sway[k]! + (mood === 'busy' ? 0.3 : 0.2)
    }

    // ---- the storm
    this.strikes = this.strikes.filter(s => t - s.at < 8)
    if (show >= 0) {
      const at = SHOW_BOLTS.indexOf(show)
      if (at === SHOW_BOLTS.length - 1) {
        this.strikes.push({ at: t, kind: 'bolt', x: L.cx - L.half * 1.3, seed: t * 7 + 1, power: 1 }, { at: t, kind: 'bolt', x: L.cx + L.half * 1.2, seed: t * 7 + 2, power: 1 })
      } else if (at >= 0) {
        const x = at % 2 === 0 ? L.cx - L.half * (1.2 + 0.25 * at) : L.cx + L.half * (1.1 + 0.1 * at)
        this.strikes.push({ at: t, kind: 'bolt', x: Math.max(4, Math.min(L.W - 4, x)), seed: t * 7 + at, power: 1 })
      }
    } else if (mood === 'busy' && this.strikes.length === 0 && t >= this.nextStrike) {
      const isBolt = hash(t, this.seed, 21) < 0.28
      this.strikes.push({ at: t, kind: isBolt ? 'bolt' : 'sheet', x: Math.round(hash(t, this.seed, 22) * L.W), seed: t, power: isBolt ? 0.85 : 0.65 })
      this.nextStrike = t + 48 + Math.floor(hash(t, this.seed, 23) * 64)
    } else if (mood === 'idle' && this.strikes.length === 0 && t >= this.nextStrike) {
      // far off on the horizon, once in a long while: a glimmer, no bolt
      if (hash(Math.floor(t / 4), this.seed, 24) < 0.012) {
        this.strikes.push({ at: t, kind: 'far', x: Math.round(hash(t, 25) * L.W), seed: t, power: 0.45 })
        this.nextStrike = t + 360 + Math.floor(hash(t, 26) * 240)
      }
    }
    if (mood !== 'busy' && mood !== 'idle' && this.nextStrike < t + 40) this.nextStrike = t + 40

    // ---- ponder: a sigil writes itself; it lingers a moment after
    if (mood === 'ponder' && this.moodFor === 0) { this.ponderAt = t; this.ponderEnd = -1 }
    if (mood !== 'ponder' && this.ponderAt >= 0 && this.ponderEnd < 0) this.ponderEnd = t
    if (this.ponderEnd >= 0 && t - this.ponderEnd > 10) { this.ponderAt = -1; this.ponderEnd = -1 }

    // ---- dream lights, after half a minute of quiet
    const motesWanted = this.calmFor > 120 ? Math.min(3, 1 + Math.floor((this.calmFor - 120) / 200)) : 0
    if (this.motes.length < motesWanted && hash(t, this.seed, 31) < 0.04) {
      this.motes.push({ x: L.cx + (hash(t, 32) - 0.5) * L.half * 1.6, y: L.sea - 1, born: t, life: 120 + Math.floor(hash(t, 33) * 80) })
    }
    this.motes = this.motes.filter(m => t - m.born < m.life && motesWanted > 0)
    for (const m of this.motes) if ((t - m.born) % 3 === 0) { m.y -= 1; m.x += hash(t, Math.round(m.born), 34) < 0.5 ? -0.5 : 0.5 }
  }

  // ---------------------------------------------------------------- drawing

  private draw(input: SceneInput): Frame {
    const d = this.d
    const L = layoutOf(input.cols, input.rows)
    const t = input.tick
    const phase = moonPhase(input.now)
    const still = stillAt(L, phase)
    d.clear()
    d.dot.set(still.base)
    const show = this.showAt >= 0 ? t - this.showAt : -1

    // the clouds: a sparse stipple inside, an edge where they thin, a lit edge along their tops
    const ca = Math.cos(this.roil * Math.PI * 2), sa = Math.sin(this.roil * Math.PI * 2)
    const { sky, cb, c1, c2, dither, top } = still
    const moonLight = L.moon !== undefined ? 1 - Math.abs(phase - 0.5) * 2 : 0
    const T = (L.band ? 0.66 : 0.5) - this.storm * (L.band ? 0.06 : 0.04)
    const body = L.band ? 0 : 0.14
    for (let k = 0; k < sky.length; k++) {
      const e = cb[k]! + ca * c1[k]! + sa * c2[k]! - T
      if (e <= 0) continue
      const b = dither[k]!
      const tp = top[k]!
      if (e < 0.06) {
        if (tp === 2 && moonLight > 0.15) { if (b < 0.6) d.dot[sky[k]!] = P.cloudMoon }
        else if (tp === 1) { if (b < (L.band ? 0.45 : 0.62)) d.dot[sky[k]!] = P.cloudRim }
        else if (b < 0.3) d.dot[sky[k]!] = P.cloudDim
      } else if (b < Math.min(0.42, body + e * 0.9)) d.dot[sky[k]!] = P.cloudDim
    }

    // the sigils: they breathe, brighter in the storm, kindled one by one in the spectacle
    still.sigils.forEach((sg, k) => {
      const breath = Math.sin(((t + sg.phase) / sg.period) * Math.PI * 2) > 0.3 ? 1 : 0
      let level = breath + (this.mood === 'busy' ? 1 : 0)
      if (show >= 6 + k * 4 && show < 132 + k * 2) level = 3
      const inkOf = [P.sigilDim, P.sigil, P.sigilBright, P.sigilBlaze][Math.min(3, level)]!
      for (const stroke of sg.strokes) for (let j = 0; j < stroke.length; j += 2) d.set(sg.x + stroke[j]!, sg.y + stroke[j + 1]!, inkOf)
    })

    this.drawPonder(L, t)
    this.drawBeard(L, input)
    this.drawEyes(L, input)
    this.drawSea(L, input)
    for (let k = 0; k < still.fore.length; k++) d.dot[still.fore[k]!] = still.foreInk[k]!
    this.drawShip(L, t)
    this.drawRain(L, t)
    this.drawBolts(L, still, t)
    for (const m of this.motes) {
      const age = t - m.born
      const c = (age + m.born) % 26
      if (c < 9) d.set(m.x, m.y, c === 0 || c === 8 || age > m.life - 8 ? P.moteDim : P.mote)
    }

    // the bubble, beside his head; where his head leaves no room beside it, over his crown, clear of his face
    let box: { c0: number; r0: number; c1: number; r1: number } | undefined
    if (input.bubble !== undefined) {
      const head = { c0: Math.max(0, Math.floor((L.cx - L.half) / 2) - 1), r0: Math.max(0, Math.floor(V(L, DOME.cy - DOME.ry) / 4)), c1: Math.min(input.cols, Math.ceil((L.cx + L.half) / 2) + 1), r1: input.rows }
      const face = { c0: Math.max(0, Math.floor(U(L, -17) / 2) - 1), r0: Math.max(0, Math.floor(V(L, -6) / 4)), c1: Math.min(input.cols, Math.ceil(U(L, 17) / 2) + 1), r1: input.rows }
      const keep = head.c0 - 5 >= 16 || input.cols - head.c1 - 5 >= 16 ? head : face
      const anchor = { c: Math.floor(U(L, -9) / 2), r: Math.max(0, Math.floor(V(L, L.band ? 4 : -1) / 4)) }
      box = drawBubble(d, input.bubble, anchor, keep, P.border, P.words, P.border, input.asciiBorders === true)
    }

    const frame = this.out ?? litFrame(input.cols, input.rows, PALETTE)
    this.out = frame
    packFast(d, PALETTE, frame)
    this.light(L, still, frame, t)
    if (box !== undefined) {
      for (let r = Math.max(0, box.r0); r < Math.min(input.rows, box.r1); r++) {
        for (let c = Math.max(0, box.c0 - 1); c < Math.min(input.cols, box.c1 + 1); c++) frame.bg[r * input.cols + c] = 0
      }
    }
    return frame
  }

  /** The light of the moment: a tall room's own night, the eyes' glow, and any strike's flash and bloom. */
  private light(L: Layout, still: Still, frame: Frame & { bg: Uint8Array }, t: number): void {
    const { cols, rows } = L
    const bg = frame.bg
    for (let r = 0; r < rows; r++) {
      let wash = 0
      if (L.tall) {
        const y = r * 4 + 2
        wash = y < L.sea ? SKY + Math.min(SKY_STEPS - 1, Math.floor((y / L.sea) * SKY_STEPS)) : DEEP + Math.min(DEEP_STEPS - 1, Math.floor(((y - L.sea) / (L.H - L.sea)) * DEEP_STEPS))
      }
      bg.fill(wash, r * cols, (r + 1) * cols)
    }
    if (L.tall) for (let i = 0; i < bg.length; i++) {
      const sh = still.shade[i]!
      if (sh !== 0 && (bg[i]! < DEEP || sh === 3)) bg[i] = sh === 2 ? P.wingShadow : P.shadow
    }
    // the eyes glow behind their own cells
    const glows = GLOW[L.s >= 1.3 ? 1 : 0]!
    for (let i = 0; i < frame.ink.length; i++) {
      const glow = glows[frame.ink[i]!]!
      if (glow !== 0) bg[i] = glow
    }
    // lightning: each strike relights what it falls on, by how it faces, and blooms behind it
    const level = this.level
    let lit = false
    for (const s of this.strikes) {
      const age = t - s.at
      const I = ((s.kind === 'bolt' ? FLASH : SHEET)[age] ?? 0) * s.power
      if (I <= 0.05) continue
      if (!lit) level.fill(0)
      lit = true
      const by = s.kind === 'far' ? L.sea - 2 : s.kind === 'sheet' ? L.skyTop + (L.sea - L.skyTop) * 0.25 : (L.skyTop + L.sea) / 2
      // in the band a strike lights the stretch round it, in a tall room most of the sky
      const reach = s.kind === 'far' ? 18 + L.W * 0.06 : s.kind === 'sheet' ? 24 + L.W * (L.band ? 0.1 : 0.18) : L.band ? 30 + L.W * 0.18 : 40 + L.W * 0.4
      for (let r = 0; r < rows; r++) {
        const y = r * 4 + 2
        const dy = (y - by) / (reach * 1.4)
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const mat = still.mat[i]!
          const x = c * 2 + 1
          const dx = (x - s.x) / reach
          let f = 1 / (1 + (dx * dx + dy * dy) * 3)
          if (mat === 1 || mat === 4) {
            // his hide and the stones, by which way they face the bolt
            const lx = s.x - x, ly = by - (L.sea - L.skyTop) - y, lz = reach * 0.8
            const nl = (still.nx[i]! * lx + still.ny[i]! * ly + still.nz[i]! * lz) / (100 * (Math.hypot(lx, ly, lz) || 1))
            f *= Math.max(0, Math.min(1, 0.15 + nl))
          } else if (mat === 2) f *= 0.75
          else if (mat === 3) f *= s.kind === 'far' ? 0.9 : 0.7
          const q = I * f
          const k = q > 0.6 ? 3 : q > 0.36 ? 2 : q > 0.16 ? 1 : 0
          // the moon and the sigils keep their own light, but the sky blooms behind them too
          if (k > level[i]! && mat !== 5) level[i] = k
          // the bloom behind, in a tall room's painted night (in the band a block of color would read as a box)
          if (L.tall && q > 0.22 && bg[i]! !== P.glow1 && bg[i]! !== P.glow2 && bg[i]! !== P.glow3) {
            bg[i] = mat === 3 ? (q > 0.5 ? P.seaBloom2 : P.seaBloom1) : mat === 1 || mat === 4 ? (q > 0.5 ? P.skinBloom2 : P.skinBloom1) : q > 0.62 ? P.bloom3 : q > 0.42 ? P.bloom2 : P.bloom1
          }
        }
      }
    }
    if (lit) relight(frame, level, LIT)
  }

  private drawPonder(L: Layout, t: number): void {
    if (this.ponderAt < 0) return
    const d = this.d
    const g = Math.max(9, (Math.round(7 * L.s) | 1))
    const x = Math.round(Math.max(2, L.cx - L.half - g - 3 * L.s)), y = Math.round(Math.max(1, Math.min(L.sea - g - 2, V(L, -7) - g / 2)))
    const key = `${this.ponderAt}:${g}`
    let sigil = this.ponderSigil
    if (sigil === undefined || sigil.key !== key) this.ponderSigil = sigil = { key, strokes: sigilStrokes(this.ponderAt * 13 + 5, g) }
    const strokes = sigil.strokes
    const ending = this.ponderEnd >= 0
    const shown = ending ? strokes.length : Math.min(strokes.length, 1 + Math.floor((t - this.ponderAt) / 2))
    const inkOf = ending ? (t - this.ponderEnd < 5 ? P.sigil : P.sigilDim) : P.sigilBright
    for (let yy = y - 1; yy <= y + g; yy++) for (let xx = x - 1; xx <= x + g; xx++) d.set(xx, yy, 0)
    for (let k = 0; k < shown; k++) {
      const stroke = strokes[k]!
      for (let j = 0; j < stroke.length; j += 2) d.set(x + stroke[j]!, y + stroke[j + 1]!, inkOf)
    }
  }

  private drawBolts(L: Layout, still: Still, t: number): void {
    const d = this.d
    for (const s of this.strikes) {
      if (s.kind !== 'bolt') continue
      const age = t - s.at
      if (age > 2) continue
      const key = `${L.cols}x${L.rows}`
      let path = s.path
      if (path === undefined || path.key !== key) s.path = path = { key, ...boltPath(L, s.x, s.seed) }
      // before his wings, behind him, the moon, the sigils and the stones
      const inkOf = age === 0 ? P.bolt : P.boltDim
      const { dots, dim } = path
      const shows = (k: number, list: number[]) => {
        const at = still.solid[list[k + 1]! * L.W + list[k]!]!
        return at === 0 || at === 2 || at === 6
      }
      for (let k = 0; k < dots.length; k += 2) {
        if (!shows(k, dots)) continue
        d.set(dots[k]!, dots[k + 1]!, inkOf)
        // a tall room's bolt is a channel two dots wide
        if (L.tall) d.set(dots[k]! + 1, dots[k + 1]!, inkOf)
      }
      if (age <= 1) for (let k = 0; k < dim.length; k += 2) if (shows(k, dim)) d.set(dim[k]!, dim[k + 1]!, P.boltDim)
    }
  }

  private drawBeard(L: Layout, input: SceneInput): void {
    const d = this.d
    const s = L.s
    const talking = input.mood === 'talk'
    for (const k of BEARD_ORDER) {
      const f = (k / (STRANDS - 1)) * 2 - 1
      let u = f * 11.5, v = 3 - 0.6 * f * f
      const len = 16.5 - 6.5 * f * f + hash(k, 41) * 2.5
      const w0 = 1.75 - 0.6 * f * f
      let a = Math.PI / 2 - f * 0.55
      const curl = (Math.abs(f) < 0.1 ? (hash(k, 42) < 0.5 ? -1 : 1) : -Math.sign(f)) * (0.42 + 0.12 * hash(k, 43))
      const phase = hash(k, 44) * 6 + Math.round(this.sway[k]! * 5) / 5
      const part = talking && Math.abs(f) < 0.5 ? Math.sign(f || 1) * 0.035 : 0
      const ds = 0.45 / s
      let n = 0
      for (let l = 0; l < len; l += ds, n++) {
        const tt = l / len
        a += (f * 0.01 + 0.05 * Math.sin(tt * Math.PI * 2.2 + phase) * (0.4 + tt) + part + curl * smoothstep(0.62, 1, tt) * 1.2) * ds
        u += Math.cos(a) * ds
        v += Math.sin(a) * ds
        const x = U(L, u), y = V(L, v)
        const hw = w0 * (1 - 0.8 * tt) * s
        const under = y > L.sea + 0.5
        if (under && n % 2 === 1) continue
        if (hw < 0.9) { d.set(x, y, under ? P.sea : P.outline); continue }
        const nx = -Math.sin(a), ny = Math.cos(a)
        // its body hides what is behind it: a latent stipple, nothing else
        // its body hides what is behind it
        for (let o = -hw + 0.8; o <= hw - 0.8; o += 0.6) d.set(x + nx * o, y + ny * o, 0)
        // under the water a strand shows in the sea's own ink, seen through it
        const edge = under ? P.sea : P.outline
        d.set(x + nx * hw, y + ny * hw, edge)
        d.set(x - nx * hw, y - ny * hw, edge)
        if (!under && hw > 2.4) d.set(x + nx * (hw - 0.8), y + ny * (hw - 0.8), edge)
        // suckers along its inner side, in a room big enough to see them
        if (!under && s >= 1.8 && n % Math.max(3, Math.round(1.7 * s)) === 0 && tt > 0.15) {
          const side = f <= 0 ? 1 : -1
          const sx = x + nx * hw * 0.42 * side, sy = y + ny * hw * 0.42 * side
          d.set(sx, sy, P.outline)
          if (s >= 2.2 && hw > 2.4) { d.set(sx + 1, sy, P.outline); d.set(sx, sy + 1, P.outline); d.set(sx + 1, sy + 1, P.outline) }
        }
      }
    }
  }

  private drawEyes(L: Layout, input: SceneInput): void {
    const d = this.d
    const s = L.s
    const flare = this.mood === 'talk' && Math.floor(input.tick / 3) % 2 === 0
    EYES.forEach((eye, e) => {
      const ex = U(L, eye.u), ey = V(L, eye.v)
      const a = eye.a * s, b = eye.b * s
      const k = Math.round(this.open[e]! * this.eyeRows(L, e))
      const big = e < 2
      const x0 = Math.round(ex - a), x1 = Math.round(ex + a)
      if (k === 0) {
        // shut: a seam that still glows a little, sagging like a sleeper's
        if (!big && s < 1.3) { d.set(ex, ey, P.lid); return }
        for (let x = x0; x <= x1; x++) {
          const c = Math.pow(Math.max(0, 1 - ((x - ex) / a) ** 2), 0.6)
          d.set(x, Math.round(ey + c * b * 0.35), big ? P.seam : P.lid)
        }
        return
      }
      const px = ex + this.look * a * 0.32 * (big ? 1 : 0)
      const ri = b * 0.95
      const pw = Math.max(1, Math.round(0.45 * s))
      for (let x = x0; x <= x1; x++) {
        const c = Math.pow(Math.max(0, 1 - ((x - ex) / a) ** 2), 0.6)
        const top = Math.round(ey - k * 0.55 * c), bot = Math.round(ey + k * 0.45 * c)
        for (let y = top; y <= bot; y++) {
          // the upper lid in the brow's ink, which it meets; the lower in the hide's
          if ((y === top || y === bot) && s >= 1.3) { d.set(x, y, y === top ? P.brow : P.outline); continue }
          if (!big && s < 1.3) { d.set(x, y, P.iris); continue }
          const dx = x - px, dy = y - ey
          if (Math.abs(dx) < pw / 2 + 0.05 && Math.abs(dy) <= ri * 0.9 && k >= 2) { d.set(x, y, 0); continue }
          const r2 = (dx * dx + dy * dy) / (ri * ri)
          if (r2 < 0.3 && big) d.set(x, y, flare ? P.flare : P.irisCore)
          else if (r2 < 1) d.set(x, y, P.iris)
          // the white of his eye is no white at all: a dark socket round the glowing iris
          else d.set(x, y, 0)
        }
      }
      if (big && s >= 1.3) for (let x = x0; x <= x1; x++) {
        const c = Math.pow(Math.max(0, 1 - ((x - ex) / a) ** 2), 0.6)
        d.set(x, Math.round(ey - k * 0.55 * c) - 1, P.brow)
      }
    })
  }

  private drawSea(L: Layout, input: SceneInput): void {
    const d = this.d
    const t = input.tick
    const { W, H } = L
    const busy = input.mood === 'busy'
    const depth = H - L.sea
    // rows of broken crests, closer together far off, drifting; the storm heaps them up
    for (let y = L.sea + 1, row = 0; y < H; row++) {
      const near = (y - L.sea) / Math.max(1, depth)
      const drift = Math.floor(t * (busy ? 0.04 + 0.1 * near : 0.012 + 0.04 * near)) * (row % 2 === 0 ? 1 : -1)
      const S = Math.round(9 + 12 * near)
      const keep = (busy ? 0.36 : 0.26) + 0.2 * near
      for (let seg = Math.floor(drift / S) - 1; seg <= Math.floor((W + drift) / S) + 1; seg++) {
        if (hash(seg, row, 51) > keep) continue
        const len = 2 + Math.floor(hash(seg, row, 52) * (2 + 5 * near))
        const off = Math.floor(hash(seg, row, 53) * (S - len))
        if (hash(seg, row, Math.floor((t + hash(seg, row, 54) * 80) / 80)) > 0.85) continue
        const inkOf = near > 0.5 && !L.band ? P.seaNear : P.sea
        for (let m = 0; m < len; m++) {
          const x = W - (seg * S + off + m - drift)
          if (x < 0 || x >= W) continue
          const yy = y - (m === Math.floor(len / 2) && len > 3 ? 1 : 0)
          d.set(x, yy, inkOf)
        }
      }
      y += 1 + Math.round(near * 2.4)
    }
    // foam where he stands in the water
    const x0 = Math.round(U(L, -TORSO.rx * 0.8)), x1 = Math.round(U(L, TORSO.rx * 0.8))
    const q = Math.floor(t / (busy ? 8 : 12))
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      if (hash(x, q, 55) < (busy && L.band ? 0.18 : 0.12)) d.set(x, L.sea + (hash(x, q, 56) < 0.5 ? 0 : 1), P.foam)
    }
    // his open eyes, and the moon, in the water: broken streaks
    const streaks = (cx: number, half: number, inkOf: number, seed: number) => {
      // in a tall room the glare outshines the crests under it (and the row keeps one ink fewer)
      if (L.tall) for (let y = L.sea + 1; y < H; y++) {
        const w = half * (0.6 + ((y - L.sea) / Math.max(1, depth)) * 1.3) * 1.1
        for (let x = Math.max(0, Math.round(cx - w)); x <= Math.min(W - 1, Math.round(cx + w)); x++) {
          const at = y * W + x
          if (d.dot[at] === P.sea || d.dot[at] === P.seaNear) d.dot[at] = 0
        }
      }
      for (let y = L.sea + 2; y < H; y += L.tall ? 3 : 2) {
        const near = (y - L.sea) / Math.max(1, depth)
        // re-cut every second and a half in the band, every three in a tall room, each row on its own beat
        const every = L.tall ? 12 : 6
        const cut = Math.floor((t + hash(y, seed) * every) / every)
        const w = half * (0.6 + near * 1.3) * (0.6 + 0.5 * hash(y, cut, seed + 1))
        const c = cx + Math.round((hash(y, cut, seed + 2) - 0.5) * 2)
        for (let x = Math.round(c - w); x <= Math.round(c + w); x++) if (hash(x, y, cut + seed) > 0.45 + near * 0.2) d.set(x, y, inkOf)
      }
    }
    for (const e of [0, 1]) {
      const o = this.open[e]!
      if (o > 0.2) streaks(U(L, EYES[e]!.u), EYES[e]!.a * L.s * 0.45 * o, P.eyeRefl, 60 + e * 5)
    }
    if (L.moon !== undefined && 1 - Math.abs(moonPhase(input.now) - 0.5) * 2 > 0.1) streaks(L.moon.x, L.moon.r * 0.6, P.moonRefl, 70)
  }

  private drawShip(L: Layout, t: number): void {
    if (this.mood === 'busy') return
    // once in a long while, a ship along the horizon, tiny beside him
    const cycle = 2400
    const k = (t + Math.floor(hash(this.seed, 3) * cycle)) % cycle
    const x = Math.round(-14 + k / 4)
    if (x > L.W + 14) return
    const art = L.s >= 1.6
      ? ['...s....s.....', '..ss...ss.....', '.sss..sss..s..', '..s....s...s..', 'ssssssssssssss', '.ssssssssssss.', '..ssssssssss..']
      : ['..s...', '.ss.s.', 'ssssss', '.ssss.']
    const y = L.sea - art.length + 2
    this.d.stamp(art, x, y, { s: P.ship })
    this.d.set(x + art[0]!.length - 1, y + art.length - 3, P.lantern)
  }

  private drawRain(L: Layout, t: number): void {
    if (this.mood !== 'busy') return
    const n = Math.max(2, Math.round((L.W * L.sea) / (L.band ? 800 : 2200)))
    // it falls to the sea line; over the water the crests carry the storm
    const span = L.sea + 4
    for (let k = 0; k < n; k++) {
      const fall = Math.floor(hash(k, 71) * span) + t * 3
      const y = (fall % span) - 3
      const x = Math.round(hash(k, 72, Math.floor(fall / span)) * (L.W + 10)) - Math.round(y / 3)
      if (y <= L.sea) this.d.set(x, y, P.rain)
      if (y - 2 <= L.sea) this.d.set(x + 1, y - 2, P.rain)
    }
  }
}

/** A bolt's dots, from the clouds to the sea: midpoint displacement, a few fainter branches. */
function boltPath(L: Layout, x0: number, seed: number): { dots: number[]; dim: number[] } {
  const top = Math.max(0, L.skyTop + Math.round((L.sea - L.skyTop) * 0.08)), bottom = L.sea
  const pts: [number, number][] = [[x0, top], [x0 + (hash(seed, 1) - 0.5) * (L.sea - top) * 0.3, bottom]]
  for (let depth = 0; depth < 6; depth++) {
    const next: [number, number][] = [pts[0]!]
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1]!, [bx, by] = pts[k]!
      next.push([(ax + bx) / 2 + (hash(seed, depth, k) - 0.5) * Math.hypot(bx - ax, by - ay) * 0.42, (ay + by) / 2], [bx, by])
    }
    pts.splice(0, pts.length, ...next)
  }
  const dots: number[] = []
  const dim: number[] = []
  const trace = (list: number[], a: [number, number], b: [number, number]) => {
    const line = dotLine(a[0], a[1], b[0], b[1])
    for (let k = 0; k < line.length; k += 2) if (line[k]! >= 0 && line[k + 1]! >= 0 && line[k]! < L.W && line[k + 1]! < L.H) list.push(line[k]!, line[k + 1]!)
  }
  for (let k = 1; k < pts.length; k++) trace(dots, pts[k - 1]!, pts[k]!)
  for (let b = 0; b < 3; b++) {
    const from = pts[Math.floor(pts.length * (0.2 + 0.5 * hash(seed, b, 9)))]!
    const side = hash(seed, b, 10) < 0.5 ? -1 : 1
    let p: [number, number] = [from[0], from[1]]
    const steps = 4 + Math.floor(hash(seed, b, 11) * 4)
    for (let k = 0; k < steps; k++) {
      const q: [number, number] = [p[0] + side * (2 + hash(seed, b, k + 20) * 4), p[1] + 2 + hash(seed, b, k + 40) * 3]
      trace(dim, p, q)
      p = q
    }
  }
  return { dots, dim }
}

export const dreamer: SceneDef = {
  id: 'sunken-dreamer',
  name: 'Sunken Dreamer',
  persona: 'a colossal tentacle-bearded sleeper risen from a drowned city, dreaming at the edge of a storm sea',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 6,
  create: seed => new Dreamer(seed),
}
