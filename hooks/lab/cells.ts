// A look's frame as Raster cells, shared by every kind that paints in them
// (the rig looks, the pixel pets, a scene that opts into cell rendering):
// the same frame as Text runs, built from the cells only when asked, and
// what the engine's Raster can hold of it. Pure: imports nothing at run
// time but util.ts, itself pure.
import type { LabCells, LabRun } from './look'
import { hex } from './util'

/** A Raster color meaning the terminal's own foreground or background (bit 24 alone). */
export const TERMINAL = 0x01000000

/**
 * How many distinct color pairs a Raster may paint at once: the rest it paints
 * as their nearest (RasterProps in the engine's types).
 */
export const RASTER_PAIRS = 1024

/**
 * A frame's cells as rows of Text runs: a run per color pair; a bare space
 * joins any run without a background. The rule of runs.ts `addCell` for
 * every cell an encoder writes (a space's foreground is the terminal's
 * own), merged here on the raw colors, which is cheaper than on their hex.
 */
export function runsOf(cells: LabCells): LabRun[][] {
  const DEFAULT = TERMINAL
  const rows: LabRun[][] = []
  const { columns, data } = cells
  for (let r = 0; r < cells.rows; r++) {
    const row: LabRun[] = []
    let fg = -1
    let bg = -1
    for (let c = 0; c < columns; c++) {
      const at = (r * columns + c) * 3
      const cp = data[at]!
      const cf = data[at + 1]!
      const cb = data[at + 2]!
      const last = row[row.length - 1]
      const char = String.fromCharCode(cp)
      if (cp === 0x20 && cb === DEFAULT && last !== undefined && bg === DEFAULT) {
        last.text += char
        continue
      }
      if (last !== undefined && cf === fg && cb === bg) {
        last.text += char
        continue
      }
      fg = cf
      bg = cb
      const run: LabRun = { text: char }
      if (cf !== DEFAULT && cp !== 0x20) run.color = hex(cf)
      else fg = DEFAULT
      if (cb !== DEFAULT) run.backgroundColor = hex(cb)
      row.push(run)
    }
    rows.push(row)
  }
  return rows
}

/** Whether two frames' cells are the same, word for word (and length). */
export function sameCells(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) return false
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return false
  return true
}

/**
 * The distinct color pairs a frame's cells show, as a Raster counts what it
 * must paint: a cell's foreground and background, a space's foreground left
 * out (it shows nothing). Over RASTER_PAIRS, the rest are painted as their
 * nearest.
 */
export function colorPairs(cells: LabCells): number {
  const seen = new Set<number>()
  const { data } = cells
  for (let at = 0; at < data.length; at += 3) {
    const fg = data[at] === 0x20 ? TERMINAL : data[at + 1]!
    // 25 bits each: a color, or the terminal's own.
    seen.add(fg * 0x2000000 + data[at + 2]!)
  }
  return seen.size
}
