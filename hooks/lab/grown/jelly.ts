// Jelly: a moon jellyfish with a face, simulated rather than drawn. Its bell
// pulses (squeeze, glide, sink), and its tentacles are verlet ropes that trail
// behind every stroke and sway in a slow current. Each seed is its own
// species: how many tentacles, how long, how wide a bell, which colors.
import { clamp } from '../util'
import { approach, clearFrame, Dots, lineOver, noise1, packFrame, rng } from './core'
import type { Frame, GenPet, Ink, Mood, Rng, TickInput } from './core'

const COLS = 12
const ROWS = 5
const W = COLS * 2
const H = ROWS * 4
/** Verlet sub-steps per tick and constraint passes per sub-step. */
const SUBSTEPS = 2
const PASSES = 3

// Inks per species, back to front: tentacle, oral arm, bell, glow, face.
// The face is a pale tint of the bell, not white: a braille cell has one
// color, so when an eye shares a cell with the bell's crown the crown takes the
// eye's color, and a tint reads there as a shine rather than a white smear.
const ROLES = 5
const TENTACLE = 1
const ARM = 2
const BELL = 3
const GLOW = 4
const FACE = 5
type Species = { name: string; inks: readonly Omit<Ink, 'name'>[] }
const SPECIES: readonly Species[] = [
  {
    name: 'moon',
    inks: [
      { dark: 0xd49ac6, light: 0x9a3d84, key: 'bashBorder' },
      { dark: 0xe8bfe0, light: 0xb0509a, key: 'bashBorder' },
      { dark: 0x9fd6ea, light: 0x2a7896, key: 'ide' },
      { dark: 0xffd9f4, light: 0x6a2fa8, key: 'planMode' },
      { dark: 0xe2f6ff, light: 0x0e3e52, key: 'text' },
    ],
  },
  {
    name: 'nettle',
    inks: [
      { dark: 0xe0905a, light: 0xa34a14, key: 'warning' },
      { dark: 0xf0b884, light: 0xb8621e, key: 'warning' },
      { dark: 0xf2c879, light: 0x9a6a00, key: 'warning' },
      { dark: 0xffe2a8, light: 0xc0392b, key: 'error' },
      { dark: 0xfff3d6, light: 0x4a3200, key: 'text' },
    ],
  },
  {
    name: 'crystal',
    inks: [
      { dark: 0x7fd3c3, light: 0x16786a, key: 'success' },
      { dark: 0xa8e6da, light: 0x1f8f7e, key: 'success' },
      { dark: 0xb4bef5, light: 0x4a55b0, key: 'suggestion' },
      { dark: 0xc8fff2, light: 0x0d5c8c, key: 'ide' },
      { dark: 0xe8ecff, light: 0x1d2466, key: 'text' },
    ],
  },
]
const INKS: readonly Ink[] = [
  { name: 'none', dark: 0, light: 0, key: 'text' },
  ...SPECIES.flatMap(sp => sp.inks.map((ink, i) => ({ ...ink, name: `${sp.name}-${['tentacle', 'arm', 'bell', 'glow', 'face'][i]}` }))),
]

type Rope = {
  /** Positions and previous positions, in dots. */
  x: Float64Array
  y: Float64Array
  px: Float64Array
  py: Float64Array
  /** Where on the rim it hangs from: -1 (left edge) to 1 (right edge). */
  at: number
  seg: number
  /** Oral arms are frilly and short; tentacles are fine and long. */
  isArm: boolean
}

export type JellyState = {
  seed: number
  species: number
  /** Bell radius (dots) at rest. */
  radius: number
  ropes: Rope[]
  /** The bell's centre (the rim's middle), its velocity, and where it likes to hover. */
  x: number
  y: number
  vy: number
  homeX: number
  homeY: number
  /** Pulse phase in [0, 1): squeeze from 0 to SQUEEZE, then glide and sink. */
  phase: number
  /** The squeeze of the bell now, 0 (relaxed) to 1 (squeezed). */
  squeeze: number
  /** A bioluminescent wave running down the tentacles: its front, in rope nodes (or -1). */
  wave: number
  /** Ticks to the next blink. */
  blink: number
  /** How tightly the tentacles curl (pondering). */
  curl: number
  life: Rng
  dots: Dots
}

const SQUEEZE = 0.28

export const jelly: GenPet<JellyState> = {
  id: 'jelly',
  name: 'Jelly',
  persona: 'a small jellyfish who drifts beside the terminal and pulses when it has something to say',
  cols: COLS,
  rows: ROWS,
  inks: INKS,

  born(seed) {
    const r = rng(seed ^ 0x1e11)
    const species = r.int(0, SPECIES.length - 1)
    const radius = r.range(5.2, 6.4)
    const tentacles = r.int(4, 6)
    const length = r.int(7, 9)
    const homeX = W / 2 + 0.5
    const homeY = 8.5
    const ropes: Rope[] = []
    const make = (at: number, n: number, seg: number, isArm: boolean): Rope => {
      const rope: Rope = { x: new Float64Array(n), y: new Float64Array(n), px: new Float64Array(n), py: new Float64Array(n), at, seg, isArm }
      for (let i = 0; i < n; i++) {
        rope.x[i] = rope.px[i] = homeX + at * radius * 0.85
        rope.y[i] = rope.py[i] = homeY + 1 + i * seg
      }
      return rope
    }
    for (let i = 0; i < tentacles; i++) {
      const at = -0.9 + (1.8 * i) / (tentacles - 1)
      ropes.push(make(at, length + (Math.abs(at) < 0.5 ? 0 : -1), 1.35, false))
    }
    ropes.push(make(-0.2, 4, 1.3, true), make(0.2, 4, 1.3, true))
    return {
      seed,
      species,
      radius,
      ropes,
      x: homeX,
      y: homeY,
      vy: 0,
      homeX,
      homeY,
      phase: r.next(),
      squeeze: 0,
      wave: -1,
      blink: 10,
      curl: 0,
      life: rng(seed ^ 0xb10b),
      dots: new Dots(COLS, ROWS),
    }
  },

  describe: s => `a ${SPECIES[s.species]!.name} jelly with ${s.ropes.filter(r => !r.isArm).length} tentacles`,

  tick(s, input, out) {
    step(s, input)
    draw(s, input, out)
  },
}

/** How long one pulse lasts, in ticks, by mood (0: no pulsing). */
const PERIOD: Record<Mood, number> = { idle: 18, busy: 10, ponder: 0, talk: 7 }

function step(s: JellyState, input: TickInput): void {
  const { mood, tick } = input
  if (input.spoke) s.wave = 0

  // The pulse: squeeze fast, relax slow. Pondering, it stops and just drifts.
  const period = PERIOD[mood]
  let thrust = 0
  if (period > 0) {
    const before = s.phase
    s.phase = (s.phase + 1 / period) % 1
    if (before < SQUEEZE && s.phase >= SQUEEZE) thrust = 0
    if (s.phase < SQUEEZE) thrust = mood === 'busy' ? 0.42 : 0.34
  }
  const target = period > 0 && s.phase < SQUEEZE ? Math.sin((Math.PI / 2) * (s.phase / SQUEEZE)) : 0
  s.squeeze = target > s.squeeze ? target : approach(s.squeeze, target, 0.18)

  // The body: a stroke pushes up, then it sinks; a soft spring keeps it home.
  // It hovers a little higher while busy, and wanders along a slow current.
  const homeY = s.homeY + (mood === 'busy' ? -0.8 : mood === 'ponder' ? 0.6 : 0)
  s.vy += -thrust + 0.045 + (homeY - s.y) * 0.03
  s.vy *= 0.78
  s.y = clamp(s.y + s.vy, 6.5, 10)
  const drift = noise1(s.seed, tick / 40) * 2.2
  s.x = approach(s.x, s.homeX + drift, 0.08)

  s.curl = approach(s.curl, mood === 'ponder' ? 1 : 0, 0.08)

  // Tentacles: verlet ropes hung from the rim, which moves with the bell.
  const current = noise1(s.seed + 9, tick / 24) * 0.03
  const rx = s.radius * (1 - 0.24 * s.squeeze)
  for (let sub = 0; sub < SUBSTEPS; sub++) {
    for (const rope of s.ropes) {
      const n = rope.x.length
      for (let i = 1; i < n; i++) {
        const vx = (rope.x[i]! - rope.px[i]!) * 0.86
        const vy = (rope.y[i]! - rope.py[i]!) * 0.86
        rope.px[i] = rope.x[i]!
        rope.py[i] = rope.y[i]!
        // Sinking water pushes them down a little; the current, and when
        // pondering, a slow curl inward, push them sideways.
        const k = i / n
        const curl = s.curl * 0.06 * k * (rope.at < 0 ? 1 : -1) * Math.cos(tick * 0.15 + i)
        // A weak spring toward a skirt shape keeps them from bunching into a rope.
        const rest = s.x + rope.at * rx * (0.9 + k * 0.35)
        rope.x[i] = rope.x[i]! + vx + current * k + curl + (rest - rope.x[i]!) * 0.025
        rope.y[i] = rope.y[i]! + vy + 0.035 - s.curl * 0.02 * k
      }
      rope.x[0] = rope.px[0] = s.x + rope.at * rx * (rope.isArm ? 1 : 0.9)
      rope.y[0] = rope.py[0] = s.y + (rope.isArm ? 0.5 : 0.8)
      for (let pass = 0; pass < PASSES; pass++) {
        for (let i = 1; i < n; i++) {
          const dx = rope.x[i]! - rope.x[i - 1]!
          const dy = rope.y[i]! - rope.y[i - 1]!
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001
          const pull = (dist - rope.seg) / dist
          if (i === 1) {
            rope.x[i] = rope.x[i]! - dx * pull
            rope.y[i] = rope.y[i]! - dy * pull
          } else {
            rope.x[i - 1] = rope.x[i - 1]! + dx * pull * 0.5
            rope.y[i - 1] = rope.y[i - 1]! + dy * pull * 0.5
            rope.x[i] = rope.x[i]! - dx * pull * 0.5
            rope.y[i] = rope.y[i]! - dy * pull * 0.5
          }
        }
        // Keep the tentacles under the bell, and inside the field.
        for (let i = 1; i < n; i++) {
          if (rope.y[i]! < s.y + 0.5) rope.y[i] = s.y + 0.5
          rope.x[i] = clamp(rope.x[i]!, 0, W - 1)
          rope.y[i] = clamp(rope.y[i]!, 0, H - 1)
        }
      }
    }
  }

  if (s.wave >= 0) s.wave = s.wave > 14 ? -1 : s.wave + 1
  s.blink--
  if (s.blink < -1) s.blink = s.life.int(12, 34)
}

function draw(s: JellyState, input: TickInput, out: Frame): void {
  const { mood, tick } = input
  const d = s.dots
  d.clear()
  clearFrame(out)
  const base = s.species * ROLES

  // Tentacles first (they hang behind the bell); oral arms are frilled.
  for (const rope of s.ropes) {
    const n = rope.x.length
    for (let i = 1; i < n; i++) {
      const lit = s.wave >= 0 && i >= 2 && !rope.isArm && Math.abs(i - s.wave * 0.7) < 0.8
      const ink = base + (lit ? GLOW : rope.isArm ? ARM : TENTACLE)
      lineOver(d, rope.x[i - 1]!, rope.y[i - 1]!, rope.x[i]!, rope.y[i]!, ink)
      if (rope.isArm && i % 2 === 1 && i < n - 1) d.over(rope.x[i]! + (rope.at < 0 ? -1 : 1), rope.y[i]!, ink)
    }
  }

  // The bell: a dome that narrows and lifts as it squeezes, with a scalloped
  // margin and a faint ring inside, as a moon jelly's.
  const rx = s.radius * (1 - 0.24 * s.squeeze)
  const ry = s.radius * 0.88 * (1 + 0.16 * s.squeeze)
  const bell = base + BELL
  const cx = s.x
  const cy = s.y
  const steps = 28
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (Math.PI * i) / steps
    d.over(cx + rx * Math.cos(a), cy + ry * Math.sin(a), bell)
  }
  // The margin: scallops along the bell's mouth.
  for (let x = -rx + 1; x <= rx - 1; x += 1) {
    const lip = Math.round(x + rx) % 3 === 0 ? 0.6 : 0
    d.over(cx + x, cy + lip, bell)
  }
  // Pondering, a glint runs round the rim, a thought going round and round.
  if (mood === 'ponder') {
    const a = Math.PI + ((tick % 12) / 11) * Math.PI
    d.set(cx + rx * Math.cos(a), cy + ry * Math.sin(a), base + GLOW)
  }

  // The face: two eyes in the middle of the bell, clear of its edge so they
  // keep their own cells; a mouth only while it talks, opening on each stroke.
  const face = base + FACE
  const lookY = mood === 'ponder' ? -1 : 0
  const ex = Math.round(cx)
  const ey = Math.round(cy - ry * 0.64) + lookY
  const shut = s.blink <= 0
  for (const x of [ex - 2, ex + 1]) {
    d.set(x, ey + 1, face)
    if (!shut) d.set(x, ey, face)
  }
  if (mood === 'talk') {
    d.set(ex - 1, ey + 2, face)
    d.set(ex, ey + 2, face)
    if (s.squeeze > 0.3) {
      d.set(ex - 1, ey + 3, face)
      d.set(ex, ey + 3, face)
    }
  }

  packFrame(d, out)
}
