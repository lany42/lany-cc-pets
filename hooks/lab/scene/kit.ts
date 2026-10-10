// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The scene kit (from braille-ambient, as it was but for its encoders): the
// small engine every scene draws with. A scene paints colored dots back to
// front onto a `Dots` canvas (2x4 dots per terminal cell, as braille has),
// lays words over it as whole cells, and packs the result (`packFast`) into
// one Frame: a code point and an ink per cell. scene/index.ts makes a Frame
// Text runs; the Raster and Svg encoders wait for their phase. Opt-in, a
// scene may also paint light: a background ink per cell (`litFrame`), cells
// relit without a dot moving (`relight`), and inks mixed into ramps. Pure:
// imports only the lab's braille.ts (the dot canvas and braille's bits),
// bubble.ts (a bubble's wrap and border) and util.ts (small helpers), all
// pure, and passes on what every scene draws with from them (`Dots`,
// `wrap`, `bayer`, `moonPhase`, `hex`, `isNarrow`).
import { POPCOUNT } from '../braille'
import type { Dots } from '../braille'
import { ASCII, ROUND, wrap } from '../bubble'
import { bayer, mixRgb } from '../util'

export { Dots } from '../braille'
export { wrap } from '../bubble'
export { bayer, hex, isNarrow, moonPhase } from '../util'

/** The pet's moods, as hooks/sprite.ts names them. */
export type Mood = 'idle' | 'busy' | 'ponder' | 'talk'
export type Theme = 'dark' | 'light'

/**
 * One ink: its color on a dark terminal and on a light one (0xRRGGBB), and its
 * weight when dots of several inks share a cell (a cell has one color, so the
 * heaviest ink there wins; a creature's eye outweighs the water behind it).
 */
export type Ink = { readonly dark: number; readonly light: number; readonly weight: number }
/** Index 0 is "no ink"; a scene lists its inks from 1. */
export type Palette = readonly Ink[]

/** An ink as a scene's palette lists it: its dark and light colors, and its weight (1 unless given). */
export const ink = (dark: number, light: number, weight = 1): Ink => ({ dark, light, weight })

/** What a scene is told each tick. */
export type SceneInput = {
  /** The pet's 250 ms tick, counting up. */
  tick: number
  mood: Mood
  /** The room, in cells. */
  cols: number
  rows: number
  /** The bubble's words: a line, '...' while pondering, or undefined for none. */
  bubble?: string
  /** The tick the mod started the latest spectacle at (a long turn just finished); undefined for none. */
  spectacle?: number
  /** Wall clock, ms since the epoch: the moon's phase, the hour. */
  now: number
  theme: Theme
  /**
   * Draw the bubble's border in ASCII (`.-'|`) rather than rounded box
   * drawing, for terminals that draw East Asian ambiguous-width characters
   * two columns wide. Braille itself is never ambiguous.
   */
  asciiBorders?: boolean
}

/** One drawn frame: a code point and an ink per cell, row-major. */
export type Frame = {
  readonly cols: number
  readonly rows: number
  readonly cp: Uint16Array
  readonly ink: Uint8Array
  readonly palette: Palette
  /**
   * Opt-in (see `litFrame`): a background ink per cell, row-major, 0 for the
   * terminal's own. Absent, every cell is on the terminal's own background,
   * as every scene was before it.
   */
  readonly bg?: Uint8Array
}

/** A living scene: `frame` advances it to `input.tick` and draws it. */
export type SceneInstance = { frame(input: SceneInput): Frame }

export type SceneDef = {
  /** What `/pet as <id>` takes. */
  id: string
  name: string
  /** Who the side model is told the pet is. */
  persona: string
  /** The color its bubble's border and the pet's name are drawn in: a theme key for Text, an ink for cells. */
  bubbleInk: Ink
  /** The smallest room it draws a scene in; below it the mod shows its small sprite. */
  minCols: number
  minRows: number
  create(seed: number): SceneInstance
}

// ---------------------------------------------------------------- dots
// The dot canvas is the lab's one (braille.ts `Dots`), passed on here: `set`,
// `get`, `line` (Bresenham, `every` > 1 dotted), `stamp`, `clearCells`,
// `text`, `glyphAt`, and the rest every kind shares.

// ---------------------------------------------------------------- outputs

export const colorOf = (ink: Ink, theme: Theme): number => (theme === 'dark' ? ink.dark : ink.light)

// ---------------------------------------------------------------- light (opt-in)
// For a scene that paints light rather than only dots: inks mixed into
// shaded ramps, cells relit where a light falls without a dot moving, and
// backgrounds under the dots (a glow, a flash, a night of its own). A scene
// that uses none of these draws exactly as before.

/** The ink `t` of the way from `a` to `b` (0..1), channel by channel in each theme; `a`'s weight unless given. */
export const mixInk = (a: Ink, b: Ink, t: number, weight = a.weight): Ink => ({ dark: mixRgb(a.dark, b.dark, t), light: mixRgb(a.light, b.light, t), weight })

/** `n` inks (n >= 2) from `a` to `b`, both ends included: a shaded ramp, weights from `a`'s to `b`'s. */
export function ramp(a: Ink, b: Ink, n: number): Ink[] {
  return Array.from({ length: n }, (_, k) => mixInk(a, b, k / (n - 1), a.weight + ((b.weight - a.weight) * k) / (n - 1)))
}

/**
 * A frame that paints backgrounds: `packFast` fills its cells as any
 * frame's (pass it as `packFast`'s `out`), and the scene writes its `bg`, an
 * ink per cell (0 for the terminal's own), each frame. The adapter draws
 * them as Text backgrounds; a cell under the bubble should be left at 0.
 */
export function litFrame(cols: number, rows: number, palette: Palette): Frame & { readonly bg: Uint8Array } {
  const n = cols * rows
  return { cols, rows, cp: new Uint16Array(n), ink: new Uint8Array(n), palette, bg: new Uint8Array(n) }
}

/**
 * Relights a packed frame where a light falls, never moving a dot: a cell
 * with `level[i]` k > 0 takes ink `lit[k - 1][ink]` (a table per level,
 * indexed by ink; 0 there keeps the ink). The shape holds while the light
 * moves: lightning, a lamp, a passing beam. Glyph cells (words, the bubble)
 * keep theirs.
 */
export function relight(frame: Frame, level: Uint8Array, lit: readonly Uint8Array[]): void {
  for (let i = 0; i < frame.cp.length; i++) {
    const k = level[i]!
    if (k === 0) continue
    const cp = frame.cp[i]!
    if (cp < 0x2800 || cp >= 0x2900) continue
    const to = lit[Math.min(k, lit.length) - 1]![frame.ink[i]!]!
    if (to !== 0) frame.ink[i] = to
  }
}

// ---------------------------------------------------------------- noise, dither, sky

/** A stable hash of integers to [0, 1): the same star is in the same place every frame. */
export function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smooth 1-D value noise in [0, 1), for wind gusts and drifting. */
export function noise1(t: number, seed = 0): number {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u
}

/**
 * Draws a moon of radius `r` dots at (cx, cy) in its phase, lit side in
 * `lit`, a faint rim on the dark side in `rim`, and a Bayer halo in `halo`.
 */
export function drawMoon(d: Dots, cx: number, cy: number, r: number, phase: number, lit: number, rim: number, halo: number, maria = 0): void {
  // The terminator: x where light meets dark on each row, as cos of the phase angle.
  const k = Math.cos(phase * 2 * Math.PI) // 1 new, -1 full
  const waxing = phase < 0.5
  for (let y = -r - 3; y <= r + 3; y++) {
    for (let x = -r - 3; x <= r + 3; x++) {
      const dd = Math.sqrt(x * x + (y * 1.05) * (y * 1.05))
      if (dd <= r + 0.35) {
        const half = Math.sqrt(Math.max(0, r * r - y * y))
        // the lit part spans from the limb to the terminator at k*half (mirrored when waning)
        const xs = waxing ? x : -x
        const isLit = xs >= k * half - 0.25
        if (isLit) d.set(cx + x, cy + y, maria !== 0 && hash(x + 50, y + 50, 7) < 0.18 && dd < r - 1 ? maria : lit)
        else if (dd > r - 0.9) d.set(cx + x, cy + y, rim)
      } else if (halo !== 0 && dd <= r + 3) {
        // a soft halo: thinner as it falls away, the same dots every frame
        const fall = 1 - (dd - r) / 3.2
        const glow = fall * fall * (0.25 + 0.75 * Math.max(0, 0.5 - Math.abs(phase - 0.5)) * 2)
        if (bayer(cx + x, cy + y) < glow * 0.55) d.set(cx + x, cy + y, halo)
      }
    }
  }
}

// ---------------------------------------------------------------- the bubble

export type Box = { c0: number; r0: number; c1: number; r1: number }

/**
 * Draws the speech bubble into the scene, near `anchor` (the cell the
 * creature speaks from: its mouth or head), avoiding `keepOut` (the creature).
 * Prefers the sky above and to the left; falls back to the left side, then
 * the right. Returns where it went, or undefined when it could not fit.
 */
export function drawBubble(
  d: Dots,
  text: string,
  anchor: { c: number; r: number },
  keepOut: Box,
  border: number,
  words: number,
  tail: number,
  ascii = false,
): Box | undefined {
  const G = ascii ? ASCII : ROUND
  // Candidate regions: the sky above the creature, the room to its left, then
  // to its right. In each, the words wrap to the room's width; the first that
  // holds them whole wins, else the roomiest, cut with an ellipsis.
  type Room = { c0: number; c1: number; r0: number; r1: number; side: 'above' | 'left' | 'right' }
  const rooms: Room[] = [
    { c0: 0, c1: d.cols, r0: 0, r1: keepOut.r0, side: 'above' },
    { c0: 0, c1: keepOut.c0 - 1, r0: 0, r1: d.rows, side: 'left' },
    { c0: keepOut.c1 + 1, c1: d.cols, r0: 0, r1: d.rows, side: 'right' },
  ]
  let best: { room: Room; lines: string[]; cap: number } | undefined
  for (const room of rooms) {
    const inner = Math.min(64, room.c1 - room.c0 - 4)
    const maxLines = room.r1 - room.r0 - 2
    if (inner < 8 || maxLines < 1) continue
    let all = wrap(text, inner, 99)
    // balance the lines: the narrowest width that still needs no more of them
    for (let w = inner - 1; w >= 8 && all.length > 1; w--) {
      const tighter = wrap(text, w, 99)
      if (tighter.length > all.length) break
      all = tighter
    }
    const whole = all.length <= maxLines
    const cap = inner * maxLines
    if (whole) { best = { room, lines: all, cap }; break }
    if (best === undefined || cap > best.cap) best = { room, lines: wrap(text, inner, maxLines), cap }
  }
  if (best === undefined) return undefined
  const { room, lines } = best
  const inner = Math.max(...lines.map(l => [...l].length))
  const bw = inner + 4
  const bh = lines.length + 2
  let box: Box
  if (room.side === 'above') {
    // ending a little right of the head, reaching left, sitting on the creature
    const c1 = Math.max(bw, Math.min(d.cols, anchor.c + 3))
    box = { c0: c1 - bw, r0: room.r1 - bh, c1, r1: room.r1 }
  } else {
    // level with the head where it can be, else as low as it fits
    const r1 = Math.max(bh, Math.min(d.rows, anchor.r + 2))
    box = room.side === 'left' ? { c0: room.c1 - bw, r0: r1 - bh, c1: room.c1, r1 } : { c0: room.c0, r0: r1 - bh, c1: room.c0 + bw, r1 }
  }

  // A clear margin of one cell left and right, so dots don't touch the border.
  d.clearCells(box.c0 - 1, box.r0, box.c1 + 1, box.r1)
  const { c0, r0, c1, r1 } = box
  d.glyphAt(c0, r0, G.tl, border)
  d.glyphAt(c1 - 1, r0, G.tr, border)
  d.glyphAt(c0, r1 - 1, G.bl, border)
  d.glyphAt(c1 - 1, r1 - 1, G.br, border)
  for (let c = c0 + 1; c < c1 - 1; c++) {
    d.glyphAt(c, r0, G.h, border)
    d.glyphAt(c, r1 - 1, G.h, border)
  }
  for (let r = r0 + 1; r < r1 - 1; r++) {
    d.glyphAt(c0, r, G.v, border)
    d.glyphAt(c1 - 1, r, G.v, border)
    for (let c = c0 + 1; c < c1 - 1; c++) d.glyphAt(c, r, 0x20, words)
    d.text(c0 + 2, r, lines[r - r0 - 1]!, words)
  }

  // The tail: a short dotted trail of braille from the bubble's edge toward the anchor.
  const ax = anchor.c * 2 + 1, ay = anchor.r * 4 + 1
  let sx: number, sy: number
  if (box.r1 <= keepOut.r0) {
    // from the bottom border, near the anchor's column
    const tc = Math.max(c0 + 2, Math.min(c1 - 3, anchor.c))
    d.glyphAt(tc, r1 - 1, G.down, border) // ┬ where the tail leaves
    sx = tc * 2 + 1; sy = r1 * 4
  } else {
    const tr = Math.max(r0 + 1, Math.min(r1 - 2, anchor.r))
    const isLeft = box.c1 <= keepOut.c0
    d.glyphAt(isLeft ? c1 - 1 : c0, tr, isLeft ? G.right : G.left, border) // ├ or ┤
    sx = isLeft ? c1 * 2 : c0 * 2 - 1; sy = tr * 4 + 2
  }
  const steps = Math.max(1, Math.round(Math.hypot(ax - sx, ay - sy) / 2))
  for (let k = 0; k < Math.min(steps, 5); k++) {
    const t = (k + 0.5) / steps
    const x = sx + (ax - sx) * t, y = sy + (ay - sy) * t
    const ci = Math.floor(y / 4) * d.cols + Math.floor(x / 2)
    if (d.glyph[ci] === 0) d.set(x, y, tail)
  }
  return box
}

// ---------------------------------------------------------------- performance (opt-in)
// For a scene whose frame costs more than it should: a faster packer, and
// still layers kept per room and built a slice a tick. Nothing above uses
// them; a scene that uses none draws exactly as before.

/** Each ink's score for 1 to 8 dots, worked out once a palette (`packFast`). */
type PackTable = { readonly weights: readonly unknown[]; readonly score: Float32Array }
const PACK_TABLES = new WeakMap<Palette, PackTable>()
const tallyInk = new Uint8Array(8)
const tallyCount = new Uint8Array(8)

/**
 * The score table for a palette: at `ink * 9 + n`, what the packing rule
 * sums for `n` dots of that ink (float32, one weight at a time, so exactly
 * its numbers), and NaN past the palette's end, where it scores nothing.
 * Kept per palette, and made again if a weight changed since.
 */
function packTable(palette: Palette): Float32Array {
  const known = PACK_TABLES.get(palette)
  if (known !== undefined && known.weights.length === palette.length) {
    let same = true
    for (let k = 0; k < palette.length && same; k++) same = Object.is(known.weights[k], palette[k]?.weight ?? 1)
    if (same) return known.score
  }
  const score = new Float32Array(256 * 9).fill(Number.NaN)
  const weights: unknown[] = []
  const sum = new Float32Array(1)
  for (let k = 0; k < palette.length; k++) {
    const weight = palette[k]?.weight ?? 1
    weights.push(weight)
    if (k >= 256) continue
    sum[0] = 0
    score[k * 9] = 0
    for (let n = 1; n <= 8; n++) {
      sum[0] = sum[0]! + weight
      score[k * 9 + n] = sum[0]!
    }
  }
  PACK_TABLES.set(palette, { weights, score })
  return score
}

/**
 * Packs the canvas into a frame. A cell's color is the ink with the
 * greatest count x weight among its dots, summed in float32, so a two-dot
 * eye beats six dots of water and a patch's edge doesn't flicker as a
 * creature slides a dot; a tie goes to the lower ink; a cell whose best
 * score is not above 0 (it holds only inks of weight 0 or less) keeps its
 * dots with ink 0, the theme's own color; an ink past the palette's end
 * scores nothing. It counts the few inks a cell holds and looks their
 * scores up in a table made once a palette, and a cell of one ink (most of
 * them) needs no counting at all. The table is kept per palette array and
 * made again when a weight changes.
 *
 *     this.out = packFast(this.d, PALETTE, this.out)
 */
export function packFast(d: Dots, palette: Palette, out?: Frame): Frame {
  const n = d.cols * d.rows
  const frame: Frame = out !== undefined && out.cp.length === n ? out : { cols: d.cols, rows: d.rows, cp: new Uint16Array(n), ink: new Uint8Array(n), palette }
  const score = packTable(palette)
  const dot = d.dot, w = d.w, cols = d.cols
  const glyph = d.glyph, glyphInk = d.glyphInk, cp = frame.cp, inks = frame.ink
  for (let r = 0; r < d.rows; r++) {
    const top = r * 4 * w
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const g = glyph[i]!
      if (g !== 0) {
        cp[i] = g
        inks[i] = glyphInk[i]!
        continue
      }
      // the cell's eight dots, in DOT_BIT's order: left, right, a row at a time (unrolled below)
      const a = top + c * 2
      const d0 = dot[a]!, d1 = dot[a + 1]!, d2 = dot[a + w]!, d3 = dot[a + w + 1]!
      const d4 = dot[a + 2 * w]!, d5 = dot[a + 2 * w + 1]!, d6 = dot[a + 3 * w]!, d7 = dot[a + 3 * w + 1]!
      const any = d0 | d1 | d2 | d3 | d4 | d5 | d6 | d7
      if (any === 0) {
        cp[i] = 0x20
        inks[i] = 0
        continue
      }
      const mask = (d0 !== 0 ? 0x01 : 0) | (d1 !== 0 ? 0x08 : 0) | (d2 !== 0 ? 0x02 : 0) | (d3 !== 0 ? 0x10 : 0) | (d4 !== 0 ? 0x04 : 0) | (d5 !== 0 ? 0x20 : 0) | (d6 !== 0 ? 0x40 : 0) | (d7 !== 0 ? 0x80 : 0)
      cp[i] = 0x2800 + mask
      // one ink: then every dot that is set equals all of them or-ed together
      if ((d0 === 0 || d0 === any) && (d1 === 0 || d1 === any) && (d2 === 0 || d2 === any) && (d3 === 0 || d3 === any) && (d4 === 0 || d4 === any) && (d5 === 0 || d5 === any) && (d6 === 0 || d6 === any) && (d7 === 0 || d7 === any)) {
        inks[i] = score[any * 9 + POPCOUNT[mask]!]! > 0 ? any : 0
        continue
      }
      // several: count each, then the best score, the lower ink on a tie
      let m = 0
      for (let k = 0; k < 8; k++) {
        const v = k === 0 ? d0 : k === 1 ? d1 : k === 2 ? d2 : k === 3 ? d3 : k === 4 ? d4 : k === 5 ? d5 : k === 6 ? d6 : d7
        if (v === 0) continue
        let j = 0
        while (j < m && tallyInk[j] !== v) j++
        if (j === m) {
          tallyInk[m] = v
          tallyCount[m++] = 1
        } else tallyCount[j] = tallyCount[j]! + 1
      }
      let best = 0, most = 0
      for (let j = 0; j < m; j++) {
        const v = tallyInk[j]!, s = score[v * 9 + tallyCount[j]!]!
        if (s > most || (s === most && v < best)) {
          most = s
          best = v
        }
      }
      inks[i] = best
    }
  }
  return frame
}

/**
 * How a still is built: all at once (return it), or in parts (a generator,
 * `function*`, with a `yield` between its parts, returning it at the end; a
 * part may `yield` a still to show until the build is done).
 */
export type StillBuild<T, K, X> = (cols: number, rows: number, key: K, extra: X) => T | Generator<T | undefined, T, void>

type Kept<T> = { readonly id: string; readonly cols: number; readonly rows: number; value: T | undefined; done: boolean; job: Generator<T | undefined, T, void> | undefined }

const isGenerator = <T>(v: unknown): v is Generator<T | undefined, T, void> =>
  typeof v === 'object' && v !== null && typeof (v as Generator).next === 'function' && typeof (v as Generator)[Symbol.iterator] === 'function'

/**
 * A scene's still layers (its ridges, stars, strata, its creature's still
 * bulk), kept per room: built the first time a room and key are asked for,
 * and kept, the `keep` most recently used (default 4), so the pet window
 * opening and closing, which moves a scene between the band's room and the
 * window's, builds each room's layers once rather than every time. `key` is
 * whatever else the still is built from (the moon's phase in steps, a level
 * of light; fold the theme in if it draws differently); `extra` goes to the
 * build when one starts and is not part of the key (the exact phase).
 *
 * A build written as a generator is run `slices` parts a call (default all
 * of them at once): a stall spread over a few ticks. Until it is done, `at`
 * gives the newest still done for the same room (another key: the moon
 * moved on, the old one shows until the new is ready), else the latest
 * still the build yielded, else undefined: the scene draws without it.
 * Once done, every frame is the one an eager build would have drawn, as
 * long as the scene's step reads nothing that is still building.
 *
 * A kept still is shared by every frame that asks for its room: keep in it
 * only what a build makes (no cursors, no state of the last time it was
 * drawn), or reset that state when the room changes.
 *
 *     private stills = new StillCache((cols, rows, level: number) => buildStill(cols, rows, level))
 *     ... const still = this.stills.at(input.cols, input.rows, level)
 */
export class StillCache<T, K extends string | number = string, X = undefined> {
  readonly keep: number
  readonly slices: number
  private readonly build: StillBuild<T, K, X>
  private kept: Kept<T>[] = []

  constructor(build: StillBuild<T, K, X>, opts: { keep?: number; slices?: number } = {}) {
    this.build = build
    this.keep = Math.max(1, Math.floor(opts.keep ?? 4))
    this.slices = Math.max(1, Math.floor(opts.slices ?? Number.POSITIVE_INFINITY))
  }

  /** The still for this room and key: kept, built now, or (built in parts) building; see the class. */
  at(cols: number, rows: number, key: K, extra?: X): T | undefined {
    const id = `${cols}x${rows}:${key}`
    const k = this.kept.findIndex(e => e.id === id)
    let e: Kept<T>
    if (k >= 0) {
      e = this.kept[k]!
      if (k !== this.kept.length - 1) {
        this.kept.splice(k, 1)
        this.kept.push(e)
      }
    } else {
      const made = this.build(cols, rows, key, extra as X)
      e = isGenerator<T>(made) ? { id, cols, rows, value: undefined, done: false, job: made } : { id, cols, rows, value: made, done: true, job: undefined }
      this.kept.push(e)
      if (this.kept.length > this.keep) this.kept.shift()
    }
    for (let n = 0; !e.done && n < this.slices; n++) {
      const step = e.job!.next()
      if (step.done === true) {
        e.value = step.value
        e.done = true
        e.job = undefined
      } else if (step.value !== undefined) e.value = step.value
    }
    if (e.done) return e.value
    for (let j = this.kept.length - 2; j >= 0; j--) {
      const o = this.kept[j]!
      if (o.done && o.cols === cols && o.rows === rows) return o.value
    }
    return e.value
  }

  /** Whether `at` would give this room and key's finished still. */
  ready(cols: number, rows: number, key: K): boolean {
    const id = `${cols}x${rows}:${key}`
    return this.kept.some(e => e.id === id && e.done)
  }

  /** Forgets every still, built or building. */
  clear(): void {
    this.kept = []
  }
}

/**
 * Counts the dots of a canvas that came on or went off since it last
 * looked (its first look, or a canvas of another size, counts 0): what the
 * rest of a scene moved this tick, to take from a budget of dots a tick.
 */
export class DotWatch {
  private was = new Uint8Array(0)

  toggled(d: Dots): number {
    const dots = d.dot, was = this.was
    let n = 0
    if (was.length === dots.length) {
      for (let i = 0; i < dots.length; i++) if ((dots[i] === 0) !== (was[i] === 0)) n++
      was.set(dots)
    } else this.was = Uint8Array.from(dots)
    return n
  }
}
