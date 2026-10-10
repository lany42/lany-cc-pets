// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The pixel kind: band-sized pets in hand-drawn pixel art (pet.ts), painted
// by letter onto the kind's pixel surface (pixels.ts) and mapped straight
// into truecolor block cells. Each is a lab look of the `pet` layout with no
// window picture: it stands right of the band's bubble as a braille pet
// does, at its own size in the band, the pet window, its card and
// pet-control. On the terminal the band and the window draw its `cells()`
// as one Raster and the frame clock blits its frames between ticks; its
// `runs()` are the same frame as Text runs, made from the cells only when
// asked (its card, pet-control, the studio, and the band measuring it).
//
// Whole pixels are the renderer's, not the artist's: every step the surface
// is cleared and the pet painted on it afresh, at whole pixels of its
// palette only, and each cell's two pixels become one of the five cells
// directly, with no encoder; a frame is kept only when a cell changed. So a
// frame is its pose's alone, and no path shows part of a pixel in any room.
// Pure: imports nothing at run time but cells.ts, the surface and its pets.
import { TICK_MS } from '../../sprite'
import { runsOf, sameCells, TERMINAL } from '../cells'
import type { LabCells, LabLook, LabRun, Live } from '../look'
import { CHAMELEON } from './chameleon-pet'
import { HAMSTER } from './hamster-pet'
import { MOMIJI_PIXEL } from './momiji-pixel-pet'
import { lettersOver, Pixels } from './pixels'
import { SAKURA_PIXEL } from './sakura-pixel-pet'
import { TREE_FROG } from './tree-frog-pet'
import type { Directing, PixelPet } from './pet'

const TICK_S = TICK_MS / 1000

/** A frame of `columns` x `rows` blank cells: spaces on the terminal's own colors. */
function blank(columns: number, rows: number): Uint32Array {
  const data = new Uint32Array(columns * rows * 3)
  for (let at = 0; at < data.length; at += 3) {
    data[at] = 0x20
    data[at + 1] = TERMINAL
    data[at + 2] = TERMINAL
  }
  return data
}

/**
 * `pet` at `pose`: its pixels cleared, painted whole and mapped into `out`,
 * its letters over them: a frame of its box as a Raster's cells, a function
 * of its pose (and the theme) alone. What a step draws, without the clock:
 * the studio's stills and the tests.
 */
export function paintCells<P>(pet: PixelPet<P>, pose: P, isLight: boolean, pixels = new Pixels(pet.columns, pet.rows, pet.palette), out: Uint32Array = new Uint32Array(pet.columns * pet.rows * 3)): Uint32Array {
  if (pixels.columns !== pet.columns || pixels.rows !== pet.rows || pixels.palette !== pet.palette) throw new RangeError(`${pet.id} paints only onto pixels of its own box and palette`)
  pixels.clear()
  pet.paint(pixels, pose, isLight)
  pixels.cellsOf(out)
  lettersOver(out, pet.columns, pet.rows, pet.letters?.(pose, isLight) ?? [])
  return out
}

/** `pet`, alive: posed by `director` each tick and each frame between, and painted afresh every step. */
function pixelLive<P>(pet: PixelPet<P>, director: Directing<P>): Live {
  const { columns, rows } = pet
  const pixels = new Pixels(columns, rows, pet.palette)
  let shown: LabCells = { columns, rows, data: blank(columns, rows), version: 0 }
  let spare: Uint32Array = new Uint32Array(columns * rows * 3)
  let runs: LabRun[][] | undefined
  return {
    step(input) {
      // A frame between ticks is the tick's input a share of a tick later.
      const share = (input.frame ?? 0) / pet.frames
      const pose = director.pose({
        t: (input.tick + share) * TICK_S,
        mood: input.mood,
        since: (input.since + share) * TICK_S,
        spoke: input.spoke,
        spectacle: input.spectacle,
        turnsEnded: input.turnsEnded,
      })
      paintCells(pet, pose, input.isLight, pixels, spare)
      if (sameCells(shown.data, spare)) return
      const data = spare
      spare = shown.data
      shown = { columns, rows, data, version: shown.version + 1 }
      runs = undefined
    },
    runs: () => (runs ??= runsOf(shown)),
    cells: () => shown,
  }
}

/** `pet` as a lab look: a band pet of its own size, in blocks, on its own frame clock. */
export function pixelLook<P>(pet: PixelPet<P>): LabLook {
  return {
    id: pet.id,
    name: pet.name,
    persona: pet.persona,
    blurb: pet.blurb,
    layout: 'pet',
    width: pet.columns,
    height: pet.rows,
    minColumns: 50,
    fallback: pet.fallback,
    bubble: pet.bubble,
    frames: pet.frames,
    blocks: true,
    start: seed => pixelLive(pet, pet.director(seed)),
    demo: () => pixelLive(pet, pet.demo()),
  }
}

/** Every pixel pet as a lab look, in the order the gallery lists them (after the drawn looks, before the rig looks): the one place a new one is registered. */
export const PIXEL_LOOKS: readonly LabLook[] = [pixelLook(HAMSTER), pixelLook(TREE_FROG), pixelLook(MOMIJI_PIXEL), pixelLook(SAKURA_PIXEL), pixelLook(CHAMELEON)]
