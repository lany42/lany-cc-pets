// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The painted look's canvas: a color sample SX x SY to a terminal cell, and a
// small scanline painter that fills vector outlines into it (non-zero
// winding, sampled at each sample's center), solid, shaded by row, column or
// sample, or washed over what is there. encode.ts turns the samples into
// cells. Pure: imports nothing; the hooks runtime and the studio both run it.

/** Samples across a cell, and down it: a quadrant is 2 x 4, an eighth row is 4 x 1. */
export const SX = 4
export const SY = 8
/** A Raster color meaning the terminal's own (foreground or background). */
export const DEFAULT = 0x01000000

/** A shape's outline: one or more closed rings of x, y pairs, in samples. */
export type Rings = readonly (readonly number[])[]

/**
 * What a fill paints with, 0xRRGGBB: one color; a color per row of samples
 * (a vertical gradient), per column (ribs), or per sample (anything else).
 */
export type Paint = number | { readonly row: (y: number) => number } | { readonly column: (x: number) => number } | { readonly at: (x: number, y: number) => number }

/** A rectangle of samples, x0 and y0 in, x1 and y1 out. */
export type Clip = { x0: number; y0: number; x1: number; y1: number }

/**
 * The painting: a color per sample (0-255 floats, sRGB), and whether the
 * figure covers it (else the terminal's own background shows there).
 */
export class Canvas {
  readonly cols: number
  readonly rows: number
  readonly w: number
  readonly h: number
  readonly r: Float32Array
  readonly g: Float32Array
  readonly b: Float32Array
  readonly cover: Uint8Array
  /** What the terminal's background is taken to be, where a sample blends with it. */
  ground = 0x1e1f22
  /** Where fills may paint: the whole canvas, or the part being redrawn. */
  clip: Clip
  // One fill's edges (top, bottom, x at top, slope, winding), sorted by top, and the scanline's crossings: reused.
  private top = new Float64Array(256)
  private bottom = new Float64Array(256)
  private x0 = new Float64Array(256)
  private slope = new Float64Array(256)
  private dir = new Int8Array(256)
  private order = new Int32Array(256)
  private active = new Int32Array(256)
  private xs = new Float64Array(256)
  private ws = new Int8Array(256)

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.w = cols * SX
    this.h = rows * SY
    const n = this.w * this.h
    this.r = new Float32Array(n)
    this.g = new Float32Array(n)
    this.b = new Float32Array(n)
    this.cover = new Uint8Array(n)
    this.clip = { x0: 0, y0: 0, x1: this.w, y1: this.h }
  }

  /** Clears the clip's samples to the terminal's background. */
  clear(): void {
    const { x0, y0, x1, y1 } = this.clip
    for (let y = y0; y < y1; y++) {
      const at = y * this.w
      this.cover.fill(0, at + x0, at + x1)
    }
  }

  /** Clips fills to whole cells c0..c1 x r0..r1 (out), or to the whole canvas. */
  clipCells(c0 = 0, r0 = 0, c1 = this.cols, r1 = this.rows): void {
    this.clip = { x0: Math.max(0, c0 * SX), y0: Math.max(0, r0 * SY), x1: Math.min(this.w, c1 * SX), y1: Math.min(this.h, r1 * SY) }
  }

  private grow(n: number): void {
    if (this.top.length >= n) return
    const size = Math.max(n, this.top.length * 2)
    this.top = new Float64Array(size)
    this.bottom = new Float64Array(size)
    this.x0 = new Float64Array(size)
    this.slope = new Float64Array(size)
    this.dir = new Int8Array(size)
    this.order = new Int32Array(size)
    this.active = new Int32Array(size)
    this.xs = new Float64Array(size)
    this.ws = new Int8Array(size)
  }

  /**
   * Fills `rings` (non-zero winding) with `paint` at `alpha`; `only` paints
   * just where the figure already is (a shadow on the face, never past its
   * edge). A wash (alpha under 1) over bare background blends with it.
   */
  fill(rings: Rings, paint: Paint, alpha = 1, only = false): void {
    // The edges, and the box round them.
    let n = 0
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const ring of rings) n += ring.length / 2
    this.grow(n)
    const { top, bottom, x0, slope, dir, order } = this
    n = 0
    for (const ring of rings) {
      const m = ring.length
      for (let k = 0; k < m; k += 2) {
        const ax = ring[k]!
        const ay = ring[k + 1]!
        const j = k + 2 < m ? k + 2 : 0
        const bx = ring[j]!
        const by = ring[j + 1]!
        if (ax < minX) minX = ax
        if (ax > maxX) maxX = ax
        if (ay < minY) minY = ay
        if (ay > maxY) maxY = ay
        if (ay === by) continue
        const isDown = ay < by
        top[n] = isDown ? ay : by
        bottom[n] = isDown ? by : ay
        x0[n] = isDown ? ax : bx
        slope[n] = (bx - ax) / (by - ay)
        dir[n] = isDown ? 1 : -1
        n++
      }
    }
    const clip = this.clip
    const y0 = Math.max(clip.y0, Math.ceil(minY - 0.5))
    const y1 = Math.min(clip.y1 - 1, Math.floor(maxY - 0.5))
    if (y1 < y0 || maxX < clip.x0 - 1 || minX > clip.x1 + 1 || n === 0) return
    // Edges by their tops, so each scanline only looks at the ones it crosses.
    for (let k = 0; k < n; k++) {
      let at = k
      while (at > 0 && top[order[at - 1]!]! > top[k]!) {
        order[at] = order[at - 1]!
        at--
      }
      order[at] = k
    }
    const { active, xs, ws, r, g, b, cover } = this
    const w = this.w
    let live = 0
    let next = 0
    const isSolid = typeof paint === 'number'
    const byRow = !isSolid && 'row' in paint ? paint.row : undefined
    const byColumn = !isSolid && 'column' in paint ? paint.column : undefined
    const bySample = !isSolid && 'at' in paint ? paint.at : undefined
    let color = isSolid ? paint : 0
    const ground = this.ground
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5
      while (next < n && top[order[next]!]! <= sy) active[live++] = order[next++]!
      // Crossings of the live edges, sorted as they come; edges past their bottom leave.
      let count = 0
      for (let k = 0; k < live; k++) {
        const e = active[k]!
        if (bottom[e]! <= sy) {
          active[k--] = active[--live]!
          continue
        }
        if (top[e]! > sy) continue
        const x = x0[e]! + (sy - top[e]!) * slope[e]!
        let at = count++
        while (at > 0 && xs[at - 1]! > x) {
          xs[at] = xs[at - 1]!
          ws[at] = ws[at - 1]!
          at--
        }
        xs[at] = x
        ws[at] = dir[e]!
      }
      if (byRow !== undefined) color = byRow(sy)
      let wind = 0
      const row = y * w
      for (let k = 0; k < count - 1; k++) {
        wind += ws[k]!
        if (wind === 0) continue
        const from = Math.max(clip.x0, Math.ceil(xs[k]! - 0.5))
        const to = Math.min(clip.x1 - 1, Math.ceil(xs[k + 1]! - 0.5) - 1)
        for (let x = from; x <= to; x++) {
          const i = row + x
          const isBare = cover[i] === 0
          if (only && isBare) continue
          if (byColumn !== undefined) color = byColumn(x + 0.5)
          else if (bySample !== undefined) color = bySample(x + 0.5, sy)
          const cr = (color >> 16) & 255
          const cg = (color >> 8) & 255
          const cb = color & 255
          if (alpha >= 1) {
            r[i] = cr
            g[i] = cg
            b[i] = cb
            cover[i] = 1
            continue
          }
          if (isBare) {
            r[i] = (ground >> 16) & 255
            g[i] = (ground >> 8) & 255
            b[i] = ground & 255
            // A thin wash over nothing (a glow's edge) blends with the background but doesn't become the figure.
            if (alpha >= 0.5) cover[i] = 1
          }
          r[i]! += (cr - r[i]!) * alpha
          g[i]! += (cg - g[i]!) * alpha
          b[i]! += (cb - b[i]!) * alpha
        }
      }
    }
  }
}
