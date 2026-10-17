// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The painted look's runtime: a pet painted in truecolor block cells (two
// colors and one block glyph a cell, edges on an eighth of a cell) at a frame
// rate of its own, worn as a lab look. A rig pet becomes one through the
// engine's adapter (../adapter.ts makes it a `PaintedPet`, pet.ts); its
// registry is RIG_LOOKS (../../rig-pets/index.ts). The look is a scene the
// width of the band (its band pet, a pixel pet played by its own director,
// at its right, its words beside it; a pet with none shows its fallback
// sprite there), and in the pet window its painted self, as tall as the
// window. It is stepped every tick and, between ticks, every frame of its
// own clock (`frames` a tick); each step repaints only what moved, encodes
// it, and lays its words over it. `cells()` is the frame as a Raster's
// cells, which the band and the window draw on the terminal and blit between
// ticks; `runs()` the same frame as Text runs, built only when asked (the
// studio, the gallery card, pet-control's preview). Pure: imports nothing at
// run time but the kit's modules, look.ts, cells.ts, bubble.ts, util.ts, the
// classic sprites (for a fallback), the pixel kind's surface and `paintCells`
// (for a band pet) and the tick's length.
import type { Sprite } from '../../../sprite'
import { frame as spriteFrame, TICK_MS } from '../../../sprite'
import { spriteById } from '../../../sprites'
import { ROUND, wrap } from '../../bubble'
import { runsOf, sameCells } from '../../cells'
import type { LabCells, LabInput, LabLook, LabRun, Live } from '../../look'
import { isCellSafe } from '../../look'
import { paintCells } from '../../pixel/index'
import type { Directing } from '../../pixel/pet'
import { Pixels } from '../../pixel/pixels'
import { clamp, mix } from '../../util'
import { Canvas, DEFAULT, SX, SY } from './canvas'
import { encode } from './encode'
import type { Affine } from './pen'
import { apply } from './pen'
import type { BandPet, Channels, PaintedPet, Part } from './pet'

/** A painted pet's frames a tick: 8, so 32 a second on the 250 ms tick. */
export const FRAMES = 8
const TICK_S = TICK_MS / 1000
/** The fewest rows a pet is painted in; shorter rooms (the band) get its band pet, or its fallback sprite. */
export const PAINTED_ROWS = 10
/** A cell in screen pixels, as the terminal draws it (JetBrainsMono 10 pt): a painted pet's units are square on screen. */
const CELL_W = 8
const CELL_H = 18
/** The terminal's background as the studio tools take it, dark and light: what a sample at a painted pet's edge blends with. */
export const GROUND = { dark: 0x1e1f22, light: 0xfafaf8 }

/** A rectangle of cells, c0 and r0 in, c1 and r1 out. */
export type Rect = { c0: number; r0: number; c1: number; r1: number }

/** Where a painted pet is in a room: how its units map to samples, and where its words may go and point. */
export type Layout = {
  isPainted: boolean
  m: Affine
  /** The columns left of it that its words may take, and the cell they point at (its mouth). */
  words: Rect
  anchor: { c: number; r: number }
  /** Its own cells: what a full repaint covers. */
  box: Rect
}

/** The classic sprite a pet with no band pet shows in rooms under 10 rows: its `fallback`. */
export const asciiOf = (pet: PaintedPet): Sprite => spriteById(pet.fallback)

/**
 * Lays `pet` out in a room. Short (the band, the gallery card): its band pet
 * at the right, bottom-aligned, two columns in; with none, its fallback
 * sprite there, `m[5]` its top row (cut off above the room). Tall (the
 * window): painted, framed by its `crop` (head to collar, say) at 10 rows and
 * its whole box from 30 rows up, eased between; at most 68% of the columns,
 * centred at 63% across, so its words have the left.
 */
export function layoutOf(pet: PaintedPet, columns: number, rows: number): Layout {
  const { band } = pet
  if (rows < PAINTED_ROWS && band === undefined) {
    const sprite = asciiOf(pet)
    const c0 = Math.max(0, columns - sprite.width - 2)
    const r0 = rows - sprite.height
    return {
      isPainted: false,
      m: [1, 0, 0, 1, c0, r0],
      words: { c0: 0, r0: 0, c1: c0 - 1, r1: rows },
      anchor: { c: c0, r: Math.max(0, r0 + Math.floor((sprite.height - 1) / 2)) },
      box: { c0, r0: 0, c1: Math.min(columns, c0 + sprite.width), r1: rows },
    }
  }
  if (rows < PAINTED_ROWS && band !== undefined) {
    const { columns: wide, rows: tall } = band.pet
    const c0 = Math.max(0, columns - wide - 2)
    return {
      isPainted: false,
      m: [1, 0, 0, 1, c0, rows * 2 - tall * 2],
      words: { c0: 0, r0: 0, c1: c0 - 1, r1: rows },
      anchor: { c: c0 + band.mouth.c, r: rows - tall + band.mouth.r },
      box: { c0, r0: 0, c1: Math.min(columns, c0 + wide), r1: rows },
    }
  }
  const { width, height, crop, mouth } = pet.window
  const f = clamp((rows - PAINTED_ROWS) / 20, 0, 1)
  const top = mix(crop.top, 0, f)
  const bottom = mix(crop.bottom, height, f)
  let unit = (rows * CELL_H) / (bottom - top)
  unit = Math.min(unit, (columns * CELL_W * 0.68) / width)
  const left = clamp(columns * CELL_W * 0.63 - (width * unit) / 2, 0, columns * CELL_W - width * unit)
  const y0 = rows * CELL_H - bottom * unit
  const sx = SX / CELL_W
  const sy = SY / CELL_H
  const m: Affine = [unit * sx, 0, 0, unit * sy, left * sx, y0 * sy]
  const faceLeft = Math.floor((left + pet.window.faceLeft * unit) / CELL_W)
  return {
    isPainted: true,
    m,
    words: { c0: 0, r0: 0, c1: faceLeft - 1, r1: rows },
    anchor: { c: Math.floor((left + mouth[0] * unit) / CELL_W), r: Math.floor((y0 + mouth[1] * unit) / CELL_H) },
    box: { c0: Math.max(0, Math.floor(left / CELL_W) - 1), r0: 0, c1: Math.min(columns, Math.ceil((left + width * unit) / CELL_W) + 1), r1: rows },
  }
}

// ---------------------------------------------------------------- what moved

/** A pose's channels rounded to what can show: 1/200, and its `snap` channels to whole (or half) samples. */
export function quantize(pet: PaintedPet, pose: Channels, m: Affine): Channels {
  const out = { ...pose }
  for (const key of Object.keys(out)) out[key] = Math.round(out[key]! * 200) / 200
  // A snapped channel moves whole samples: between them, nothing it covers changes.
  for (const [key, per] of Object.entries(pet.window.snap ?? {})) {
    if (per !== undefined && key in pose) out[key] = Math.round(pose[key]! * m[3] * per) / (m[3] * per)
  }
  return out
}

/** The cells a part covers at `pose`, under `m`. */
function partCells(part: Part<Channels>, pose: Channels, m: Affine): Rect {
  const t = part.space(pose, m)
  const [x0, y0, x1, y1] = part.box
  const corners = [apply(t, x0, y0), apply(t, x1, y0), apply(t, x0, y1), apply(t, x1, y1)]
  const xs = corners.map(p => p[0])
  const ys = corners.map(p => p[1])
  return { c0: Math.floor(Math.min(...xs) / SX) - 1, r0: Math.floor(Math.min(...ys) / SY) - 1, c1: Math.ceil(Math.max(...xs) / SX) + 1, r1: Math.ceil(Math.max(...ys) / SY) + 1 }
}

const union = (a: Rect, b: Rect): Rect => ({ c0: Math.min(a.c0, b.c0), r0: Math.min(a.r0, b.r0), c1: Math.max(a.c1, b.c1), r1: Math.max(a.r1, b.r1) })
const area = (r: Rect): number => Math.max(0, r.c1 - r.c0) * Math.max(0, r.r1 - r.r0)

/**
 * The rectangles to repaint going from `last` to `next`: each moved part,
 * where it was and where it is. When they add up to most of `box`, one
 * repaint instead, of the box grown to hold every one of them: a part may
 * reach past the box (a prop that travels in from beside the pet, a shower
 * round it), and what it left there must go too.
 */
export function dirty(pet: PaintedPet, last: Channels, next: Channels, m: Affine, box: Rect): Rect[] {
  const rects: Rect[] = []
  for (const part of pet.window.parts) {
    if (!part.keys.some(key => last[key] !== next[key])) continue
    rects.push(union(partCells(part, last, m), partCells(part, next, m)))
  }
  // Mostly everything: one repaint is cheaper than many. Never of the box alone: that left a part's cells past it stale.
  const total = rects.reduce((sum, r) => sum + area(r), 0)
  return total > area(box) * 0.7 ? [rects.reduce(union, box)] : rects
}

// ---------------------------------------------------------------- her words

/**
 * Draws a bubble of `text` into `cells` in `region`, its right edge beside
 * her and its tail toward `anchor`; false when the region can't hold a
 * bubble at all (the band bubbles the words instead).
 */
export function bubble(cells: Uint32Array, columns: number, text: string, region: Rect, anchor: { c: number; r: number }, border: number): boolean {
  const room = Math.min(48, region.c1 - region.c0 - 4)
  const most = region.r1 - region.r0 - 2
  if (room < 8 || most < 1) return false
  let lines = wrap(text, room, most)
  // The narrowest width that needs no more lines.
  for (let w = room - 1; w >= 8 && lines.length > 1; w--) {
    const tighter = wrap(text, w, most)
    if (tighter.length > lines.length || tighter.some(line => line.endsWith('…')) !== lines.some(line => line.endsWith('…'))) break
    lines = tighter
  }
  const inner = Math.max(...lines.map(line => [...line].length))
  const c1 = region.c1
  const c0 = c1 - inner - 4
  const height = lines.length + 2
  const r1 = clamp(anchor.r + 2, region.r0 + height, region.r1)
  const r0 = r1 - height
  const put = (c: number, r: number, cp: number, fg: number) => {
    if (c < 0 || c >= columns || r < region.r0 || r >= region.r1) return
    const at = (r * columns + c) * 3
    cells[at] = cp
    cells[at + 1] = fg
    cells[at + 2] = DEFAULT
  }
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const isTop = r === r0
      const isBottom = r === r1 - 1
      const isLeft = c === c0
      const isRight = c === c1 - 1
      const cp = isTop ? (isLeft ? ROUND.tl : isRight ? ROUND.tr : ROUND.h) : isBottom ? (isLeft ? ROUND.bl : isRight ? ROUND.br : ROUND.h) : isLeft || isRight ? ROUND.v : 0x20
      put(c, r, cp, cp === 0x20 ? DEFAULT : border)
    }
    if (r > r0 && r < r1 - 1) [...lines[r - r0 - 1]!].forEach((ch, k) => put(c0 + 2 + k, r, ch.codePointAt(0) ?? 0x20, DEFAULT))
  }
  // The tail: a tee on the right border level with her mouth (or as near as the box allows), and a short line toward her, over empty cells only.
  const tr = clamp(anchor.r, r0 + 1, r1 - 2)
  put(c1 - 1, tr, ROUND.right, border)
  for (let c = c1; c < Math.min(c1 + 2, anchor.c - 1, columns); c++) {
    const at = (tr * columns + c) * 3
    if (cells[at] !== 0x20 || cells[at + 2] !== DEFAULT) break
    put(c, tr, ROUND.h, border)
  }
  return true
}

// ---------------------------------------------------------------- the look

/**
 * Repaints `rect` (cells) of `pet` at `pose` into `canvas` as `place` lays
 * it out: clipped to the rect, cleared, painted (its window form; a band pet
 * or a fallback sprite is written as cells, `bandInto` and `asciiInto`). The
 * rect as painted, clamped to the canvas; undefined when empty.
 */
export function repaint(pet: PaintedPet, canvas: Canvas, place: Layout, pose: Channels, rect: Rect): Rect | undefined {
  const r: Rect = { c0: clamp(rect.c0, 0, canvas.cols), r0: clamp(rect.r0, 0, canvas.rows), c1: clamp(rect.c1, 0, canvas.cols), r1: clamp(rect.r1, 0, canvas.rows) }
  if (area(r) === 0) return undefined
  canvas.clipCells(r.c0, r.r0, r.c1, r.r1)
  canvas.clear()
  if (place.isPainted) pet.window.paint(canvas, pose, place.m)
  return r
}

/**
 * Writes `cells`, a frame of `band`'s box as its own look paints it
 * (`paintCells`), into `data` (encoded cells) where `place` lays it out:
 * bottom-aligned at the box's left column, rows above the room left out.
 */
export function bandInto(data: Uint32Array, columns: number, rows: number, place: Layout, cells: Uint32Array, band: BandPet): void {
  const { columns: wide, rows: tall } = band.pet
  const { c0 } = place.box
  const count = Math.min(wide, columns - c0)
  for (let r = Math.max(0, tall - rows); r < tall; r++) data.set(cells.subarray(r * wide * 3, (r * wide + count) * 3), ((rows - tall + r) * columns + c0) * 3)
}

/**
 * Writes `lines`, a frame of the fallback sprite, into `data` (encoded cells)
 * where `place` lays it out: the box blanked, each glyph in `ink` on the
 * terminal's background, spaces blank, rows above the room left out.
 */
export function asciiInto(data: Uint32Array, columns: number, rows: number, place: Layout, lines: readonly string[], ink: number): void {
  const { c0, c1 } = place.box
  for (let r = 0; r < rows; r++) {
    for (let c = c0; c < c1; c++) {
      const at = (r * columns + c) * 3
      data[at] = 0x20
      data[at + 1] = DEFAULT
      data[at + 2] = DEFAULT
    }
  }
  lines.forEach((line, k) => {
    const r = place.m[5] + k
    if (r < 0 || r >= rows) return
    ;[...line].forEach((char, j) => {
      const c = c0 + j
      if (c >= c1) return
      const at = (r * columns + c) * 3
      const cp = char.codePointAt(0) ?? 0x20
      data[at] = cp
      data[at + 1] = cp === 0x20 ? DEFAULT : ink
    })
  })
}

/** `pet`, alive in a room: stepped each tick and each frame between, repainting what moved; its band pet, if it has one, played by its own director (on a gallery card, its own card's). */
function painted(pet: PaintedPet, seed: number, isDemo = false): Live {
  const director = pet.director(seed)
  const { band } = pet
  let bandDirector: Directing<unknown> | undefined
  let bandPixels: Pixels | undefined
  let bandCells: Uint32Array | undefined
  /** The band pet's last pose, and the time of its own frame it was posed at. */
  let bandPose: unknown
  let bandAt = Number.NaN
  let canvas: Canvas | undefined
  let layout: Layout | undefined
  let theme: 'dark' | 'light' = 'dark'
  /** Its art, encoded; and the frame shown (its art with its words over it). */
  let art = new Uint32Array(0)
  let shown: LabCells = { columns: 0, rows: 0, data: new Uint32Array(0), version: 0 }
  let last: Channels | undefined
  let lastKey = ''
  let words: string | undefined
  let isLeft = false
  let runs: LabRun[][] | undefined
  let spare: Uint32Array = new Uint32Array(0)

  /** Repaints and encodes `rect` of it at `pose`. */
  const redraw = (pose: Channels, rect: Rect) => {
    if (canvas === undefined || layout === undefined) return
    const r = repaint(pet, canvas, layout, pose, rect)
    if (r !== undefined) encode(canvas, art, r.c0, r.r0, r.c1, r.r1)
  }

  return {
    step(input: LabInput) {
      const { columns, rows } = input.room
      const frame = input.frame ?? 0
      const nextTheme = input.isLight ? 'light' : 'dark'
      let isFresh = false
      if (canvas === undefined || canvas.cols !== columns || canvas.rows !== rows || theme !== nextTheme) {
        canvas = new Canvas(columns, rows)
        theme = nextTheme
        canvas.ground = GROUND[theme]
        layout = layoutOf(pet, columns, rows)
        art = new Uint32Array(columns * rows * 3)
        for (let at = 0; at < art.length; at += 3) {
          art[at] = 0x20
          art[at + 1] = DEFAULT
          art[at + 2] = DEFAULT
        }
        isFresh = true
      }
      const place = layout!
      let changed = isFresh
      if (place.isPainted) {
        const t = (input.tick + frame / FRAMES) * TICK_S
        const next = quantize(pet, director.pose({ t, mood: input.mood, since: input.since * TICK_S, spoke: input.spoke, spectacle: input.spectacle, turnsEnded: input.turnsEnded }), place.m)
        if (isFresh || last === undefined) redraw(next, { c0: 0, r0: 0, c1: columns, r1: rows })
        else for (const rect of dirty(pet, last, next, place.m, place.box)) redraw(next, rect)
        changed ||= last === undefined || Object.keys(next).some(key => next[key] !== last![key])
        last = next
      } else if (band !== undefined) {
        // Its band pet on its own clock: posed by its own director once a frame of its own (as its own look steps it), painted afresh when its pose changes.
        const own = Math.floor((frame * band.pet.frames) / FRAMES)
        const share = own / band.pet.frames
        const t = (input.tick + share) * TICK_S
        if (t !== bandAt) {
          bandDirector ??= isDemo ? band.pet.demo() : band.pet.director(seed)
          bandPose = bandDirector.pose({ t, mood: input.mood, since: (input.since + share) * TICK_S, spoke: input.spoke, spectacle: input.spectacle, turnsEnded: input.turnsEnded })
          bandAt = t
        }
        const key = JSON.stringify(bandPose)
        if (isFresh || key !== lastKey) {
          bandPixels ??= new Pixels(band.pet.columns, band.pet.rows, band.pet.palette)
          bandCells ??= new Uint32Array(band.pet.columns * band.pet.rows * 3)
          bandInto(art, columns, rows, place, paintCells(band.pet, bandPose, input.isLight, bandPixels, bandCells), band)
          changed = true
        }
        lastKey = key
      } else {
        // No band pet: its fallback sprite's frame for the mood and tick, as the band would draw that sprite.
        const lines = spriteFrame(asciiOf(pet), input.mood, input.tick)
        const key = lines.join('\n')
        if (isFresh || key !== lastKey) {
          asciiInto(art, columns, rows, place, lines, pet.border[theme])
          changed = true
        }
        lastKey = key
      }

      // Its words: the line while it shows (one it can draw cell for cell), "..." while it thinks of one.
      const line = input.line !== undefined && isCellSafe(input.line.text) ? input.line.text : undefined
      const nextWords = input.mood === 'ponder' ? '...' : line
      if (nextWords !== words) changed = true
      words = nextWords
      if (!changed) return
      // Into the spare buffer: the frame shown stays whole until this one replaces it, and only if it differs.
      if (spare.length !== art.length) spare = new Uint32Array(art.length)
      spare.set(art)
      isLeft = words !== undefined && !bubble(spare, columns, words, place.words, place.anchor, pet.border[theme])
      if (!isFresh && shown.data.length === spare.length && sameCells(shown.data, spare)) return
      const data = spare
      spare = shown.data
      shown = { columns, rows, data, version: shown.version + 1 }
      runs = undefined
    },
    runs() {
      runs ??= runsOf(shown)
      return runs
    },
    cells: () => shown,
    leftWords: () => isLeft,
  }
}

/** `pet` as a lab look: a scene the band's width and its band pet's rows (or its fallback sprite's), painted tall in the pet window, at its own 32 frames a second. */
export function lookOf(pet: PaintedPet): LabLook {
  // Its band pet or its fallback sprite whole, never a row of it cut off.
  const height = pet.band !== undefined ? pet.band.pet.rows : asciiOf(pet).height
  return {
    id: pet.id,
    name: pet.name,
    persona: pet.persona,
    blurb: pet.blurb,
    layout: 'scene',
    width: 40,
    height,
    fewest: height,
    minColumns: 40,
    ownsBubble: true,
    fallback: pet.fallback,
    bubble: pet.bubble,
    frames: FRAMES,
    blocks: true,
    start: seed => painted(pet, seed),
    demo: () => painted(pet, 1, true),
  }
}
