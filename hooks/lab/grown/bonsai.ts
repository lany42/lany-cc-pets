// Bonsai: a little clay pot with a face, and the tree it grows on its head.
// Not drawn: grown. The tree is the result of replaying growth steps from the
// pet's seed, one per finished turn at first and slower as it matures, so the
// same seed and the same number of turns always give the same tree.
// It remembers {seed, turns} across sessions, sways like it breathes, follows
// the real seasons (blossom, green, amber, bare and snowy), and when a turn
// ends you watch the new twig grow.
import { clamp } from '../util'
import { clearFrame, Dots, hash01, lineOver, packFrame, rng, TAU } from './core'
import type { Frame, GenPet, Ink, Mood, Rng, TickInput } from './core'

const COLS = 16
const ROWS = 6
const W = COLS * 2
const H = ROWS * 4
/** The pot's rim row (dots); the tree lives above it. */
const RIM = 16
const BASE_X = 16
/** How many growth steps are replayed at most (about 10,000 turns in). */
const MAX_STEPS = 600

/**
 * Growth steps for a number of finished turns: one each for the first 50 (a
 * sapling in a day), then slowing (about 120 at 200 turns, 220 at 1,000), so
 * the tree keeps changing for months instead of filling its pot in a week.
 */
export const stepsFor = (turns: number): number =>
  Math.min(MAX_STEPS, turns <= 50 ? turns : 50 + Math.floor(Math.sqrt((turns - 50) * 30)))
/** Ticks the newest twig takes to grow in after a turn ends. */
const GROW_TICKS = 8

// Inks, back to front: the pot, bark, the leaves of each season, blossom,
// snow, the glowing bud, the face.
const POT = 1
const BARK = 2
const LEAF_SPRING = 3
const LEAF_SUMMER = 4
const LEAF_AUTUMN = 5
const LEAF_WINTER = 6
const BLOSSOM = 7
const SNOW = 8
const BUD = 9
const FACE = 10

const INKS: readonly Ink[] = [
  { name: 'none', dark: 0, light: 0, key: 'text' },
  { name: 'pot', dark: 0x86a8c8, light: 0x3f6a8a, key: 'suggestion' },
  { name: 'bark', dark: 0xa89078, light: 0x6d5544, key: 'subtle' },
  { name: 'leaf-spring', dark: 0xa8d98a, light: 0x4c8c2b, key: 'success' },
  { name: 'leaf-summer', dark: 0x6fbf73, light: 0x2e7d32, key: 'success' },
  { name: 'leaf-autumn', dark: 0xe8a04c, light: 0xb35900, key: 'warning' },
  { name: 'leaf-winter', dark: 0x8fa89a, light: 0x5b7065, key: 'inactive' },
  { name: 'blossom', dark: 0xf5a9c8, light: 0xc2185b, key: 'bashBorder' },
  { name: 'snow', dark: 0xeef4f8, light: 0x8aa4b4, key: 'text' },
  { name: 'bud', dark: 0xfff08a, light: 0xd08700, key: 'warning' },
  { name: 'face', dark: 0xc8def2, light: 0x24496a, key: 'suggestion' },
]

type Season = 'spring' | 'summer' | 'autumn' | 'winter'
const seasonOf = (month: number): Season =>
  month >= 2 && month <= 4 ? 'spring' : month >= 5 && month <= 7 ? 'summer' : month >= 8 && month <= 10 ? 'autumn' : 'winter'
const LEAF_OF: Record<Season, number> = { spring: LEAF_SPRING, summer: LEAF_SUMMER, autumn: LEAF_AUTUMN, winter: LEAF_WINTER }

// ---------------------------------------------------------------------------
// The tree: nodes joined to their parents; tips are where it grows.

type Tree = {
  x: number[]
  y: number[]
  parent: number[]
  /** The step a node was born at (0 for the seedling). */
  born: number[]
  /** Growing ends, by node index. */
  tips: number[]
  /** Each tip's heading (radians, -PI/2 is up) and the heading it leans to. */
  heading: Map<number, number>
  prefer: Map<number, number>
  /** Foliage density per tip, 0-4: grows when a tip is boxed in. */
  pad: Map<number, number>
  /** Descendants per node (for trunk thickness), recomputed after growth. */
  weight: number[]
  steps: number
  rand: Rng
  /** The trunk's lean, from the seed: informal upright, slanting or nearly straight. */
  lean: number
}

function sprout(seed: number): Tree {
  const rand = rng(seed ^ 0x5eed)
  const lean = rand.range(-0.45, 0.45)
  const t: Tree = {
    x: [BASE_X, BASE_X + Math.cos(-Math.PI / 2 + lean) * 2.5],
    y: [RIM - 1, RIM - 1 - 2.5],
    parent: [-1, 0],
    born: [0, 0],
    tips: [1],
    heading: new Map([[1, -Math.PI / 2 + lean]]),
    prefer: new Map([[1, -Math.PI / 2 + lean * 0.6]]),
    pad: new Map([[1, 0]]),
    weight: [1, 0],
    steps: 0,
    rand,
    lean,
  }
  return t
}

/**
 * Inside the canopy's room: a dome over the pot (narrow at the apex, widest
 * low down, as a bonsai is shaped), shifted the way the trunk leans.
 */
function roomy(t: Tree, x: number, y: number): boolean {
  if (x < 1.5 || x > W - 2.5 || y < 1 || y > RIM - 3.5) return false
  const k = (y - 1) / (RIM - 4.5)
  const half = 15 * (0.3 + 0.7 * Math.sqrt(clamp(k, 0, 1)))
  return Math.abs(x - (BASE_X + t.lean * 7)) <= half
}

/** True when (x, y) is within `gap` of a node on another branch than `from`'s own line. */
function crowded(t: Tree, x: number, y: number, from: number, gap: number): boolean {
  for (let i = 0; i < t.x.length; i++) {
    if (i === from || i === t.parent[from]) continue
    const dx = t.x[i]! - x
    const dy = t.y[i]! - y
    if (dx * dx + dy * dy < gap * gap) return true
  }
  return false
}

function addNode(t: Tree, parent: number, x: number, y: number): number {
  t.x.push(x)
  t.y.push(y)
  t.parent.push(parent)
  t.born.push(t.steps)
  t.weight.push(0)
  return t.x.length - 1
}

/** Picks a tip, the leader and young tips more often (apical dominance). */
function pickTip(t: Tree): number {
  let total = 0
  const weights = t.tips.map(tip => {
    const w = (tip === leader(t) ? 2.2 : 1) / (1 + (t.pad.get(tip) ?? 0))
    total += w
    return w
  })
  let r = t.rand.next() * total
  for (let i = 0; i < t.tips.length; i++) {
    r -= weights[i]!
    if (r <= 0) return t.tips[i]!
  }
  return t.tips[t.tips.length - 1]!
}

const leader = (t: Tree) => t.tips[0]!

/** One growth step: extend a tip, or fork a new branch off the wood. Returns the node it touched. */
function grow(t: Tree): number {
  t.steps++
  const r = t.rand
  const nodes = t.x.length
  const maxTips = Math.min(9, 2 + Math.floor(t.steps / 7))
  const wantsFork = t.steps > 2 && t.tips.length < maxTips && r.chance(t.tips.length < 3 ? 0.5 : 0.3)

  if (wantsFork) {
    // Fork from a node partway up the wood, toward the side with more room.
    const from = r.int(Math.min(1, nodes - 1), nodes - 1)
    if (!t.tips.includes(from) && t.y[from]! < RIM - 4) {
      const side = r.chance(0.5) ? 1 : -1
      const parentHeading = Math.atan2(t.y[from]! - t.y[t.parent[from]!]!, t.x[from]! - t.x[t.parent[from]!]!)
      for (const s of [side, -side]) {
        const heading = parentHeading + s * r.range(0.75, 1.25)
        const len = r.range(2, 3)
        const nx = t.x[from]! + Math.cos(heading) * len
        const ny = t.y[from]! + Math.sin(heading) * len
        if (roomy(t, nx, ny) && !crowded(t, nx, ny, from, 2.2)) {
          const tip = addNode(t, from, nx, ny)
          t.tips.push(tip)
          t.heading.set(tip, heading)
          // Bonsai branches reach out, nearly level, and lift a little at the end.
          t.prefer.set(tip, -Math.PI / 2 + s * r.range(0.95, 1.35))
          t.pad.set(tip, 0)
          return tip
        }
      }
    }
  }

  // Extend a tip: turn a little at random, a little toward where it leans.
  const tip = pickTip(t)
  const heading = t.heading.get(tip)!
  const prefer = t.prefer.get(tip)!
  for (let attempt = 0; attempt < 3; attempt++) {
    const turned = heading + (prefer - heading) * 0.35 + r.range(-0.45, 0.45) * (attempt + 1)
    const len = r.range(2, 3.2)
    const nx = t.x[tip]! + Math.cos(turned) * len
    const ny = t.y[tip]! + Math.sin(turned) * len
    if (roomy(t, nx, ny) && !crowded(t, nx, ny, tip, 1.8)) {
      const node = addNode(t, tip, nx, ny)
      t.tips[t.tips.indexOf(tip)] = node
      t.heading.set(node, turned)
      t.prefer.set(node, prefer)
      t.pad.set(node, t.pad.get(tip)!)
      t.heading.delete(tip)
      t.prefer.delete(tip)
      t.pad.delete(tip)
      return node
    }
  }
  // Boxed in: the pad on that tip thickens instead (the tree prunes itself).
  t.pad.set(tip, Math.min(4, t.pad.get(tip)! + 1))
  return tip
}

function weigh(t: Tree): void {
  t.weight.fill(0)
  for (let i = t.x.length - 1; i > 0; i--) t.weight[t.parent[i]!]! += t.weight[i]! + 1
}

function grownTo(seed: number, steps: number): Tree {
  const t = sprout(seed)
  for (let i = 0; i < Math.min(steps, MAX_STEPS); i++) grow(t)
  weigh(t)
  return t
}

// ---------------------------------------------------------------------------
// The pot and its face, drawn as dot art: '#' is pot, 'e' is face.

// x: 0         1         2         3
//    01234567890123456789012345678901
const POT_ART = [
  '    ########################    ', // 16 the lip
  '      #                  #      ', // 17
  '      #                  #      ', // 18
  '      #                  #      ', // 19
  '       #                #       ', // 20
  '       #                #       ', // 21
  '        #              #        ', // 22
  '         ##############         ', // 23
]
// The face sits in the pot's lower row of cells, clear of the lip, so each
// feature is whole in its cells: eyes at x 10 and 20, the mouth between.
type Face = { eyes: readonly string[]; mouth: readonly string[] }
const EYES = {
  open: ['##        ##', '##        ##'],
  blink: ['            ', '##        ##'],
  happy: [' #        # ', '# #      # #'],
}
const MOUTHS = {
  smile: ['#  #', ' ## '],
  flat: ['    ', ' ## '],
  open: [' ## ', ' ## '],
  wide: ['#  #', '####'],
}
const EYES_AT = { x: 10, y: 20 }
const MOUTH_AT = { x: 14, y: 21 }

// ---------------------------------------------------------------------------

type Growing = { node: number; left: number }
type Falling = { x: number; y: number; ink: number; age: number }

export type BonsaiState = {
  seed: number
  /** Finished turns, ever: what it remembers; the tree has stepsFor(turns) steps. */
  turns: number
  tree: Tree
  dots: Dots
  growing: Growing | undefined
  /** A twinkle on the node the last finished turn grew (or thickened). */
  spark: Growing | undefined
  falling: Falling[]
  /** Ticks left of the happy face after a twig. */
  glad: number
  /** Ticks until the next blink, and how long it shuts. */
  nextBlink: number
  /** Smoothed sway strength, so moods ease into each other. */
  sway: number
  life: Rng
  mood: Mood
  moodTicks: number
}

export const bonsai: GenPet<BonsaiState> = {
  id: 'bonsai',
  name: 'Bonsai',
  persona: 'a little clay pot with a face, and a bonsai on its head that grows as their work does',
  cols: COLS,
  rows: ROWS,
  inks: INKS,

  born(seed, memory) {
    const kept = memory as { v?: number; seed?: number; turns?: number } | undefined
    const turns = kept?.v === 1 && kept.seed === seed && typeof kept.turns === 'number' ? Math.max(0, Math.floor(kept.turns)) : 0
    return {
      seed,
      turns,
      tree: grownTo(seed, stepsFor(turns)),
      dots: new Dots(COLS, ROWS),
      growing: undefined,
      spark: undefined,
      falling: [],
      glad: 0,
      nextBlink: 12,
      sway: 1,
      life: rng(seed ^ 0x11fe),
      mood: 'idle',
      moodTicks: 0,
    }
  },

  turned(memory, seed) {
    if (memory === undefined || memory === null) return { v: 1, seed, turns: 1 }
    const kept = memory as { v?: unknown; seed?: unknown; turns?: unknown }
    // Another version's, or another seed's: not ours to write over.
    if (kept.v !== 1 || kept.seed !== seed || typeof kept.turns !== 'number') return undefined
    return { v: 1, seed, turns: Math.max(0, Math.floor(kept.turns)) + 1 }
  },

  describe: s => `${s.tree.steps} ${s.tree.steps === 1 ? 'twig' : 'twigs'} from ${s.turns} ${s.turns === 1 ? 'turn' : 'turns'}`,

  tick(s, input, out) {
    const { tick, mood } = input
    s.moodTicks = mood === s.mood ? s.moodTicks + 1 : 0
    s.mood = mood
    const season = seasonOf(input.month)

    if (input.turnsEnded > 0) {
      s.turns += input.turnsEnded
      s.glad = 12
      if (stepsFor(s.turns) > s.tree.steps) {
        // Every step the turns have earned; the last one grows in where you can see it.
        let node = leader(s.tree)
        let isNew = false
        while (stepsFor(s.turns) > s.tree.steps) {
          const before = s.tree.x.length
          node = grow(s.tree)
          isNew = s.tree.x.length > before
        }
        weigh(s.tree)
        s.spark = { node, left: 10 }
        if (isNew) s.growing = { node, left: GROW_TICKS }
      } else {
        // No twig this time (it is older now and grows slower), but it noticed: the leader glints.
        s.spark = { node: leader(s.tree), left: 6 }
      }
    }

    // Sway: strong while talking, calm idle, held still while pondering.
    const want = mood === 'talk' ? 1.7 : mood === 'busy' ? 1.15 : mood === 'ponder' ? 0 : 1
    s.sway += (want - s.sway) * 0.25

    draw(s, input, season, out)

    if (s.growing !== undefined && --s.growing.left <= 0) s.growing = undefined
    if (s.spark !== undefined && --s.spark.left <= 0) s.spark = undefined
    if (s.glad > 0) s.glad--
  },
}

function draw(s: BonsaiState, input: TickInput, season: Season, out: Frame): void {
  const { tick, mood } = input
  const t = s.tree
  const d = s.dots
  d.clear()
  clearFrame(out)

  // Each node sways with its height: the top moves most, the trunk base not at all.
  const period = mood === 'talk' ? 10 : 26
  const n = t.x.length
  const sx = new Array<number>(n)
  const sy = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const lift = clamp((RIM - t.y[i]!) / (RIM - 1), 0, 1)
    const wave = Math.sin((TAU * tick) / period - t.x[i]! * 0.12 + (s.seed & 7))
    sx[i] = t.x[i]! + s.sway * 0.9 * lift * lift * wave
    sy[i] = t.y[i]!
  }

  // The twig growing in: its node slides out from its parent.
  const g = s.growing
  if (g !== undefined) {
    const p = t.parent[g.node]!
    const k = 1 - g.left / GROW_TICKS
    sx[g.node] = sx[p]! + (sx[g.node]! - sx[p]!) * k
    sy[g.node] = sy[p]! + (sy[g.node]! - sy[p]!) * k
  }

  // Wood: thicker toward the base (pipe model), with a root flare once it is old.
  for (let i = 1; i < n; i++) {
    const p = t.parent[i]!
    lineOver(d, sx[p]!, sy[p]!, sx[i]!, sy[i]!, BARK)
    const thick = t.weight[i]! >= 30 ? 3 : t.weight[i]! >= 10 ? 2 : 1
    if (thick >= 2) lineOver(d, sx[p]! + 1, sy[p]!, sx[i]! + 1, sy[i]!, BARK)
    if (thick >= 3) lineOver(d, sx[p]! - 1, sy[p]! + 0.5, sx[i]! - 1, sy[i]! + 0.5, BARK)
  }
  if (t.steps >= 25) {
    d.over(BASE_X - 2, RIM - 1, BARK)
    d.over(BASE_X + 2, RIM - 1, BARK)
    d.over(BASE_X - 1, RIM - 1, BARK)
    d.over(BASE_X + 1, RIM - 1, BARK)
  }

  // Foliage: a cloud-shaped pad on every tip, flat underneath, dotted by a
  // stable hash (so it never boils), denser where the tip is boxed in.
  const leaf = LEAF_OF[season]
  const young = t.steps < 4
  for (const tip of t.tips) {
    if (g !== undefined && tip === g.node && g.left > 2) continue
    const pad = t.pad.get(tip)!
    const age = t.steps - t.born[tip]!
    // A pad clothes the last stretch of its branch: biggest at the tip, smaller on the two nodes behind it.
    let node = tip
    for (let k = 0; k < (young ? 1 : 3) && node > 0; k++) {
      const r = young ? 1.2 : (1.5 + Math.min(pad, 2) * 0.2 + Math.min(age, 8) * 0.04) * (1 - k * 0.22)
      cloud(d, s.seed + tip * 3 + k, sx[node]!, sy[node]! - 0.7, r, season, leaf, t.steps, pad)
      node = t.parent[node]!
      if (node === 0) break
    }
  }

  // Busy: the bud on the leader glows, the twig the next finished turn may grow.
  if (mood === 'busy' || mood === 'ponder') {
    const tip = leader(t)
    const on = mood === 'busy' ? Math.floor(tick / 3) % 2 === 0 : Math.floor(tick / 4) % 2 === 0
    if (on) {
      d.set(sx[tip]!, sy[tip]! - 1, BUD)
      d.set(sx[tip]! + 1, sy[tip]! - 1, BUD)
    }
  }
  // Where the finished turn grew, a twinkle: a plus, then a cross, shrinking away.
  const sp = s.spark
  if (sp !== undefined && (g === undefined || g.left <= GROW_TICKS - 3)) {
    const x = sx[sp.node]!
    const y = sy[sp.node]! - 1
    const arm = sp.left > 4 ? 2 : 1
    const shape = sp.left % 2 === 0 ? [[0, -arm], [0, arm], [-arm, 0], [arm, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]]
    d.set(x, y, BUD)
    for (const [dx, dy] of shape) d.set(x + dx!, y + dy!, BUD)
  }

  // Now and then a leaf lets go (more in autumn), or snow drifts past in winter.
  if (mood === 'idle' && s.falling.length < 2) {
    const odds = season === 'autumn' ? 1 / 60 : season === 'winter' ? 1 / 70 : 1 / 160
    if (s.life.chance(odds) && t.tips.length > 0 && t.steps >= 6) {
      const tip = t.tips[s.life.int(0, t.tips.length - 1)]!
      s.falling.push({ x: sx[tip]! + s.life.range(-2, 2), y: sy[tip]! + 1, ink: season === 'winter' ? SNOW : season === 'spring' ? BLOSSOM : leaf, age: 0 })
    }
  }
  s.falling = s.falling.filter(f => f.y < RIM - 1)
  for (const f of s.falling) {
    f.age++
    f.y += 0.5
    f.x += Math.sin(f.age * 0.6) * 0.6
    d.set(f.x, f.y, f.ink)
  }

  // The pot, then its face.
  for (let row = 0; row < POT_ART.length; row++) {
    const line = POT_ART[row]!
    for (let x = 0; x < line.length; x++) if (line[x] === '#') d.over(x, RIM + row, POT)
  }
  const face = faceOf(s, mood, tick)
  // Busy, it watches the work to its left; pondering, it looks away to think.
  const look = mood === 'busy' ? -1 : mood === 'ponder' ? 1 : 0
  stampArt(d, face.eyes, EYES_AT.x + look, EYES_AT.y, FACE)
  stampArt(d, face.mouth, MOUTH_AT.x + look, MOUTH_AT.y, FACE)

  packFrame(d, out)
}

/**
 * One foliage pad: a cloud, rounded on top and flat underneath, its dots
 * picked by a hash keyed to the pad (so a swaying pad keeps its pattern and
 * never boils), denser at the crown.
 */
function cloud(d: Dots, key: number, cx: number, cy: number, r: number, season: Season, leaf: number, steps: number, pad: number): void {
  const rx = r * 1.55
  const ry = r * 0.8
  const winter = season === 'winter'
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry * 0.45); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const q = nx * nx + ny * ny
      if (q > 1) continue
      const lx = Math.round(x - cx + 8)
      const ly = Math.round(y - cy + 8)
      const fill = (winter ? 0.34 : 0.5 + pad * 0.04) + (ny < 0 ? 0.18 : 0) - q * 0.12
      if (hash01(key, lx, ly) > fill) continue
      let ink = leaf
      if (season === 'spring' && steps >= 12 && hash01(key, lx + 40, ly) < 0.06) ink = BLOSSOM
      if (winter && ny < -0.35) ink = SNOW
      d.over(x, y, ink)
    }
  }
}

function faceOf(s: BonsaiState, mood: Mood, tick: number): Face {
  if (s.glad > 0) return { eyes: EYES.happy, mouth: MOUTHS.smile }
  if (mood === 'talk') {
    const open = [1, 1, 0, 1, 0, 0, 1, 0][tick % 8] === 1
    return { eyes: EYES.open, mouth: open ? MOUTHS.open : MOUTHS.flat }
  }
  if (mood === 'ponder') return { eyes: EYES.open, mouth: MOUTHS.flat }
  // Blink every few seconds, at an uneven pace.
  s.nextBlink--
  if (s.nextBlink <= 0) {
    if (s.nextBlink <= -1) s.nextBlink = s.life.int(14, 36)
    return { eyes: EYES.blink, mouth: MOUTHS.smile }
  }
  return { eyes: EYES.open, mouth: mood === 'busy' ? MOUTHS.flat : MOUTHS.smile }
}

function stampArt(d: Dots, art: readonly string[], ox: number, oy: number, ink: number): void {
  for (let y = 0; y < art.length; y++) {
    const line = art[y]!
    for (let x = 0; x < line.length; x++) if (line[x] === '#') d.set(ox + x, oy + y, ink)
  }
}
