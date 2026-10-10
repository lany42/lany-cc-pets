// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Deep Water: a strip of open sea seen from below the surface. Light comes
// down in slow slanted rays; marine snow drifts through them; kelp sways at
// the right. In the water hangs a moon jellyfish, the pet: a glassy bell with
// its four pink loops showing through, frilled arms and long fine tentacles.
// It swims the way jellies do: a squeeze, a long slow relax, a rest.
//
// The jellyfish moves below the dot. Its bell, strands and arms are drawn from
// continuous numbers, and each part reads where the bell was a moment ago, the
// lower the later: a squeeze starts at the margin and runs down the strands as
// a wave, so they trail rather than snap. Its parts take their new places only
// as far as the tick's share of the room allows (what the water has not used);
// a part that would overspend waits a tick, and trails a little more.
//
// The band is its core: surface, jellyfish, kelp and sand, six rows. A taller
// room adds water round that core, 30 above to 70 below, and in a tall one the
// jellyfish grows (a hero, up to 1.6 times, its loops a ring of four):
//   above, near the light   the surface glints; a school of silver sardines
//           wheels on a slow figure of eight, flashing as it turns
//   below, the twilight     lanternfish hang in the dark, their photophores
//           blinking; a siphonophore trails its string of lights; plankton
//           glimmer, each on its own slow clock
//   below, the floor        sand, pebbles, sea pens and a glass sponge; at the
//           right a reef wall climbs to the kelp, with anemones and a sea fan;
//           and in the deep an anglerfish waits, still, its lure glowing
//   in the kelp             a garibaldi or two, bright orange
//
//   idle    one easy pulse every six seconds or so; it drifts, slowly. After
//           half a minute of quiet each pulse stirs a few motes of plankton
//           into light, and after a minute and more a comb jelly glimmers into
//           view far off, rainbows running down its combs; both go when work
//           starts
//   busy    a current runs: the snow streams sideways, its strands stream
//           back, the kelp leans, it pulses twice as often, the sardines
//           hurry, and now and then a school of small fish crosses far back
//   ponder  sparks of light run down its tentacles, one after another
//   talk    its bell flashes with each pulse, its loops glow; while its words
//           are up it holds its place and pulses where it is
//   spectacle (a long turn just ended)  a whale passes: a huge pale shadow
//           crossing the whole width far behind it, slowly, singing
import { smooth } from '../util'
import type { Dots as DotsT, Frame, Ink, Mood, SceneDef, SceneInput, SceneInstance } from './kit'
import { bayer, Dots, drawBubble, hash, ink, noise1, packFast } from './kit'

const P = {
  surface: 1, glint: 2, ray: 3, rayBright: 4, snow: 5, snowNear: 6, whaleFill: 7, whale: 8, whaleEye: 9, song: 10,
  fish: 11, sardine: 12, garibaldi: 13, lantern: 14, angler: 15, anglerLit: 16, tooth: 17, lure: 18, lureGlow: 19, lureDim: 20, stalk: 21,
  plankton: 22, sand: 23, sandDim: 24, rock: 25, rockDim: 26, sponge: 27, seaPen: 28, anemone: 29, fan: 30,
  kelp: 31, kelpLight: 32, kelpFar: 33,
  tentacle: 34, arm: 35, glow: 36, bell: 37, bellBright: 38, loop: 39, loopBright: 40, loopSoft: 41, loopSoftBright: 42,
  spark: 43, mote: 44, comb: 45, rainbow: 46, // 46..49: rose, gold, green, sky
  border: 50, words: 51,
} as const

const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
PALETTE[P.surface] = ink(0x274a62, 0xb5cddd, 1.1)
PALETTE[P.glint] = ink(0x6f97b2, 0x7c9cb4, 1.3)
PALETTE[P.ray] = ink(0x1f3d52, 0xcfdeea, 1)
PALETTE[P.rayBright] = ink(0x2c5670, 0xb5cde0, 1.1)
PALETTE[P.snow] = ink(0x3a5263, 0xb8c4cc, 1.2)
PALETTE[P.snowNear] = ink(0x5d7789, 0x93a4b0, 1.3)
PALETTE[P.whaleFill] = ink(0x1c3044, 0xd5dfe8, 1.1)
PALETTE[P.whale] = ink(0x2f4d6a, 0xa9bccd, 1.4)
PALETTE[P.whaleEye] = ink(0x5d84a8, 0x6d8aa8, 3)
PALETTE[P.song] = ink(0x2a4560, 0xb9cad8, 1.2)
PALETTE[P.fish] = ink(0x3e6a80, 0x8fb0c4, 1.5)
PALETTE[P.sardine] = ink(0x7f9fb6, 0x5f7f98, 1.6)
PALETTE[P.garibaldi] = ink(0xf0843c, 0xd2601c, 3)
PALETTE[P.lantern] = ink(0x3b4b60, 0x9eacbc, 1.3)
PALETTE[P.angler] = ink(0x463f58, 0xa69cb6, 1.3)
PALETTE[P.tooth] = ink(0xa8a294, 0x7a7262, 2)
PALETTE[P.lure] = ink(0xfff2a8, 0xb08400, 8)
PALETTE[P.lureGlow] = ink(0xa89848, 0xbfa640, 1.6)
PALETTE[P.lureDim] = ink(0x5e5836, 0xd9cd9c, 1.4)
PALETTE[P.stalk] = ink(0x5e5640, 0xb0a582, 1.4)
PALETTE[P.plankton] = ink(0x2a4652, 0xb4cad2, 1)
PALETTE[P.anglerLit] = ink(0x6e6352, 0x8c7e62, 1.4)
PALETTE[P.sand] = ink(0x4a4434, 0xbfb59a, 1.2)
PALETTE[P.sandDim] = ink(0x35322a, 0xd4ccb6, 1)
PALETTE[P.rock] = ink(0x434a58, 0x9da3ae, 1.2)
PALETTE[P.rockDim] = ink(0x2c313b, 0xc6cad2, 1)
PALETTE[P.sponge] = ink(0x8ea7ba, 0x5f7c92, 1.4)
PALETTE[P.seaPen] = ink(0xc27c5c, 0xb0583a, 2)
PALETTE[P.anemone] = ink(0xd47e9e, 0xb44a74, 2.2)
PALETTE[P.fan] = ink(0x9a5a8c, 0x8a3a78, 1.8)
PALETTE[P.kelp] = ink(0x2c5536, 0x7aa07e, 1.5)
PALETTE[P.kelpLight] = ink(0x3f7348, 0x5d8a62, 1.6)
PALETTE[P.kelpFar] = ink(0x1f3a2a, 0xb6cab8, 1.1)
PALETTE[P.tentacle] = ink(0x8c7fb4, 0x9a86c6, 1.6)
PALETTE[P.arm] = ink(0xb3a0d6, 0x8668b8, 2)
PALETTE[P.glow] = ink(0x584c78, 0xddd3ee, 1.4)
PALETTE[P.bell] = ink(0xc8b6ea, 0x7656b0, 2.5)
PALETTE[P.bellBright] = ink(0xf0e6ff, 0x5a32a0, 3)
PALETTE[P.loop] = ink(0xe597c6, 0xc0508e, 3.5)
PALETTE[P.loopBright] = ink(0xffc4e8, 0xa02a70, 4)
// a hero's loops: the same pinks, light enough that the bell's outline keeps the cells it shares with them
PALETTE[P.loopSoft] = ink(0xe597c6, 0xc0508e, 2)
PALETTE[P.loopSoftBright] = ink(0xffc4e8, 0xa02a70, 2.2)
PALETTE[P.spark] = ink(0x9ff4ff, 0x0f8aa0, 6)
PALETTE[P.mote] = ink(0x3f8796, 0x7cbcc8, 2.5)
PALETTE[P.comb] = ink(0x8a9cc0, 0x6a7ea6, 1.5)
PALETTE[P.rainbow] = ink(0xdb7fa6, 0xd0306a, 4)
PALETTE[P.rainbow + 1] = ink(0xd9bf7c, 0xa87400, 4)
PALETTE[P.rainbow + 2] = ink(0x88d8a8, 0x10905a, 4)
PALETTE[P.rainbow + 3] = ink(0x7cbce4, 0x1070c0, 4)
PALETTE[P.border] = ink(0xc8b6ea, 0x7656b0, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)

// ---------------------------------------------------------------- art
// Drawn facing left; `stamp` mirrors them. ',' clears the dot behind (an eye).

/**
 * An anglerfish (a humpback, Melanocetus) facing left at scale `A`: a round
 * dark body, a gape of needle teeth with the lower jaw jutting, a small eye,
 * and its lure on a stalk arching forward over the mouth. Dot offsets from its
 * middle with their part (0 body, 1 tooth, 2 stalk, 3 eye), and where the
 * lure hangs.
 */
function anglerArt(A: number): { dots: number[]; ex: number; ey: number } {
  const dots: number[] = []
  const seen = new Set<number>()
  const put = (x: number, y: number, part: number) => {
    x = Math.round(x); y = Math.round(y)
    const key = (y + 200) * 1000 + x + 500
    if (seen.has(key)) return
    seen.add(key)
    dots.push(x, y, part)
  }
  const rx = 11 * A, ry = 7 * A
  // the body: its outline, the head a little fuller than the tail end, open at the mouth
  const steps = Math.round(64 * A)
  for (let k = 0; k < steps; k++) {
    const a = (2 * Math.PI * k) / steps
    if (a > 2.5 && a < 3.9) continue
    const head = 1 + 0.12 * Math.max(0, -Math.cos(a))
    put(Math.cos(a) * rx * head, Math.sin(a) * ry * head * (Math.sin(a) > 0 ? 1.08 : 1), 0)
  }
  // the jaws, from the lips back to the corner of the mouth, the lower one jutting; needle teeth on both
  const cx = -rx * 0.3, cy = ry * 0.2
  const ux = Math.cos(3.9) * rx * 1.12, uy = Math.sin(3.9) * ry * 1.12
  const lx = Math.cos(2.5) * rx * 1.12 - 2 * A, ly = Math.sin(2.5) * ry * 1.17
  const n = Math.round(10 * A)
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const x1 = ux + (cx - ux) * u, y1 = uy + (cy - uy) * u
    const x2 = lx + (cx - lx) * u, y2 = ly + (cy - ly) * u
    put(x1, y1, 0)
    put(x2, y2, 0)
    if (u > 0.85) continue
    if (i % 2 === 1) { put(x1, y1 + 1, 1); if (u < 0.45) put(x1, y1 + 2, 1) }
    if (i % 2 === 0 && i > 0) { put(x2, y2 - 1, 1); if (u < 0.45) put(x2, y2 - 2, 1) }
  }
  put(-rx * 0.5, -ry * 0.4, 3)
  // the pectoral fin, and the tail's fan
  for (let k = 0; k < 4 * A; k++) put(rx * 0.1 + k * 0.7, ry * 0.4 + k * 0.5, 0)
  const tail = 4 * A
  for (let k = 0; k <= tail; k++) { put(rx + 0.5 + k * 0.9, -k * 0.85, 0); put(rx + 0.5 + k * 0.9, k * 0.85, 0) }
  for (let k = -Math.floor(tail * 0.85); k <= tail * 0.85; k += 2) put(rx + 0.5 + tail * 0.9, k, 0)
  // the lure's stalk: from the top of its head, up and forward over the mouth
  const sx = -rx * 0.25, sy = -ry * 1.02, qx = -rx * 0.85, qy = -ry * 1.85, tx = -rx * 1.3, ty = -ry * 0.95
  const m = Math.round(18 * A)
  for (let i = 0; i <= m; i++) {
    const u = i / m
    put((1 - u) ** 2 * sx + 2 * (1 - u) * u * qx + u * u * tx, (1 - u) ** 2 * sy + 2 * (1 - u) * u * qy + u * u * ty, 2)
  }
  return { dots, ex: Math.round(tx), ey: Math.round(ty + 1) }
}
/** The small fish that cross while the current runs: a body and a fin, two rows, so a step moves few dots. */
const SMALL_FISH = ['.ff.f', 'ffff.']
/** A lanternfish: a blunt head, a forked tail, and a row of photophores along its belly. */
const LANTERN = ['..bbbbb.b', '.b.....bb', '..pbpbp.b']
const GARIBALDI = ['..ooo....', '.oooooo.o', 'o,oooooooo', '.oooooo.o', '..ooo....']
/** A comb jelly: its body (c), and its comb rows (digits), down which a rainbow runs. */
const COMB = ['..cc..', '.c12c.', 'c3.41c', 'c2..3c', 'c1.24c', '.c43c.', '..cc..']
/** A glass sponge (Venus' flower basket): a vase of lattice. */
const SPONGE = [
  '..sssss..',
  '.s.s.s.s.',
  's.s.s.s.s',
  '.s.s.s.s.',
  '.s.s.s.s.',
  '..s.s.s..',
  '..s.s.s..',
  '.s.s.s.s.',
  '..s.s.s..',
  '..s.s.s..',
  '...s.s...',
  '...sss...',
]
const ANEMONE = ['a.a.a.a', '.a.a.a.', '..aaa..', '..aaa..']
/** The four oral arms: across the bell (-1 left .. 1 right) and how long. */
const ARMS: readonly (readonly [number, number])[] = [[-1, 11], [-0.35, 14], [0.35, 13], [1, 10]]
/** The loops across the bell: never quite symmetric, so as it drifts they step over one at a time. */
const LOOPS = [-0.64, -0.215, 0.235, 0.61]
/** A hero's loops, as a ring seen from a little above: their angles round it (the near ones, sin > 0, hang lower). */
const RING = [1.13, 2.71, 4.28, 5.85]
const LOOP = ['.l.', 'l.l']
const LOOP_MID = ['.ll.', 'l..l', 'l..l']
const LOOP_HERO = ['.lll.', 'l...l', 'l...l']

// ---------------------------------------------------------------- the pulse

/** How squeezed the bell is through one pulse (phase 0..1): a quick squeeze, a long relax, a rest. */
const squeezeAt = (phase: number): number => (phase < 0.4 ? smooth(phase / 0.4) : phase < 0.92 ? 1 - smooth((phase - 0.4) / 0.52) : 0)
/** How high a pulse has lifted it (0..1, and back down by the pulse's end): up with the squeeze, a long sink. */
const liftAt = (phase: number): number => (phase < 0.3 ? smooth(phase / 0.3) : 1 - smooth((phase - 0.3) / 0.7))
/** How far the ripple down its strands has moved on (0..1 a pulse): just after the squeeze, then it rests. */
const rippleAt = (phase: number): number => smooth((phase - 0.06) / 0.6)

/** The bell's height when relaxed: the band's saucer, a little rounder in a hero. */
const domeOf = (S: number): number => S * 4 * (1 + (S - 1) * 0.6)

/** Dots a tick, so the whale crosses any width in about a minute (240 ticks), never faster than it can be seen. */
const whaleSpeed = (W: number): number => Math.max(0.5, Math.min(1.4, (W + 130) / 240))

// ---------------------------------------------------------------- the room

type Layout = {
  W: number; H: number; cols: number; rows: number
  /** The jellyfish's scale: 1 in the band and the inline window, up to 1.6 in a tall one. */
  S: number
  /** The core strip, in dots: the surface down to the sand in the band; the jellyfish's water in a window. */
  coreTop: number; coreBot: number
  /** The extra rows above and below the core. */
  above: number; below: number
  bed: number
  kelp: number
  /** Where the jellyfish's rim may wander (y) and its middle (x). */
  top: number; bottom: number; xMin: number; xMax: number
  /** How many dots a pulse lifts it (none in the band: there a pulse is a squeeze), and how fast it wanders. */
  bob: number; drift: number
  /** The reef wall, when there is room for one: from its foot (x0, at the bed) up to its shelf (x1, y shelf). */
  reef: { x0: number; x1: number; shelf: number } | undefined
  /** How far down the sun's rays reach. */
  reach: number
}

function layoutOf(cols: number, rows: number): Layout {
  const W = cols * 2, H = rows * 4
  const S = rows <= 12 ? 1 : Math.round(10 * (1 + Math.min(0.6, (rows - 12) * 0.024))) / 10
  const coreRows = Math.min(rows, Math.max(6, Math.round(6 * S)))
  const extra = rows - coreRows
  const above = Math.round(extra * 0.3), below = extra - above
  const coreTop = above * 4, coreBot = (above + coreRows) * 4
  const bed = H - 2
  const kelp = W - Math.max(8, Math.round(W * (rows > 8 ? 0.07 : 0.05)))
  const top = coreTop + Math.round(6 * S), bottom = Math.max(top + 2, coreBot - Math.round(16 * S))
  const xMin = Math.max(Math.round(W * 0.35), 20), xMax = Math.max(xMin + 4, kelp - Math.round(14 * S))
  const shelf = coreBot + Math.round(below * 4 * 0.35)
  const reef = below >= 8 ? { x1: kelp - 6, x0: Math.round(kelp - 6 - (bed - shelf) * 1.1), shelf } : undefined
  const reach = H <= 48 ? H : Math.round(48 + (H - 48) * 0.55)
  return { W, H, cols, rows, S, coreTop, coreBot, above, below, bed, kelp, top, bottom, xMin, xMax, bob: rows >= 10 ? 0.75 * S : 0, drift: rows >= 10 ? 0.018 : 0.012, reef, reach }
}

/** What never moves in a room, worked out once a size. */
type Still = {
  size: string
  /** Dots drawn over the swimmers (the floor, the reef and what grows there): dot index, ink. */
  near: Int32Array
  /** 1 where the floor or the reef hides what is behind it. */
  solid: Uint8Array
  /** The floor's top, per x. */
  floor: Int16Array
  /** Which x carry a dot of the surface, and when each glints. */
  surf: Uint8Array
  /** Plankton in the dark: dot index, phase, period (ticks). */
  plankton: Int32Array
  /** Where each anglerfish's lure hangs: x, y. */
  anglers: Int16Array
  /** The garibaldi's homes among the kelp: x, y, facing. */
  garibaldi: Int16Array
  /** Lanternfish homes: x, y, period, phase. */
  lanterns: Float32Array
  /** Far kelp, behind everything that swims: dot indexes. */
  far: Int32Array
  /** A siphonophore in the twilight: its head x, y, its length and its angle; empty for none. */
  siphon: Float32Array
}

type Flake = { x: number; y: number; v: number; near: boolean }
type Fish = { x: number; y: number; k: number }
type Spark = { strand: number; along: number }
type Mote = { x: number; y: number; age: number }

const HISTORY = 64

class Deep implements SceneInstance {
  private d: DotsT = new Dots(1, 1)
  private out: Frame | undefined
  private seed: number
  private last = -1
  private mood: Mood = 'idle'
  private moodFor = 0
  private calmFor = 0
  private still: Still | undefined
  // the jellyfish: its middle (x) and its rim (y), in dots, never rounded until drawn
  private x = -1
  private y = -1
  private homeX = -1
  private homeY = -1
  private phase = 0.82
  private amp = 1
  private ripple = 0
  private stream = 0
  private flash = 0
  /** Where it was, how squeezed, and how hard the current pushed, tick by tick: its strands read it late. */
  private hx = new Float64Array(HISTORY)
  private hy = new Float64Array(HISTORY)
  private hc = new Float64Array(HISTORY)
  private hs = new Float64Array(HISTORY)
  // the water
  private snow: Flake[] = []
  private school: Fish[] = []
  private schoolAt = -1000
  private sparks: Spark[] = []
  private motes: Mote[] = []
  private sardineAt = 0
  // the comb jelly: where, how much of it shows (dots), and whether it is leaving
  private combX = 0
  private combY = 0
  private combShown = 0
  private combAt = -1
  private combLeaving = false
  private whaleAt = -1
  private lastSpectacle: number | undefined
  /** The jellyfish's parts as drawn last: dot index, ink pairs; and how long each has waited to move. */
  private parts: { shown: number[]; next: number[]; waited: number }[] = []
  private part = 0
  private mark = new Int32Array(0)
  private gen = 0
  /** The water's dots as they were last tick (a small room only), and how many changed since. */
  private water = new Uint8Array(0)
  private waterMoved = 0
  /** The words up last tick: a new bubble clears its cells, and the jellyfish holds still that tick. */
  private words: string | undefined

  constructor(seed: number) {
    this.seed = seed
  }

  frame(input: SceneInput): Frame {
    if (this.d.cols !== input.cols || this.d.rows !== input.rows) {
      this.d = new Dots(input.cols, input.rows)
      this.out = undefined
      this.snow = []
      this.school = []
      this.motes = []
      this.combAt = -1
      this.combShown = 0
      this.x = -1
      this.parts = []
    }
    const gap = this.last < 0 ? 1 : input.tick - this.last
    const steps = Math.max(0, Math.min(8, gap))
    for (let k = 0; k < steps; k++) {
      this.step(input, input.tick - steps + 1 + k)
      // a long gap (the band was hidden): its strands have long since settled where it is
      if (k === 0 && gap > 8) this.settle()
    }
    this.last = input.tick
    this.draw(input)
    this.out = packFast(this.d, PALETTE, this.out)
    return this.out
  }

  // ---------------------------------------------------------------- behaviour

  private settle(): void {
    const c = squeezeAt(this.phase) * this.amp
    this.hx.fill(this.x)
    this.hy.fill(this.y)
    this.hc.fill(c)
    this.hs.fill(this.stream)
  }

  private step(input: SceneInput, t: number): void {
    const L = layoutOf(input.cols, input.rows)
    const mood = input.mood
    if (mood !== this.mood) { this.mood = mood; this.moodFor = 0 } else this.moodFor++
    const held = input.bubble !== undefined
    this.calmFor = mood === 'idle' && !held ? this.calmFor + 1 : 0

    if (this.x < 0) {
      this.x = L.xMax - 4
      this.y = (L.top + L.bottom) / 2
      this.homeX = this.x
      this.homeY = this.y
      this.settle()
    }

    // the pulse: the phase only ever runs on, faster or slower, so a mood never cuts a pulse short
    const period = mood === 'busy' ? 13 : mood === 'talk' ? 10 : 26
    const before = this.phase
    this.phase = (this.phase + 1 / period) % 1
    const began = this.phase < before
    this.amp += ((mood === 'busy' ? 0.8 : 1) - this.amp) * 0.08
    this.ripple += (rippleAt(this.phase) - rippleAt(before) + (began ? 1 : 0)) * 0.75
    if (began && mood === 'talk') this.flash = 3
    if (this.flash > 0) this.flash--

    // drifting and lifting, slowly, and not at all while its words are up
    if (!held) {
      if (L.bob > 0) this.y -= (liftAt(this.phase) - liftAt(before)) * L.bob
      if (Math.abs(this.homeX - this.x) < 0.5) this.homeX = L.xMin + hash(Math.floor(t / 97), this.seed, 4) * (L.xMax - L.xMin)
      // in a window it wanders up and down too; in the band its depth is its own and only a pulse moves it
      if (L.bob > 0 && Math.abs(this.homeY - this.y) < 0.3) this.homeY = L.top + hash(Math.floor(t / 89), this.seed, 5) * (L.bottom - L.top)
      this.x += Math.max(-L.drift, Math.min(L.drift, this.homeX - this.x))
      this.y += Math.max(-L.drift * 0.6, Math.min(L.drift * 0.6, this.homeY - this.y))
    }

    // the current
    const current = mood === 'busy' ? 0.5 + 0.5 * noise1(t / 40, 5) : 0
    this.stream += (current - this.stream) * 0.04

    const at = t & (HISTORY - 1)
    this.hx[at] = this.x
    this.hy[at] = this.y
    this.hc[at] = squeezeAt(this.phase) * this.amp
    this.hs[at] = this.stream

    // marine snow: a fixed number of flakes, recycled at the top
    const want = Math.round((L.W * L.H) / (L.rows > 12 ? 300 : 160))
    while (this.snow.length < want) {
      const i = this.snow.length
      this.snow.push({ x: hash(i, this.seed, 6) * L.W, y: hash(i, this.seed, 7) * L.H, v: 0.025 + 0.04 * hash(i, 8), near: hash(i, 9) < 0.25 })
    }
    const still = this.stillAt(L)
    for (const f of this.snow) {
      f.y += f.v * (f.near ? 1.6 : 1)
      f.x += Math.sin((t + f.v * 1000) / 37) * 0.02 - this.stream * (f.near ? 0.45 : 0.12)
      if (f.x < 0) f.x += L.W
      const floor = still.floor[Math.min(L.W - 1, Math.max(0, Math.round(f.x)))]!
      if (f.y >= floor - 1) { f.y = 0; f.x = hash(t, Math.round(f.v * 1e4), 10) * L.W }
    }

    // a school of small fish now and then while the current runs
    if (mood === 'busy' && this.school.length === 0 && t - this.schoolAt > 160 && hash(t, this.seed, 11) < 0.03) {
      this.schoolAt = t
      const y0 = L.coreTop + 4 + hash(t, 12) * Math.max(1, L.coreBot - L.coreTop - 14)
      const n = L.rows > 8 ? 7 : 4
      for (let k = 0; k < n; k++) this.school.push({ x: L.W + 4 + k * 7 + hash(t, k, 13) * 5, y: y0 + (hash(t, k, 14) - 0.5) * 7, k })
    }
    for (const f of this.school) f.x -= 0.4
    if (this.school.length > 0) this.school = this.school.filter(f => f.x > -6)
    this.sardineAt += mood === 'busy' ? 0.3 : 0.13

    // ponder: sparks of light run down the tentacles
    if (mood === 'ponder' && this.moodFor % 2 === 0) this.sparks.push({ strand: Math.floor(hash(t, 15) * 6), along: 0 })
    for (const s of this.sparks) s.along += 1.5
    if (this.sparks.length > 0) this.sparks = this.sparks.filter(s => s.along < 16 * L.S)

    // a reward for quiet: after half a minute each pulse stirs a few motes of plankton into light
    if (began && this.calmFor > 120) {
      for (let k = 0; k < 3; k++) {
        const side = hash(t, k, 16) < 0.5 ? -1 : 1
        this.motes.push({ x: this.x + side * L.S * (9 + hash(t, k, 17) * 7), y: this.y + L.S * (hash(t, k, 18) * 12 - 3), age: 0 })
      }
    }
    for (const m of this.motes) m.age++
    if (this.motes.length > 0) this.motes = this.motes.filter(m => m.age < 14 && this.calmFor > 0)

    // and after a minute and more, a comb jelly glimmers into view, far off; it fades when work starts
    const room = L.xMin - 30
    if (this.combAt < 0 && this.calmFor > 300 && room > 12 && hash(t, this.seed, 19) < 0.02) {
      this.combAt = t
      this.combLeaving = false
      this.combShown = 0
      this.combX = 6 + hash(t, 20) * (room - 6)
      this.combY = L.coreTop + 4 + hash(t, 21) * Math.max(1, L.coreBot - L.coreTop - 14)
    }
    if (this.combAt >= 0) {
      if (this.calmFor === 0 || t - this.combAt > 480) this.combLeaving = true
      this.combShown = this.combLeaving ? this.combShown - 4 : Math.min(40, this.combShown + 1)
      if (this.combLeaving && this.combShown <= 0) { this.combAt = -1; this.combShown = 0 }
    }

    // the whale, when the mod asks for it
    if (input.spectacle !== undefined && input.spectacle !== this.lastSpectacle && t >= input.spectacle) {
      this.lastSpectacle = input.spectacle
      if (this.whaleAt < 0) this.whaleAt = t
    }
    if (this.whaleAt >= 0 && (t - this.whaleAt) * whaleSpeed(L.W) > L.W + 130) this.whaleAt = -1
  }

  /** A value from its past: `lag` ticks ago, between ticks too. */
  private past(buf: Float64Array, t: number, lag: number): number {
    const at = t - lag
    const i = Math.floor(at), f = at - i
    return buf[i & (HISTORY - 1)]! * (1 - f) + buf[(i + 1) & (HISTORY - 1)]! * f
  }

  // ---------------------------------------------------------------- the still world

  private stillAt(L: Layout): Still {
    const size = `${L.cols}x${L.rows}`
    if (this.still?.size === size) return this.still
    const { W, H } = L
    const near: number[] = []
    const solid = new Uint8Array(W * H)
    const floor = new Int16Array(W)
    const put = (x: number, y: number, inkAt: number) => {
      x = Math.round(x); y = Math.round(y)
      if (x >= 0 && y >= 0 && x < W && y < H) near.push(y * W + x, inkAt)
    }
    const reef = L.reef
    // the sand line, as the band has always drawn it (anchored to the right edge), and the reef's face
    for (let x = 0; x < W; x++) {
      const wx = W - x
      const sand = L.bed + Math.round(noise1(wx / 13, 31) * 1.6) - 1
      let top = sand
      if (reef !== undefined && x > reef.x0) {
        const u = Math.min(1, (x - reef.x0) / (reef.x1 - reef.x0))
        const rough = (noise1(x / 7, 77) - 0.5) * 3 + (noise1(x / 2.5, 78) - 0.5) * 1.4
        top = Math.round(L.bed + (reef.shelf - L.bed) * smooth(u) + rough * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.2))))
      }
      floor[x] = Math.min(sand, top)
      for (let y = Math.max(0, floor[x]! + 1); y < H; y++) solid[y * W + x] = 1
      if (top < sand) {
        // rock: its edge, and a stipple inside that thins with depth, in patches like weathered stone
        put(x, top, P.rock)
        for (let y = top + 1; y < H; y++) {
          const depth = y - top
          const p = (0.04 + 0.26 * Math.exp(-depth / 4)) * (0.5 + noise1(x / 6 + y / 11, 81))
          if (hash(x, y, 80) < p) put(x, y, depth < 3 ? P.rock : P.rockDim)
        }
      } else {
        if (hash(wx, 32) < 0.75) put(x, sand, P.sand)
        if (hash(wx, 33) < 0.12) put(x, sand + 1, P.sand)
        // a deeper floor shows more of the sand under its line
        if (L.below >= 4) for (let y = sand + 2; y < H; y++) if (bayer(x, y) < 0.09) put(x, y, P.sandDim)
      }
    }
    // the surface: which x carry a dot (as ever), and each one's moment to glint
    const surf = new Uint8Array(W)
    for (let x = 0; x < W; x++) surf[x] = hash(x, 1) < 0.45 ? 1 + Math.floor(hash(x, 2) * 200) : 0

    const deepEnd = reef !== undefined ? reef.x0 : L.kelp
    if (L.below >= 4) {
      // pebbles on the deep floor, one now and then
      for (let c = 0; c * 9 < deepEnd - 4; c++) {
        if (hash(c, 34, this.seed) > 0.4) continue
        const x = c * 9 + 1 + Math.floor(hash(c, 35) * 6)
        const y = floor[x]! - 1
        put(x, y, P.rock); put(x + 1, y, P.rock)
        if (hash(c, 36) < 0.5) put(x + 1, y - 1, P.rock)
      }
    }
    // the anglerfish: hanging still above the deep floor, its body lit where its lure is near
    const anglers: number[] = []
    // where they hang, so nothing grows through them
    const clear: number[] = []
    if (L.below >= 8 && deepEnd > 70) {
      const A = L.below >= 16 ? 1.3 : 1
      const art = anglerArt(A)
      const n = deepEnd > 320 ? 2 : 1
      for (let i = 0; i < n; i++) {
        const f = hash(i, 47, this.seed) < 0.5 ? 1 : -1
        const ax = Math.round(deepEnd * ((i + 0.25 + hash(i, 45, this.seed) * 0.3) / n))
        const ay = Math.round(L.bed - 9 * A - 5 - hash(i, 46) * Math.max(0, L.below * 4 * 0.15))
        const ex = ax - f * art.ex, ey = ay + art.ey
        for (let k = 0; k < art.dots.length; k += 3) {
          const x = ax - f * art.dots[k]!, y = ay + art.dots[k + 1]!, part = art.dots[k + 2]!
          const lit = Math.hypot(x - ex, (y - ey) * 1.2) < 9 * A
          put(x, y, part === 1 ? P.tooth : part === 2 ? P.stalk : part === 3 ? P.tooth : lit ? P.anglerLit : P.angler)
        }
        anglers.push(ex, ey)
        clear.push(ax - 16 * A, ax + 16 * A)
      }
    }

    if (L.below >= 6) {
      // sea pens: feathers on a stalk, standing from the sand
      const pens = Math.max(1, Math.round(deepEnd / 70))
      for (let i = 0; i < pens; i++) {
        const x = Math.round(((i + 0.3 + hash(i, 37) * 0.4) / pens) * deepEnd)
        let hidden = false
        for (let k = 0; k < clear.length; k += 2) if (x > clear[k]! && x < clear[k + 1]!) hidden = true
        if (hidden) continue
        const tall = 6 + Math.round(hash(i, 38) * Math.min(8, L.below))
        const base = floor[Math.min(W - 1, x)]!
        for (let k = 1; k <= tall; k++) {
          const sx = x + Math.round(Math.sin(k / 4 + i) * 0.6)
          put(sx, base - k, P.seaPen)
          if (k > 2 && k % 2 === 0 && k < tall) { put(sx - 1, base - k - 1, P.seaPen); put(sx + 1, base - k - 1, P.seaPen) }
        }
      }
      // a glass sponge, where the floor is wide enough
      if (deepEnd > 120) {
        let x = Math.round(deepEnd * (0.62 + hash(39, this.seed) * 0.1))
        for (let k = 0; k < clear.length; k += 2) if (x + 9 > clear[k]! && x < clear[k + 1]!) x = Math.round(clear[k + 1]! + 3)
        const base = floor[Math.max(0, Math.min(W - 1, x + 4))]!
        SPONGE.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 's') put(x + c, base - SPONGE.length + r, P.sponge) }))
      }
    }
    if (reef !== undefined) {
      // anemones on the shelf and the slope, and a sea fan on the face
      const n = Math.max(2, Math.round((reef.x1 - reef.x0) / 22))
      for (let i = 0; i < n; i++) {
        const x = Math.round(reef.x0 + ((i + 0.5 + (hash(i, 40) - 0.5) * 0.5) / n) * (L.kelp - reef.x0 - 4))
        const base = floor[Math.min(W - 1, x + 3)]!
        ANEMONE.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'a') put(x + c, base - ANEMONE.length + r + 1, P.anemone) }))
      }
      const fx = Math.round(reef.x0 + (reef.x1 - reef.x0) * 0.42)
      const fbase = floor[fx]!
      const branch = (x: number, y: number, a: number, len: number, depth: number): void => {
        for (let k = 0; k < len; k++) put(x + Math.cos(a) * k, y - Math.sin(a) * k, P.fan)
        if (depth <= 0) return
        const ex = x + Math.cos(a) * len, ey = y - Math.sin(a) * len
        branch(ex, ey, a + 0.45, len * 0.72, depth - 1)
        branch(ex, ey, a - 0.4, len * 0.72, depth - 1)
      }
      branch(fx, fbase, Math.PI / 2 + 0.15, 5, 3)
    }

    // plankton in the dark below the light, each blinking on its own slow clock
    const plankton: number[] = []
    if (L.below >= 4) {
      const n = Math.round((W * (L.H - L.coreBot)) / 480)
      for (let i = 0; i < n; i++) {
        const x = Math.floor(hash(i, 41, this.seed) * W)
        const y = L.coreBot + 2 + Math.floor(hash(i, 42, this.seed) * (L.H - L.coreBot - 4))
        if (solid[y * W + x] === 1 || y >= floor[x]! - 1) continue
        plankton.push(y * W + x, Math.floor(hash(i, 43) * 400), 160 + Math.floor(hash(i, 44) * 240))
      }
    }

    // garibaldi keep to the kelp, half hidden in it
    const garibaldi: number[] = []
    if (L.rows >= 11) {
      const n = L.W - L.kelp > 24 ? 2 : 1
      for (let i = 0; i < n; i++) {
        const x = L.kelp + 1 + Math.round(hash(i, 48, this.seed) * Math.max(0, W - L.kelp - 12))
        const fl = floor[Math.min(W - 1, x + 4)]!
        const y = Math.round(Math.max(L.coreTop + 2, fl - 9 - hash(i, 49) * Math.max(0, fl - L.coreTop - 20) * 0.6))
        garibaldi.push(x, y, i % 2 === 0 ? -1 : 1)
      }
    }

    // lanternfish in the twilight under the core
    const lanterns: number[] = []
    if (L.below >= 4) {
      const n = Math.max(2, Math.min(14, Math.round((W * L.below) / 560)))
      const y0 = L.coreBot + 4, y1 = L.coreBot + Math.max(6, L.below * 4 * 0.5)
      for (let i = 0; i < n; i++) {
        lanterns.push(4 + hash(i, 50, this.seed) * (deepEnd - 16), y0 + hash(i, 51) * (y1 - y0), 300 + hash(i, 52) * 300, hash(i, 53) * 6.28)
      }
    }

    // far kelp, dim, behind the near fronds in a tall room
    const far: number[] = []
    if (L.rows >= 11) {
      const n = Math.max(2, Math.round((W - L.kelp) / 6))
      for (let i = 0; i < n; i++) {
        const base = L.kelp - 4 - Math.round(hash(i, 54) * (W - L.kelp) * 1.2)
        const fl = floor[Math.max(0, Math.min(W - 1, base))]!
        const tall = Math.round((fl - 4) * (0.35 + 0.4 * hash(i, 55)))
        for (let k = 0; k < tall; k++) {
          const x = Math.round(base + Math.sin(i * 2.1 - k / 7) * (k / tall) * 2)
          const y = fl - k
          if (x >= 0 && x < W && y >= 0) far.push(y * W + x)
        }
      }
    }

    // a siphonophore, a long colony drifting in the twilight, where there is room for one
    const siphon: number[] = []
    if (L.below >= 8 && deepEnd > 90) {
      const len = Math.round(Math.min(deepEnd * 0.55, 40 + W * 0.15))
      siphon.push(6 + hash(56, this.seed) * Math.max(1, deepEnd * 0.3), L.coreBot + L.below * 4 * (0.2 + 0.1 * hash(57, this.seed)), len, 0.1 + hash(58, this.seed) * 0.1)
    }

    this.still = {
      size, near: Int32Array.from(near), solid, floor, surf, siphon: Float32Array.from(siphon),
      plankton: Int32Array.from(plankton), anglers: Int16Array.from(anglers), garibaldi: Int16Array.from(garibaldi),
      lanterns: Float32Array.from(lanterns), far: Int32Array.from(far),
    }
    return this.still
  }

  // ---------------------------------------------------------------- drawing

  /** A dot behind the floor and the reef: only where they don't hide it. */
  private behind(x: number, y: number, inkAt: number): void {
    x = Math.round(x); y = Math.round(y)
    const d = this.d
    if (x < 0 || y < 0 || x >= d.w || y >= d.h) return
    if (this.still!.solid[y * d.w + x] === 1) return
    d.dot[y * d.w + x] = inkAt
  }

  private draw(input: SceneInput): void {
    const d = this.d
    const L = layoutOf(input.cols, input.rows)
    const still = this.stillAt(L)
    const t = input.tick
    d.clear()

    // the surface: a faint line rolling along the top, a dot here and there glinting
    for (let x = 0; x < L.W; x++) {
      const s = still.surf[x]!
      if (s === 0) continue
      const y = Math.round(0.6 + 0.6 * Math.sin((x + t / 16) / 6) + 0.4 * Math.sin((x - t / 24) / 11))
      d.set(x, y, (t + s) % 200 < 7 ? P.glint : P.surface)
    }

    // light rays: slanted bands of dots, fading with depth, each breathing on its own
    const rays = Math.max(2, Math.round(L.W / 55))
    const tall = L.rows > 12
    const wide = tall ? 1.5 : 1
    for (let k = 0; k < rays; k++) {
      const x0 = ((k + 0.5) / rays) * L.W + (hash(k, 21) - 0.5) * 30 + Math.sin(t / 360 + k) * 4
      const slant = 0.45 + Math.sin(t / 520 + k * 2) * 0.1
      const width = (4 + hash(k, 22) * 5) * wide
      const breath = 0.55 + 0.45 * Math.sin(t / 220 + k * 1.7)
      for (let y = 2; y < Math.min(L.bed, L.reach); y++) {
        const fade = (1 - y / L.reach) * breath
        const cx = x0 + y * slant
        // in a tall room a ray's row takes one ink, so the window's rows stay few runs of color
        const one = tall ? (fade > 0.6 ? P.rayBright : P.ray) : 0
        for (let x = Math.floor(cx - width / 2); x <= cx + width / 2; x++) {
          const edge = 1 - Math.abs(x - cx) / (width / 2)
          if (bayer(x, y) < fade * edge * 0.42) this.behind(x, y, one !== 0 ? one : fade * edge > 0.5 ? P.rayBright : P.ray)
        }
      }
    }

    // far kelp, dim, behind it all
    for (let k = 0; k < still.far.length; k++) d.dot[still.far[k]!] = P.kelpFar

    // the whale, far back, behind everything that lives here
    if (this.whaleAt >= 0) this.drawWhale(L, t)

    // plankton, blinking: always there, now and then lit
    for (let k = 0; k < still.plankton.length; k += 3) {
      const lit = (t + still.plankton[k + 1]!) % still.plankton[k + 2]! < 3
      d.dot[still.plankton[k]!] = lit ? P.spark : P.plankton
    }

    this.drawSardines(L)
    this.drawLanterns(still, t)
    this.drawSiphon(still, t)

    for (const f of this.snow) this.behind(f.x, f.y, f.near ? P.snowNear : P.snow)
    for (const f of this.school) d.stamp(SMALL_FISH, f.x, f.y, { f: P.fish })

    // the floor and the reef, and what grows and waits there
    this.drawGlow(still, t)
    for (let k = 0; k < still.near.length; k += 2) d.dot[still.near[k]!] = still.near[k + 1]!
    this.drawLures(still, t)
    this.drawGaribaldi(still, t)
    this.drawKelp(L, still, t)
    this.drawComb(t)
    for (const m of this.motes) d.set(m.x, m.y, m.age < 3 ? P.spark : P.mote)
    // what the water changed since the last tick: in a small room the jellyfish moves only in what is left
    this.waterMoved = 0
    if (L.W * L.H <= 8000) {
      const dots = d.dot, was = this.water
      if (was.length === dots.length) for (let i = 0; i < dots.length; i++) if ((dots[i] === 0) !== (was[i] === 0)) this.waterMoved++
      if (was.length !== dots.length) this.water = Uint8Array.from(dots)
      else was.set(dots)
    }
    this.drawJelly(L, input)

    if (input.bubble !== undefined) {
      const S = L.S
      const bw = 11 * S
      const bellTop = this.y - domeOf(S)
      const c0 = Math.floor((this.x - bw - 2) / 2), c1 = Math.ceil((this.x + bw + 2) / 2)
      drawBubble(d, input.bubble, { c: Math.floor((this.x - 4 * S) / 2), r: Math.max(0, Math.floor((bellTop + 2) / 4)) }, { c0, r0: Math.max(0, Math.floor(bellTop / 4)), c1, r1: input.rows }, P.border, P.words, P.border, input.asciiBorders === true)
    }
  }

  private drawKelp(L: Layout, still: Still, t: number): void {
    const d = this.d
    const span = L.W - L.kelp
    const n = Math.max(3, Math.round(span / 3))
    const tallRoom = L.rows > 12
    for (let i = 0; i < n; i++) {
      const base = L.kelp + Math.round((i + 0.5) * (span / n))
      const floor = still.floor[Math.min(L.W - 1, base)]! + 1
      const tall = Math.round((floor - 1) * (0.58 + 0.4 * hash(i, 41)))
      const phase = t / 40 + i * 1.3
      for (let k = 0; k < tall; k++) {
        const y = floor - 1 - k
        const u = k / tall
        const x = base + Math.sin(phase - k / 5) * u * 2.2 - this.stream * u * u * 5
        // in a tall room the fronds are one ink but for their tips (fewer runs of color in its rows)
        const blade = tallRoom && u < 0.85 ? P.kelp : P.kelpLight
        d.set(x, y, tallRoom && u >= 0.85 ? P.kelpLight : P.kelp)
        // a blade every few dots, on alternating sides
        if (k % 5 === 2 && k > 3) {
          const side = (k / 5) % 2 < 1 ? -1 : 1
          d.set(x + side, y - 1, blade)
          d.set(x + side * 2, y - 2, blade)
        }
      }
    }
  }

  /** The sardines: a school of silver in lanes on a slow figure of eight near the light, flashing as it turns. */
  private drawSardines(L: Layout): void {
    if (L.above < 2) return
    const n = Math.max(6, Math.min(42, Math.round((L.W * L.above) / 58)))
    const ax = L.W * 0.26, xc = L.W * 0.34
    const yc = 3 + (L.coreTop - 3) * 0.5, ay = Math.max(0.5, (L.coreTop - 9) * 0.32)
    const p = this.sardineAt / ax
    const lanes = L.above >= 5 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const lane = i % lanes
      const q = p - Math.floor(i / lanes) * (3.4 / ax) - lane * (1.2 / ax) + 0.4
      // the way the school swims here, and each lane set off across it
      const dx = Math.cos(q), dy = ((2 * ay) / ax) * Math.cos(2 * q + 1)
      const len = Math.hypot(dx, dy)
      const off = (lane - (lanes - 1) / 2) * 2.4 + (hash(i, 62) - 0.5) * 1.4
      const x = xc + ax * Math.sin(q) - (dy / len) * off + (hash(i, 61) - 0.5) * 1.6
      const y = yc + ay * Math.sin(2 * q + 1) + (dx / len) * off * 0.6
      const dir = dx >= 0 ? 1 : -1
      // a flash runs through the school where it turns
      const inkAt = Math.sin(q * 3 + i * 0.21) > 0.88 ? P.glint : P.sardine
      this.behind(x, y, inkAt)
      this.behind(x - dir, y, inkAt)
      this.behind(x - dir * 2.4, y + (i % 2 === 0 ? -0.6 : 0.6), P.sardine)
    }
  }

  private drawLanterns(still: Still, t: number): void {
    const s = still.lanterns
    for (let k = 0; k < s.length; k += 4) {
      const period = s[k + 2]!, ph = s[k + 3]!
      const x = s[k]! + Math.sin(t / period + ph) * 7
      const y = s[k + 1]! + Math.sin(t / (period * 1.3) + ph) * 1.5
      const face = Math.cos(t / period + ph) >= 0 ? -1 : 1
      const lit = (t + Math.round(ph * 40)) % 37 < 9
      this.d.stamp(LANTERN, x, y, { b: P.lantern, p: lit ? P.spark : P.mote }, face > 0)
    }
  }

  /** The anglerfish's glow: a halo round where its lure rests, fixed to the water so it never boils, breathing. */
  private drawGlow(still: Still, t: number): void {
    const a = still.anglers
    for (let k = 0; k < a.length; k += 2) {
      const ex = a[k]!, ey = a[k + 1]!
      const breath = 0.5 + 0.5 * Math.sin(t / 22 + k)
      for (let y = -7; y <= 7; y++) {
        for (let x = -9; x <= 9; x++) {
          const r = Math.hypot(x, y * 1.3)
          if (r < 1.2 || r > 8) continue
          const fall = 1 - r / 8.2
          if (bayer(ex + x, ey + y) < 0.7 * fall * fall) this.behind(ex + x, ey + y, r < 2.4 + 2.6 * breath ? P.lureGlow : P.lureDim)
        }
      }
    }
  }

  /** The lure itself, swaying a dot on its stalk now and then. */
  private drawLures(still: Still, t: number): void {
    const a = still.anglers
    for (let k = 0; k < a.length; k += 2) this.d.set(a[k]!, a[k + 1]! + (Math.floor((t + k * 50) / 30) % 3 === 0 ? 1 : 0), P.lure)
  }

  /** A siphonophore: a colony on one long stem, swimming bells at its head, lights strung down it, swaying. */
  private drawSiphon(still: Still, t: number): void {
    const s = still.siphon
    if (s.length === 0) return
    const hx = s[0]!, hy = s[1]!, len = s[2]!, ang = s[3]!
    const ca = Math.cos(ang), sa = Math.sin(ang)
    for (let k = 0; k <= len; k++) {
      const sway = Math.sin(t / 160 - k / 16) * (k / len) * 3.5
      const x = hx + ca * k - sa * sway, y = hy + sa * k + ca * sway
      if (k < 7) {
        // the swimming bells: a little cluster at the head
        if (k % 2 === 0) { this.behind(x, y - 1, P.comb); this.behind(x, y + 1, P.comb) }
        continue
      }
      if (k % 4 === 0) {
        this.behind(x, y, P.comb)
        // a light, and a tentacle hanging from every other group
        if (k % 8 === 0) { this.behind(x, y + 1, (t + k * 7) % 90 < 6 ? P.spark : P.mote); this.behind(x + 0.4, y + 3, P.comb) }
      } else if (k % 2 === 0) this.behind(x, y, P.comb)
    }
  }

  private drawGaribaldi(still: Still, t: number): void {
    const g = still.garibaldi
    for (let k = 0; k < g.length; k += 3) {
      // it holds its place, now and then nudging a dot up or down, and turns about once a minute
      const bob = Math.floor((t + k * 40) / 50) % 4 === 1 ? -1 : 0
      const face = Math.floor((t + k * 90) / 260) % 2 === 0 ? g[k + 2]! : -g[k + 2]!
      this.d.stamp(GARIBALDI, g[k]!, g[k + 1]! + bob, { o: P.garibaldi }, face > 0)
    }
  }

  private drawComb(t: number): void {
    if (this.combAt < 0 || this.combShown <= 0) return
    const d = this.d
    const x0 = Math.round(this.combX), y0 = Math.round(this.combY)
    const run = Math.floor(t / 3)
    for (let r = 0; r < COMB.length; r++) {
      const row = COMB[r]!
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]!
        if (ch === '.') continue
        // it glimmers in dot by dot, in a fixed scattered order
        if (hash(r, c, 71) * 40 >= this.combShown) continue
        // a cell has one color, so the rainbow runs across it a cell at a time
        d.set(x0 + c, y0 + r, ch === 'c' ? P.comb : P.rainbow + ((Math.floor((y0 + r) / 4) + Math.floor((x0 + c) / 2) + run) % 4))
      }
    }
  }

  // ---------------------------------------------------------------- the jellyfish

  /** Starts drawing part `n` of the jellyfish. */
  private begin(n: number): void {
    while (this.parts.length <= n) this.parts.push({ shown: [], next: [], waited: 0 })
    this.part = n
    this.parts[n]!.next.length = 0
  }

  private put(x: number, y: number, inkAt: number): void {
    x = Math.round(x); y = Math.round(y)
    const d = this.d
    if (x < 0 || y < 0 || x >= d.w || y >= d.h) return
    this.parts[this.part]!.next.push(y * d.w + x, inkAt)
  }

  /** Dots that differ between two parts' lists (where they stand, not their ink). */
  private moved(a: number[], b: number[]): number {
    const m = this.mark
    const g = (this.gen += 2)
    for (let k = 0; k < a.length; k += 2) m[a[k]!] = g
    let cost = 0
    for (let k = 0; k < b.length; k += 2) {
      const i = b[k]!
      if (m[i] !== g && m[i] !== g + 1) cost++
      m[i] = g + 1
    }
    for (let k = 0; k < a.length; k += 2) if (m[a[k]!] === g) cost++
    return cost
  }

  /**
   * Lets the jellyfish's parts take their new places, the longest-waiting
   * first, until the tick's budget of dots is spent; the rest keep theirs a
   * tick longer (their color still changes). So a pulse never moves more of
   * it at once than the room can bear, and what waits trails a little.
   */
  private govern(count: number, budget: number): void {
    const parts = this.parts
    if (this.mark.length !== this.d.w * this.d.h) { this.mark = new Int32Array(this.d.w * this.d.h); this.gen = 0 }
    // newly drawn (born, or the room changed): all of it at once
    let fresh = true
    for (let i = 0; i < count && fresh; i++) if (parts[i]!.shown.length > 0) fresh = false
    if (fresh) budget = Infinity
    const order: number[] = []
    const costs: number[] = []
    for (let i = 0; i < count; i++) {
      const p = parts[i]!
      costs[i] = this.moved(p.shown, p.next)
      if (costs[i]! > 0) order.push(i)
      else { const s = p.shown; p.shown = p.next; p.next = s; p.waited = 0 }
    }
    order.sort((a, b) => parts[b]!.waited - parts[a]!.waited || a - b)
    let spent = 0
    // one part a tick may go over the budget, the one that has waited longest, so none waits for ever
    let forced = false
    for (const i of order) {
      const p = parts[i]!
      const fits = spent + costs[i]! <= budget
      if (fits || (!forced && budget > 0 && p.waited >= 3)) {
        const s = p.shown; p.shown = p.next; p.next = s
        p.waited = 0
        spent += costs[i]!
        if (!fits) forced = true
      } else {
        p.waited++
        if (p.shown.length === p.next.length) for (let k = 1; k < p.shown.length; k += 2) p.shown[k] = p.next[k]!
      }
    }
    const dot = this.d.dot
    for (let i = 0; i < count; i++) {
      const s = parts[i]!.shown
      for (let k = 0; k < s.length; k += 2) dot[s[k]!] = s[k + 1]!
    }
  }

  private drawJelly(L: Layout, input: SceneInput): void {
    const t = input.tick
    const S = L.S
    // how far a pulse squeezes it: in dots, growing more slowly than a hero grows, so a big bell moves no more than it must
    const Q = Math.sqrt(S)
    const cx = this.x, rim = this.y
    const c = squeezeAt(this.phase) * this.amp
    const rx = S * 10 - Q * 1.6 * c // half-width of the bell: a wide saucer, narrower as it squeezes
    // the dome's height (it grows as it squeezes): a hero's is a little rounder than the band's saucer
    const dome = domeOf(S)
    const lit = this.flash > 0
    const bellInk = lit ? P.bellBright : P.bell
    let n = 0

    // the bell: a dome outline (its two halves), and inside it a fainter second curve
    const x0 = Math.ceil(cx - rx), x1 = Math.floor(cx + rx)
    const mid = Math.round(cx)
    let prev = this.past(this.hy, t, 2.2)
    this.begin(n++)
    for (let x = x0; x <= x1 + 1; x++) {
      if (x === mid) this.begin(n++)
      const u = Math.max(-1, Math.min(1, (x - cx) / rx))
      // the margin squeezes first and the dome follows it, a tick or two behind; but when it lifts
      // or sinks the crown leads and the margin follows
      const hu = dome + Q * 1.3 * this.past(this.hc, t, 3 * (1 - Math.abs(u)))
      const ru = this.past(this.hy, t, 2.2 * Math.abs(u))
      const yTop = x > x1 ? this.past(this.hy, t, 2.2) : ru - hu * Math.sqrt(Math.max(0, 1 - u * u))
      if (x <= x1) this.put(x, yTop, bellInk)
      // the steep sides need the gaps filled
      if (x > x0) {
        const a = Math.round(Math.min(yTop, prev)), b = Math.round(Math.max(yTop, prev))
        const fx = yTop < prev ? x : x - 1
        for (let y = a + 1; y < b; y++) this.put(fx, y, bellInk)
      }
      prev = yTop
    }
    if (n === 1) this.begin(n++)
    this.begin(n++)
    for (let x = x0; x <= x1; x++) {
      const u = (x - cx) / rx
      if (Math.abs(u) >= 0.85 || (x & 1) === 1) continue
      const hu = dome + Q * 1.3 * this.past(this.hc, t, 3 * (1 - Math.abs(u)))
      this.put(x, this.past(this.hy, t, 2.2 * Math.abs(u)) - (hu - 1.6 * S) * Math.sqrt(Math.max(0, 1 - (u * 1.12) ** 2)), P.glow)
    }
    // the rim, scalloped (the scallops keep their places as it moves: only its ends change)
    this.begin(n++)
    for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
      if (((x % 3) + 3) % 3 !== 1) this.put(x, this.past(this.hy, t, 2.2 * Math.min(1, Math.abs(x - cx) / rx)), bellInk)
    }
    // four loops showing through: the moon jelly's mark. In the band a row of little horseshoes, as
    // ever; in a hero, a ring of four seen from a little above, the near two lower than the far
    const bright = lit || input.mood === 'talk'
    const loopInk = S >= 1.3 ? (bright ? P.loopSoftBright : P.loopSoft) : bright ? P.loopBright : P.loop
    const art = S >= 1.5 ? LOOP_HERO : S >= 1.3 ? LOOP_MID : LOOP
    const lw = art[0]!.length
    for (let i = 0; i < 4; i++) {
      this.begin(n++)
      let lx: number, ly: number
      if (S < 1.3) {
        lx = cx + LOOPS[i]! * rx - (lw - 1) / 2
        ly = rim - 4 * S * 0.45 - (art.length - 2) * 0.5
      } else {
        const a = RING[i]!
        lx = cx + Math.cos(a) * rx * 0.46 - (lw - 1) / 2
        ly = rim - dome * 0.36 + Math.sin(a) * dome * 0.13 - (art.length - 1) * 0.5
      }
      lx = Math.round(lx); ly = Math.round(ly)
      for (let r = 0; r < art.length; r++) for (let q = 0; q < lw; q++) if (art[r]![q] === 'l') this.put(lx + q, ly + r, loopInk)
    }

    // fine tentacles all round the rim: each dot reads where the rim was a moment ago, the lower the later
    const strands = Math.round(9 * Q)
    for (let k = 0; k < strands; k++) {
      this.begin(n++)
      const side = -1 + (2 * k) / (strands - 1)
      const len = Math.round((6 + hash(k, 51) * 4) * S)
      for (let j = 1; j <= len; j++) {
        const lag = 1.8 + (j * 0.45) / S
        const px = this.past(this.hx, t, lag), py = this.past(this.hy, t, lag)
        const pc = this.past(this.hc, t, lag), ps = this.past(this.hs, t, lag)
        // the squeeze draws its roots in; lower down a strand only follows them part of the way
        const pull = (side * 1.6 * Q * pc) / (1 + (j * 0.35) / S)
        const sway = Math.sin(this.ripple * 1.05 + k * 1.1 - j / (2.5 * S)) * (0.12 + (j * 0.04) / S) * Q
        const x = px + side * (10 * S - 0.5) - pull + side * 10 * j * 0.03 * (1 - 0.5 * pc) + sway - ps * j * 0.6
        const y = py + j * (1 - ps * 0.3)
        // every other dot, on rows of the water rather than of the strand, so a lift only moves its ends
        if (j > 2 && ((Math.round(y) + k) & 1) === 1) continue
        let inkAt: number = P.tentacle
        for (const sp of this.sparks) if (sp.strand % strands === k % 6 && Math.abs(sp.along * 0.6 - j) < 1.2) inkAt = P.spark
        this.put(x, y, inkAt)
      }
    }
    // four oral arms: frilled ribbons, longer, hanging from the middle
    for (const [side, len0] of ARMS) {
      this.begin(n++)
      const len = Math.round(len0 * S)
      const out = side < 0 ? -1 : 1
      const strand = Math.round((side + 1) * 1.5)
      for (let j = 1; j <= len; j++) {
        const lag = 2.4 + (j * 0.5) / S
        const px = this.past(this.hx, t, lag), py = this.past(this.hy, t, lag), ps = this.past(this.hs, t, lag)
        const x = px + side * 2.2 * S + Math.sin(this.ripple * 0.9 + j / (3 * S) + side * 2) * (0.6 + (j * 0.05) / S) * S - ps * j * 0.5
        const y = py + j
        let inkAt: number = P.arm
        for (const sp of this.sparks) if (Math.abs(sp.along - j / S) < 1 && sp.strand % 4 === strand) inkAt = P.spark
        this.put(x, y, inkAt)
        if (j % Math.round(4 * S) === 2) this.put(x + out, y, inkAt)
      }
    }

    // the dots the room may change this tick, less what the water has changed already
    const cap = input.mood === 'busy' ? 0.018 : input.mood === 'talk' ? 0.013 : 0.011
    // and none at all on the tick words land, which clear the cells under their bubble
    const landed = input.bubble !== this.words
    this.words = input.bubble
    this.govern(n, landed && input.bubble !== undefined ? 0 : Math.round(L.W * L.H * cap) - this.waterMoved)
  }

  private drawWhale(L: Layout, t: number): void {
    const k = t - this.whaleAt
    // a humpback, about 100 dots long, swimming left; scaled to the water's height
    const len = Math.min(110, Math.max(60, L.H * 4))
    const thick = Math.min(L.H * 0.36, len * 0.13)
    const head = L.W + 8 - k * whaleSpeed(L.W) // its snout: across any width in about a minute
    const mid = L.H * 0.48 + Math.sin(k / 40) * 1.5
    const beat = Math.sin(k / 9)
    // its profile: a blunt head, the back rising to a small hump, a thin tail stock
    const back = (u: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.8))), 0.7) + 0.12 * Math.exp(-(((u - 0.68) / 0.035) ** 2))
    const belly = (u: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.7))), 0.6) * (u < 0.35 ? 1.08 : 1)
    const top = (u: number) => mid - thick * back(u)
    const bot = (u: number) => mid + thick * 0.85 * belly(u) + (u > 0.6 ? (u - 0.6) * beat * 1.8 : 0)
    for (let x = Math.max(0, Math.floor(head)); x < Math.min(L.W, head + len); x++) {
      const u = (x - head) / len
      const y0 = Math.round(top(u) + (u > 0.6 ? (u - 0.6) * beat * 2 : 0)), y1 = Math.round(bot(u))
      this.behind(x, y0, P.whale)
      this.behind(x, y1, P.whale)
      for (let y = y0 + 1; y < y1; y++) if (bayer(x, y) < 0.14) this.behind(x, y, P.whaleFill)
      // throat grooves on the lower jaw
      if (u > 0.04 && u < 0.3 && x % 2 === 0) this.behind(x, y1 - 2, P.whaleFill)
    }
    // the eye, the long pectoral fin, the flukes
    this.behind(head + len * 0.12, mid + 1, P.whaleEye)
    for (let j = 0; j < len * 0.28; j++) this.behind(head + len * 0.24 + j, mid + thick * 0.6 + j * 0.28 + Math.sin(k / 12) * j * 0.04, P.whale)
    const tailX = head + len, tailY = mid + beat * 3
    for (let j = 0; j < thick * 0.9; j++) {
      this.behind(tailX + j * 0.5, tailY - j, P.whale)
      this.behind(tailX + j * 0.5, tailY + j * 0.9, P.whale)
    }
    // its song: faint arcs widening from its head every few seconds
    const age = k % 28
    if (age < 14 && k > 20) {
      const r = 3 + age * 1.6
      for (let a = 2.2; a < 4.1; a += 0.12) this.behind(head - 2 + Math.cos(a) * r, mid + Math.sin(a) * r * 0.7, P.song)
    }
  }
}

export const deep: SceneDef = {
  id: 'deep-water',
  name: 'Deep Water',
  persona: 'a moon jellyfish drifting in a strip of deep sea above the prompt',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 6,
  create: seed => new Deep(seed),
}
