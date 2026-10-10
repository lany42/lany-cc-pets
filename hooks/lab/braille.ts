// Braille, the dots every braille look draws in: a terminal cell is 2 dots
// wide and 4 tall, and its glyph is U+2800 plus a bit for each dot inked.
// This is the one bit table, the one dot canvas every kind draws on (the
// scenes, the grown and the drawn pets), and the highest-ink rule a cell is
// packed by in the grown and drawn kinds; the scene kit's weighted vote
// (`packFast` in scene/kit.ts) is the other rule, and is the kit's.
// Pure: imports nothing but util.ts, itself pure.
//
//            x=0   x=1          Unicode dot numbers
//   y=0     0x01  0x08              1  4
//   y=1     0x02  0x10              2  5
//   y=2     0x04  0x20              3  6
//   y=3     0x40  0x80              7  8
import { isNarrow } from './util'

/** Braille's bit for dot (x, y) of a cell, at [y * 2 + x]. */
export const DOT_BIT: readonly number[] = [0x01, 0x08, 0x02, 0x10, 0x04, 0x20, 0x40, 0x80]

/** How many dots a mask holds. */
export const POPCOUNT = new Uint8Array(256)
for (let m = 1; m < 256; m++) POPCOUNT[m] = (m & 1) + POPCOUNT[m >> 1]!

/**
 * One cell by the highest-ink rule: the cell whose top-left dot is `at`, in
 * dots `w` wide, as `top << 8 | mask`, its highest ink and its braille bits
 * (0 for a cell with no dot). A kind that packs so numbers its inks from
 * back to front, and a cell takes its frontmost. The kernel the grown and
 * drawn kinds' loops share; each loop makes what its kind draws of it.
 */
export function topCell(dot: Uint8Array, at: number, w: number): number {
  let mask = 0
  let top = 0
  for (let k = 0; k < 8; k++) {
    const v = dot[at + (k >> 1) * w + (k & 1)]!
    if (v === 0) continue
    mask |= DOT_BIT[k]!
    if (v > top) top = v
  }
  return (top << 8) | mask
}

/**
 * A dot canvas the size of `cols x rows` cells: one ink index per dot (0 =
 * empty), and a layer of whole-cell glyphs over them (words, a bubble's
 * border). Every kind draws on this one class, so each call site sees one
 * shape. Two line rules, which place different dots: `line` (Bresenham,
 * the scenes' and the drawn pets') and `trace` (even steps along the longer
 * axis, rounded: Tokyo Cat's and the stray's).
 */
export class Dots {
  readonly cols: number
  readonly rows: number
  readonly w: number
  readonly h: number
  readonly dot: Uint8Array
  /** Whole-cell glyphs laid over the dots (words, borders): a code point, 0 for none. */
  readonly glyph: Uint16Array
  readonly glyphInk: Uint8Array

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.w = cols * 2
    this.h = rows * 4
    this.dot = new Uint8Array(this.w * this.h)
    this.glyph = new Uint16Array(cols * rows)
    this.glyphInk = new Uint8Array(cols * rows)
  }

  clear(): void {
    this.dot.fill(0)
    this.glyph.fill(0)
    this.glyphInk.fill(0)
  }

  /** Inks dot (x, y), rounded; later draws cover earlier ones, 0 clears, and a dot off the canvas is dropped. */
  set(x: number, y: number, ink: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.dot[y * this.w + x] = ink
  }

  /** The ink at dot (x, y), given whole; 0 off the canvas. */
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.dot[y * this.w + x]!
  }

  /** The ink at dot (x, y), rounded; 0 off the canvas. */
  at(x: number, y: number): number {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.dot[y * this.w + x]!
  }

  /** Inks dot (x, y), rounded, only if `ink` outranks what is there. */
  over(x: number, y: number, ink: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = y * this.w + x
    if (this.dot[i]! < ink) this.dot[i] = ink
  }

  erase(x: number, y: number): void {
    this.set(x, y, 0)
  }

  /** Bresenham line; `every` > 1 draws a dotted line. */
  line(x0: number, y0: number, x1: number, y1: number, ink: number, every = 1): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let n = 0
    for (let err = dx + dy; ; n++) {
      if (n % every === 0) this.set(x0, y0, ink)
      if (x0 === x1 && y0 === y1) return
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }

  /** A line in even steps along its longer axis, as many as it is long, each dot rounded. */
  trace(x0: number, y0: number, x1: number, y1: number, ink: number): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let k = 0; k <= n; k++) this.set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, ink)
  }

  /** A row of dots from x0 to x1 (rounded) at y; `every` > 1 dots it. */
  hline(x0: number, x1: number, y: number, ink: number, every = 1): void {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) if ((x - Math.round(x0)) % every === 0) this.set(x, y, ink)
  }

  /** A column of dots from y0 to y1 (rounded) at x; `every` > 1 dots it. */
  vline(x: number, y0: number, y1: number, ink: number, every = 1): void {
    for (let y = Math.round(y0); y <= Math.round(y1); y++) if ((y - Math.round(y0)) % every === 0) this.set(x, y, ink)
  }

  /** A rectangle's outline, its corners at (x0, y0) and (x1, y1). */
  box(x0: number, y0: number, x1: number, y1: number, ink: number): void {
    this.hline(x0, x1, y0, ink)
    this.hline(x0, x1, y1, ink)
    this.vline(x0, y0, y1, ink)
    this.vline(x1, y0, y1, ink)
  }

  /**
   * Stamps pixel art: each character found in `map` sets that ink (0
   * clears), `,` clears the dot (a body hides what is behind it), anything
   * else leaves it. `flip` mirrors it left to right.
   */
  stamp(art: readonly string[], ox: number, oy: number, map: Readonly<Record<string, number>>, flip = false): void {
    ox = Math.round(ox)
    oy = Math.round(oy)
    for (let y = 0; y < art.length; y++) {
      const row = art[y]!
      const n = row.length
      for (let x = 0; x < n; x++) {
        const ch = row[flip ? n - 1 - x : x]!
        if (ch === ',') this.set(ox + x, oy + y, 0)
        else {
          const ink = map[ch]
          if (ink !== undefined) this.set(ox + x, oy + y, ink)
        }
      }
    }
  }

  /** Erases every dot for which `keep` says false. */
  clip(keep: (x: number, y: number) => boolean): void {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!keep(x, y)) this.dot[y * this.w + x] = 0
  }

  /** Clears a rectangle of cells, dots and glyphs. */
  clearCells(c0: number, r0: number, c1: number, r1: number): void {
    for (let r = Math.max(0, r0); r < Math.min(this.rows, r1); r++) {
      for (let c = Math.max(0, c0); c < Math.min(this.cols, c1); c++) {
        for (let y = r * 4; y < r * 4 + 4; y++) {
          this.dot[y * this.w + c * 2] = 0
          this.dot[y * this.w + c * 2 + 1] = 0
        }
        this.glyph[r * this.cols + c] = 0
      }
    }
  }

  /** Lays text over the dots, one character per cell. Narrow-safe characters only; others become '?'. */
  text(c: number, r: number, s: string, ink: number): void {
    if (r < 0 || r >= this.rows) return
    let i = 0
    for (const ch of s) {
      const col = c + i++
      if (col < 0 || col >= this.cols) continue
      const cp = ch.codePointAt(0)!
      this.glyph[r * this.cols + col] = isNarrow(cp) ? cp : 0x3f
      this.glyphInk[r * this.cols + col] = ink
    }
  }

  glyphAt(c: number, r: number, cp: number, ink: number): void {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return
    this.glyph[r * this.cols + c] = cp
    this.glyphInk[r * this.cols + c] = ink
  }
}
