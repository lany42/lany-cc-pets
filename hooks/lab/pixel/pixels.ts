// The pixel kind's surface: a pixel pet's box as whole pixels, one a column
// and two a row, each a color of the pet's palette or bare. A pet paints it
// by letter (`set`, `stamp`, `erase`) at whole coordinates only: a fraction
// of a pixel, or a letter its palette doesn't know, is refused with an
// error that names it, and a pixel outside the box is dropped. There is
// nothing to fill, wash or offset by part of a pixel, and no color but the
// palette's can be drawn.
//
// The kind's adapter (index.ts) clears the surface before every paint and
// maps it to cells with `cellsOf`: each cell's two pixels straight to one of
// the five cells (a space, on the terminal's own background or a color; an
// upper or a lower half block), with no encoder, so bare is its own value
// and a pixel of any color stays a pixel. So every frame a pixel pet shows
// is whole pixels of its own palette by construction, whatever its code
// draws. `lettersOver` writes a pet's ASCII letters over the cells, refusing
// one outside the box. Pure: imports nothing at run time but cells.ts.
import { TERMINAL } from '../cells'

/** A pixel pet's colors by letter, 0xRRGGBB, the same on a dark and a light terminal: one character a color, never '.', which is bare. */
export type Palette = Readonly<Record<string, number>>

/** Letter rows and where their top left goes: a part of a pet, laid at a column and pixel row of its own. */
export type Patch = { readonly art: readonly string[]; readonly x: number; readonly y: number }

/** A letter a pet writes over its cells: a printable ASCII code point, its cell's column and row in the box, and its 0xRRGGBB ink. */
export type Letter = { readonly cp: number; readonly c: number; readonly r: number; readonly ink: number }

/** A row of letters turned left for right: a symmetric part drawn once. */
export const mirror = (row: string): string => [...row].reverse().join('')

/** A pixel with no color: the terminal's own background shows there. */
const BARE = -1
const UPPER = 0x2580
const LOWER = 0x2584

const isColor = (ink: number): boolean => Number.isInteger(ink) && ink >= 0 && ink <= 0xffffff

/** Refuses a coordinate that is not a whole pixel, naming it. */
function whole(x: number, y: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new RangeError(`pixel ${x},${y} is not a whole pixel`)
}

/** A pixel pet's box as whole pixels: `columns` x `2 * rows`, each a color of its palette or bare. */
export class Pixels {
  /** Its box in cells. */
  readonly columns: number
  readonly rows: number
  /** Its box in pixels: a pixel a column, two a row. */
  readonly w: number
  readonly h: number
  readonly palette: Palette
  private readonly colors: ReadonlyMap<string, number>
  /** Each pixel's color, row by row from the top left, or BARE. */
  private readonly ink: Int32Array

  constructor(columns: number, rows: number, palette: Palette) {
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) throw new RangeError(`a box of ${columns} x ${rows} cells is not whole`)
    const colors = new Map<string, number>()
    for (const [letter, ink] of Object.entries(palette)) {
      if ([...letter].length !== 1 || letter === '.') throw new RangeError(`the palette's letter "${letter}" is not one character other than "."`)
      if (!isColor(ink)) throw new RangeError(`the palette's letter "${letter}" is not a color (0xRRGGBB): ${ink}`)
      colors.set(letter, ink)
    }
    this.columns = columns
    this.rows = rows
    this.w = columns
    this.h = rows * 2
    this.palette = palette
    this.colors = colors
    this.ink = new Int32Array(this.w * this.h).fill(BARE)
  }

  /** Every pixel bare: the adapter's, before every paint. */
  clear(): void {
    this.ink.fill(BARE)
  }

  /** The color `letter` names, or a refusal naming it. */
  private colorOf(letter: string): number {
    const ink = this.colors.get(letter)
    if (ink === undefined) throw new RangeError(`no color for the letter "${letter}"`)
    return ink
  }

  /** Pixel `x`, `y` (column, pixel row from the box's top left) in its palette's `letter`; outside the box, nothing. */
  set(x: number, y: number, letter: string): void {
    whole(x, y)
    const ink = this.colorOf(letter)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.ink[y * this.w + x] = ink
  }

  /** Pixel `x`, `y` bare again; outside the box, nothing. */
  erase(x: number, y: number): void {
    whole(x, y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.ink[y * this.w + x] = BARE
  }

  /** Letter rows with their top left at column `x`, pixel row `y`: each letter a pixel of its color, '.' leaving what is there. */
  stamp(art: readonly string[], x: number, y: number): void {
    whole(x, y)
    for (let r = 0; r < art.length; r++) {
      const row = art[r]!
      for (let c = 0; c < row.length; c++) {
        const letter = row[c]!
        if (letter !== '.') this.set(x + c, y + r, letter)
      }
    }
  }

  /** Pixel `x`, `y`'s color (0xRRGGBB), or undefined where it is bare or outside the box. */
  inkAt(x: number, y: number): number | undefined {
    whole(x, y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return undefined
    const ink = this.ink[y * this.w + x]!
    return ink === BARE ? undefined : ink
  }

  /** The pixels as a Raster's cells, into `out` (3 words a cell): each cell's upper and lower pixel as one of the five cells. */
  cellsOf(out: Uint32Array): Uint32Array {
    const { w, ink } = this
    if (out.length !== w * this.rows * 3) throw new RangeError(`a buffer of ${out.length} words is not ${w} x ${this.rows} cells`)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < w; c++) {
        const top = ink[2 * r * w + c]!
        const bottom = ink[(2 * r + 1) * w + c]!
        const at = (r * w + c) * 3
        if (top === bottom) {
          // Two pixels alike: a space on their color, or on the terminal's own.
          out[at] = 0x20
          out[at + 1] = TERMINAL
          out[at + 2] = top === BARE ? TERMINAL : top
        } else if (bottom === BARE) {
          out[at] = UPPER
          out[at + 1] = top
          out[at + 2] = TERMINAL
        } else if (top === BARE) {
          out[at] = LOWER
          out[at + 1] = bottom
          out[at + 2] = TERMINAL
        } else {
          out[at] = UPPER
          out[at + 1] = top
          out[at + 2] = bottom
        }
      }
    }
    return out
  }
}

/** Writes `letters` over a frame of `columns` x `rows` cells: each its code point in its ink on the terminal's own background. One outside the box, not printable ASCII or not a color is refused, naming it. */
export function lettersOver(out: Uint32Array, columns: number, rows: number, letters: readonly Letter[]): void {
  for (const { cp, c, r, ink } of letters) {
    if (!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || r < 0 || c >= columns || r >= rows) throw new RangeError(`a letter at cell ${c},${r} is outside the box of ${columns} x ${rows}`)
    if (!Number.isInteger(cp) || cp < 0x20 || cp > 0x7e) throw new RangeError(`the letter U+${Number(cp).toString(16).toUpperCase()} at cell ${c},${r} is not printable ASCII`)
    if (!isColor(ink)) throw new RangeError(`the letter at cell ${c},${r} has no color (0xRRGGBB): ${ink}`)
    const at = (r * columns + c) * 3
    out[at] = cp
    out[at + 1] = ink
    out[at + 2] = TERMINAL
  }
}
