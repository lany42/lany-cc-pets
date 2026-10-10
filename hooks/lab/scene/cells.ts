// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Cell rendering for scenes (opt-in): a scene's frame as Raster cells, a
// code point, a foreground and a background a cell, so the band and the pet
// window draw it as one Raster on the terminal (hooks/register.tsx draws any
// look that offers `cells()` so, as it draws the rig looks), and its Text
// runs are made from the same cells only where something asks for them (the
// gallery card, pet-control's preview). Two more pieces build on it, each
// opt-in too: a color field under the dots, painted in samples and encoded
// in block elements by the painted looks' encoder (rig/kit/encode.ts), so
// skies, blooms and silhouettes are smooth where braille can only dot them;
// and the frames between ticks the painted looks' frame clock steps and blits.
// A scene that opts into none of it is drawn exactly as before (index.ts
// keeps its own path for it). Pure: imports nothing at run time but the
// lab's own modules.
import { TERMINAL } from '../cells'
import { Canvas, SX, SY } from '../rig/kit/canvas'
import type { Glyph } from '../rig/kit/encode'
import { encode, GLYPHS, NARROW_GLYPHS } from '../rig/kit/encode'
import { mixRgb } from '../util'
import type { Box, Frame, Ink, Palette, SceneInput, Theme } from './kit'
import { colorOf, litFrame } from './kit'

/**
 * What a scene opts into, as `sceneLook(def, { ..., cells: { ... } })`:
 * `{}` draws it as Raster cells; `blocks` lets its field (a FieldFrame's)
 * be drawn in block elements, which a cell of one color stands for
 * otherwise; `frames` (2 to 10) steps it that many times a tick, as the
 * painted looks' frame clock steps them, and blits each changed frame.
 */
export type SceneCells = { blocks?: true; frames?: number }

/**
 * What a scene with `frames` is told: the tick's input, and which of the
 * tick's frames this is (`frame`, 0 to `frames` - 1). A frame between ticks
 * has the same tick, mood and words; only what reads `frame` should move.
 */
export type SceneFrameInput = SceneInput & { frame?: number; frames?: number }

/** How a field is drawn: in block elements, in the narrow ones alone, or a color a cell. */
export type FieldMode = 'blocks' | 'narrow' | 'flat'

// ---------------------------------------------------------------- the field

/**
 * A color field under a scene's dots: the painted looks' canvas (rig/kit/
 * canvas.ts), SX x SY (4 x 8) samples a cell, so twice a scene's dots each
 * way. Paint it with its fills (`fill` takes rings of x, y in samples, and a
 * color, a color per row or column or sample, an alpha), `wash` and `glow`.
 * A sample left bare is the terminal's own background. Call `begin` before
 * a whole repaint, `repaint` before a part's: the adapter encodes the field
 * again only when its version moves on, and then only the cells repainted,
 * so a still field costs nothing a tick and a moving glow only its box.
 */
export class Field extends Canvas {
  /** Moves on with each `begin` and `repaint`: the adapter keeps the field's cells till it does. */
  version = 0
  /** The cells repainted since the adapter last took them: all of them after `begin`. */
  private dirty: Box | undefined

  /** Starts a whole repaint over `ground` (the terminal's background as the theme takes it): the field bare again. */
  begin(ground: number): void {
    this.ground = ground
    this.clipCells()
    this.clear()
    this.version++
    this.dirty = { c0: 0, r0: 0, c1: this.cols, r1: this.rows }
  }

  /**
   * Starts a repaint of cells c0..c1 x r0..r1 (c1 and r1 out): those cells
   * bare again, and every fill clipped to them until the next `begin` or
   * `repaint`. Paint all that overlaps them again; the rest stands.
   */
  repaint(c0: number, r0: number, c1: number, r1: number): void {
    const box = { c0: Math.max(0, c0), r0: Math.max(0, r0), c1: Math.min(this.cols, c1), r1: Math.min(this.rows, r1) }
    if (box.c1 <= box.c0 || box.r1 <= box.r0) return
    this.clipCells(box.c0, box.r0, box.c1, box.r1)
    this.clear()
    this.version++
    const was = this.dirty
    this.dirty = was === undefined ? box : { c0: Math.min(was.c0, box.c0), r0: Math.min(was.r0, box.r0), c1: Math.max(was.c1, box.c1), r1: Math.max(was.r1, box.r1) }
  }

  /** The cells repainted since it was last asked, and none after: the adapter's, as it encodes them. */
  takeDirty(): Box | undefined {
    const box = this.dirty
    this.dirty = undefined
    return box
  }

  /** A vertical wash over x0..x1, y0..y1 (samples): colors at heights, `stops` of [y, 0xRRGGBB] going down. */
  wash(stops: readonly (readonly [number, number])[], x0 = 0, y0 = 0, x1 = this.w, y1 = this.h, alpha = 1): void {
    this.fill([[x0, y0, x1, y0, x1, y1, x0, y1]], { row: y => colorAt(stops, y) }, alpha)
  }

  /**
   * A soft round light at (cx, cy), rx x ry samples, its middle `strength`
   * of `color` (0..1) and nothing at its rim. Over bare background it is
   * painted only where it is half on or more, as the canvas paints a wash.
   */
  glow(cx: number, cy: number, rx: number, ry: number, color: number, strength = 1): void {
    const { x0, y0, x1, y1 } = this.clip
    const xa = Math.max(x0, Math.floor(cx - rx))
    const xb = Math.min(x1, Math.ceil(cx + rx))
    const ya = Math.max(y0, Math.floor(cy - ry))
    const yb = Math.min(y1, Math.ceil(cy + ry))
    const cr = (color >> 16) & 255
    const cg = (color >> 8) & 255
    const cb = color & 255
    const { r, g, b, cover, w, ground } = this
    for (let y = ya; y < yb; y++) {
      const dy = (y + 0.5 - cy) / ry
      for (let x = xa; x < xb; x++) {
        const dx = (x + 0.5 - cx) / rx
        const d2 = dx * dx + dy * dy
        if (d2 >= 1) continue
        const a = (1 - d2) * (1 - d2) * strength
        const i = y * w + x
        if (cover[i] === 0) {
          if (a < 0.5) continue
          r[i] = (ground >> 16) & 255
          g[i] = (ground >> 8) & 255
          b[i] = ground & 255
          cover[i] = 1
        }
        r[i]! += (cr - r[i]!) * a
        g[i]! += (cg - g[i]!) * a
        b[i]! += (cb - b[i]!) * a
      }
    }
  }
}

/** The color at height `y` of a wash's stops, mixed channel by channel between the two around it (as the kit's ramps mix). */
function colorAt(stops: readonly (readonly [number, number])[], y: number): number {
  const first = stops[0]
  if (first === undefined) return 0
  if (y <= first[0]) return first[1]
  for (let k = 1; k < stops.length; k++) {
    const [ya, ca] = stops[k - 1]!
    const [yb, cb] = stops[k]!
    if (y > yb) continue
    return mixRgb(ca, cb, yb === ya ? 1 : (y - ya) / (yb - ya))
  }
  return stops[stops.length - 1]![1]
}

/** A lit frame (kit.ts `litFrame`) with a field under it: pass it to `packFast` as its `out`, then paint `bg` and `field`. */
export type FieldFrame = Frame & { readonly bg: Uint8Array; readonly field: Field }

/** A frame that paints a field (and backgrounds), `cols` x `rows`: made once a room, reused every frame. */
export function fieldFrame(cols: number, rows: number, palette: Palette): FieldFrame {
  return { ...litFrame(cols, rows, palette), field: new Field(cols, rows) }
}

// ---------------------------------------------------------------- encoding

/** A palette's inks as Raster colors, per theme (ink 0 the terminal's own): worked out once, not once a cell. */
const COLORS = new WeakMap<Palette, Partial<Record<Theme, Uint32Array>>>()

function colorsOf(palette: Palette, theme: Theme): Uint32Array {
  const known = COLORS.get(palette) ?? {}
  COLORS.set(palette, known)
  return (known[theme] ??= Uint32Array.from(palette, (ink: Ink | undefined, k) => (k === 0 || ink === undefined ? TERMINAL : colorOf(ink, theme))))
}

/** Whether a code point is one cell wide wherever braille is, even where ambiguous ones are drawn wide. */
export const isNarrowGlyph = (cp: number): boolean => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0x2800 && cp <= 0x28ff) || cp === 0x2590 || (cp >= 0x2596 && cp <= 0x259f)

const ALL = SX * SY

/**
 * Turns a scene's frames into Raster cells, one Live's worth: the frame's
 * dots in their inks, the bubble's border in the ink the scene drew it in
 * (its `bubbleInk`, where Text takes the look's theme key) and its words in
 * the terminal's own, every background ink as a background, and a field
 * (a FieldFrame's) under the bare cells. It keeps the field's cells between
 * frames, so a field is encoded again only when it is repainted.
 */
export class CellLayer {
  /** The field encoded (cells, as a Raster's), and each cell's one color for a dot over it. */
  private under = new Uint32Array(0)
  private means = new Uint32Array(0)
  private drawn: { field: Field; version: number; mode: FieldMode } | undefined

  /** Encodes `frame` for `theme` into `out` (its columns x rows x 3 words), its field in `mode`. */
  encode(frame: Frame, theme: Theme, out: Uint32Array, mode: FieldMode): void {
    const n = frame.cols * frame.rows
    const colors = colorsOf(frame.palette, theme)
    const bg = frame.bg
    const field = (frame as Partial<FieldFrame>).field
    const hasField = field !== undefined && field.cols === frame.cols && field.rows === frame.rows
    if (hasField) this.encodeField(field, mode)
    const { under, means } = this
    for (let i = 0; i < n; i++) {
      const cp = frame.cp[i]!
      const ink = frame.ink[i]!
      const back = bg === undefined ? 0 : bg[i]!
      const at = i * 3
      if (cp === 0x20 && ink === 0) {
        // Bare: its background ink, else the field there, else the terminal's own.
        if (back > 0) {
          out[at] = 0x20
          out[at + 1] = TERMINAL
          out[at + 2] = colors[back]!
        } else if (hasField) {
          out[at] = under[at]!
          out[at + 1] = under[at + 1]!
          out[at + 2] = under[at + 2]!
        } else {
          out[at] = 0x20
          out[at + 1] = TERMINAL
          out[at + 2] = TERMINAL
        }
        continue
      }
      const isDot = cp >= 0x2800 && cp < 0x2900
      const isBorder = cp >= 0x2500 && cp < 0x2580
      out[at] = cp
      // Dots and the border in their inks; words (and the bubble's inside) are the terminal's own text.
      out[at + 1] = (isDot || isBorder) && ink > 0 ? colors[ink]! : TERMINAL
      // A dot sits on its background ink, else on the field's color there; the bubble only on its own.
      out[at + 2] = back > 0 ? colors[back]! : isDot && hasField ? means[i]! : TERMINAL
    }
    if (mode === 'narrow') keepNarrow(out)
  }

  /**
   * The field's cells, and its color a cell: encoded again only when it has
   * been repainted, and then only the cells repainted since (all of them for
   * another field, size or mode).
   */
  private encodeField(field: Field, mode: FieldMode): void {
    const words = field.cols * field.rows * 3
    const drawn = this.drawn
    const isSame = drawn !== undefined && drawn.field === field && drawn.mode === mode && this.under.length === words
    if (isSame && drawn.version === field.version) return
    const whole: Box = { c0: 0, r0: 0, c1: field.cols, r1: field.rows }
    const dirty = field.takeDirty()
    const box = isSame ? (dirty ?? whole) : whole
    if (this.under.length !== words) {
      this.under = new Uint32Array(words)
      this.means = new Uint32Array(words / 3)
    }
    meansOf(field, this.means, box)
    if (mode === 'flat') {
      for (let r = box.r0; r < box.r1; r++) {
        for (let c = box.c0; c < box.c1; c++) {
          const i = r * field.cols + c
          this.under[i * 3] = 0x20
          this.under[i * 3 + 1] = TERMINAL
          this.under[i * 3 + 2] = this.means[i]!
        }
      }
    } else {
      const glyphs: readonly Glyph[] = mode === 'narrow' ? NARROW_GLYPHS : GLYPHS
      encode(field, this.under, box.c0, box.r0, box.c1, box.r1, glyphs)
      if (mode === 'narrow') keepSharp(field, this.under, this.means, box)
    }
    this.drawn = { field, version: field.version, mode }
  }
}

/** Which quadrants (bit 1 upper left, 2 upper right, 4 lower left, 8 lower right) each narrow glyph inks. */
const QUADRANTS_OF = new Map(NARROW_GLYPHS.map(one => [one.cp, one.groups.reduce((bits, group) => bits | (1 << group), 0)]))

/**
 * How much of a cell's error as one color a narrow glyph must take away to
 * stay. The narrow glyphs have no top and bottom halves, so a slope or a
 * level edge they can only comb or stripe; what they draw well, a side or a
 * corner, takes away most of it.
 */
const SHARP = 0.4

/**
 * The narrow glyphs kept where they draw an edge truly (a side, a corner):
 * elsewhere the cell is its one color, as a terminal that draws ambiguous
 * characters wide would rather have it than a comb.
 */
function keepSharp(field: Field, under: Uint32Array, means: Uint32Array, box: Box): void {
  const { w, r, g, b, cover, ground } = field
  const gr = (ground >> 16) & 255
  const gg = (ground >> 8) & 255
  const gb = ground & 255
  for (let cr = box.r0; cr < box.r1; cr++) for (let cc = box.c0; cc < box.c1; cc++) {
    const i = cr * field.cols + cc
    const at = i * 3
    const bits = QUADRANTS_OF.get(under[at]!)
    if (bits === undefined || bits === 0 || means[i] === TERMINAL) continue
    const fg = under[at + 1]!
    const bg = under[at + 2]!
    const mean = means[i]!
    let glyphErr = 0
    let flatErr = 0
    for (let y = 0; y < SY; y++) {
      const row = (cr * SY + y) * w + cc * SX
      for (let x = 0; x < SX; x++) {
        const s = row + x
        const isOn = cover[s] === 1
        const vr = isOn ? r[s]! : gr
        const vg = isOn ? g[s]! : gg
        const vb = isOn ? b[s]! : gb
        const q = (y < SY / 2 ? 0 : 2) + (x < SX / 2 ? 0 : 1)
        const shown = ((bits >> q) & 1) === 1 ? fg : bg
        const sr = shown === TERMINAL ? gr : (shown >> 16) & 255
        const sg = shown === TERMINAL ? gg : (shown >> 8) & 255
        const sb = shown === TERMINAL ? gb : shown & 255
        glyphErr += 2 * (vr - sr) ** 2 + 4 * (vg - sg) ** 2 + 3 * (vb - sb) ** 2
        flatErr += 2 * (vr - ((mean >> 16) & 255)) ** 2 + 4 * (vg - ((mean >> 8) & 255)) ** 2 + 3 * (vb - (mean & 255)) ** 2
      }
    }
    if (glyphErr <= flatErr * SHARP) continue
    under[at] = 0x20
    under[at + 1] = TERMINAL
    under[at + 2] = mean
  }
}

/**
 * Each cell's one color: the mean of its samples (a bare one as the ground),
 * or the terminal's own where half or more of it is bare, as the encoder
 * leaves a mostly bare cell's background.
 */
function meansOf(field: Field, out: Uint32Array, box: Box): void {
  const { w, r, g, b, cover, ground } = field
  const gr = (ground >> 16) & 255
  const gg = (ground >> 8) & 255
  const gb = ground & 255
  for (let cr = box.r0; cr < box.r1; cr++) {
    for (let cc = box.c0; cc < box.c1; cc++) {
      let n = 0
      let sr = 0
      let sg = 0
      let sb = 0
      for (let y = 0; y < SY; y++) {
        const row = (cr * SY + y) * w + cc * SX
        for (let x = 0; x < SX; x++) {
          const i = row + x
          if (cover[i] === 1) {
            n++
            sr += r[i]!
            sg += g[i]!
            sb += b[i]!
          } else {
            sr += gr
            sg += gg
            sb += gb
          }
        }
      }
      out[cr * field.cols + cc] = n * 2 <= ALL ? TERMINAL : ((Math.round(sr / ALL) << 16) | (Math.round(sg / ALL) << 8) | Math.round(sb / ALL)) >>> 0
    }
  }
}

/** Where ambiguous characters are drawn wide: what is left of them becomes ASCII (an ellipsis a dot, anything else a question mark). */
function keepNarrow(out: Uint32Array): void {
  for (let at = 0; at < out.length; at += 3) {
    const cp = out[at]!
    if (!isNarrowGlyph(cp)) out[at] = cp === 0x2026 ? 0x2e : 0x3f
  }
}
