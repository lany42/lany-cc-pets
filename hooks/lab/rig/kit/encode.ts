// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The painted look's encoder: each cell's SX x SY samples become the one
// glyph and two colors that show them best. The glyphs are block elements a
// terminal draws itself (the 16 quadrant patterns, half blocks among them,
// the lower eighths, the upper eighth and two left quarters), so they tile
// without seams in any font, and an edge lands on an eighth of a cell: a slow
// move is smooth. Each glyph splits the cell's samples into its ink and the
// rest; the error of showing each part as one color is found from sums over
// the cell's quadrants, rows and columns, so a glyph costs a few adds, not a
// pass over the samples. Pure: imports nothing but the canvas.
import { Canvas, DEFAULT, SX, SY } from './canvas'

/** The sample groups a glyph's ink is made of: the 4 quadrants (2 x 4), the 8 rows (4 x 1), the 4 columns (1 x 8). */
const QUAD = 0
const ROW = 4
const COLUMN = 12
const GROUPS = 16
/** Per group: red, green, blue sums, the weighted sum of squares, and how many samples the figure covers. */
const SLOTS = 5
const SIZE = [8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8]

export type Glyph = { cp: number; groups: readonly number[]; n: number }

const glyph = (cp: number, groups: number[]): Glyph => ({ cp, groups, n: groups.reduce((sum, at) => sum + SIZE[at]!, 0) })

/** The 16 quadrant patterns (bit 1 upper left, 2 upper right, 4 lower left, 8 lower right). */
const QUADRANTS = [...' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█'].map((ch, bits) =>
  glyph(
    ch.codePointAt(0)!,
    [0, 1, 2, 3].filter(q => ((bits >> q) & 1) === 1).map(q => QUAD + q),
  ),
)

/** Every glyph the encoder may pick; the space (no ink) first. */
export const GLYPHS: readonly Glyph[] = [
  ...QUADRANTS,
  // The lower eighths but the half, a quadrant pattern already: ▁▂▃ ▅▆▇.
  ...[1, 2, 3, 5, 6, 7].map(eighths => glyph(0x2580 + eighths, Array.from({ length: eighths }, (_, at) => ROW + SY - 1 - at))),
  // The upper eighth ▔, the left quarter ▎ and three quarters ▊.
  glyph(0x2594, [ROW]),
  glyph(0x258e, [COLUMN]),
  glyph(0x258a, [COLUMN, COLUMN + 1, COLUMN + 2]),
]

/**
 * The glyphs a terminal draws one column wide even where it draws East Asian
 * ambiguous-width characters two (UAX #11 calls these neutral): the space,
 * the right half and the quadrants U+2596-259F. With a cell's two colors
 * swapped they make 14 of the 16 quadrant patterns (the left half is the
 * right one turned round); the top and bottom halves and the eighths are
 * ambiguous, so not among them. For a look that must keep to narrow glyphs.
 */
export const NARROW_GLYPHS: readonly Glyph[] = GLYPHS.filter(one => one.cp === 0x20 || one.cp === 0x2590 || (one.cp >= 0x2596 && one.cp <= 0x259f))

/** Per channel weights of the error: green counts most, as the eye counts it. */
const WR = 2
const WG = 4
const WB = 3
/** How much of its error a cell forgives the glyph it showed last: a slow move doesn't flicker an edge between two. */
const KEEP = 0.85

const ALL = SX * SY

/**
 * Encodes the canvas's cells from `c0, r0` up to `c1, r1` into `out`, three
 * words a cell (code point, foreground, background; DEFAULT for the
 * terminal's own). What `out` held for a cell (the frame before) breaks near
 * ties in its favor. `glyphs` are the ones it may pick: GLYPHS unless told
 * (NARROW_GLYPHS for a terminal that draws ambiguous ones wide).
 */
export function encode(canvas: Canvas, out: Uint32Array, c0 = 0, r0 = 0, c1 = canvas.cols, r1 = canvas.rows, glyphs: readonly Glyph[] = GLYPHS): void {
  const { w, r, g, b, cover } = canvas
  const gr = (canvas.ground >> 16) & 255
  const gg = (canvas.ground >> 8) & 255
  const gb = canvas.ground & 255
  const ground2 = WR * gr * gr + WG * gg * gg + WB * gb * gb
  const sums = new Float64Array(GROUPS * SLOTS)
  for (let cr = r0; cr < r1; cr++) {
    for (let cc = c0; cc < c1; cc++) {
      sums.fill(0)
      let covered = 0
      let first = -1
      let isFlat = true
      for (let y = 0; y < SY; y++) {
        const row = (cr * SY + y) * w + cc * SX
        for (let x = 0; x < SX; x++) {
          const i = row + x
          const isOn = cover[i] === 1
          const vr = isOn ? r[i]! : gr
          const vg = isOn ? g[i]! : gg
          const vb = isOn ? b[i]! : gb
          if (isOn) covered++
          // A cell of one color all through (most of a flat-shaded figure) needs no search.
          const key = isOn ? (Math.round(vr) << 16) | (Math.round(vg) << 8) | Math.round(vb) : -2
          if (first === -1) first = key
          else if (key !== first) isFlat = false
          const ss = WR * vr * vr + WG * vg * vg + WB * vb * vb
          const on = isOn ? 1 : 0
          const q = (QUAD + (y < SY / 2 ? 0 : 2) + (x < SX / 2 ? 0 : 1)) * SLOTS
          sums[q]! += vr
          sums[q + 1]! += vg
          sums[q + 2]! += vb
          sums[q + 3]! += ss
          sums[q + 4]! += on
          const rw = (ROW + y) * SLOTS
          sums[rw]! += vr
          sums[rw + 1]! += vg
          sums[rw + 2]! += vb
          sums[rw + 3]! += ss
          sums[rw + 4]! += on
          const cl = (COLUMN + x) * SLOTS
          sums[cl]! += vr
          sums[cl + 1]! += vg
          sums[cl + 2]! += vb
          sums[cl + 3]! += ss
          sums[cl + 4]! += on
        }
      }
      const at = (cr * canvas.cols + cc) * 3
      if (covered === 0) {
        out[at] = 0x20
        out[at + 1] = DEFAULT
        out[at + 2] = DEFAULT
        continue
      }
      if (isFlat && covered === ALL) {
        out[at] = 0x20
        out[at + 1] = DEFAULT
        out[at + 2] = first >>> 0
        continue
      }
      // The cell's totals: its four quadrants together.
      let tr = 0
      let tg = 0
      let tb = 0
      let tss = 0
      for (let q = 0; q < 4; q++) {
        tr += sums[q * SLOTS]!
        tg += sums[q * SLOTS + 1]!
        tb += sums[q * SLOTS + 2]!
        tss += sums[q * SLOTS + 3]!
      }
      const last = out[at]!
      let best = Infinity
      let bestCp = 0x20
      let bestFg = DEFAULT
      let bestBg = DEFAULT
      for (const one of glyphs) {
        let fr = 0
        let fg = 0
        let fb = 0
        let fss = 0
        let fCover = 0
        for (const group of one.groups) {
          const s = group * SLOTS
          fr += sums[s]!
          fg += sums[s + 1]!
          fb += sums[s + 2]!
          fss += sums[s + 3]!
          fCover += sums[s + 4]!
        }
        const fn = one.n
        const bn = ALL - fn
        // The ink is the figure: a glyph whose ink would fall mostly on bare background is not this cell's.
        if (fn > 0 && fCover * 2 < fn) continue
        // The rest takes the terminal's own background where it is mostly bare, else the figure's mean.
        const bCover = covered - fCover
        const isBare = bn > 0 && bCover * 2 <= bn
        const br = tr - fr
        const bg = tg - fg
        const bb = tb - fb
        const bss = tss - fss
        let err = fn > 0 ? fss - (WR * fr * fr + WG * fg * fg + WB * fb * fb) / fn : 0
        if (bn > 0) err += isBare ? bss - 2 * (WR * gr * br + WG * gg * bg + WB * gb * bb) + bn * ground2 : bss - (WR * br * br + WG * bg * bg + WB * bb * bb) / bn
        if (one.cp === last) err *= KEEP
        if (err < best) {
          best = err
          bestCp = one.cp
          bestFg = fn > 0 ? rgb(fr / fn, fg / fn, fb / fn) : DEFAULT
          bestBg = bn === 0 ? DEFAULT : isBare ? DEFAULT : rgb(br / bn, bg / bn, bb / bn)
        }
      }
      // A full block is a space on its background: the same cell, quieter to draw.
      if (bestCp === 0x2588) {
        bestCp = 0x20
        bestBg = bestFg
        bestFg = DEFAULT
      }
      out[at] = bestCp
      out[at + 1] = bestFg
      out[at + 2] = bestBg
    }
  }
}

const rgb = (r: number, g: number, b: number): number => ((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)) >>> 0
