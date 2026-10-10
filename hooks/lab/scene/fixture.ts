// A scene for the tests alone (lab/fixture.ts lists it, as it lists
// test-window): never in the gallery, worn only where the store names it.
// `test-cells` is a dusk over a ridge with a firefly, opted into every piece
// of cell rendering (cells, blocks, 2 frames a tick), so the tests and the
// studio can hold the opt-in to its rules
// without any real scene's art: a field (a sky washed from night to amber, a
// sun's glow on the horizon, the ridge's silhouette) under braille stars, a
// lit cell behind the firefly, the firefly moving on its own frames, and the
// bubble. A pure function of its input: stepped twice in one tick, or a frame
// again, it draws the same.
import { fieldFrame } from './cells'
import type { FieldFrame, SceneFrameInput } from './cells'
import type { Frame, Ink, SceneDef, SceneInstance } from './kit'
import { colorOf, Dots, drawBubble, hash, ink, packFast } from './kit'
import { sceneLook } from './index'

const P = { star: 1, starDim: 2, ridge: 3, firefly: 4, glow: 5, border: 6, words: 7, zenith: 8, dusk: 9, amber: 10, sun: 11, land: 12, moon: 13 } as const
const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
PALETTE[P.star] = ink(0xe8e4d0, 0x5a5640, 2)
PALETTE[P.starDim] = ink(0x6a6878, 0xa8a6b4)
PALETTE[P.ridge] = ink(0x3a3448, 0x8c8498, 1.5)
PALETTE[P.firefly] = ink(0xf2e86a, 0x8a7a00, 9)
PALETTE[P.glow] = ink(0x4a4420, 0xf4eec0)
PALETTE[P.border] = ink(0xaf87ff, 0x8700ff, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)
// the field's colors only: the sky from zenith to the horizon, the sun, the land
PALETTE[P.zenith] = ink(0x101828, 0xc8d4ec)
PALETTE[P.dusk] = ink(0x3a2c52, 0xd8c8e8)
PALETTE[P.amber] = ink(0xc0703a, 0xf0b888)
PALETTE[P.sun] = ink(0xffd890, 0xffe8b0)
PALETTE[P.land] = ink(0x161420, 0x8a8294)
PALETTE[P.moon] = ink(0xd8d4c0, 0x7a7460)

/** The terminal's background as the studio takes it, dark and light: what the field's edges blend with. */
const GROUND = { dark: 0x1e1f22, light: 0xfafaf8 }

/** The ridge's height (dots above the horizon) at dot column x. */
const ridgeAt = (x: number, w: number): number => 3 + 2.5 * Math.sin((x / w) * 7.1) + 1.5 * Math.sin((x / w) * 17.3 + 1)

function dusk(): SceneInstance {
  let out: FieldFrame | undefined
  let painted = ''
  let breathed = -1
  return {
    frame(input: SceneFrameInput): Frame {
      const { cols, rows, theme } = input
      const d = new Dots(cols, rows)
      const w = cols * 2
      const h = rows * 4
      const tall = rows >= 12
      // The horizon: the band's fourth row, a tall room's two thirds down.
      const horizon = tall ? Math.round(h * 0.66) : h - 6
      for (let k = 0; k < Math.floor((w * horizon) / 40); k++) {
        const x = Math.floor(hash(k, 1) * w)
        const y = Math.floor(hash(k, 2) * (horizon - 6))
        // Twinkles: a star dims on its own clock.
        d.set(x, y, hash(k, Math.floor((input.tick + k * 7) / 24)) < 0.8 ? P.star : P.starDim)
      }
      for (let x = 0; x < w; x++) for (let y = horizon - Math.round(ridgeAt(x, w)); y < h; y++) if (y === horizon - Math.round(ridgeAt(x, w)) || hash(x, y, 3) < 0.08) d.set(x, y, P.ridge)
      // The firefly: a Lissajous path stepped by the frame, so its frames between ticks move it.
      const t = input.tick + (input.frame ?? 0) / (input.frames ?? 1)
      const speed = input.mood === 'busy' ? 0.09 : 0.04
      const fx = Math.round(w * 0.75 + Math.sin(t * speed * 2) * w * 0.12)
      const fy = Math.round(horizon * 0.6 + Math.sin(t * speed * 3) * horizon * 0.25)
      d.set(fx, fy, P.firefly)
      d.set(fx + 1, fy, P.firefly)
      let box: { c0: number; r0: number; c1: number; r1: number } | undefined
      if (input.bubble !== undefined) {
        const at = { c: Math.floor(fx / 2), r: Math.floor(fy / 4) }
        box = drawBubble(d, input.bubble, at, { c0: at.c - 1, r0: at.r, c1: at.c + 2, r1: rows }, P.border, P.words, P.border, input.asciiBorders === true)
      }
      const frame = out !== undefined && out.cols === cols && out.rows === rows ? out : fieldFrame(cols, rows, PALETTE)
      out = frame
      packFast(d, PALETTE, frame)
      // A lit cell behind the firefly, but never under the bubble.
      frame.bg.fill(0)
      const glowAt = Math.floor(fy / 4) * cols + Math.floor(fx / 2)
      if (box === undefined) frame.bg[glowAt] = P.glow
      // The field: painted whole when the room, the theme or the bubble changes; the sun's box alone when its slow breath does.
      const breath = Math.floor(input.tick / 16) % 4
      const key = `${cols}x${rows}:${theme}:${box === undefined ? '' : `${box.c0},${box.r0},${box.c1},${box.r1}`}`
      if (key !== painted || breath !== breathed) {
        const field = frame.field
        const c = (k: number) => colorOf(PALETTE[k]!, theme)
        const sx = 2 // samples a dot, each way
        const sun = { x: w * sx * 0.3, y: horizon * sx, rx: w * sx * 0.12, ry: (tall ? 16 : 6) * sx }
        if (key !== painted) field.begin(GROUND[theme])
        else field.repaint(Math.floor((sun.x - sun.rx) / 4), Math.floor((sun.y - sun.ry) / 8), Math.ceil((sun.x + sun.rx) / 4), Math.ceil((sun.y + sun.ry) / 8))
        painted = key
        breathed = breath
        if (tall) field.wash([[0, c(P.zenith)], [horizon * sx * 0.55, c(P.dusk)], [horizon * sx, c(P.amber)]], 0, 0, field.w, horizon * sx)
        field.glow(sun.x, sun.y, sun.rx, sun.ry, c(P.sun), 0.6 + breath * 0.1)
        const ridge: number[] = []
        for (let x = 0; x <= w; x += 2) ridge.push(x * sx, (horizon - ridgeAt(x, w)) * sx)
        ridge.push(w * sx, h * sx, 0, h * sx)
        if (tall) field.fill([ridge], c(P.land))
        // A pale moon, hard-edged and outlined by nothing: where blocks show their edges best.
        if (tall) {
          const moon: number[] = []
          const r = Math.min(w, h) * sx * 0.09
          // A sample is 2 x 2.25 px on screen (a cell 8 x 18): a little wider across than down, so round.
          for (let k = 0; k < 40; k++) moon.push(w * sx * 0.12 + Math.cos((k / 40) * Math.PI * 2) * r * 1.125, h * sx * 0.2 + Math.sin((k / 40) * Math.PI * 2) * r)
          field.fill([moon], c(P.moon))
        }
        // Under the bubble, the terminal's own background.
        if (box !== undefined) {
          field.clipCells(box.c0 - 1, box.r0, box.c1 + 1, box.r1)
          field.clear()
        }
        field.clipCells()
      }
      return frame
    },
  }
}

/** The dusk itself, for the tests and the studio to register other ways. */
export const DUSK: SceneDef = {
  id: 'test-cells',
  name: 'Cells Test',
  persona: 'a test firefly over a dusk ridge, painted in cells',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 6,
  create: () => dusk(),
}

/** The dusk opted into all of cell rendering: Raster cells, a block field, 2 frames a tick. */
export const CELL_FIXTURE = sceneLook(DUSK, { fallback: 'many-eyes', bubble: 'merged', blurb: 'a test of cells', cells: { blocks: true, frames: 2 } })
