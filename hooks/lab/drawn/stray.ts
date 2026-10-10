// Stray: an alley cat that lives in a hole in a brick wall, by the prompt.
//
// The band is the foot of an alley wall: two courses of brick, the corner
// of a dumpster at its left end, and a hole knocked through the bricks at
// its right end, where two eyes shine now and then. After a quiet while the
// cat slips out, walks into the open, sits a spell, looks back toward home
// and goes in again. When a line lands it lies in its doorway, head and paws
// out, and meows toward the bubble. When Claude starts working it bolts off
// behind the dumpster and turns up on the spinner line, running after the
// spinner's word for as long as the turn lasts.
//
// In the pet window it draws the whole alley at night: the wall with its
// hole, a dumpster, a street lamp pooling light on the wet ground, a fire
// escape, and tonight's real moon over the low roof. The same story plays
// there with a cat two and a half times the size: eyes in the dark, a tabby
// that walks out into the lamplight, sits, turns to face the person, and goes
// home; a moth at the lamp; and a rat under the dumpster that comes out while
// the cat is away (and, with the cat at home, thinks better of it).
//
// Every picture is a pure function of the moment. Idle runs on `since`, so
// after any turn or line the cat starts the quiet at home, in its hole. A
// big change of pose takes two or three ticks, a share of its dots each (an
// ordered-dither cross-fade), and a walking cat keeps two paws planted each
// step, so within a mood the window never moves the whole cat at once. (A
// change of mood can: the moment doesn't say where the last mood left it.)
import { addCell } from '../../runs'
import { topCell } from '../braille'
import { bayer, moonPhase } from '../util'
import { cellsOf, Dots, hash, runsOf } from './dots'
import type { Run, Style } from './dots'
import type { Drawing, ExperimentalPet, Moment } from './pet'

// ------------------------------------------------------------------ the story

/** One idle cycle, in ticks (64 s): home, a walk out, a sit, a walk back. */
const CYCLE = 256
/** Places on its path, from deep in the hole (0) to its spot outside (MOVES - 1); a move every other tick. */
const MOVES = 21
/** In a cycle it roams: it walks out from OUT, sits from SAT, turns to the person at FRONT_AT, back at BACK_AT, up at UP_AT, walks home from HOME and is in at IN. */
const OUT = 72
const SAT = OUT + MOVES * 2
const FRONT_AT = 150
const BACK_AT = 186
const UP_AT = 194
const HOME = 198
const IN = HOME + (MOVES - 1) * 2

type Eyes = 'open' | 'half'
/** How it sits: sitting down, side on (facing left), facing the person, side on facing home, standing to go. */
type Sit = 'down' | 'side' | 'front' | 'back' | 'up'
type Pose =
  | { kind: 'home'; eyes?: Eyes; isGlancing: boolean }
  | { kind: 'walk'; n: number; isHomeward: boolean }
  | { kind: 'sit'; sit: Sit; blink?: Eyes | 'shut'; isEar: boolean; isFlick: boolean; isUp: boolean }
  | { kind: 'turn'; from: Pose; to: Pose; f: number }
  | { kind: 'door'; isMeow: boolean; isUp: boolean; isEar: boolean; slide: number }
  | { kind: 'dash'; s: number }

/** Whether the cat goes out in idle cycle `cycle` of a quiet that began at tick `from`: the first time always, then three in five. */
const roams = (from: number, cycle: number): boolean => cycle === 0 || hash(from, cycle, 11) < 0.6

/** Its eyes in the dark of the hole at cycle tick `k`, when they show: a cat that roams shows them before and after its walk. */
function homeEyes(k: number, isRoaming: boolean): { eyes: Eyes; isGlancing: boolean } | undefined {
  const spans = isRoaming ? [[10, 40], [52, OUT], [IN + 2, CYCLE]] : [[10, 40], [52, 84], [110, 150], [168, 238]]
  if (!spans.some(([a, b]) => k >= a! && k < b!)) return undefined
  const blink = k === 22 || k === 60 || k === 124 || k === 186 || k === 212 || k === 250
  return { eyes: blink ? 'half' : 'open', isGlancing: (k >= 30 && k < 35) || (k >= 196 && k < 202) }
}

const sitting = (sit: Sit, k = 0): Pose => ({
  kind: 'sit',
  sit,
  ...(sit === 'front' && k >= 162 && k < 165 ? { blink: k === 163 ? ('shut' as const) : ('half' as const) } : {}),
  isEar: (sit === 'side' && (k === 140 || k === 141)) || (sit === 'back' && k === 190),
  isFlick: sit === 'side' && (k === 126 || k === 127 || k === 131),
  isUp: sit === 'front' && k >= 172 && k < 178,
})

/** The quiet: since-anchored, so it starts at home after any turn. */
function idlePose(since: number, tick: number): Pose {
  const cycle = Math.floor(since / CYCLE)
  const k = since % CYCLE
  const isRoaming = roams(tick - since, cycle)
  if (!isRoaming || k < OUT || k >= IN) {
    const eyes = homeEyes(k, isRoaming)
    return { kind: 'home', ...(eyes !== undefined ? { eyes: eyes.eyes } : {}), isGlancing: eyes?.isGlancing ?? false }
  }
  const out = (n: number): Pose => ({ kind: 'walk', n, isHomeward: false })
  const home = (n: number): Pose => ({ kind: 'walk', n, isHomeward: true })
  if (k < SAT) return out(Math.floor((k - OUT) / 2))
  if (k >= HOME) return home(MOVES - 2 - Math.floor((k - HOME) / 2))
  // Sitting, and every change of pose a turn of two ticks (three, turning to the person and away).
  const turn = (from: Pose, to: Pose, f = 0.5): Pose => ({ kind: 'turn', from, to, f })
  if (k === SAT) return turn(out(MOVES - 1), sitting('down'))
  if (k === SAT + 1) return sitting('down')
  if (k === SAT + 2) return turn(sitting('down'), sitting('side'))
  if (k < FRONT_AT) return sitting('side', k)
  if (k < FRONT_AT + 2) return turn(sitting('side'), sitting('front'), (k - FRONT_AT + 1) / 3)
  if (k < BACK_AT) return sitting('front', k)
  if (k < BACK_AT + 2) return turn(sitting('front'), sitting('back'), (k - BACK_AT + 1) / 3)
  if (k < UP_AT) return sitting('back', k)
  if (k === UP_AT) return turn(sitting('back'), sitting('up'))
  if (k === UP_AT + 1) return sitting('up')
  if (k === UP_AT + 2) return turn(sitting('up'), home(MOVES - 1))
  return home(MOVES - 1)
}

/** What the cat does at this moment, in band and window alike. */
function poseOf(m: Moment): Pose {
  if (m.mood === 'busy') return { kind: 'dash', s: m.since }
  // Thinking of a line it slides into its doorway and looks up; talking, it meows toward the bubble; after, it listens there.
  if (m.mood === 'ponder') return { kind: 'door', isMeow: false, isUp: m.since >= 3, isEar: m.since % 16 === 9 || m.since % 16 === 10, slide: Math.max(0, 8 - m.since * 4) }
  if (m.mood === 'talk') return { kind: 'door', isMeow: m.since % 4 < 2 && m.since < 12, isUp: false, isEar: false, slide: 0 }
  if (m.line !== undefined) return { kind: 'door', isMeow: false, isUp: false, isEar: m.line.age % 20 === 14, slide: 0 }
  return idlePose(m.since, m.tick)
}

/** A sprite: its art, where its left edge and top go, whether it faces right, which eye rows show. */
type Sprite = { art: readonly string[]; x: number; y: number; isFlipped: boolean; eyeRows?: readonly number[] }

/** The dots of `art` placed as `s` says: [x, y, isEye] for each. */
function dotsOf(s: Sprite): [number, number, boolean][] {
  const out: [number, number, boolean][] = []
  s.art.forEach((row, ay) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[s.isFlipped ? row.length - 1 - i : i]
      if (ch === undefined || ch === '.') continue
      if (ch === 'E' && s.eyeRows !== undefined && !s.eyeRows.includes(ay)) continue
      out.push([s.x + i, s.y + ay, ch === 'E'])
    }
  })
  return out
}

// ------------------------------------------------------------------ the band

const BAND_COLS = 22
const BAND_ROWS = 2
const BW = BAND_COLS * 2
const BH = BAND_ROWS * 4

const B_BRICK = 1
const B_EDGE = 2
const B_CAT = 3
const B_DUMP = 4
const B_EYES = 5
const BAND_PALETTE: Style[] = [{}, { color: 'inactive', dim: true }, { color: 'inactive' }, { color: 'text' }, { color: 'success', dim: true }, { color: 'warning', bold: true }]

/** The hole's span on each dot row of the band, [from, to]: two bricks knocked out of the lower course, one of the upper, a chip above. */
const B_HOLE: readonly (readonly [number, number] | undefined)[] = [undefined, [34, 37], [32, 39], [32, 39], [29, 42], [29, 42], [29, 42], [29, 42]]
const inBandHole = (x: number, y: number): boolean => {
  const span = B_HOLE[y]
  return span !== undefined && x >= span[0] && x <= span[1]
}
/** Where the tunnel starts on a row: the cat is out of sight from here right. */
const bandMouth = (y: number): number => B_HOLE[y]?.[0] ?? 33

/** The dumpster's right corner at the band's left end: lid, a rib, a fork pocket, a caster. */
const B_DUMPSTER = [
  '##########.',
  '.#.......#.',
  '.#...#...##',
  '.#...#...##',
  '.#...#...#.',
  '.#.......#.',
  '.#########.',
  '..#.....#..',
]
/** The dumpster's right edge: the cat passes behind it. */
const B_DUMP_EDGE = 10

/** The band's wall: two courses of brick right of the dumpster, joints staggered, thinning out leftward; the hole's rough rim. */
function bandWall(d: Dots): void {
  for (let x = 13; x < BW; x++) {
    const isNear = x >= 18
    for (let y = 0; y < BH; y++) {
      if (inBandHole(x, y)) continue
      // a course line between the two courses and the wall's foot, dotted where the wall fades into the dark
      const isMortar = (y === 3 || y === 7) && (isNear ? y === 3 || x % 2 === 0 : x % 2 === 1 && y === 3)
      const isJoint = isNear && (y < 3 ? x % 6 === 3 : y > 3 && y < 7 && x % 6 === 0)
      if (isMortar || isJoint) d.set(x, y, B_BRICK)
    }
  }
  for (let y = 0; y < BH; y++) {
    for (let x = 26; x < BW; x++) {
      if (inBandHole(x, y)) continue
      if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => inBandHole(x + dx!, y + dy!))) d.set(x, y, B_EDGE)
    }
  }
  d.stamp(B_DUMPSTER, 0, 0, { '#': B_DUMP })
}

// The cat at band size, eight dots tall, facing left; 'o' its eye, a hole in its head (or, in the dark, a shine).
const B_WALK = [
  [
    '.#..#..........#',
    '.####.........#.',
    '#o###.........#.',
    '.####........#..',
    '..##########.#..',
    '..###########...',
    '..#.#.....#.#...',
    '.#...#...#...#..',
  ],
  [
    '.#..#..........#',
    '.####.........#.',
    '#o###.........#.',
    '.####........#..',
    '..##########.#..',
    '..###########...',
    '...#.#...#.#....',
    '...#.#...#.#....',
  ],
]
const B_SIT = [
  '.#..#......',
  '.####......',
  '#o###......',
  '.####......',
  '..####.....',
  '..#####....',
  '..######...',
  '.##########',
]
/** Sitting with its eyes shut (a slow blink), with an ear turned, with its tail tip up. */
const B_SIT_BLINK = ['.#..#......', '.####......', '#####......', ...B_SIT.slice(3)]
const B_SIT_EAR = ['.#...#.....', '.####......', ...B_SIT.slice(2)]
const B_SIT_FLICK = [...B_SIT.slice(0, 6), '..######.#.', '.########..']
/** Lying in its doorway, head and paws out; meowing, its jaw drops; an ear turned. */
const B_LOAF = [
  '.#..#.......',
  '.####.......',
  '#o###.......',
  '.#####......',
  '..######....',
  '..########..',
  '.#########..',
  '##.#########',
]
const B_MEOW = ['.#..#.......', '.####.......', '#o###.......', '#..###......', '.#######....', ...B_LOAF.slice(5)]
const B_LOAF_EAR = ['.#...#......', ...B_LOAF.slice(1)]

function bandSprite(p: Pose): Sprite | undefined {
  const at = (art: readonly string[], x: number, isFlipped = false): Sprite => ({ art, x, y: 0, isFlipped })
  switch (p.kind) {
    case 'walk':
      return p.isHomeward ? at(B_WALK[p.n % 2]!, 12 + (MOVES - 1 - p.n), true) : at(B_WALK[p.n % 2]!, 33 - p.n)
    case 'sit':
      if (p.sit === 'back') return at(p.isEar ? B_SIT_EAR : B_SIT, 14, true)
      if (p.sit === 'up') return at(B_WALK[1]!, 12, true)
      return at(p.blink === 'shut' ? B_SIT_BLINK : p.isEar ? B_SIT_EAR : p.isFlick ? B_SIT_FLICK : B_SIT, 12)
    case 'door':
      return at(p.isMeow ? B_MEOW : p.isEar ? B_LOAF_EAR : B_LOAF, 21 + p.slide / 4)
    case 'dash':
      return at(B_WALK[p.s % 2]!, 33 - p.s * 4)
    default:
      return undefined
  }
}
/** Where its eyes shine in the hole, looking out. */
const B_EYES_AT = [[34, 5], [37, 5]] as const

/** The band cat's dots as they show, by dot (y * BW + x) and ink: fur out of the tunnel and clear of the dumpster, its eye's shine in the dark. */
function bandCatDots(p: Pose): Map<number, number> {
  const dots = new Map<number, number>()
  if (p.kind === 'turn') {
    // part way through a change of pose, as in the window: what both share, and of each's own a share
    const a = bandCatDots(p.from)
    const b = bandCatDots(p.to)
    for (const [i, ink] of a) if (b.has(i) || bayer(i % BW, Math.floor(i / BW)) >= p.f) dots.set(i, ink)
    for (const [i, ink] of b) if (bayer(i % BW, Math.floor(i / BW)) < p.f) dots.set(i, ink)
    return dots
  }
  const sprite = bandSprite(p)
  if (sprite === undefined) return dots
  for (const [x, y, isEye] of dotsOf({ ...sprite, art: sprite.art.map(row => row.replaceAll('o', 'E')) })) {
    if (x < 0 || x >= BW) continue
    if (isEye) {
      if (inBandHole(x, y)) dots.set(y * BW + x, B_EYES)
    } else if (x < bandMouth(y) && x > B_DUMP_EDGE) dots.set(y * BW + x, B_CAT)
  }
  return dots
}

function drawBand(p: Pose): Run[][] {
  const d = new Dots(BAND_COLS, BAND_ROWS)
  bandWall(d)
  if (p.kind === 'home' && p.eyes !== undefined) {
    for (const [ex, ey] of B_EYES_AT) d.set(ex - (p.isGlancing ? 1 : 0), ey + (p.eyes === 'half' ? 1 : 0), B_EYES)
  }
  const dots = bandCatDots(p)
  if (dots.size > 0) {
    // It stands in front of the bricks: they clear from its cells, so it reads as a cat and not a smudge.
    const cells = new Set([...dots.keys()].map(i => (Math.floor(i / BW) >> 2) * BAND_COLS + ((i % BW) >> 1)))
    d.clip((x, y) => x <= B_DUMP_EDGE || !cells.has((y >> 2) * BAND_COLS + (x >> 1)))
    for (const [i, ink] of dots) d.set(i % BW, Math.floor(i / BW), ink)
  }
  return runsOf(cellsOf(d), BAND_PALETTE)
}

// ------------------------------------------------------------------ the spinner

/** The one-row cat that rides the spinner line: two strides, facing left (it chases the word). */
const RUNNER = [
  ['#.#..........', '###.......##.', '.#########...', '#.........#..'],
  ['#.#..........', '###........##', '.#########...', '...#.#..#.#..'],
]

function runner(t: number): string {
  const d = new Dots(7, 1)
  d.stamp(RUNNER[t % 2]!, 0, 0, { '#': 1 })
  return cellsOf(d)[0]!.map(c => c.ch).join('').trimEnd()
}

// ------------------------------------------------------------------ the window: the alley at night

const WIN_COLS = 64
const WIN_ROWS = 22
const WW = WIN_COLS * 2
const WH = WIN_ROWS * 4
/** The foot of the wall, where every paw stands. */
const GROUND = 79
/** The tall building's edge: right of it the wall is low, with sky above its coping. */
const CORNER = 84
const ROOF = 18
/** The lantern's glass, the light of the alley. */
const LX = 55
const LY = 16
/** The puddle by the lamp's foot, where drops ring. */
const PX = 38
const PY = 85

// Inks, back to front: a cell takes its frontmost.
const STAR = 1, HALO = 2, MOON_RIM = 3, MOON = 4, BRICK = 5, BRICK_LIT = 6, EDGE = 7, FILL = 8, IRON = 9, PAVE = 10,
  PUDDLE = 11, POOL = 12, SHINE = 13, RIPPLE = 14, CAT = 15, CAT_LIT = 16, RAT = 17, DUMP = 18,
  POST = 19, LANTERN = 20, MOTH = 21, EYES = 22
/**
 * Each ink's colour on a dark theme and a light one: the night, and the same
 * night inked on a light page (the hole a dark hatch there, for its eyes).
 * Inks that sit side by side share a colour where the eye won't miss the
 * difference (the sky's faint things, the hole's rim and the mortar), so the
 * picture stays in few runs.
 */
const INKS: Record<number, readonly [string, string, boolean?]> = {
  [STAR]: ['#4a4a50', '#cfcbbd'],
  [HALO]: ['#4a4a50', '#cfcbbd'],
  [MOON_RIM]: ['#4a4a50', '#cfcbbd'],
  [MOON]: ['#e6dfc0', '#9c8a44'],
  [BRICK]: ['#3b3638', '#d6cfca'],
  [BRICK_LIT]: ['#6e5440', '#c49a76'],
  [EDGE]: ['#3b3638', '#d6cfca'],
  [FILL]: ['#151517', '#4a4650'],
  [IRON]: ['#4a4e56', '#9a9ea6'],
  [PAVE]: ['#3b4656', '#9fb0c2'],
  [PUDDLE]: ['#3b4656', '#9fb0c2'],
  [POOL]: ['#7a5e36', '#e0b868'],
  [SHINE]: ['#c08a3c', '#c8861e'],
  [RIPPLE]: ['#8aa0b8', '#6a88a8'],
  [CAT]: ['#8e9198', '#63666e'],
  [CAT_LIT]: ['#c9b9a0', '#7a5c40'],
  [RAT]: ['#7a716a', '#8c8078'],
  [DUMP]: ['#3d6e52', '#4f8a66'],
  [POST]: ['#50545c', '#6c7078'],
  [LANTERN]: ['#ffd685', '#d48a0a', true],
  [MOTH]: ['#d6ccb4', '#7c745f'],
  [EYES]: ['#f6c445', '#f0a800', true],
}
const paletteOf = (theme: 0 | 1): Style[] =>
  Array.from({ length: EYES + 1 }, (_, i) => {
    const ink = INKS[i]
    return ink === undefined ? {} : ink[2] === true ? { color: ink[theme], bold: true as const } : { color: ink[theme] }
  })
const WIN_DARK = paletteOf(0)
const WIN_LIGHT = paletteOf(1)

// The wall: courses five dots tall, bricks twelve long, joints staggered.
const courseOf = (y: number): number => Math.floor(y / 5)
const brickOf = (x: number, y: number): number => Math.floor((x + (courseOf(y) % 2) * 6) / 12)
/** The hole: bricks and broken half-bricks knocked out of an arch at the wall's foot. */
const isHoleHalf = (c: number, h: number): boolean => {
  const cx = h * 6 - (c % 2) * 6 + 3
  const cy = c * 5 + 1.5
  return c <= 15 && ((cx - 108) / 15.5) ** 2 + ((cy - 80) / 25) ** 2 < 1
}
const inHole = (x: number, y: number): boolean => y <= GROUND && y >= 0 && isHoleHalf(courseOf(y), Math.floor((x + (courseOf(y) % 2) * 6) / 6))
/** Where the tunnel starts on each row: the cat is out of sight from here right. */
const MOUTH: readonly number[] = (() => {
  const rows: number[] = []
  let least = WW
  for (let y = 0; y < WH; y++) {
    let x = 0
    while (x < WW && !inHole(x, y)) x++
    rows.push(x)
    if (x < least) least = x
  }
  return rows.map(x => (x === WW ? least : x))
})()

// The dumpster: a trapezoid of green steel; it and the lamp post stand in front of the cat.
const DUMP_TOP = 47
const dumpLeft = (y: number): number => 4 + Math.floor((y - DUMP_TOP) / 12)
const dumpRight = (y: number): number => 45 - Math.floor((y - DUMP_TOP) / 12)
const inDumpster = (x: number, y: number): boolean => y >= 42 && y <= GROUND + 2 && x >= dumpLeft(Math.max(y, DUMP_TOP)) - 1 && x <= dumpRight(Math.max(y, DUMP_TOP)) + 1
const inPost = (x: number, y: number): boolean => (x === 54 || x === 55) && y >= 22 && y <= 86

/** A layer of dots the window's size, one ink per dot (0 none), row by row: the lab's canvas (`set`, `trace`). */
type Layer = Dots
const layer = (): Layer => new Dots(WIN_COLS, WIN_ROWS)
/** The cell a dot is in, numbered row by row. */
const cellOf = (x: number, y: number): number => (y >> 2) * WIN_COLS + (x >> 1)

/** How lit a dot of the wall is by the lantern, 0-1. */
const lampLight = (x: number, y: number): number => Math.max(0, 1 - Math.hypot(x - LX, (y - LY) * 1.15) / 46)

/** Lays `over` onto `l`, clearing every cell it touches of what was there: iron in front of brick, not tangled with it. */
function knock(under: Layer, onto: Layer): void {
  const l = under.dot
  const over = onto.dot
  const cells = new Set<number>()
  for (let i = 0; i < over.length; i++) if (over[i] !== 0) cells.add(cellOf(i % WW, Math.floor(i / WW)))
  for (let i = 0; i < l.length; i++) {
    if (over[i] !== 0) l[i] = over[i]!
    else if (cells.has(cellOf(i % WW, Math.floor(i / WW)))) l[i] = 0
  }
}

/** The alley behind the cat: walls, hole, fire escape, sky, ground. Drawn once per theme. */
function backLayer(isLight: boolean): Layer {
  const l = layer()
  // the fire escape's landings, stair and ladder cast the wall behind them into shadow
  const isShadowed = (x: number, y: number): boolean =>
    (y <= 8 && x <= 25) || (y >= 25 && y <= 34 && x >= 1 && x <= 47) || (y >= 34 && y <= 42 && x >= 37 && x <= 44) || (y > 8 && y < 34 && x >= y - 5 && x <= y + 2)
  // bricks in running bond: mortar lit warm near the lamp, dim in the dark, a joint or two long gone
  for (let y = 0; y <= GROUND; y++) {
    for (let x = 0; x < WW; x++) {
      if ((x >= CORNER && y < ROOF) || inDumpster(x, y) || inPost(x, y) || isShadowed(x, y)) continue
      if (inHole(x, y)) {
        if (!isLight || (x + y) % 2 === 0) l.set(x, y, FILL)
        continue
      }
      const isMortar = y % 5 === 4
      const isJoint = !isMortar && (x + (courseOf(y) % 2) * 6) % 12 === 0
      if (!isMortar && !isJoint) continue
      if (isJoint && hash(brickOf(x, y), courseOf(y), 7) < 0.1) continue
      if (isMortar && hash(Math.floor(x / 3), y, 9) < 0.05) continue
      l.set(x, y, lampLight(x, y) > 0.32 ? BRICK_LIT : BRICK)
    }
  }
  // the hole's rim: broken brick ends round the dark; brickbats fallen at its mouth
  for (let y = 40; y <= GROUND; y++) {
    for (let x = 80; x < WW; x++) {
      if (inHole(x, y)) continue
      if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => inHole(x + dx!, y + dy!))) l.set(x, y, EDGE)
    }
  }
  for (const [x, y] of [[86, 78], [87, 78], [88, 78], [86, 77], [87, 77], [89, 79], [90, 79], [124, 78], [125, 78], [125, 77], [123, 79]] as const) l.set(x, y, EDGE)
  // the low wall's coping, and the tall building's corner
  for (let x = CORNER; x < WW; x++) {
    l.set(x, ROOF - 1, EDGE)
    if (x % 2 === 0) l.set(x, ROOF - 2, EDGE)
  }
  l.trace(CORNER - 1, 0, CORNER - 1, ROOF - 1, EDGE)
  // the fire escape: two landings with railings, the stair between, a drop ladder
  const iron = layer()
  const rail = (x0: number, x1: number, floor: number): void => {
    for (let x = x0; x <= x1; x++) {
      iron.set(x, floor, IRON)
      if (x % 2 === 0) iron.set(x, floor + 1, IRON)
      iron.set(x, floor - 7, IRON)
      if (x % 4 === 0 || x === x1) for (let y = floor - 6; y < floor; y++) iron.set(x, y, IRON)
    }
  }
  rail(0, 24, 7)
  rail(2, 46, 33)
  for (let i = 0; i <= 22; i++) {
    iron.set(28 - i, 32 - i, IRON)
    iron.set(33 - i, 32 - i, IRON)
    if (i % 3 === 1) for (let x = 29 - i; x < 33 - i; x++) iron.set(x, 32 - i, IRON)
  }
  for (let y = 35; y <= 42; y++) {
    iron.set(38, y, IRON)
    iron.set(43, y, IRON)
    if (y % 3 === 0) for (let x = 39; x < 43; x++) iron.set(x, y, IRON)
  }
  knock(l, iron)
  // sky: a few faint stars over the low roof
  for (const [x, y] of [[90, 4], [97, 13], [121, 3], [125, 12], [115, 14], [88, 10]] as const) l.set(x, y, STAR)
  // the ground: wet paving, the lamp's pool, a puddle with the lantern in it
  for (let y = GROUND + 1; y < WH; y++) {
    for (let x = 0; x < WW; x++) {
      const pool = 1 - Math.hypot((x - LX - 4) / 48, (y - 84) / 6)
      if (pool > 0 && bayer(x, y) < pool * pool * 0.45) l.set(x, y, POOL)
      else if (y === WH - 1 && x % 4 === 1) l.set(x, y, PAVE)
      else if (y === GROUND + 4 && x % 9 === 6) l.set(x, y, PAVE)
    }
  }
  for (let x = PX - 13; x <= PX + 13; x++) {
    const t = (x - PX) / 13
    const h = 1.7 * Math.sqrt(Math.max(0, 1 - t * t))
    const top = Math.round(PY - h)
    const bottom = Math.round(PY + h)
    for (let y = top; y <= bottom; y++) l.set(x, y, 0)
    l.set(x, top, PUDDLE)
    if (x % 2 === 0) l.set(x, bottom, PUDDLE)
  }
  for (const [x, y] of [[48, 84], [49, 84], [48, 85], [49, 86], [46, 85], [47, 86]] as const) l.set(x, y, SHINE)
  return l
}

/** What stands in front of the cat: the dumpster and the lamp. Drawn once. */
function frontLayer(): Layer {
  const l = layer()
  // the lid, shut, a little domed, with a lip and a seam between its halves
  for (let x = 2; x <= 47; x++) {
    l.set(x, 44 - (x > 8 && x < 41 ? 1 : 0), DUMP)
    if (x % 2 === 0) l.set(x, 45, DUMP)
    l.set(x, 46, DUMP)
  }
  l.trace(24, 43, 24, 46, DUMP)
  // its body: top band, sides, ribs, the fork pockets, two casters, a faint skin of paint
  for (let y = DUMP_TOP; y <= GROUND; y++) {
    const x0 = dumpLeft(y)
    const x1 = dumpRight(y)
    l.set(x0, y, DUMP)
    l.set(x1, y, DUMP)
    for (let x = x0 + 1; x < x1; x++) {
      const isRib = y > 51 && y < GROUND - 1 && (x === 14 || x === 24 || x === 34)
      if (isRib || y === DUMP_TOP || y === 51 || y === GROUND || (y > 51 && bayer(x, y) < 0.07)) l.set(x, y, DUMP)
    }
  }
  for (const [x0, x1] of [[1, 4], [45, 49]] as const) {
    for (let x = x0; x <= x1; x++) {
      l.set(x, 53, DUMP)
      l.set(x, 57, DUMP)
    }
    for (let y = 54; y <= 56; y++) {
      l.set(x0, y, DUMP)
      l.set(x1, y, DUMP)
    }
  }
  for (const cx of [12, 38]) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-1, 1], [1, 1], [-1, 2], [1, 2], [0, 3]] as const) l.set(cx + dx, GROUND + 1 + dy, IRON)
  }
  // the street lamp: a flared foot, a collar, the post, a four-paned lantern under its cap and finial
  for (let x = 51; x <= 58; x++) {
    l.set(x, 86, POST)
    if (x >= 52 && x <= 57) l.set(x, 85, POST)
  }
  for (let y = 80; y <= 84; y++) for (let x = 53; x <= 56; x++) l.set(x, y, POST)
  for (let y = 22; y < 80; y++) {
    l.set(54, y, POST)
    l.set(55, y, POST)
  }
  for (let x = 53; x <= 56; x++) l.set(x, 58, POST)
  for (let y = 12; y <= 21; y++) {
    const half = 4 - Math.floor((y - 12) / 4)
    for (let x = LX - half; x <= LX + half; x++) l.set(x, y, LANTERN)
  }
  for (let x = 50; x <= 60; x++) l.set(x, 11, POST)
  for (let x = 52; x <= 58; x++) l.set(x, 10, POST)
  for (let x = 54; x <= 56; x++) l.set(x, 9, POST)
  for (const [x, y] of [[55, 8], [55, 7], [54, 6], [56, 6], [55, 5]] as const) l.set(x, y, POST)
  for (let x = 53; x <= 57; x++) l.set(x, 22, POST)
  return l
}

/** The alley is the same every tick but for what moves in it: drawn once per theme, kept. */
const BACKS = new Map<boolean, Layer>()
let FRONT: [number, number][] | undefined
/** The window's canvas, drawn afresh from the alley each tick (nothing of the last tick is read). */
let WINDOW: Layer | undefined

/** The moon over the low roof in its phase: lit side, a faint rim on the dark side, a halo. */
function drawMoon(l: Layer, phase: number): void {
  const cx = 106, cy = 8, r = 5.5
  const k = Math.cos(phase * 2 * Math.PI)
  const isWaxing = phase < 0.5
  for (let y = -9; y <= 9; y++) {
    for (let x = -9; x <= 9; x++) {
      const dd = Math.hypot(x, y * 1.05)
      if (dd <= r + 0.35) {
        const half = Math.sqrt(Math.max(0, r * r - y * y))
        const isLit = (isWaxing ? x : -x) >= k * half - 0.25
        if (isLit) l.set(cx + x, cy + y, MOON)
        else if (dd > r - 0.9) l.set(cx + x, cy + y, MOON_RIM)
      } else if (dd <= r + 3 && cy + y < ROOF - 2) {
        const fall = 1 - (dd - r) / 3.2
        if (bayer(cx + x, cy + y) < fall * fall * 0.3 * (1 - Math.abs(k) * 0.6)) l.set(cx + x, cy + y, HALO)
      }
    }
  }
}

// The cat at window size, facing left. '#' fur, 'E' an eye (it shines; the rest of its cell clears round it).
// Every picture is an even number of dots wide, so it mirrors true and its eyes keep to their cells.
const W_HEAD = [
  '......#...#...',
  '.....##..###..',
  '....#########.',
  '...###########',
  '..##EE########',
  '.###EE########',
  '####EE########',
  '.#############',
]
const W_TAIL = [
  '..................................#...',
  '...................................#..',
  '....................................#.',
  '....................................#.',
  '....................................#.',
  '...................................#..',
  '..................................#...',
  '.................................#....',
]
const W_BODY = [
  ...W_HEAD.map((row, y) => merge(`${row}........................`, W_TAIL[y])),
  '..#######################.......#.....',
  '....#######################....#......',
  '......#########################.......',
  '.......#########################......',
  '........########################......',
  '.........######.........#######.......',
]
/**
 * Its legs, shoulder and hip to paw, in two strides: spread and gathered.
 * The near legs are two dots wide, the far ones a hairline. Each stride
 * moves the body two dots on and swings one diagonal pair four, while the
 * other pair's paws stay planted: so a step moves half its legs, as a cat's does.
 */
const LEGS = [
  { top: 11, feet: [8, 10], isNear: true },
  { top: 13, feet: [15, 13], isNear: false },
  { top: 26, feet: [24, 26], isNear: false },
  { top: 28, feet: [31, 29], isNear: true },
] as const
function legRows(stride: number): string[] {
  const rows = Array.from({ length: 6 }, () => [...'.'.repeat(38)])
  for (const leg of LEGS) {
    const foot = leg.feet[stride]!
    for (let r = 0; r < 5; r++) {
      const x = Math.round(leg.top + ((foot - leg.top) * r) / 4)
      rows[r]![x] = '#'
      // a near leg is thicker at the top, where the shoulder or the thigh is
      if (leg.isNear && r < 2) rows[r]![x + 1] = '#'
    }
    for (let x = foot - 1; x <= foot + (leg.isNear ? 1 : 0); x++) rows[5]![x] = '#'
  }
  return rows.map(row => row.join(''))
}
/** A walking cat, 38 x 20, in its two strides. */
const W_WALK = [0, 1].map(stride => [...W_BODY, ...legRows(stride)])

function merge(a: string, b: string | undefined): string {
  if (b === undefined) return a
  let out = ''
  for (let i = 0; i < Math.max(a.length, b.length); i++) out += b[i] !== undefined && b[i] !== '.' ? b[i] : (a[i] ?? '.')
  return out
}

/** Sitting side on, facing left, 24 x 24: tabby stripes down its haunch, its tail curled round its paws. */
const W_SIT = [
  '......#...#.............',
  '.....##..###............',
  '....#########...........',
  '...###########..........',
  '..##EE#########.........',
  '.###EE#########.........',
  '####EE#########.........',
  '.##############.........',
  '..#############.........',
  '....###########.........',
  '.....##########.........',
  '.....###########........',
  '.....#######.####.......',
  '.....########.####......',
  '.....##############.....',
  '.....##########.####....',
  '.....###########.###....',
  '.....####.##########....',
  '.....###..##########....',
  '.....###..##########....',
  '.....###..##########....',
  '.....###..#########.....',
  '....####.#########.##...',
  '...####################.',
]
/** Sitting down: its front still standing, its rear lowered to the ground. */
const W_SIT_DOWN = [
  ...W_BODY.slice(0, 8).map(row => row.slice(0, 24)),
  '..##############........',
  '....#############.......',
  '......############......',
  '.......############.....',
  '........############....',
  '.........###########....',
  '.........##.#########...',
  '..........#.#########...',
  '..........#.#########...',
  '..........#.#########...',
  '.........##.#########...',
  '.........##.##########..',
]
/** Facing the person, 26 x 28: two eyes in the lamplight, stripes on its brow, its tail round its feet. */
const W_FRONT = [
  '...#..............#.......',
  '...##............##.......',
  '...###..........###.......',
  '..####..........####......',
  '..#######.##.#######......',
  '.#######.####.#######.....',
  '.####################.....',
  '.####################.....',
  '.#####..######..#####.....',
  '.#####EE######EE#####.....',
  '.#####EE######EE#####.....',
  '.#####EE######EE#####.....',
  '.##########..########.....',
  '..#########..#######......',
  '...################.......',
  '....##############........',
  '....##############........',
  '...################.......',
  '...#######.########.......',
  '..#######.#.#########.....',
  '..######.##.##.#######....',
  '..######.##.##.#######....',
  '..######.##.##.#######....',
  '..######.##.##.######.....',
  '..######.##.##.#####......',
  '..######.##.##.#######....',
  '..#######################.',
  '...#####################..',
]
/** Lying in its doorway like a sphinx, 24 x 16: head up, forelegs laid out in front; meowing, its jaw dropped. */
const W_LOAF = [
  '......#...#.............',
  '.....##..###............',
  '....#########...........',
  '...###########..........',
  '..##EE#########.........',
  '.###EE#########.........',
  '####EE##########........',
  '.################.......',
  '..##################....',
  '....#################...',
  '.....#################..',
  '.....##################.',
  '......#################.',
  '.##########.############',
  '###########.############',
  '##########.#############',
]
const W_MEOW = [
  ...W_LOAF.slice(0, 7),
  '...##############.......',
  '.#..################....',
  '##..#################...',
  ...W_LOAF.slice(10),
]

/** Small changes: its tail tip flicked up; eyes half shut and shut; an ear turned back. */
const flickTail = (art: readonly string[]): string[] => art.map((row, y) => (y === 21 ? `${row.slice(0, 20)}.#..` : y === 22 ? `${row.slice(0, 19)}.#...` : row))
const halfShut = (art: readonly string[]): string[] => art.map((row, y) => (y === 9 ? row.replaceAll('E', '#') : row))
const shut = (art: readonly string[]): string[] => art.map((row, y) => (y === 9 || y === 10 ? row.replaceAll('E', '#') : row.replaceAll('E', y === 11 ? '#' : 'E')))
const earBack = (art: readonly string[]): string[] => art.map((row, y) => (y === 0 ? `.....#....#${'.'.repeat(row.length - 11)}` : y === 1 ? `.....##..##${'.'.repeat(row.length - 11)}` : row))

/** The walk out's left edge at place `n`, and the walk home's; where it sits, faces the person, lies in its door. */
const outX = (n: number): number => 104 - n * 2
const homeX = (n: number): number => 94 - n * 2
const SIT_X = 62
const DOOR_X = 76

function winSprite(p: Pose): Sprite | undefined {
  const top = (art: readonly string[]): number => GROUND + 1 - art.length
  const at = (art: readonly string[], x: number, isFlipped = false, eyeRows?: readonly number[]): Sprite => ({ art, x, y: top(art), isFlipped, ...(eyeRows !== undefined ? { eyeRows } : {}) })
  switch (p.kind) {
    case 'walk':
      return p.isHomeward ? at(W_WALK[p.n % 2]!, homeX(p.n), true) : at(W_WALK[p.n % 2]!, outX(p.n))
    case 'dash':
      return at(W_WALK[p.s % 2]!, 104 - p.s * 5)
    case 'sit':
      if (p.sit === 'down') return at(W_SIT_DOWN, SIT_X)
      if (p.sit === 'side') return at(p.isEar ? earBack(W_SIT) : p.isFlick ? flickTail(W_SIT) : W_SIT, SIT_X)
      if (p.sit === 'front') return at(p.blink === 'shut' ? shut(W_FRONT) : p.blink === 'half' ? halfShut(W_FRONT) : W_FRONT, SIT_X + 4, false, p.isUp ? [9, 10] : undefined)
      if (p.sit === 'back') return at(p.isEar ? earBack(W_SIT) : W_SIT, SIT_X + 6, true)
      return at(W_SIT_DOWN, SIT_X + 6, true)
    case 'door':
      return at(p.isMeow ? W_MEOW : p.isEar ? earBack(W_LOAF) : W_LOAF, DOOR_X + p.slide, false, p.isUp ? [4, 5] : undefined)
    default:
      return undefined
  }
}

/** The cat's dots in the window, as they show: fur out of the tunnel and clear of what stands in front, eyes in the dark too. */
function catDots(p: Pose): { fur: Set<number>; eyes: number[]; mid: number } {
  const fur = new Set<number>()
  const eyes: number[] = []
  if (p.kind === 'turn') {
    // part way through a change of pose: what both share, and of each's own a share on an ordered dither
    const a = catDots(p.from)
    const b = catDots(p.to)
    for (const i of a.fur) if (b.fur.has(i) || bayer(i % WW, Math.floor(i / WW)) >= p.f) fur.add(i)
    for (const i of b.fur) if (bayer(i % WW, Math.floor(i / WW)) < p.f) fur.add(i)
    return { fur, eyes: p.f < 0.5 ? a.eyes : b.eyes, mid: (a.mid + b.mid) / 2 }
  }
  const sprite = winSprite(p)
  if (sprite === undefined) return { fur, eyes, mid: 0 }
  for (const [x, y, isEye] of dotsOf(sprite)) {
    if (x < 0 || y < 0 || x >= WW || y >= WH || inDumpster(x, y) || inPost(x, y)) continue
    const isOut = x < (MOUTH[y] ?? WW)
    if (isEye) {
      if (isOut || inHole(x, y)) eyes.push(y * WW + x)
    } else if (isOut) fur.add(y * WW + x)
  }
  return { fur, eyes, mid: sprite.x + sprite.art[0]!.length / 2 }
}

/** The rat under the dumpster, facing right, 16 x 5; sniffing, its nose up. */
const W_RAT = [
  '...........##...',
  '.....######.##..',
  '....###########.',
  '.#.#############',
  '#.#...#.#..#.#..',
]
const W_RAT_SNIFF = ['...........##...', '.....######.##..', '....##########.#', '.#.###########..', '#.#...#.#..#.#..']

/** Where the rat's left edge is, or nothing while it stays under the dumpster. */
function ratAt(m: Moment, p: Pose): { x: number; isSniff: boolean } | undefined {
  if (m.mood === 'busy') {
    // with the cat away, it comes out for scraps
    if (m.since < 28) return undefined
    const k = (m.since - 28) % 128
    if (k < 34) return { x: 30 + Math.floor(k / 2) * 2, isSniff: false }
    if (k < 64) return { x: 62, isSniff: k % 8 < 2 }
    if (k < 73) return { x: 62 - (k - 63) * 4, isSniff: false }
    return undefined
  }
  if (m.mood !== 'idle' || m.line !== undefined || p.kind !== 'home') return undefined
  // with the cat at home it peeks out, sees two eyes light up across the alley, and thinks better of it
  const k = m.since % CYCLE
  if (roams(m.tick - m.since, Math.floor(m.since / CYCLE)) || k < 150 || k >= 174) return undefined
  if (k < 158) return { x: 34 + Math.floor((k - 150) / 2) * 2, isSniff: false }
  if (k < 170) return { x: 40, isSniff: k === 160 || k === 164 }
  return { x: 40 - (k - 169) * 4, isSniff: false }
}

/** The moth at the lamp: resting on the lantern's cap, fluttering round it now and then, and often while Claude works. */
function mothAt(m: Moment): { x: number; y: number; isOpen: boolean } {
  const isBusy = m.mood === 'busy'
  const k = isBusy ? m.since % 16 : m.since % 112
  const isFlying = isBusy ? k < 6 : k >= 60 && k < 64
  if (!isFlying) return { x: 60, y: 9, isOpen: false }
  const a = (isBusy ? m.since : k) * 0.8
  return { x: Math.round(LX + 1 + Math.cos(a) * 10), y: Math.round(LY - 1 + Math.sin(a) * 7), isOpen: m.tick % 2 === 0 }
}

/** A ring on the puddle after a drop falls, for three ticks. */
function rippleAt(m: Moment): number | undefined {
  const k = (m.since + 30) % (m.mood === 'busy' ? 48 : 120)
  return k < 3 ? k + 1 : undefined
}

/**
 * The frame as rows of runs, straight from its dots: a braille glyph per
 * inked cell coloured by its frontmost ink (braille.ts `topCell`), a blank
 * joining the run before it (runs.ts `addCell`), as dots.ts runsOf has them
 * (without its cells in between: the window is big, and drawn every tick).
 * Its palettes paint no background and no dim.
 */
function runsOfInk(ink: Uint8Array, palette: readonly Style[]): Run[][] {
  const out: Run[][] = []
  const blank = palette[0]!
  for (let r = 0; r < WIN_ROWS; r++) {
    const runs: Run[] = []
    for (let c = 0; c < WIN_COLS; c++) {
      const cell = topCell(ink, r * 4 * WW + c * 2, WW)
      const style = cell === 0 ? blank : palette[cell >> 8]!
      addCell(runs, cell === 0 ? ' ' : String.fromCharCode(0x2800 + (cell & 0xff)), cell === 0, style.color, undefined, undefined, style.bold === true ? true : undefined)
    }
    out.push(runs)
  }
  return out
}

function drawWindow(m: Moment, pose: Pose): Run[][] {
  const isLight = m.isLight === true
  const back = BACKS.get(isLight) ?? backLayer(isLight)
  BACKS.set(isLight, back)
  FRONT ??= [...frontLayer().dot.entries()].filter(([, v]) => v !== 0)
  // the alley, then what moves over it, on the one canvas kept for it
  const canvas = (WINDOW ??= layer())
  canvas.dot.set(back.dot)
  const ink = canvas.dot
  if (m.now !== undefined) drawMoon(canvas, moonPhase(m.now))
  const ripple = rippleAt(m)
  if (ripple !== undefined) for (let a = 0; a < 16; a += 2) canvas.set(PX - 4 + Math.cos((a * Math.PI) / 8) * ripple * 2, PY + Math.sin((a * Math.PI) / 8) * ripple * 0.6, RIPPLE)

  // What moves in front of the wall: the cat (or its eyes in the hole), the rat, the moth.
  const dots: [number, number][] = []
  if (pose.kind === 'home' && pose.eyes !== undefined) {
    const shift = pose.isGlancing ? -2 : 0
    for (const ex of [104, 112]) for (let y = pose.eyes === 'half' ? 67 : 65; y <= 67; y++) for (const dx of [0, 1]) dots.push([y * WW + ex + shift + dx, EYES])
  }
  const cat = catDots(pose)
  // in the lamp's pool its fur takes the warm light
  const fur = cat.mid < 90 ? CAT_LIT : CAT
  for (const i of cat.fur) dots.push([i, fur])
  for (const i of cat.eyes) dots.push([i, EYES])
  const rat = ratAt(m, pose)
  if (rat !== undefined) {
    const art = rat.isSniff ? W_RAT_SNIFF : W_RAT
    art.forEach((row, ay) => {
      for (let i = 0; i < row.length; i++) {
        const x = rat.x + i
        const y = GROUND - 4 + ay
        if (row[i] === '#' && !inDumpster(x, y) && x < WW) dots.push([y * WW + x, RAT])
      }
    })
  }
  const moth = mothAt(m)
  for (const [dx, dy] of moth.isOpen ? [[-1, 0], [1, 0], [0, 1]] : [[0, 0], [0, 1]]) dots.push([(moth.y + dy!) * WW + moth.x + dx!, MOTH])

  // Each clears its cells of the alley behind it (but a cell it only grazes), and an eye clears its own cell of fur: so each reads alone.
  const cells = new Uint8Array(WIN_COLS * WIN_ROWS)
  for (const [i, v] of dots) {
    const c = cellOf(i % WW, Math.floor(i / WW))
    cells[c] = v === EYES ? 9 : v === MOTH ? Math.max(3, cells[c]!) : Math.min(8, cells[c]! + 1)
  }
  for (let c = 0; c < cells.length; c++) {
    if (cells[c]! < 3) continue
    const x0 = (c % WIN_COLS) * 2
    const y0 = Math.floor(c / WIN_COLS) * 4
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) ink[(y0 + dy) * WW + x0 + dx] = 0
  }
  for (const [i, v] of dots) if (v === EYES || cells[cellOf(i % WW, Math.floor(i / WW))] !== 9) ink[i] = v
  for (const [i, v] of FRONT) ink[i] = v
  return runsOfInk(ink, isLight ? WIN_LIGHT : WIN_DARK)
}

// ------------------------------------------------------------------ the pet

function draw(m: Moment): Drawing {
  const pose = poseOf(m)
  const band = m.isWindow === true ? drawWindow(m, pose) : drawBand(pose)
  const rides = pose.kind === 'dash' && pose.s >= 3
  return { band, ...(rides ? { spinner: [{ text: '… ', color: 'claude' }, { text: runner(m.tick), color: 'claude' }] } : {}) }
}

export const pet: ExperimentalPet = {
  id: 'stray',
  name: 'Stray',
  persona: 'a stray tabby cat that lives in a hole in an alley wall by the prompt',
  blurb: 'an alley cat; it runs off to ride the spinner',
  color: 'inactive',
  ownsBubble: false,
  rows: { rest: BAND_ROWS, most: BAND_ROWS },
  window: { width: WIN_COLS, height: WIN_ROWS },
  draw,
}
