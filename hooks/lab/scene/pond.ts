// Koi Pond: a moonlit pond the width of the terminal. Tonight's moon, in its
// real phase (a crisp terminator, so a crescent, a half, a gibbous moon and a
// full one each read as what they are), hangs over a far shore of low hills;
// its light glitters on the water in broken streaks. Reeds and two cattails
// stand at the right edge, a lily pad with one lotus floats near. Under the
// surface a kohaku koi, white with red patches, glows dim while it wanders
// deep, and brightens as it rises.
//
// The core strip is the band's six rows: sky and moon, the far shore, the
// water with the koi just under it, the pad, the reeds. A taller room keeps
// that strip whole around the horizon and gives its extra rows to the world,
// about 46 above and 54 below, every motif left out whole where it can't fit:
//   the sky, far to near   a Milky Way of fBm star clouds with a dark rift,
//                          washed out by a bright moon; a skein of wild geese
//                          crossing every few minutes, cut out of the moon's
//                          light when they pass it; stars in three magnitudes
//                          that twinkle on their own slow clocks; the moon
//                          large enough for its maria (the rabbit pounding
//                          mochi, where the real seas are) and earthshine on a
//                          crescent; a weeping willow's fronds hanging from
//                          the top left, swaying in a breeze that travels
//                          through them, a leaf now and then let go
//   the far shore          a far range of mountains, the hills and pines, an
//                          arched drum bridge whose reflection closes its
//                          circle, a snow-viewing lantern whose flame
//                          gutters now and then
//   the water, far to near the glitter path, the lantern's warm streak, the
//                          koi's strip, colonies of pads in perspective with
//                          lotus flowers and buds, frogs sitting on the
//                          biggest, fallen leaves drifting, and the stones of
//                          the near bank
// The koi keeps its size and its strip in every room, in the right half of a
// window. Motion is spread thin: every glint, star and frog keeps its own
// clock; the water steps on even ticks and the koi on odd ones, one change a
// tick (a rise travels down it as a bend, and its head leads every turn).
//
//   idle    the koi wanders deep and slow, pausing to hover; a light breeze
//           sways the willow and the reeds; a frog blinks or croaks now and
//           then. After half a minute of quiet, fireflies come out over the
//           reeds and the shore, more the longer it stays quiet, and little by
//           little their flashes fall into step (pulse-coupled, as real ones do)
//   busy    a light rain: drops streak down and ring the water; the koi swims
//           laps a little higher and quicker; the reeds and the willow lean in
//           the wind, which strips a few leaves; the frogs croak more
//   ponder  it stops mid-water and lets air bubbles rise to the surface
//   talk    it surfaces under its words, facing them, and rings spread from
//           its mouth
//   spectacle (a long turn just ended)  it leaps: an arc out of the water, a
//           splash of droplets, wide rings, the moon's reflection broken up
import { clamp } from '../util'
import type { Dots as DotsT, Frame, Ink, Mood, SceneDef, SceneInput, SceneInstance } from './kit'
import { bayer, Dots, drawBubble, hash, ink, moonPhase, noise1, packFast } from './kit'

// Inks, back to front. On a light theme the scene becomes an ink wash on paper.
const P = {
  starDim: 1, star: 2, hill: 3, water: 4, waterNear: 5, halo: 6, rim: 7,
  reflDim: 8, refl: 9, maria: 10, moon: 11, reed: 12, cattail: 13, pad: 14,
  ring: 15, ringDim: 16, rain: 17, air: 18,
  finD: 19, whiteD: 20, redD: 21, finM: 22, whiteM: 23, redM: 24, finS: 25, whiteS: 26, redS: 27,
  lotus: 28, firefly: 29, fireflyDim: 30, border: 31, words: 32, spray: 33,
  starBright: 34, milky: 35, shine: 36, ridge: 37, willow: 38, willowLit: 39, leaf: 40,
  stone: 41, bank: 42, lamp: 43, lampLow: 44, lampRefl: 45, bridge: 46, bridgeRefl: 47,
  frog: 48, frogEye: 49, throat: 50, padFar: 51, bud: 52, goose: 53,
} as const

const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
PALETTE[P.starDim] = ink(0x384258, 0xc9ced6)
PALETTE[P.star] = ink(0x7f8aa6, 0x99a2b0, 1.2)
PALETTE[P.hill] = ink(0x2f4542, 0xb5c2b8)
PALETTE[P.water] = ink(0x223647, 0xbccbd8)
PALETTE[P.waterNear] = ink(0x2c465c, 0xa4b8c8)
PALETTE[P.halo] = ink(0x45443a, 0xddd6bc)
PALETTE[P.rim] = ink(0x6e6a52, 0xb9b08a, 1.3)
PALETTE[P.reflDim] = ink(0x6a6650, 0xbcb184, 1.2)
PALETTE[P.refl] = ink(0xb3ab86, 0x9c8f58, 1.4)
PALETTE[P.maria] = ink(0x9d977c, 0xb7aa78, 2)
PALETTE[P.moon] = ink(0xefe9cc, 0x8d7f45, 2)
PALETTE[P.reed] = ink(0x3f5c37, 0x6c8c5a, 1.5)
PALETTE[P.cattail] = ink(0x80593a, 0x8a5730, 2.5)
PALETTE[P.pad] = ink(0x2f5a3e, 0x5d8c63, 1.5)
PALETTE[P.ring] = ink(0x5d84a3, 0x5f82a2, 1.6)
PALETTE[P.ringDim] = ink(0x3a566e, 0x8ea6bb, 1.3)
PALETTE[P.rain] = ink(0x4b6379, 0x8299ad, 1.1)
PALETTE[P.air] = ink(0x86aac6, 0x55809f, 2.5)
PALETTE[P.finD] = ink(0x5a554e, 0xcfc8bd, 1.6)
PALETTE[P.whiteD] = ink(0x8a857a, 0xb9b1a3, 2)
PALETTE[P.redD] = ink(0x9a5038, 0xe39a7c, 2.4)
PALETTE[P.finM] = ink(0x77706a, 0xbab2a4, 1.6)
PALETTE[P.whiteM] = ink(0xbdb7aa, 0x998f80, 2)
PALETTE[P.redM] = ink(0xd2683e, 0xd56a45, 2.4)
PALETTE[P.finS] = ink(0xb7afa1, 0x9d9484, 1.6)
PALETTE[P.whiteS] = ink(0xf0eadf, 0x80776a, 2)
PALETTE[P.redS] = ink(0xf27a43, 0xcc4a1e, 2.4)
PALETTE[P.lotus] = ink(0xdc8aa5, 0xc4577a, 3)
PALETTE[P.firefly] = ink(0xd2ec7e, 0x7f9a22, 5)
PALETTE[P.fireflyDim] = ink(0x6f7d40, 0xb7c98a, 3)
PALETTE[P.border] = ink(0xe8875a, 0xc0582a, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)
PALETTE[P.spray] = ink(0xc9dbe8, 0x5e88aa, 3)
PALETTE[P.starBright] = ink(0xc9d2e8, 0x5d6778, 1.5)
PALETTE[P.milky] = ink(0x384258, 0xc9ced6, 0.8) // the dim stars' color, so the dust and its stars draw as one run
PALETTE[P.shine] = ink(0x3e3d36, 0xdedacb, 1.1)
PALETTE[P.ridge] = ink(0x25303a, 0xd3dae0, 0.9)
PALETTE[P.willow] = ink(0x2d4836, 0xaac0a7, 1.2)
PALETTE[P.willowLit] = ink(0x46664a, 0x84a07c, 1.3)
PALETTE[P.leaf] = ink(0x8f9c55, 0x7d8a38, 2)
PALETTE[P.stone] = ink(0x575c60, 0x8d918f, 1.4)
PALETTE[P.bank] = ink(0x3b4144, 0xbcc0bd, 1.1)
PALETTE[P.lamp] = ink(0xf0b860, 0xc07a18, 4)
PALETTE[P.lampLow] = ink(0xcf9446, 0xd09048, 4)
PALETTE[P.lampRefl] = ink(0x7d5c33, 0xd8ab70, 1.6)
PALETTE[P.bridge] = ink(0x6e3d33, 0xb8654f, 1.5)
PALETTE[P.bridgeRefl] = ink(0x452f2b, 0xdcb1a4, 1.1)
PALETTE[P.frog] = ink(0x5b8a45, 0x4c7a33, 2.5)
PALETTE[P.frogEye] = ink(0xd9d47a, 0x6b6514, 5)
PALETTE[P.throat] = ink(0xb4c98e, 0x8fae63, 3)
PALETTE[P.padFar] = ink(0x25463a, 0x94b59a, 1.4)
PALETTE[P.bud] = ink(0xa8687e, 0xd28ba4, 3)
PALETTE[P.goose] = ink(0x5d6577, 0x787b80, 3)

/** Smooth 2-D value noise in [0, 1). */
function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), e = hash(xi + 1, yi + 1, seed)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v
}

/** Three octaves of it: fBm, for dust and seas. */
function fbm2(x: number, y: number, seed: number): number {
  return (noise2(x, y, seed) * 4 + noise2(x * 2.03, y * 2.03, seed + 17) * 2 + noise2(x * 4.1, y * 4.1, seed + 31)) / 7
}

// ---------------------------------------------------------------- the moon
// The near side's seas, seen with north up, on the unit disc: x, y (north
// positive), rx, ry. Where the real maria are, so the rabbit is there too.
const MARIA: readonly (readonly [number, number, number, number])[] = [
  [-0.24, 0.53, 0.3, 0.25], // Imbrium
  [0.27, 0.46, 0.17, 0.16], // Serenitatis
  [0.5, 0.14, 0.22, 0.19], // Tranquillitatis
  [0.8, 0.29, 0.09, 0.14], // Crisium
  [0.73, -0.15, 0.12, 0.2], // Fecunditatis
  [0.52, -0.28, 0.09, 0.09], // Nectaris
  [-0.72, 0.18, 0.18, 0.42], // Procellarum
  [-0.5, -0.06, 0.19, 0.24], // Procellarum, south
  [-0.26, -0.36, 0.17, 0.14], // Nubium
  [-0.57, -0.41, 0.09, 0.09], // Humorum
  [0.02, 0.8, 0.36, 0.06], // Frigoris
  [0.06, 0.24, 0.08, 0.08], // Vaporum
]

function inMare(u: number, v: number): boolean {
  const edge = 0.75 + 0.5 * noise2(u * 7 + 40, v * 7 + 40, 5) // ragged shores
  for (const [mx, my, rx, ry] of MARIA) if (((u - mx) / rx) ** 2 + ((v - my) / ry) ** 2 < edge) return true
  return false
}

/** A dot is a little taller than it is wide: rows are squashed by this so a disc comes out round. */
const ASPECT = 1.08

/**
 * Tonight's moon as the pond draws it, from its real phase (`moonPhase`):
 * the lit part out to a crisp terminator, never thinner than a dot and a bit,
 * so a young crescent still shows. With `detail` (a moon big enough) its maria
 * darken the lit part, a crescent's dark part glows faintly with earthshine,
 * and a gibbous moon's dark limb is a faint dotted edge, so the bite shows; a
 * Bayer halo leans toward the lit side and grows with the light. At new moon
 * only the earthshine is left, or nothing in a small sky. Dots come back as
 * (dx, dy, ink) triples about its centre, worked out once a phase and size.
 */
function pondMoon(r: number, phase: number, detail: boolean): number[] {
  const out: number[] = []
  const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2 // 0 new, 1 full
  const waxing = phase < 0.5 // lit on the right, as seen from the north
  let k = Math.cos(2 * Math.PI * phase) // where the terminator crosses each row, as a share of the half-chord
  // a small moon keeps a crescent's limb at least a dot and a bit thick, and a gibbous moon's bite two dots deep
  if (lit > 0.012) k = Math.min(k, 1 - 1.4 / r)
  if (lit > 0.5 && lit < 0.97) k = Math.max(k, -1 + 2 / r)
  const reach = detail ? Math.round(r * 0.45 + 3) : 3
  const sub = [-0.25, 0.25]
  for (let y = -r - reach; y <= r + reach; y++) {
    for (let x = -r - reach; x <= r + reach; x++) {
      let inside = 0, on = 0
      for (const sy of sub) {
        for (const sx of sub) {
          const px = x + sx, py = (y + sy) * ASPECT
          if (px * px + py * py > r * r) continue
          inside++
          const half = Math.sqrt(r * r - py * py)
          if ((waxing ? px : -px) >= k * half) on++
        }
      }
      const dd = Math.sqrt(x * x + (y * ASPECT) ** 2)
      if (inside >= 2) {
        if (on >= 2) out.push(x, y, detail && inMare(x / r, (-y * ASPECT) / r) ? P.maria : P.moon)
        else if (detail && lit < 0.5) {
          // earthshine: the old moon in the new moon's arms
          const edge = dd > r - 1.2
          if ((edge && (x + y) % 2 === 0) || hash(x + 64, y + 64, 9) < 0.04 + 0.1 * (1 - lit * 2)) out.push(x, y, P.shine)
        } else if (lit >= 0.5 && lit < 0.97 && dd > r - 1.1 && (x + y) % 2 === 0) out.push(x, y, P.shine)
        continue
      }
      if (lit < 0.03 || dd > r + reach) continue
      const fall = 1 - (dd - r) / (reach + 0.2)
      const side = (waxing ? x : -x) / Math.max(1, dd)
      const toward = lit + (1 - lit) * clamp(0.5 + side, 0, 1)
      if (bayer(x + 64, y + 64) < fall * fall * (0.25 + 0.45 * lit) * toward * 0.6) out.push(x, y, P.halo)
    }
  }
  return out
}

// ---------------------------------------------------------------- the koi
// Drawn heading left (its head at x 0), 25 x 8 dots. W white, R red, F fin;
// ',' is the eye, a dot left dark inside the head.
const BODY = [
  '......RRR..................',
  '...RRRRRRRWW...............',
  '.WWRRRRRWWWWWRRW...........',
  'W,WWWWWWWWWWRRRRWWWW.......',
  'WWWWWWWWWWWWWWRWWWWWW......',
  '.WWWWWWWWWWWWWWWWWWW.......',
  '..WWWWWWWWWWWWWWW..........',
  '...........................',
]
const TAILS = [
  // spread, flick up, spread, flick down
  ['...........................', '.......................FF..', '......................FFF..', '....................FFFF...', '.....................FFF...', '....................FFFF...', '......................FFF..', '.......................FF..'],
  ['........................FF.', '......................FFF..', '.....................FFF...', '....................FFF....', '.....................FF....', '....................FFF....', '......................F....', '...........................'],
  ['...........................', '.......................FF..', '......................FFF..', '....................FFFF...', '.....................FFF...', '....................FFFF...', '......................FFF..', '.......................FF..'],
  ['...........................', '......................F....', '....................FFF....', '.....................FF....', '....................FFF....', '.....................FFF...', '......................FFF..', '........................FF.'],
]
const FINS = [
  ['...........................', '...........................', '...........................', '...........................', '...........................', '...........................', '.F.........................', '..FFF.....FF...............'],
  ['...........................', '...........................', '...........................', '...........................', '...........................', '...........................', '...........................', '..FF.F....F.F..............'],
]
// Turning toward you: three-quarter (shorter, both pectorals showing), then head-on.
const THREE_Q = [
  '.....RRR.........',
  '...RRRRRWW.......',
  '.WWRRRWWWWRW...FF',
  'W,WWWWWWRRWWWFFF.',
  'WWWWWWWWWWWWWFF..',
  '.WWWWWWWWWWW.FFF.',
  '.FWWWWWWWW.....FF',
  'FF...F...........',
]
const FRONT = [
  '...RRR...',
  '..RRRRW..',
  '.WRRWWWW.',
  'FW,WW,WWF',
  'FWWWWWWWF',
  'FWWWWWWWF',
  '..WWWWW..',
  '.F.....F.',
]

function overlay(...layers: (readonly string[])[]): string[] {
  const out = layers[0]!.map(r => r.split(''))
  for (const layer of layers.slice(1)) {
    layer.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') out[y]![x] = ch }))
  }
  return out.map(r => r.join(''))
}
const SWIM = TAILS.map((tail, i) => overlay(BODY, tail, FINS[i % 2]!))

/** The art rotated by `angle` (radians, nose-up positive for a left-heading koi), as dot offsets from its middle. */
const rotated = new Map<string, [number, number, string][]>()
function rotate(art: readonly string[], step: number): [number, number, string][] {
  const key = `${SWIM.indexOf(art as string[])}:${step}`
  const hit = rotated.get(key)
  if (hit !== undefined) return hit
  const angle = (step * Math.PI) / 18
  const cx = art[0]!.length / 2, cy = art.length / 2
  const cos = Math.cos(angle), sin = Math.sin(angle)
  const out: [number, number, string][] = []
  const seen = new Set<string>()
  // inverse-map a slightly larger box so the rotation leaves no holes
  for (let y = -16; y <= 16; y++) {
    for (let x = -16; x <= 16; x++) {
      const sx = cos * x + sin * y + cx, sy = -sin * x + cos * y + cy
      const ch = art[Math.floor(sy)]?.[Math.floor(sx)]
      if (ch === undefined || ch === '.') continue
      const k = `${x},${y}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push([x, y, ch])
    }
  }
  rotated.set(key, out)
  return out
}

// ---------------------------------------------------------------- the others
// A frog sitting on a pad, face on: its eyes bulge into the row of cells above
// its body, so they keep their own cells and glint. T is its throat, puffed out
// when it croaks.
const FROG_EYES = 'EE..EE'
const FROG = ['FFFFFF', 'FFFFFF', '.FFFF.', 'F.FF.F']
const FROG_CROAK = ['FFFFFF', 'FFFFFF', 'FTTTTF', 'F.TT.F']

// A snow-viewing lantern (yukimi-doro) of stone, its fire box lit.
const LANTERN = [
  '......s......',
  '....sssss....',
  '..sssssssss..',
  'sssssssssssss',
  's...s...s...s',
  '....sLLLs....',
  '....sLLLs....',
  '...sssssss...',
  '...s.....s...',
  '..s.......s..',
  '.s.........s.',
]

type Layout = {
  W: number; H: number; horizon: number; r: number; moonX: number; moonY: number
  reeds: number; surface: number; deep: number; xMin: number; xMax: number
  /** a window's room, not the band's: the zones may show */
  isWindow: boolean
  /** the willow's reach from the left edge, 0 for none */
  willow: number
  ridge: boolean
  milky: boolean
  /** the lantern's middle, and the bridge's, -1 for none */
  lantern: number
  bridge: number
  bridgeR: number
  bank: boolean
  flies: number
}

/** A ring spreading on the water; a raindrop's is dotted (`thin`). */
type Ring = { x: number; y: number; age: number; max: number; thin?: boolean }
type Drop = { x: number; y: number; land: number }
type Bubble = { x: number; y: number; size: number; born: number }
/** A firefly: where it is, its flash clock (0 to 1), and how far into a flash it is (from below 0, its own small lag; OFF when dark). */
type Fly = { x: number; y: number; vx: number; vy: number; phase: number; period: number; glow: number; seed: number }
const OFF = -99
type Spray = { x: number; y: number; vx: number; vy: number }
type Leaf = { x: number; y: number; vy: number; land: number; phase: number; floating: number; life: number }
type Star = { x: number; y: number; wx: number; phase: number; bright: boolean }
type Frond = { ax: number; ay: number; len: number; curl: number; lit: boolean }
type Pad = { cx: number; cy: number; rx: number; bloom: 0 | 1 | 2; frog: number }
/** Glints that come and go on their own clocks: the moon's glitter path, the lantern's streak, the bridge's reflection. */
type Glints = { key: string; x: Int16Array; y: Int16Array; len: Uint8Array; period: Uint8Array; off: Uint8Array; p: Float32Array; ink: Uint8Array; slot: Int32Array; on: Uint8Array }

class Pond implements SceneInstance {
  private d: DotsT = new Dots(1, 1)
  private out: Frame | undefined
  private seed: number
  private last = -1
  private laid: { key: number; L: Layout } | undefined
  /** Everything that never moves at one size and light, drawn once: the sky's dust, the far shore, the bridge and lantern. */
  private still: { key: string; bg: Uint8Array; fg: Int32Array; fgInk: Uint8Array; stars: Star[]; starSlot: Int32Array; starInk: Uint8Array; fronds: Frond[]; pads: Pad[]; lamp: number[] } | undefined
  private moonAt: { key: string; dots: number[] } | undefined
  private glints: Glints | undefined
  // the koi
  private x = -1
  private y = -1
  private heading = -1
  private turn = -1
  private tail = 0
  private target = -1
  private hover = 0
  private leapAt = -1
  private leapDue = false
  private leapFrom = 0
  /** Where the koi is drawn (x; the depth of its head, middle and tail) and its tail's beat: a tick or so behind it, one change a tick. */
  private shown: [number, number, number, number, number] = [NaN, NaN, NaN, NaN, 0]
  // the weather and the water
  private rings: Ring[] = []
  private drops: Drop[] = []
  private air: Bubble[] = []
  private flies: Fly[] = []
  private spray: Spray[] = []
  private leaves: Leaf[] = []
  private calmFor = 0
  private mood: Mood = 'idle'
  private moodFor = 0
  private lastSpectacle: number | undefined

  constructor(seed: number) {
    this.seed = seed
  }

  frame(input: SceneInput): Frame {
    const { cols, rows } = input
    if (this.d.cols !== cols || this.d.rows !== rows) {
      this.d = new Dots(cols, rows)
      this.out = undefined
    }
    const steps = this.last < 0 ? 1 : Math.max(0, Math.min(8, input.tick - this.last))
    for (let k = 0; k < steps; k++) this.step(input, input.tick - steps + 1 + k)
    this.last = input.tick
    this.draw(input)
    this.out = packFast(this.d, PALETTE, this.out)
    return this.out
  }

  // ---------------------------------------------------------------- layout

  private layout(cols: number, rows: number): Layout {
    const key = cols * 4096 + rows
    if (this.laid?.key === key) return this.laid.L
    const W = cols * 2, H = rows * 4
    const isWindow = H > 28
    const horizon = H <= 28 ? Math.round(H * 0.42) : Math.round(H * 0.46)
    const water = H - horizon
    const willow = isWindow && horizon >= 40 && W >= 110 ? clamp(Math.round(W * 0.2), 26, 84) : 0
    // the moon: big enough in the band for its phase to read, bigger in a window, with its seas from 8 dots
    const r = !isWindow ? (H >= 24 ? 5 : 4)
      : Math.min(H <= 40 ? Math.max(4, Math.min(8, Math.round(H * 0.15))) : clamp(Math.round(6 + (H - 40) * 0.05), 6, 13), Math.max(4, Math.floor((horizon - 3) / 2.4)))
    const moonX = willow > 0 ? Math.max(willow + r + 8, Math.round(W * 0.2)) : Math.max(r + 6, Math.round(W * 0.16))
    const moonY = isWindow ? Math.max(r + 2, Math.round(horizon * 0.4)) : Math.max(r, Math.round(horizon * 0.42))
    const reeds = isWindow ? W - Math.min(30, Math.max(12, Math.round(W * 0.075))) : W - Math.min(16, Math.max(10, Math.round(W * 0.07)))
    const surface = horizon + 5 // koi centre with its dorsal fin at the surface
    // The koi's strip: the band's own depth, a little deeper in a tall room, never the whole water.
    const deep = isWindow ? Math.min(Math.max(surface + 2, H - 5), surface + clamp(4 + Math.round((H - 24) * 0.04), 4, 10)) : Math.max(surface + 2, H - 5)
    const xMin = isWindow ? Math.max(Math.round(W * 0.5), moonX + r + 14) : Math.max(Math.round(W * 0.3), moonX + 14)
    const xMax = Math.max(xMin + 8, reeds - 15)
    const lantern = isWindow && horizon >= 16 && W >= 140 ? Math.round(W * 0.6) : -1
    const bridgeR = clamp(Math.round(W * 0.045), 9, 16)
    const bridge = isWindow && horizon >= 30 && W >= 220 ? Math.round(moonX + r * 2 + 14 + (lantern - moonX - r * 2 - 14) * 0.45) : -1
    const L: Layout = {
      W, H, horizon, r, moonX, moonY, reeds, surface, deep, xMin, xMax, isWindow, willow,
      ridge: isWindow && horizon >= 16,
      milky: isWindow && horizon >= 40,
      lantern, bridge, bridgeR,
      bank: isWindow && water >= 40,
      flies: isWindow ? clamp(Math.round((W * H) / 2600), 4, 16) : 4,
    }
    this.laid = { key, L }
    return L
  }

  // ---------------------------------------------------------------- behaviour

  private step(input: SceneInput, t: number): void {
    const L = this.layout(input.cols, input.rows)
    const mood = input.mood
    if (mood !== this.mood) {
      this.mood = mood
      this.moodFor = 0
      if (mood === 'busy') this.hover = 0 // work started: no resting, laps at once
    } else this.moodFor++
    this.calmFor = mood === 'idle' ? this.calmFor + 1 : 0

    // a spectacle the mod just asked for: leap, once, as soon as it is in view and not turning
    if (input.spectacle !== undefined && input.spectacle !== this.lastSpectacle && t >= input.spectacle) {
      this.lastSpectacle = input.spectacle
      this.leapDue = true
    }
    if (this.leapDue && this.leapAt < 0 && this.turn < 0 && this.x >= L.xMin - 2 && this.x <= L.xMax + 2) {
      this.leapDue = false
      this.leapAt = t
      this.leapFrom = this.x
    }

    if (this.x < 0) {
      // arrives from beyond the reeds
      this.x = L.W + 14
      this.y = L.deep
      this.target = L.xMax - 6
      this.heading = -1
    }

    // The leap overrides everything for its length.
    if (this.leapAt >= 0) {
      const k = t - this.leapAt
      if (k === 0) this.rings.push({ x: this.x + this.heading * 10, y: L.horizon + 1, age: 0, max: 6 })
      if (k === 6) this.splash(this.x, L.horizon + 1, 10)
      if (k === 15) {
        this.splash(this.x, L.horizon + 1, 14)
        this.rings.push({ x: this.x, y: L.horizon + 2, age: 0, max: 14 }, { x: this.x, y: L.horizon + 2, age: -3, max: 10 })
      }
      if (k >= 22) { this.leapAt = -1; this.y = L.surface + 2 }
    } else {
      this.swim(input, L, t)
    }

    // ponder: air rises from its mouth, a bubble every few ticks
    if (mood === 'ponder' && this.moodFor % 3 === 0 && this.turn < 0) {
      this.air.push({ x: this.mouth() + this.heading * 1, y: this.y - 1, size: 1, born: t })
    }
    for (const b of this.air) {
      b.y -= 0.7
      b.x += (hash(Math.round(b.y), b.born, 3) - 0.5) * 0.8
      if (t - b.born === 3 || t - b.born === 7) b.size = Math.min(3, b.size + 1)
    }
    this.air = this.air.filter(b => {
      if (b.y > L.horizon + 1) return true
      this.rings.push({ x: b.x, y: L.horizon + 1, age: 0, max: 3 })
      return false
    })

    // talk: rings spread from its mouth while it speaks
    if (mood === 'talk' && this.moodFor % 5 === 1 && this.y <= L.surface + 1) {
      this.rings.push({ x: this.mouth() + this.heading * 2, y: L.horizon + 2, age: 0, max: 7 })
    }

    // busy: a light rain, a drop every second or so; thinner in a narrow band, as dense in a wide window
    if (mood === 'busy' && hash(t, this.seed, 11) < 0.3 * (L.isWindow ? Math.max(1, L.W / 200) : Math.min(1, L.W / 132))) {
      const x = Math.floor(hash(t, this.seed, 12) * L.W)
      const near = hash(t, this.seed, 13)
      this.drops.push({ x, y: -2, land: Math.round(L.horizon + 2 + near * (L.H - L.horizon - 4)) })
    }
    for (const dr of this.drops) dr.y += 3
    this.drops = this.drops.filter(dr => {
      if (dr.y < dr.land) return true
      const near = (dr.land - L.horizon) / (L.H - L.horizon)
      this.rings.push({ x: dr.x, y: dr.land, age: 0, max: 2 + Math.round(near * (L.isWindow ? 4 : 3)), thin: true })
      return false
    })

    for (const ring of this.rings) ring.age++
    this.rings = this.rings.filter(ring => ring.age <= ring.max)

    for (const s of this.spray) { s.x += s.vx; s.y += s.vy; s.vy += 0.45 }
    this.spray = this.spray.filter(s => s.y < L.horizon + 2)

    this.stepFlies(L, t)
    this.stepLeaves(L, t, mood)
  }

  /**
   * Fireflies come out after half a minute of quiet, more the longer it lasts,
   * and leave when work starts. Each flashes on its own clock; a flash nudges
   * the others' clocks forward (pulse-coupled oscillators, as Mirollo and
   * Strogatz modelled real fireflies), so over minutes of quiet they fall into
   * step and flash together.
   */
  private stepFlies(L: Layout, t: number): void {
    const quiet = this.calmFor - 120
    const want = quiet > 0 ? Math.min(L.flies, 1 + Math.floor(quiet / (L.isWindow ? 40 : 160))) : 0
    if (this.flies.length < want && hash(t, this.seed, 21) < 0.03) {
      const n = this.flies.length
      const home = hash(t, 4, 26)
      const x = !L.isWindow || home < 0.5 ? L.reeds - 4 - hash(t, 1, 22) * 30
        : home < 0.8 || L.willow === 0 ? L.willow + hash(t, 1, 22) * (L.reeds - L.willow)
        : hash(t, 1, 22) * L.willow
      const high = L.isWindow ? Math.min(28, L.horizon * 0.4) : 5
      this.flies.push({ x, y: L.horizon - 2 - hash(t, 2, 23) * high, vx: 0, vy: 0, phase: hash(t, 3, 24), period: 19 + Math.floor(hash(t, 5, 27) * 7), glow: OFF, seed: n * 7 + Math.floor(hash(t, 6, 28) * 30) })
    }
    if (want === 0 && this.flies.length > 0 && hash(t, this.seed, 25) < 0.15) this.flies.shift()
    const top = L.isWindow ? Math.max(1, L.horizon - Math.min(34, L.horizon * 0.5)) : 1
    for (const f of this.flies) {
      f.vx = f.vx * 0.9 + (noise1(t / 20, f.seed) - 0.5) * 0.06
      f.vy = f.vy * 0.9 + (noise1(t / 23, f.seed + 50) - 0.5) * 0.05
      f.x = Math.max(2, Math.min(L.W - 2, f.x + f.vx))
      f.y = Math.max(top, Math.min(L.horizon + 3, f.y + f.vy))
      f.phase += 1 / f.period
      if (f.glow !== OFF && ++f.glow >= 7) f.glow = OFF
    }
    // flashes, and the nudges they give; a nudge past the top fires that one too
    for (let fired = true; fired;) {
      fired = false
      for (const f of this.flies) {
        if (f.phase < 1) continue
        f.phase = 0
        f.glow = -(f.seed % 2) // in step, a flash still ripples through them
        fired = true
        for (const g of this.flies) if (g !== f && g.phase > 0) g.phase += 0.07 * g.phase
      }
    }
  }

  /** Willow leaves let go on a gust (the wind strips more), fall turning over, land, drift a while and sink. */
  private stepLeaves(L: Layout, t: number, mood: Mood): void {
    if (L.willow > 0) {
      const g = this.gust(t, L.willow * 0.5)
      const chance = mood === 'busy' ? 0.03 : mood === 'idle' ? 0.003 + 0.008 * Math.max(0, g) : 0
      const fronds = this.still?.fronds ?? []
      if (fronds.length > 0 && this.leaves.length < 10 && hash(t, this.seed, 81) < chance) {
        const f = fronds[Math.floor(hash(t, 82) * fronds.length)]!
        const s = Math.round(f.len * (0.4 + 0.6 * hash(t, 83)))
        const land = Math.round(L.horizon + 3 + hash(t, 84) * (L.H - L.horizon - 8))
        this.leaves.push({ x: f.ax + f.curl * (s / Math.max(1, f.len)), y: f.ay + s, vy: 0.3 + 0.15 * hash(t, 85), land, phase: Math.floor(hash(t, 86) * 40), floating: -1, life: 700 + Math.floor(hash(t, 87) * 900) })
      }
    }
    const busy = mood === 'busy'
    for (const leaf of this.leaves) {
      if (leaf.floating < 0) {
        leaf.y += leaf.vy
        leaf.x += busy ? 0.35 : 0.06 + 0.22 * Math.sin((t + leaf.phase) / 7)
        if (leaf.y >= leaf.land) { leaf.y = leaf.land; leaf.floating = 0 }
      } else {
        leaf.floating++
        leaf.x += busy ? 0.05 : 0.012
      }
    }
    this.leaves = this.leaves.filter(leaf => leaf.floating < leaf.life && leaf.x < L.reeds - 2)
  }

  /** The breeze at a place, -1 to 1: a slow swell that travels left to right across the room. */
  private gust(t: number, x: number): number {
    return noise1((t - x * 0.3) / 64, this.seed + 7) * 2 - 1
  }

  private swim(input: SceneInput, L: Layout, t: number): void {
    const mood = input.mood
    // it stays under its words, at the top, until they fade
    const speaking = mood === 'talk' || (input.bubble !== undefined && input.bubble !== '...')
    // where it wants to be in depth: deep and dim when idle, at the top to talk
    const wantY =
      speaking ? L.surface
      : mood === 'ponder' ? L.surface + 1
      : mood === 'busy' ? (L.surface + L.deep) / 2
      : L.deep - Math.round(noise1(t / 60, this.seed) * 1.5)
    this.y += Math.max(-0.2, Math.min(0.2, wantY - this.y))

    let speed = 0
    if (this.turn >= 0) {
      this.turn++
      if (this.turn === 3) this.heading = -this.heading
      if (this.turn >= 6) this.turn = -1
    } else {
      const away = this.x > L.xMax + 2 || this.x < L.xMin - 2
      if (away) {
        // arriving, or the pond got narrower: come back into view first
        this.target = Math.max(L.xMin, Math.min(L.xMax, this.x))
        this.hover = 0
      } else if (speaking || mood === 'ponder') {
        // stop and face the words, which sit to the left
        if (this.heading > 0 && this.moodFor > 1) this.turn = 0
        this.target = this.x
      } else if (mood === 'busy') {
        // laps, with a breath at each end before it turns back
        if (this.hover > 0) this.hover--
        else if (Math.abs(this.target - this.x) < 2 || this.target < L.xMin || this.target > L.xMax) {
          if (this.target >= L.xMin && this.target <= L.xMax && this.moodFor > 0) this.hover = 6 + Math.floor(hash(t, this.seed, 33) * 8)
          this.target = this.x > (L.xMin + L.xMax) / 2 ? L.xMin + 2 : L.xMax - 2
        }
      } else if (this.hover > 0) {
        // resting where it is; the next place is already chosen
        this.hover--
      } else if (Math.abs(this.target - this.x) < 1.5) {
        // arrived: hover a while, then pick somewhere else
        this.hover = 12 + Math.floor(hash(t, this.seed, 31) * 40)
        this.target = L.xMin + hash(t, this.seed, 32) * (L.xMax - L.xMin)
      }
      const dx = this.hover > 0 ? 0 : this.target - this.x
      const dir = Math.sign(dx)
      if (dir !== 0 && dir !== this.heading && Math.abs(dx) > 3 && this.hover === 0) this.turn = 0
      else {
        const top = away ? 0.8 : mood === 'busy' ? 0.5 : 0.25
        speed = Math.min(top, Math.abs(dx) * 0.06 + 0.05) * dir
        if (Math.sign(speed) !== this.heading) speed = 0
        this.x += speed
      }
    }
    this.tail += 0.12 + Math.abs(speed) * 0.7
  }

  private splash(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + 0.7 * hash(i, x, 41))
      const v = 1 + 1.6 * hash(i, x, 42)
      this.spray.push({ x, y, vx: Math.cos(a) * v * (i % 2 ? 1 : -1), vy: -Math.sin(a) * v * 1.3 })
    }
  }

  private mouth(): number {
    return this.x + this.heading * 12
  }

  // ---------------------------------------------------------------- the still layers

  /** The top of the near shore at x: low hills, and a pine every so often. */
  private shoreTop(L: Layout, x: number): number {
    const wx = L.W - x
    const s = L.isWindow ? clamp(L.horizon / 18, 1, 3) : 1
    let top = L.horizon - Math.round(1 + s * (2.4 * noise1(wx / 23, 3) + 0.8 * noise1(wx / 9, 4)))
    // a pine every so often: a narrow triangle standing on the hill
    const cell = Math.floor(wx / 9)
    if (hash(cell, 8) < 0.45) {
      const at = cell * 9 + 2 + Math.floor(hash(cell, 6) * 5)
      const tall = 3 + Math.floor(hash(cell, 7) * Math.max(2, L.isWindow ? Math.min(14, L.horizon * 0.2) : L.horizon * 0.35))
      const off = Math.abs(wx - at)
      if (off * 2.2 < tall) top = Math.min(top, L.horizon - 2 - tall + Math.round(off * 2.2))
    }
    return top
  }

  /** The far range: higher, smoother, fainter than the shore. */
  private ridgeTop(L: Layout, x: number): number {
    const wx = L.W - x
    const A = Math.min(22, L.horizon * 0.3)
    return L.horizon - 4 - Math.round(A * (0.65 * noise1(wx / 80, 13) + 0.35 * noise1(wx / 27, 14)))
  }

  /** The Milky Way's dust at a dot, 0 to 1: a band from the upper right toward the horizon, its rift a darker lane. */
  private dust(L: Layout, x: number, y: number): number {
    const x0 = L.W * 0.78, x1 = L.W * 0.36
    const nx = L.horizon, ny = x0 - x1 // the band's normal
    const len = Math.hypot(nx, ny)
    const dist = ((x - x0) * nx + y * ny) / len
    const w = clamp(L.horizon * 0.2, 9, 24)
    const core = Math.exp(-((dist / w) ** 2))
    if (core < 0.03) return 0
    // star clouds: fBm with its contrast pulled up, so the band comes in clumps
    const lumps = clamp((fbm2(x / 14, y / 10, this.seed + 3) - 0.38) * 2.6, 0, 1)
    if (lumps === 0) return 0
    const lane = Math.exp(-(((dist - w * 0.15) / (w * 0.22)) ** 2))
    const rift = lane < 0.02 ? 0 : lane * clamp((fbm2(x / 7, y / 7, this.seed + 9) - 0.3) * 2, 0, 1)
    return clamp(core * lumps - rift * 0.8, 0, 1)
  }

  /**
   * The layers that never move at a size and a light (how bright the moon is,
   * in five steps): the sky's dust and stars, the far range and shore, the
   * bridge and lantern, the willow's shape; and, laid over the koi, the pads
   * and the near bank. Found once, not once a tick (lab: a hash a dot is slow
   * in the hooks runtime).
   */
  private stillAt(cols: number, rows: number, light: number): NonNullable<Pond['still']> {
    const L = this.layout(cols, rows)
    const key = `${cols}x${rows}:${Math.round(light * 4)}`
    if (this.still?.key === key) return this.still
    const dk = new Dots(cols, rows)
    const dark = 1 - 0.75 * Math.round(light * 4) / 4 // a bright moon washes the faint sky out
    const moonClear = L.r * (L.isWindow ? 1.45 : 1) + 5

    // the far range and the shore, as their tops
    const shore = new Int16Array(L.W)
    const ridge = new Int16Array(L.W)
    for (let x = 0; x < L.W; x++) { shore[x] = this.shoreTop(L, x); ridge[x] = L.ridge ? this.ridgeTop(L, x) : L.horizon }

    // the Milky Way's dust, and the stars, denser in it
    const stars: Star[] = []
    const dustRow = new Float32Array((L.W >> 1) + 1) // the dust is smooth: sampled once a 2 x 2 block of dots
    for (let y = 0; y < L.horizon - 3; y++) {
      const high = 1 - 0.55 * (y / L.horizon) ** 2 // fewer near the horizon, through more air
      if (L.milky && (y & 1) === 0) for (let bx = 0; bx < dustRow.length; bx++) dustRow[bx] = this.dust(L, bx * 2, y)
      for (let x = 0; x < L.W; x++) {
        if (y >= ridge[x]! - 1 || y >= shore[x]! - 1) continue
        if ((x - L.moonX) ** 2 + ((y - L.moonY) * ASPECT) ** 2 < moonClear * moonClear) continue
        const wx = L.W - x
        const mw = L.milky ? dustRow[x >> 1]! * dark : 0
        // dust as a sparse stipple (a still layer: it never boils), denser in the clouds
        if (mw > 0 && hash(x, y, this.seed + 77) < mw * 0.2) dk.set(x, y, P.milky)
        const density = L.isWindow ? 0.011 * high * (0.6 + 0.4 * dark) + 0.035 * mw : 0.011
        if (hash(wx, y, this.seed) > density) continue
        stars.push({ x, y, wx, phase: hash(wx, y, 5) * 80, bright: hash(wx, y, 6) < (mw > 0.2 ? 0.02 : 0.06) })
      }
    }

    // the far range: a broken contour and a little dither under it, where the shore doesn't hide it
    if (L.ridge) {
      for (let x = 0; x < L.W; x++) {
        const top = ridge[x]!, wx = L.W - x
        if (top < shore[x]! - 1 && hash(wx, 15) > 0.18) dk.set(x, top, P.ridge)
        for (let y = top + 1; y < shore[x]! - 1; y++) if (bayer(x, y) < 0.13 * (1 - (y - top) / 9)) dk.set(x, y, P.ridge)
      }
    }

    // the shore: a dotted contour of low hills and a few pines, very faint
    for (let x = 0; x < L.W; x++) {
      const wx = L.W - x, top = shore[x]!
      dk.set(x, top, P.hill)
      for (let y = top + 1; y < L.horizon; y++) {
        const p = L.isWindow && y < top + 3 ? 0.2 : 0.07
        if (hash(wx, y, 12) < p) dk.set(x, y, P.hill)
      }
    }

    // the drum bridge: a high arch, its rail and posts; the water below draws the rest of the circle
    if (L.bridge >= 0) {
      const R = L.bridgeR, h = R * 0.62
      for (let x = -R - 2; x <= R + 2; x++) {
        const u = Math.max(-1, Math.min(1, x / R))
        const deck = L.horizon - 1 - Math.round(h * Math.sqrt(1 - u * u))
        for (let y = deck; y < L.horizon; y++) dk.set(L.bridge + x, y, 0) // the hills don't show through
        dk.set(L.bridge + x, deck, P.bridge)
        if (Math.abs(x) <= R - 1) {
          dk.set(L.bridge + x, deck - 3, P.bridge)
          if ((x + R) % 4 === 0) for (let y = deck - 2; y < deck; y++) dk.set(L.bridge + x, y, P.bridge)
        }
      }
    }

    // the lantern on the shore, the hill behind it hidden
    const lamp: number[] = []
    if (L.lantern >= 0) {
      const w = LANTERN[0]!.length, h = LANTERN.length
      const lx = L.lantern - Math.floor(w / 2), ly = Math.min(shore[L.lantern]!, L.horizon - 1) - h + 2
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dk.set(lx + x, ly + y, 0)
      dk.stamp(LANTERN, lx, ly, { s: P.stone, L: P.lamp })
      LANTERN.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'L' && lx + x >= 0 && lx + x < L.W && ly + y >= 0) lamp.push((ly + y) * L.W + lx + x) }))
    }
    // the willow: two branches arching in from the top left under a thinning crown of leaves; its fronds hang from them
    const fronds: Frond[] = []
    if (L.willow > 0) {
      const span = L.willow
      const droop = Math.min(14, L.horizon * 0.16)
      for (let x = -2; x < span + 6; x++) {
        const u = x / span
        const b1 = Math.round(droop * u * u), b2 = Math.round(2 + droop * 1.4 * u * u)
        dk.set(x, b1, P.willow)
        if (x < span * 0.6) dk.set(x, b2, P.willow)
        const crown = 5 * (1 - u * 0.7)
        for (let y = 0; y < b1 + crown; y++) if (hash(x, y, this.seed + 79) < 0.3 * (1 - Math.max(0, y - b1) / crown)) dk.set(x, y, P.willow)
      }
      const n = Math.round(span / 2.7)
      for (let i = 0; i < n; i++) {
        const u = clamp((i + 0.5 + (hash(i, this.seed, 71) - 0.5) * 0.8) / n, 0, 1)
        const ax = Math.round(u * span - 3)
        const ay = Math.round(2 + droop * u * u + hash(i, 72) * 3)
        const room = L.horizon - 10 - ay
        const len = Math.max(4, Math.round(room * (0.3 + 0.65 * hash(i, this.seed, 73)) * (1 - 0.4 * u)))
        fronds.push({ ax, ay, len, curl: (hash(i, 74) - 0.5) * 3, lit: Math.abs(ax - L.moonX) < L.r * 3.2 + 8 })
      }
    }
    const bg = dk.dot.slice()

    // over the koi: the pads in their colonies, and the near bank's stones
    const fgDots = new Dots(cols, rows)
    const pads = L.isWindow ? this.padsOf(L) : []
    for (const pad of pads) this.drawPad(fgDots, pad, (pad.cy - L.horizon) / (L.H - L.horizon) < 0.3 ? P.padFar : P.pad)
    if (L.bank) {
      for (let x = Math.floor(hash(this.seed, 51) * 6); x < L.reeds - 4;) {
        const rx = 4 + Math.floor(hash(x, this.seed, 52) * 8)
        const ry = 2.5 + hash(x, 53) * 2.5
        const cx = x + rx, cy = L.H - 1 + Math.round(ry * 0.3)
        for (let yy = -Math.ceil(ry); yy <= 0; yy++) {
          for (let xx = -rx; xx <= rx; xx++) {
            const q = (xx / rx) ** 2 + (yy / ry) ** 2
            if (q > 1.05) continue
            // an outline and a speckled face
            if (q > 0.6 || hash(cx + xx, cy + yy, 55) < 0.16) fgDots.set(cx + xx, cy + yy, P.bank)
          }
        }
        x += rx * 2 + 2 + Math.floor(hash(x, 54) * 6)
      }
    }
    let n = 0
    for (let i = 0; i < fgDots.dot.length; i++) if (fgDots.dot[i] !== 0) n++
    const fg = new Int32Array(n), fgInk = new Uint8Array(n)
    n = 0
    for (let i = 0; i < fgDots.dot.length; i++) if (fgDots.dot[i] !== 0) { fg[n] = i; fgInk[n++] = fgDots.dot[i]! }

    this.still = { key, bg, fg, fgInk, stars, starSlot: new Int32Array(stars.length).fill(-1), starInk: new Uint8Array(stars.length), fronds, pads, lamp }
    return this.still
  }

  /**
   * The window's lily pads: colonies placed by hash and kept apart (a little
   * Poisson-disk sampling), each pad as big as it is near, a few in flower or
   * in bud, and frogs on the biggest (beside the lotus, on one in flower).
   * The band's one pad, with its lotus, is always among them, near.
   */
  private padsOf(L: Layout): Pad[] {
    const water = L.H - L.horizon
    const bottom = L.H - (L.bank ? 7 : 3)
    const nearOf = (y: number) => (y - L.horizon) / water
    const sizeAt = (y: number) => Math.round(2.5 + 7.5 * Math.pow(Math.max(0, nearOf(y)), 0.9))
    const pads: Pad[] = [{ cx: Math.round(L.W * 0.5), cy: bottom, rx: Math.max(5, sizeAt(bottom) - 1), bloom: 1, frog: -1 }]
    const fits = (x: number, y: number, rx: number) => pads.every(p => Math.abs(p.cx - x) > p.rx + rx + 3 || Math.abs(p.cy - y) > (p.rx + rx) * 0.3 + 3)
    const koiStrip = (x: number, y: number, rx: number) => y > L.surface - 7 && y < L.deep + 7 && x + rx > L.xMin - 18 && x - rx < L.xMax + 18
    // colony centres away from the koi's strip; darts thrown about them until the pond holds enough
    const colonies: [number, number][] = []
    for (let a = 0; a < 40 && colonies.length < clamp(Math.round((L.W * water) / 6000), 1, 6); a++) {
      const ccx = Math.round((0.06 + 0.86 * hash(a, this.seed, 91)) * L.reeds)
      const ccy = Math.round(L.horizon + 4 + hash(a, this.seed, 92) * (bottom - L.horizon - 4))
      if (!koiStrip(ccx, ccy, 4)) colonies.push([ccx, ccy])
    }
    const want = clamp(Math.round((L.W * water) / 2200), 2, 16)
    for (let a = 0; a < 200 && pads.length < want && colonies.length > 0; a++) {
      const [ccx, ccy] = colonies[a % colonies.length]!
      const spread = nearOf(ccy)
      const x = ccx + Math.round((hash(a, this.seed, 94) - 0.5) * (16 + 40 * spread))
      const y = clamp(ccy + Math.round((hash(a, this.seed, 95) - 0.5) * (6 + 16 * spread)), L.horizon + 3, bottom)
      const rx = Math.max(2, sizeAt(y) - Math.floor(hash(a, 96) * 3))
      if (x - rx < 2 || x + rx > L.reeds - 4 || !fits(x, y, rx) || koiStrip(x, y, rx)) continue
      const b = hash(a, this.seed, 97)
      pads.push({ cx: x, cy: y, rx, bloom: rx >= 4 && b < 0.2 ? 1 : rx >= 3 && b < 0.36 ? 2 : 0, frog: -1 })
    }
    // frogs: one in a small window, up to three in a wide one, on the biggest pads not in bud
    const frogs = water < 20 ? 0 : clamp(1 + Math.floor((L.W * water) / 18000), 1, 3)
    const seats = pads.filter(p => p.rx >= 5 && p.bloom !== 2).sort((a, b) => b.rx - a.rx || a.cx - b.cx)
    for (let k = 0; k < Math.min(frogs, seats.length); k++) seats[k]!.frog = k
    return pads
  }

  private drawPad(d: DotsT, pad: Pad, inkPad: number, bob = 0): void {
    const { cx, rx } = pad
    const cy = pad.cy + bob
    const ry = Math.max(1, rx * 0.3)
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x / rx) ** 2 + (y / (ry + 0.4)) ** 2 > 1) continue
        if (y >= 0 && Math.abs(x - 1) <= y * 0.9) continue // the notch, toward you
        d.set(cx + x, cy + y, inkPad)
      }
    }
    if (pad.bloom === 1) {
      const lx = cx - Math.round(rx * 0.45), ly = cy - 4
      d.stamp(['.p.p.', 'p.p.p', '.ppp.', '..p..'], lx - 2, ly, { p: P.lotus })
    } else if (pad.bloom === 2) {
      const lx = cx + Math.round(rx * 0.4), ly = cy - 3
      d.stamp(['.b', 'bb', '.b'], lx, ly, { b: P.bud })
    }
  }

  /** The glints on the water: the moon's glitter path, the lantern's streak, the bridge's reflection; found once a size and phase. */
  private glintsAt(L: Layout, phase: number): Glints {
    const key = `${L.W}x${L.H}:${Math.round(phase * 720)}`
    if (this.glints?.key === key) return this.glints
    const xs: number[] = [], ys: number[] = [], lens: number[] = [], periods: number[] = [], offs: number[] = [], ps: number[] = [], inks: number[] = []
    const add = (x: number, y: number, len: number, p: number, inkG: number) => {
      const i = xs.length
      xs.push(x); ys.push(y); lens.push(len); ps.push(p); inks.push(inkG)
      periods.push(20 + Math.floor(hash(x, y, 32) * 44))
      offs.push(Math.floor(hash(x, y, 33) * 64) + (i % 3))
    }
    const water = L.H - L.horizon
    const lit = (1 - Math.cos(2 * Math.PI * phase)) / 2
    if (lit > 0.03) {
      // under the lit part of the moon: its middle shifts toward the lit limb
      const cx = L.moonX + (phase < 0.5 ? 1 : -1) * L.r * (1 - lit) * 0.5
      for (let y = L.horizon + 1; y < L.H; y += 2) {
        const near = (y - L.horizon) / water
        const half = (L.r * 0.8 + near * L.r * 2.2) * (0.35 + 0.65 * lit)
        for (let x = Math.round(cx - half); x <= Math.round(cx + half);) {
          const len = 2 + Math.floor(hash(x, y, 31) * 3)
          const dist = Math.abs(x + len / 2 - cx) / Math.max(1, half)
          const p = (0.3 + 0.5 * lit) * (1 - dist * dist) * (1 - near * 0.25)
          if (p > 0.04) add(x, y, len, p, near < 0.3 && dist < 0.5 ? P.refl : P.reflDim)
          x += len + 1
        }
      }
    }
    if (L.lantern >= 0) {
      for (let k = 0; k < 6; k++) {
        const y = L.horizon + 1 + k * 2
        add(L.lantern - 1 + Math.round((hash(k, 61) - 0.5) * 2), y, 2 + (k > 2 ? 1 : 0), 0.65 - k * 0.07, P.lampRefl)
      }
    }
    if (L.bridge >= 0) {
      const R = L.bridgeR, h = R * 0.62
      for (let x = -R + 1; x <= R - 1; x += 2) {
        const u = x / R
        add(L.bridge + x, L.horizon + 1 + Math.round(h * Math.sqrt(1 - u * u)), 2, 0.8, P.bridgeRefl)
      }
    }
    const n = xs.length
    this.glints = {
      key, x: Int16Array.from(xs), y: Int16Array.from(ys), len: Uint8Array.from(lens), period: Uint8Array.from(periods), off: Uint8Array.from(offs),
      p: Float32Array.from(ps), ink: Uint8Array.from(inks), slot: new Int32Array(n).fill(-1), on: new Uint8Array(n),
    }
    return this.glints
  }

  // ---------------------------------------------------------------- drawing

  private draw(input: SceneInput): void {
    const d = this.d
    const L = this.layout(input.cols, input.rows)
    const t = input.tick
    const isBusy = input.mood === 'busy'
    const phase = moonPhase(input.now)
    const light = (1 - Math.cos(2 * Math.PI * phase)) / 2
    const still = this.stillAt(input.cols, input.rows, light)
    d.dot.set(still.bg)
    d.glyph.fill(0)
    d.glyphInk.fill(0)
    // the lantern's flame gutters low now and then (its color only: no dot moves)
    if (noise1(t / 6, this.seed + 5) > 0.8) for (const i of still.lamp) d.dot[i] = P.lampLow

    // stars: fixed to the right edge, so a wider terminal shows more sky on the
    // left; each twinkles on its own slow clock, and a bright one now and then glints
    for (let i = 0; i < still.stars.length; i++) {
      const star = still.stars[i]!
      const slow = Math.floor((t + star.phase) / 80)
      if (still.starSlot[i] !== slow) {
        still.starSlot[i] = slow
        still.starInk[i] = star.bright ? P.starBright : hash(star.wx, star.y, slow) > 0.75 ? P.star : P.starDim
      }
      d.set(star.x, star.y, still.starInk[i]!)
      if (star.bright && (t + Math.floor(star.phase * 7)) % (240 + Math.floor(star.phase * 4)) < 2) {
        d.set(star.x - 1, star.y, P.starDim); d.set(star.x + 1, star.y, P.starDim)
        d.set(star.x, star.y - 1, P.starDim); d.set(star.x, star.y + 1, P.starDim)
      }
    }

    // tonight's moon
    const detail = L.r >= 8
    const moonKey = `${L.r}:${Math.round(phase * 720)}:${detail}`
    if (this.moonAt?.key !== moonKey) this.moonAt = { key: moonKey, dots: pondMoon(L.r, phase, detail) }
    const md = this.moonAt.dots
    for (let k = 0; k < md.length; k += 3) d.set(L.moonX + md[k]!, L.moonY + md[k + 1]!, md[k + 2]!)

    if (L.willow > 0) this.drawWillow(L, t, isBusy, still.fronds)
    if (L.milky) this.drawGeese(L, t)

    // The water steps on even ticks, the koi on odd ones (but in a hurry), so their changes never pile up on one tick.
    const even = t - (t & 1)

    // ripples: short streaks on every other row, drifting slowly, nearer ones faster
    const waterRows = L.H - L.horizon
    for (let y = L.horizon + 2; y < L.H; y += 2) {
      const near = (y - L.horizon) / waterRows
      const drift = Math.floor(even * (0.02 + 0.06 * near))
      const S = Math.round(10 + 10 * near)
      const inkW = near > 0.5 ? P.waterNear : P.water
      // u = W - x + drift runs right to left; each S-dot slot may hold one streak
      for (let s = Math.floor(drift / S); s * S <= L.W + drift; s++) {
        if (hash(s, y, 1) > 0.18 + 0.25 * near) continue
        const len = 2 + Math.floor(hash(s, y, 2) * (2 + 5 * near))
        const off = Math.floor(hash(s, y, 3) * (S - len))
        if (hash(s, y, Math.floor((even + hash(s, y, 4) * 60) / 60)) > 0.8) continue
        for (let m = off; m < off + len; m++) {
          const x = L.W - (s * S + m) + drift
          if (x >= 0 && x < L.W) d.set(x, y, inkW)
        }
      }
    }

    // glints: the moon's glitter path and the others, each streak on its own clock
    const G = this.glintsAt(L, phase)
    for (let i = 0; i < G.x.length; i++) {
      const slot = Math.floor((even + G.off[i]!) / G.period[i]!)
      if (G.slot[i] !== slot) { G.slot[i] = slot; G.on[i] = hash(i, slot, 34) < G.p[i]! ? 1 : 0 }
      if (G.on[i] === 0) continue
      for (let m = 0; m < G.len[i]!; m++) d.set(G.x[i]! + m, G.y[i]!, G.ink[i]!)
    }

    // rings on the water
    for (const ring of this.rings) {
      if (ring.age < 1) continue
      const rx = ring.age * 1.3, ry = Math.max(0.6, rx * 0.28)
      const n = ring.thin === true ? Math.max(5, Math.round(rx * 2.6)) : Math.max(6, Math.round(rx * 4))
      const inkR = ring.age > ring.max * 0.6 ? P.ringDim : P.ring
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 2 * Math.PI
        // a raindrop's ring, flat on the far water, shows as its two ends spreading: ( )
        if (ring.thin === true && Math.abs(Math.cos(a)) < 0.6) continue
        d.set(ring.x + Math.cos(a) * rx, ring.y + Math.sin(a) * ry, inkR)
      }
    }

    // the koi, under the pads and reeds
    this.drawKoi(L, t, input.mood === 'busy' || (t & 1) === 1)

    // air bubbles rising from it
    for (const b of this.air) {
      const x = Math.round(b.x), y = Math.round(b.y)
      if (b.size === 1) d.set(x, y, P.air)
      else if (b.size === 2) { d.set(x, y, P.air); d.set(x + 1, y, P.air); d.set(x, y + 1, P.air); d.set(x + 1, y + 1, P.air) }
      else for (const [dx, dy] of [[0, -1], [1, -1], [-1, 0], [2, 0], [-1, 1], [2, 1], [0, 2], [1, 2]] as const) d.set(x + dx, y + dy, P.air)
    }

    // leaves: tumbling as they fall, lying flat once they float
    for (const leaf of this.leaves) {
      const x = Math.round(leaf.x), y = Math.round(leaf.y)
      if (leaf.floating >= 0) { d.set(x, y, P.leaf); d.set(x + 1, y, P.leaf); d.set(x + 2, y - 1, P.leaf) }
      else if (Math.floor((t + leaf.phase) / 5) % 2 === 0) { d.set(x, y, P.leaf); d.set(x + 1, y + 1, P.leaf) }
      else { d.set(x + 1, y, P.leaf); d.set(x, y + 1, P.leaf) }
    }

    // over the koi: the window's pads and bank, the band's pads, the frogs
    for (let k = 0; k < still.fg.length; k++) d.dot[still.fg[k]!] = still.fgInk[k]!
    if (L.isWindow) {
      for (const pad of still.pads) if (pad.frog >= 0) this.drawFrog(pad, t, input.mood)
    } else this.drawPads(L, t)
    this.drawReeds(L, t, isBusy)

    // rain streaks
    for (const dr of this.drops) {
      d.set(dr.x, dr.y, P.rain)
      d.set(dr.x, dr.y - 1, P.rain)
    }
    for (const s of this.spray) d.set(s.x, s.y, P.spray)

    // fireflies: a slow glow, on a while, then out; low over the water, their light in it too
    for (const f of this.flies) {
      if (f.glow < 0) continue
      const c = f.glow === 0 || f.glow === 6 ? P.fireflyDim : P.firefly
      d.set(f.x, f.y, c)
      const below = 2 * L.horizon - Math.round(f.y) + 1
      if (L.isWindow && f.y < L.horizon && below < L.H && below - L.horizon < 12 && c === P.firefly) d.set(f.x, below, P.fireflyDim)
    }

    // the bubble, in the sky by its head
    if (input.bubble !== undefined) {
      const head = this.mouth()
      const top = this.leapAt >= 0 ? 0 : Math.round(this.y - 4)
      const c0 = Math.floor((Math.min(this.x - 13, head) ) / 2), c1 = Math.ceil((Math.max(this.x + 13, head)) / 2)
      drawBubble(d, input.bubble, { c: Math.floor(head / 2), r: Math.max(0, Math.floor(top / 4)) }, { c0: c0 - 1, r0: Math.max(0, Math.floor(top / 4)), c1: c1 + 1, r1: input.rows }, P.border, P.words, P.border, input.asciiBorders === true)
    }
  }

  private drawKoi(L: Layout, t: number, mayStep: boolean): void {
    const d = this.d
    // brighter the nearer the surface
    const depth = (this.y - L.surface) / Math.max(1, L.deep - L.surface)
    const tier = this.leapAt >= 0 || depth < 0.3 ? 2 : depth < 0.7 ? 1 : 0
    const map: Record<string, number> = [
      { W: P.whiteD, R: P.redD, F: P.finD },
      { W: P.whiteM, R: P.redM, F: P.finM },
      { W: P.whiteS, R: P.redS, F: P.finS },
    ][tier]!
    const flip = this.heading > 0

    if (this.leapAt >= 0) {
      // the arc: up out of the water, over, and back in, nose leading
      const k = t - this.leapAt
      const u = Math.max(0, Math.min(1, (k - 4) / 12))
      const lift = k < 4 ? 0 : Math.sin(u * Math.PI)
      const x = this.leapFrom + this.heading * (k < 4 ? k * 0.8 : 3.2 + u * 22)
      this.x = x
      const y = (k < 4 ? L.surface - k * 0.8 : L.surface - 3.2) - lift * Math.max(0, L.surface - 3.2 - Math.max(4.5, L.surface - 52))
      this.y = y
      const tilt = k < 4 ? 2 : Math.round((1 - 2 * u) * 3) // in steps of 10 degrees, nose up, level at the top, nose down
      const art = SWIM[Math.floor(k / 2) % 4]!
      for (const [dx, dy, ch] of rotate(art, tilt)) {
        const ink = map[ch]
        if (ink === undefined) { if (ch === ',') d.set(x + (flip ? -dx : dx), y + dy, 0); continue }
        d.set(x + (flip ? -dx : dx), y + dy, ink)
      }
      return
    }

    // Drawn one change a tick (each moves every dot it covers): a step in depth
    // travels down it as a bend, head, middle, tail; then a step along; and the
    // tail beats only while it holds still.
    const wantX = Math.round(this.x), wantY = Math.round(this.y), wantTail = Math.floor(this.tail) % 4
    const s = this.shown
    if (this.turn >= 0 || Number.isNaN(s[0]) || Math.abs(wantX - s[0]) > 3 || Math.abs(wantY - s[1]) > 2) this.shown = [wantX, wantY, wantY, wantY, wantTail]
    else if (!mayStep) { /* holds this tick */ }
    else if (s[2] !== s[1]) s[2] = s[1]
    else if (s[3] !== s[2]) s[3] = s[2]
    else if (wantY !== s[1]) s[1] = wantY
    else if (wantX !== s[0]) s[0] = wantX
    else s[4] = wantTail
    const [kx, yHead, yMid, yTail, kt] = this.shown
    const ahead = (x: number) => (flip ? x - kx : kx - x) // toward the head
    const headSide = (x: number) => ahead(x) > 0
    const bodySide = (x: number) => ahead(x) <= 0

    // Turning: side, three-quarter, head-on, three-quarter the other way, side. The
    // head leads each change between side and three-quarter by a tick, as a fish turns.
    const swim = SWIM[kt]!
    if (this.turn === 0 || this.turn === 5) {
      // heading still the old way at 0 (the head is ahead of x), the new way at 5
      const into = this.turn === 0
      this.stampKoi(into ? THREE_Q : swim, kx, flip, yHead - 4, map, headSide)
      this.stampKoi(into ? swim : THREE_Q, kx, flip, yHead - 4, map, bodySide)
      return
    }
    const art = this.turn < 0 ? swim : this.turn === 2 ? FRONT : THREE_Q
    if (yHead === yMid && yMid === yTail) this.stampKoi(art, kx, flip, yHead - 4, map)
    else {
      this.stampKoi(art, kx, flip, yHead - 4, map, x => ahead(x) >= 4)
      this.stampKoi(art, kx, flip, yMid - 4, map, x => ahead(x) < 4 && ahead(x) > -5)
      this.stampKoi(art, kx, flip, yTail - 4, map, x => ahead(x) <= -5)
    }
  }

  /** One of the koi's poses where it sits about `kx` (only the dots `keep` keeps): side on, three-quarter or head-on. */
  private stampKoi(art: readonly string[], kx: number, flip: boolean, top: number, map: Readonly<Record<string, number>>, keep?: (x: number) => boolean): void {
    const w = art[0]!.length
    const left = art === FRONT ? kx - 4 : art === THREE_Q ? kx - (flip ? 9 : 8) : kx - (flip ? w - 12 : 12)
    if (keep === undefined) { this.d.stamp(art, left, top, map, flip); return }
    for (let y = 0; y < art.length; y++) {
      const row = art[y]!
      for (let x = 0; x < w; x++) {
        if (!keep(left + x)) continue
        const ch = row[flip ? w - 1 - x : x]!
        if (ch === ',') this.d.set(left + x, top + y, 0)
        else if (map[ch] !== undefined) this.d.set(left + x, top + y, map[ch]!)
      }
    }
  }

  /** The band's pad, and a far one or two in a wide band; a pad bobs a dot when the koi passes right under it. */
  private drawPads(L: Layout, t: number): void {
    const pads: [number, number, number, boolean][] = [[Math.round(L.W * 0.5), L.H - 3, 7, true]]
    if (L.W >= 150) pads.push([Math.round(L.W * 0.36), L.horizon + 4, 4, false])
    if (L.W >= 220) pads.push([Math.round(L.W * 0.63), L.horizon + 6, 5, false])
    for (const [cx, cy, rx, hasLotus] of pads) {
      const bob = Math.abs(this.x - cx) < 6 && this.y > cy - 6 && t % 6 < 2 ? 1 : 0
      this.drawPad(this.d, { cx, cy, rx, bloom: hasLotus ? 1 : 0, frog: -1 }, P.pad, bob)
    }
  }

  /** A frog on its pad: it blinks now and then, and croaks, its throat puffing twice; more in the rain. */
  private drawFrog(pad: Pad, t: number, mood: Mood): void {
    const d = this.d
    // beside the lotus on a pad in flower, else in the middle
    const left = 2 * Math.floor((pad.cx + (pad.bloom === 1 ? 1 : -2)) / 2)
    const eyes = 4 * Math.floor((pad.cy - 3) / 4) - 1 // eyes in the bottom dot row of a cell, the body in the cells under
    const k = pad.frog
    const blink = (t + k * 37) % (97 + k * 23) === 0
    const every = mood === 'busy' ? 50 + k * 9 : 200 + k * 61
    const c = (t + k * 71 + 13) % every
    const croak = (mood === 'idle' || mood === 'busy') && (c < 2 || (c >= 3 && c < 5))
    if (!blink) d.stamp([FROG_EYES], left, eyes, { E: P.frogEye })
    d.stamp(croak ? FROG_CROAK : FROG, left, eyes + 1, { F: P.frog, T: P.throat })
  }

  /**
   * A rare crossing in a tall sky: every four minutes or so a skein of five to
   * seven wild geese flies right to left in a V, wings beating each on its
   * own time; half the time low enough to cross the moon, where each goose is
   * a gap cut out of its light (geese across the autumn moon, as in the prints).
   */
  private drawGeese(L: Layout, t: number): void {
    const d = this.d
    const every = 960
    const k = Math.floor(t / every)
    const age = t - (k * every + Math.floor(hash(k, this.seed, 101) * 240))
    if (age < 0) return
    const lead = L.W + 8 - age * 0.3
    const n = 5 + Math.floor(hash(k, this.seed, 102) * 3)
    if (lead + n * 4 < -4) return
    const high = hash(k, this.seed, 103) < 0.5 ? L.moonY - L.r * 0.8 + hash(k, 104) * L.r * 1.4 : 4 + hash(k, 104) * L.horizon * 0.3
    for (let i = 0; i < n; i++) {
      const rank = Math.ceil(i / 2), side = i === 0 ? 0 : i % 2 === 1 ? -1 : 1
      const x = Math.round(lead + rank * 6 + hash(k, i, 105) * 1.5), y = Math.round(high + side * rank * 2.4)
      const up = ((t + i * 3) >> 2) % 2 === 0
      for (const [dx, dy] of up ? ([[-1, -1], [0, 0], [1, -1]] as const) : ([[-1, 0], [0, 0], [1, 0]] as const)) {
        const under = d.get(x + dx, y + dy)
        d.set(x + dx, y + dy, under === P.moon || under === P.maria ? 0 : P.goose)
      }
    }
  }

  /** Fronds of the weeping willow, leafy strings that sway as the breeze passes through them, and lean with the wind. */
  private drawWillow(L: Layout, t: number, isBusy: boolean, fronds: Frond[]): void {
    const d = this.d
    const A = isBusy ? 3.5 : 1.8
    const lean = isBusy ? 2.5 : 0
    for (const f of fronds) {
      const g = isBusy ? 0.5 + 0.5 * this.gust(t * 2, f.ax) : this.gust(t, f.ax)
      const inkF = f.lit ? P.willowLit : P.willow
      for (let s = 0; s <= f.len; s++) {
        // a chain of small leaves, zigzag, with a gap here and there, thinning to its tip
        if ((s * 7 + f.ax * 3) % 11 === 0) continue
        const u = s / f.len
        if (u > 0.8 && s % 2 === 1) continue
        const x = f.ax + f.curl * u + (lean + A * g) * u * u + ((s >> 1) & 1)
        d.set(x, f.ay + s, inkF)
      }
    }
  }

  private drawReeds(L: Layout, t: number, isBusy: boolean): void {
    const d = this.d
    const span = L.W - L.reeds
    const n = Math.max(4, Math.round(span / (L.isWindow ? 3 : 2.2)))
    const gust = isBusy ? 0.8 + 1.4 * noise1(t / 22, 9) : 0.35 * Math.sin(t / 40)
    for (let i = 0; i < n; i++) {
      const base = L.reeds + Math.round((i + 0.5) * (span / n))
      // in a window they stand up out of the near water, some past the horizon, some low, leaning apart
      const tall = hash(i, 65)
      const height = L.isWindow
        ? Math.round((L.H - L.horizon) * (tall < 0.3 ? 0.45 + tall : 1) + (tall < 0.3 ? 0 : 4 + hash(i, 61) * Math.min(26, L.horizon * 0.3)))
        : Math.round((L.H - 2) * (0.62 + 0.38 * hash(i, 61)))
      const topY = L.H - height
      const splay = L.isWindow ? Math.sqrt(height / 24) * 1.6 : 1
      const lean = (hash(i, 62) - 0.6) * 3 * splay - gust * (0.6 + 0.4 * hash(i, 63)) * splay
      for (let y = L.H - 1; y >= topY; y--) {
        const u = (L.H - 1 - y) / height
        d.set(base + lean * u * u, y, P.reed)
      }
      // a blade leaning out from a few of them
      if (hash(i, 64) < (L.isWindow ? 0.7 : 0.5)) {
        const by = L.H - Math.round(height * 0.35)
        const blade = Math.min(height * 0.45, 16)
        for (let k = 1; k < Math.round(blade); k++) {
          const u = k / blade
          d.set(base - k * 0.55 - gust * u * u * 1.5, by - k * 0.9 + u * u * 2.5, P.reed)
        }
      }
      // two cattails, more in a wide clump
      if (i === 1 || i === n - 2 || (n > 10 && i % 5 === 3)) {
        const cxx = base + lean * 0.8
        for (let y = topY + 2; y < topY + 6; y++) { d.set(cxx, y, P.cattail); if (y > topY + 2 && y < topY + 5) d.set(cxx + 1, y, P.cattail) }
        d.set(cxx + lean * 0.1, topY, P.reed)
        d.set(cxx + lean * 0.1, topY + 1, P.reed)
      }
    }
  }
}

export const pond: SceneDef = {
  id: 'koi-pond',
  name: 'Koi Pond',
  persona: 'a kohaku koi living in a small moonlit pond at the bottom of the terminal',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 5,
  create: seed => new Pond(seed),
}
