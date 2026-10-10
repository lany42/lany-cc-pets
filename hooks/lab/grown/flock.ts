// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Flock: a murmuration of starlings who believe they are one bird. Most of
// the time they sit on a wire, shuffling and looking about. When Claude works
// they lift off and wheel overhead (a few keep it up through a long turn while
// the rest settle back); when they ponder they circle; and when they have
// something to say, every bird flies to its place in a face, and the face
// talks. Then they go home to their own spot on the wire.
import { clamp } from '../util'
import { clearFrame, Dots, hash01, packFrame, rng, TAU } from './core'
import type { Frame, GenPet, Ink, Mood, Rng, TickInput } from './core'

const COLS = 24
const ROWS = 4
const W = COLS * 2
const H = ROWS * 4
const CX = W / 2

const WIRE = 1
const BIRD = 2
const SHEEN_A = 3
const SHEEN_B = 4
const EYE = 5
const INKS: readonly Ink[] = [
  { name: 'none', dark: 0, light: 0, key: 'text' },
  { name: 'wire', dark: 0x5d676c, light: 0x98a1a6, key: 'subtle' },
  { name: 'bird', dark: 0xd3d6e4, light: 0x2c3046, key: 'text' },
  // A starling's sheen: now and then one glints violet or green.
  { name: 'sheen-violet', dark: 0xc4a8f2, light: 0x6a3fb8, key: 'planMode' },
  { name: 'sheen-green', dark: 0x9ee0b8, light: 0x1f7a4a, key: 'success' },
  { name: 'eye', dark: 0xffffff, light: 0x101320, key: 'text' },
]

/** The wire sags between its two poles: y at x. (`wire` is kept for a second wire, unused.) */
const wireY = (_wire: number, x: number): number => {
  const u = (x - CX) / (CX - 2)
  return 11.2 + 3.2 * (1 - u * u)
}

type Bird = {
  x: number
  y: number
  vx: number
  vy: number
  /** Its own spot: which wire, and where along it. */
  wire: number
  home: number
  isPerched: boolean
  /** Which way its head turns while perched: -1, 0, 1. */
  look: number
  /** Ticks left of a short flight of its own (a sortie), and where to. */
  sortie: number
  sx: number
  sy: number
  /** Ticks left of a hop (a little jump on the wire). */
  hop: number
}

export type FlockState = {
  seed: number
  birds: Bird[]
  /** Each bird's place in the face, fixed when the face starts forming. */
  faceSlot: number[]
  mood: Mood
  moodTicks: number
  /** Ticks to the face's next blink. */
  blink: number
  life: Rng
  dots: Dots
}

export const flock: GenPet<FlockState> = {
  id: 'flock',
  name: 'Flock',
  persona: 'a murmuration of starlings on a wire who believe, together, that they are one bird',
  cols: COLS,
  rows: ROWS,
  inks: INKS,

  born(seed) {
    const r = rng(seed ^ 0xf10c)
    const n = r.int(18, 22)
    // Perches in little clusters along the wire, two dots apart at least.
    const taken: boolean[][] = [new Array(W).fill(false)]
    const birds: Bird[] = []
    for (let i = 0; i < n; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const wire = 0
        const near = birds.length > 0 && r.chance(0.6) ? birds[r.int(0, birds.length - 1)]!.home + (r.chance(0.5) ? 2 : -2) : r.int(4, W - 5)
        const home = Math.round(near)
        if (home < 4 || home > W - 5 || taken[wire]![home] || taken[wire]![home - 1] || taken[wire]![home + 1]) continue
        taken[wire]![home] = true
        const y = wireY(wire, home) - 1
        birds.push({ x: home, y, vx: 0, vy: 0, wire, home, isPerched: true, look: r.int(-1, 1), sortie: 0, sx: 0, sy: 0, hop: 0 })
        break
      }
    }
    return { seed, birds, faceSlot: [], mood: 'idle', moodTicks: 0, blink: 20, life: rng(seed ^ 0xb1d5), dots: new Dots(COLS, ROWS) }
  },

  describe: s => `${s.birds.length} starlings`,

  tick(s, input, out) {
    step(s, input)
    draw(s, input, out)
  },
}

// ---------------------------------------------------------------------------
// Where each bird wants to be

/** How many face places are features (eyes, then mouth); the rest are stragglers circling it. */
const FEATURES = 17

/**
 * The face's places for `n` birds, in the sky above the wire: two eyes of four
 * birds, a mouth of nine (a smile, or an O while a word is out), and the
 * stragglers circling round it. It looks a little left, toward its bubble.
 */
function facePlaces(n: number, isOpen: boolean, isBlink: boolean, tick: number): [number, number][] {
  const look = -2
  const places: [number, number][] = []
  // Each eye is four birds filling the middle of one cell (a crisp ⠶): x even, rows 1-2.
  for (const ex of [CX - 10 + look, CX + 8 + look]) {
    if (isBlink) places.push([ex - 1, 2], [ex, 2], [ex + 1, 2], [ex + 2, 2])
    else places.push([ex, 1], [ex + 1, 1], [ex, 2], [ex + 1, 2])
  }
  // The mouth: a wide smile; talking, its middle drops open into a D, each
  // bird moving two dots at most, so the mouth can open and shut in a tick.
  const SMILE: readonly [number, number][] = [[-8, 5], [-6, 6.4], [-4, 7.3], [-2, 7.8], [0, 8], [2, 7.8], [4, 7.3], [6, 6.4], [8, 5]]
  const OPEN: readonly [number, number][] = [[-8, 5], [-6, 7], [-4, 5.6], [-2, 9.2], [0, 5.6], [2, 9.2], [4, 5.6], [6, 7], [8, 5]]
  for (const [x, y] of isOpen ? OPEN : SMILE) places.push([CX + look + x, y])
  const rest = n - places.length
  for (let i = 0; i < rest; i++) {
    const a = (TAU * i) / rest + tick * 0.12
    places.push([CX + look + 17 * Math.cos(a), 4.5 + 4.5 * Math.sin(a)])
  }
  return places
}

/** Gives each bird a face place, matching birds and places by angle round the middle, so no paths cross much. */
function assignFace(s: FlockState): void {
  const places = facePlaces(s.birds.length, false, false, 0)
  const angle = (x: number, y: number) => Math.atan2((y - 5) * 2, x - CX)
  const birds = s.birds.map((b, i) => [i, angle(b.x, b.y)] as const).sort((a, b) => a[1] - b[1])
  const slots = places.map((p, i) => [i, angle(p[0], p[1])] as const).sort((a, b) => a[1] - b[1])
  // Rotate the matching to the best offset (fewest total distance).
  let best = 0
  let bestCost = Infinity
  for (let off = 0; off < slots.length; off++) {
    let cost = 0
    for (let k = 0; k < birds.length; k++) {
      const b = s.birds[birds[k]![0]]!
      const p = places[slots[(k + off) % slots.length]![0]]!
      cost += Math.hypot(b.x - p[0], b.y - p[1])
    }
    if (cost < bestCost) {
      bestCost = cost
      best = off
    }
  }
  s.faceSlot = new Array(s.birds.length)
  birds.forEach(([i], k) => (s.faceSlot[i] = slots[(k + best) % slots.length]![0]))
}

/** How many birds fly while busy: all of them at first, then most settle back and a few keep wheeling. */
function flyers(s: FlockState): number {
  const n = s.birds.length
  if (s.moodTicks < 48) return n
  return Math.max(5, Math.round(n - (n * 0.8 * Math.min(1, (s.moodTicks - 48) / 60))))
}

function step(s: FlockState, input: TickInput): void {
  const { mood, tick } = input
  s.moodTicks = mood === s.mood ? s.moodTicks + 1 : 0
  if (mood === 'talk' && (s.mood !== 'talk' || s.faceSlot.length === 0)) assignFace(s)
  s.mood = mood

  const n = s.birds.length
  s.blink--
  if (s.blink < -1) s.blink = s.life.int(10, 20)
  const talkOpen = [1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1][tick % 12] === 1
  const face = mood === 'talk' ? facePlaces(n, talkOpen, s.blink <= 0, tick) : undefined
  const flying = mood === 'busy' ? flyers(s) : 0

  // The flock's middle and heading, for the wheeling birds.
  let mx = 0
  let my = 0
  let mvx = 0
  let mvy = 0
  let m = 0
  for (const b of s.birds) {
    if (b.isPerched) continue
    mx += b.x
    my += b.y
    mvx += b.vx
    mvy += b.vy
    m++
  }
  if (m > 0) {
    mx /= m
    my /= m
    mvx /= m
    mvy /= m
  }
  // Where the murmuration is heading: a slow figure of eight over the wires.
  const lead = { x: CX + 15 * Math.sin(tick * 0.045), y: 5 + 3 * Math.sin(tick * 0.09) }

  s.birds.forEach((b, i) => {
    let target: [number, number] | undefined
    let mode: 'go' | 'wheel' | 'home' = 'home'
    if (face !== undefined) {
      const p = face[s.faceSlot[i] ?? i]!
      target = [p[0] + (hash01(i, tick >> 1, 3) - 0.5) * 0.5, p[1]]
      mode = 'go'
    } else if (mood === 'ponder') {
      const a = (TAU * i) / n + tick * 0.07
      target = [CX + 11 * Math.cos(a), 5.5 + 4.5 * Math.sin(a)]
      mode = 'go'
    } else if (i < flying) {
      mode = 'wheel'
    } else if (b.sortie > 0) {
      b.sortie--
      target = b.sortie > 5 ? [b.sx, b.sy] : undefined
      mode = target === undefined ? 'home' : 'go'
    }

    if (mode === 'home' && b.isPerched) {
      perchLife(s, b, input)
      return
    }
    b.isPerched = false

    if (mode === 'wheel') {
      // Boids: cohesion, alignment, separation, and a pull toward the lead.
      let ax = (mx - b.x) * 0.012 + (mvx - b.vx) * 0.12 + (lead.x - b.x) * 0.01
      let ay = (my - b.y) * 0.012 + (mvy - b.vy) * 0.12 + (lead.y - b.y) * 0.014
      for (const o of s.birds) {
        if (o === b || o.isPerched) continue
        const dx = b.x - o.x
        const dy = b.y - o.y
        const d2 = dx * dx + dy * dy
        if (d2 < 4 && d2 > 0) {
          ax += (dx / d2) * 0.35
          ay += (dy / d2) * 0.35
        }
      }
      // Stay inside the field, softly.
      if (b.y < 1) ay += 0.15
      if (b.y > 10) ay -= 0.15
      if (b.x < 2) ax += 0.15
      if (b.x > W - 3) ax -= 0.15
      b.vx += ax
      b.vy += ay
      const speed = Math.hypot(b.vx, b.vy)
      const clampTo = clamp(speed, 0.45, 1.05)
      if (speed > 0) {
        b.vx *= clampTo / speed
        b.vy *= clampTo / speed
      }
    } else {
      // Fly to a place, arriving gently; home is the bird's own spot on the wire.
      const [tx, ty] = target ?? [b.home, wireY(b.wire, b.home) - 1]
      const dx = tx - b.x
      const dy = ty - b.y
      const dist = Math.hypot(dx, dy)
      const fast = mode === 'go' && mood === 'talk' ? 3.2 : 1.6
      const want = Math.min(fast, dist * 0.45)
      const k = dist > 0 ? want / dist : 0
      b.vx += (dx * k - b.vx) * 0.55
      b.vy += (dy * k - b.vy) * 0.55
      if (target === undefined && dist < 0.7) {
        b.x = b.home
        b.y = wireY(b.wire, b.home) - 1
        b.vx = b.vy = 0
        b.isPerched = true
        return
      }
    }
    b.x = clamp(b.x + b.vx, 0, W - 1)
    b.y = clamp(b.y + b.vy, 0, H - 1)
  })

  // A finished turn, while they sit: a wave of little hops runs down the wires.
  if (input.turnsEnded > 0) s.birds.forEach(b => b.isPerched && (b.hop = -Math.round(b.home / 4)))
}

/** A perched bird's small life: it looks about, shuffles, and now and then takes a short flight. */
function perchLife(s: FlockState, b: Bird, input: TickInput): void {
  const r = s.life
  if (b.hop < 0) b.hop++
  if (r.chance(1 / 90)) b.look = r.int(-1, 1)
  if (input.mood === 'idle' && r.chance(1 / 700)) {
    // Shuffle one step along the wire, if the spot is free.
    const to = b.home + (r.chance(0.5) ? 2 : -2)
    const free = to > 2 && to < W - 3 && !s.birds.some(o => o !== b && o.wire === b.wire && Math.abs(o.home - to) < 2)
    if (free) {
      b.home = to
      b.x = to
      b.y = wireY(b.wire, to) - 1
    }
  }
  if (input.mood === 'idle' && r.chance(1 / 1400)) {
    b.sortie = r.int(12, 18)
    b.sx = clamp(b.home + r.range(-10, 10), 3, W - 4)
    b.sy = r.range(1, 4)
  }
}

// ---------------------------------------------------------------------------

function draw(s: FlockState, input: TickInput, out: Frame): void {
  const { tick, mood } = input
  const d = s.dots
  d.clear()
  clearFrame(out)

  // The wire, sagging between two poles with a crossbar each.
  for (let x = 2; x < W - 2; x++) d.set(x, wireY(0, x), WIRE)
  for (const px of [1, W - 2]) {
    for (let y = 10; y < H; y++) d.set(px, y, WIRE)
    d.set(px - 1, 10, WIRE)
    d.set(px + 1, 10, WIRE)
  }

  const face = mood === 'talk'
  s.birds.forEach((b, i) => {
    // Most of the time a starling is dark and plain; now and then one catches the light.
    const glint = hash01(s.seed + i, tick >> 3, 11)
    const ink = glint < 0.05 ? SHEEN_A : glint < 0.1 ? SHEEN_B : BIRD
    if (b.isPerched) {
      // Sitting: a body on the wire and a head above it, turned this way or that.
      const hop = b.hop < 0 && b.hop > -3 ? -1 : 0
      d.over(b.x, b.y + hop, ink)
      d.over(b.x + (b.look > 0 ? 1 : 0), b.y - 1 + hop, ink)
      return
    }
    const isFeature = face && (s.faceSlot[i] ?? 99) < FEATURES
    d.over(b.x, b.y, isFeature ? EYE : ink)
  })

  packFrame(d, out)
}

