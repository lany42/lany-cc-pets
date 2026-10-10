// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The drawn kind's braille: the lab's dot canvas (braille.ts `Dots`), and the
// cells and runs it draws as.
//
// Pure TS: no DOM; it imports only braille.ts and runs.ts, both pure. Each terminal cell
// is 2 dots wide and 4 tall; a dot holds an ink (an index into the pet's
// palette, 0 = no dot). A cell takes the braille glyph of its inked dots and
// the colour of its highest ink (braille.ts `topCell`), so a pet orders its
// palette by priority: eyes above body above background.
import { addCell } from '../../runs'
import type { Run } from '../../runs'
import { Dots, topCell } from '../braille'

export { Dots }
/** One run of text in one style, as the band draws it with nested `Text`: the lab's one Run (runs.ts). */
export type { Run }

/** How an ink is drawn: a theme key or raw colour, its background, dim, bold. */
export type Style = { color?: string; bg?: string; dim?: true; bold?: true }

/** One cell before styling: its glyph and the ink that colours it (0 = default). */
export type Cell = { ch: string; ink: number }

/** The canvas as cells: a braille glyph per inked cell (a space when empty), coloured by its highest ink. */
export function cellsOf(d: Dots): Cell[][] {
  const { cols, rows, w, dot } = d
  const out: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      const cell = topCell(dot, r * 4 * w + c * 2, w)
      row.push(cell === 0 ? { ch: ' ', ink: 0 } : { ch: String.fromCharCode(0x2800 + (cell & 0xff)), ink: cell >> 8 })
    }
    out.push(row)
  }
  return out
}

/** Writes `text` into `cells` at (row, col) in `ink`, clipped to the grid. */
export function put(cells: Cell[][], row: number, col: number, text: string, ink: number): void {
  const line = cells[row]
  if (line === undefined) return
  for (let i = 0; i < text.length; i++) {
    if (col + i >= 0 && col + i < line.length) line[col + i] = { ch: text[i] ?? ' ', ink }
  }
}

/**
 * Cells as rows of styled runs (runs.ts `addCell`); a space joins the run
 * before it, so runs stay few. Where the palette paints a background (its
 * ink 0 has one), a space is a cell of ink 0's style like any other.
 */
export function runsOf(cells: readonly (readonly Cell[])[], palette: readonly Style[]): Run[][] {
  const ground = palette[0]?.bg
  return cells.map(row => {
    const runs: Run[] = []
    for (const cell of row) {
      const last = runs[runs.length - 1]
      // a blank takes the style before it (unless the palette paints a background), so runs stay few
      if (cell.ch === ' ' && last !== undefined && ground === undefined) {
        addCell(runs, ' ', true, last.color, last.backgroundColor)
        continue
      }
      const style: Style = palette[cell.ink] ?? {}
      addCell(runs, cell.ch, false, style.color, style.bg ?? ground, style.dim === true ? true : undefined, style.bold === true ? true : undefined)
    }
    return runs
  })
}

/** A small deterministic hash, for "random" choices that must come out the same on every redraw. */
export function hash(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    h ^= p | 0
    h = Math.imul(h, 0x01000193)
    h ^= h >>> 13
  }
  return (h >>> 0) / 0x100000000
}
