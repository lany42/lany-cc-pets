// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The drawn kind: pets that break the frame (from braille-uncanny), each a
// pure function of the moment: an inchworm that is its own speech bubble, a
// shy thing behind a ledge, a cat made of the moonlight it blocks, an alley
// cat that rides the spinner. This adapter makes each a lab look; its moment is
// what the clock last told it, so a render only reads what it drew.
import type { Color } from 'claude-code'

import type { LabInput, LabLook, LabRun, Live } from '../look'
import { isCellSafe } from '../look'
import { pet as looper } from './looper'
import { pet as nightcat } from './nightcat'
import { pet as peek } from './peek'
import type { Drawing, ExperimentalPet } from './pet'
import { pet as stray } from './stray'

/**
 * One drawn pet, alive: what it drew at the moment the clock last gave it.
 * `ridesSpinner` lets it ride the spinner line too: its words there, less
 * the ellipsis the engine's own suffix already draws.
 */
function sketch(pet: ExperimentalPet, ridesSpinner: boolean): Live {
  let drawing: Drawing = { band: [] }
  let rows: LabRun[][] = []
  let isLeft = false
  /** For a pet with a window picture: the input it last drew for, and its band self then, drawn when asked. */
  let last: LabInput | undefined
  let band: LabRun[][] | undefined
  /** What it draws for `input`, its window picture when `isWindow`, and whether it left its words to the band. */
  const drawFor = (input: LabInput, isWindow: boolean): { drawing: Drawing; isLeft: boolean } => {
    // A pet that draws its own bubble only gets words it can draw cell for cell; the band bubbles the rest.
    const line = input.line !== undefined && (!pet.ownsBubble || isCellSafe(input.line.text)) ? input.line : undefined
    const moment = { tick: input.tick, mood: input.mood, since: input.since, columns: input.room.columns, rows: input.room.rows, isLight: input.isLight, now: input.now, ...(isWindow ? { isWindow: true } : {}) }
    const drawn = pet.draw({ ...moment, ...(line !== undefined ? { line } : {}) })
    // Grown round its words past the band's rows, it rests instead and leaves them to the band: a band never scrolls.
    const isWordy = line !== undefined || input.mood === 'ponder'
    const left = pet.ownsBubble && isWordy && drawn.band.length > input.room.rows
    return { drawing: left ? pet.draw({ ...moment, mood: input.mood === 'busy' ? 'busy' : 'idle' }) : drawn, isLeft: left }
  }
  const live: Live = {
    step(input) {
      const isWindow = pet.window !== undefined && input.isWindow === true
      const drawn = drawFor(input, isWindow)
      drawing = drawn.drawing
      isLeft = drawn.isLeft
      rows = drawing.band
      last = input
      band = isWindow ? undefined : rows
    },
    runs: () => rows,
    ...(pet.ownsBubble ? { leftWords: () => isLeft } : {}),
  }
  if (pet.window !== undefined) live.bandRuns = () => (band ??= last === undefined ? [] : drawFor(last, false).drawing.band)
  if (ridesSpinner) live.spinner = () => drawing.spinner?.map(run => run.text).join('').replace(/^…\s*/, '') || undefined
  return live
}

/** A drawn pet as a lab look: what its card says, its width at rest, how far it grows round its words, its fallback. */
export function drawnLook(pet: ExperimentalPet, extra: { blurb: string; width: number; most?: { width: number; height: number }; fallback: string; hasFloor?: boolean; ridesSpinner?: boolean }): LabLook {
  return {
    id: pet.id,
    name: pet.name,
    persona: pet.persona,
    // Its artist's blurb, cut to a card's line.
    blurb: extra.blurb,
    layout: 'pet',
    width: extra.width,
    height: pet.rows.rest,
    ...(extra.most !== undefined ? { most: extra.most } : {}),
    ...(pet.window !== undefined ? { window: pet.window } : {}),
    minColumns: 50,
    ...(pet.ownsBubble ? { ownsBubble: true } : {}),
    ...(extra.hasFloor === true ? { hasFloor: true } : {}),
    fallback: extra.fallback,
    bubble: pet.color as Color,
    start: () => sketch(pet, extra.ridesSpinner === true),
    demo: () => sketch(pet, false),
  }
}

// A drawn look marks nothing after a turn's closing line: a mark would
// redraw onto every past turn in the scrollback as it is put on, and vanish
// when it is taken off.
export const DRAWN_LOOKS: readonly LabLook[] = [
  // Its bubble grows round a line: up to its 50 columns of words and its rim, and a row a line wrapped.
  drawnLook(looper, { blurb: 'is its own bubble', width: 17, most: { width: 58, height: 11 }, fallback: 'jumping-spider' }),
  drawnLook(peek, { blurb: 'ducks when Claude works', width: 24, fallback: 'many-eyes', hasFloor: true }),
  drawnLook(nightcat, { blurb: 'made of missing dots', width: 17, fallback: 'cat' }),
  drawnLook(stray, { blurb: 'alley cat, rides spinner', width: 22, fallback: 'cat', hasFloor: true, ridesSpinner: true }),
]
