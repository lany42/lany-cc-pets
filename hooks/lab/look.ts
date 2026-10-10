// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The "experimental!" tier's one shape: a lab look. Every kind of braille pet
// (frames baked by hand, creatures grown from a seed, scenes the width of the
// band, pets drawn by a pure function) is turned into this by its own small
// adapter, so the band, the pane and the clock only ever see a LabLook and the
// Live one it starts. Pure: imports nothing at run time but util.ts, itself
// pure.
import type { Color } from 'claude-code'

import type { Run } from '../runs'
import { isNarrow } from './util'

/** The moods a lab look is told: the band's four, with sleep resting as idle and cheer playing as talk. */
export type LabMood = 'idle' | 'busy' | 'ponder' | 'talk'

/** A run of one style, named as TextProps names them, so the band spreads it straight onto a Text: the one Run every kind draws (runs.ts). */
export type LabRun = Run

/**
 * A frame as a Raster's cells, for a look that paints in truecolor blocks:
 * per cell a code point, a foreground and a background (0x00RRGGBB, or
 * 0x01000000 for the terminal's own), row-major. `version` moves on whenever
 * the cells change, so a frame drawn already isn't sent again.
 */
export type LabCells = { readonly columns: number; readonly rows: number; readonly data: Uint32Array; readonly version: number }

/**
 * The cells the band gives a look: the columns it may take, and its rows. A
 * scene fills them; a pet that draws its own bubble talks in them, and leaves
 * a line it can't fit to the band.
 */
export type Room = { columns: number; rows: number }

/**
 * What the clock tells a live look each tick, from the pet's own atoms: never
 * from a render, so a look only moves when time does.
 */
export type LabInput = {
  /** The pet's animation tick, 250 ms each. */
  tick: number
  mood: LabMood
  /** Ticks since `mood` began: lets a look play an entrance (a duck, a rise). */
  since: number
  /** Main turns finished (not on an Esc) since its last step: usually 0, 1 the tick after one, more after a nap. */
  turnsEnded: number
  /** True on the one tick a new line landed in the bubble. */
  spoke: boolean
  /** True on the one tick a long turn ended, at most once in a while: a scene plays its big moment. */
  spectacle: boolean
  /** The bubble's line while it shows, and its age in ticks: for looks that draw their own bubble. */
  line?: { text: string; age: number }
  /** Wall clock, ms: the month for the seasons, tonight's moon. */
  now: number
  /** The band's room when it last drew: a scene fills it, a pet may fit itself to it. */
  room: Room
  /** Whether the person's theme is a light one: for looks with raw colors or a night of their own. */
  isLight: boolean
  /**
   * True while the pet window draws it and its room holds its window picture
   * (LabLook.window) with a bubble beside or above (band.ts showsWindow): it
   * draws that picture. Never in the band, a gallery card or a room too small.
   */
  isWindow?: boolean
  /**
   * For a look with `frames`: which of the tick's frames this step draws, 0
   * (the tick itself) to frames - 1. The rest of the input is the tick's, so
   * moods and talk keep their ticks. Absent for every other look.
   */
  frame?: number
  /**
   * True where the person's terminal draws East Asian ambiguous-width
   * characters (box drawing, most block elements, the ellipsis) two columns
   * wide: a look keeps to braille, ASCII, spaces and the narrow blocks then
   * (a scene that paints in cells does it for itself, in scene/cells.ts).
   * Nothing sets it yet: absent, as for every look today.
   */
  isAmbiguousWide?: boolean
}

/** One lab look, alive: born from a seed (and what it remembered), moved only by `step`. */
export type Live = {
  /** Advances one tick and draws: the clock's alone, never a render's. */
  step(input: LabInput): void
  /** What the last step drew, as rows of runs; blank until the first step. */
  runs(): readonly (readonly LabRun[])[]
  /** This one pet in a few words, for pet-control: "88 twigs from 100 turns". */
  describe?(): string
  /** Words to ride the spinner line with while Claude works, after its own suffix; undefined leaves it be. */
  spinner?(): string | undefined
  /** True when its last step had words (a line, its "...") but no rows for them: the band bubbles them beside it instead. */
  leftWords?(): boolean
  /** A look with a window picture: what its last step draws in the band, for the band and pet-control while `runs` is the window's. */
  bandRuns?(): readonly (readonly LabRun[])[]
  /** What the last step drew as a Raster's cells (the same frame as `runs`): the band and the pet window draw it so on the terminal, and blit its frames between ticks. */
  cells?(): LabCells
}

export type LabLook = {
  /** Lowercase, hyphenated: what `/pet as <id>` takes; never a classic sprite's id. */
  id: string
  name: string
  /** A noun phrase the side model is told it is, as a sprite's. */
  persona: string
  /** What it does, or takes, in a few words for its gallery card: "grows with your turns". One card's line. */
  blurb: string
  /**
   * Where it lives in the band. `pet`: art `width` x `height` at rest, right
   * of the band's bubble as a classic look. `scene`: art across the band's
   * whole width, `height` rows, its bubble drawn inside it; `width` is its
   * gallery thumbnail's.
   */
  layout: 'pet' | 'scene'
  width: number
  height: number
  /** How far a look that draws its own bubble may grow while it talks; the rest hold `width` x `height`. */
  most?: { width: number; height: number }
  /**
   * A pet's bigger picture for the pet window: the largest box it draws
   * there (at most 120 x 39), told by `isWindow`. Everywhere
   * else (the band, its card, pet-control, a window too small) it is
   * `width` x `height` as ever.
   */
  window?: { width: number; height: number }
  /** The fewest rows a scene composes itself in, when fewer than its `height`: a short band gets it smaller rather than swapped. */
  least?: number
  /** The fewest rows a scene may be shown in, its top (sky) cropped from a frame composed in `least`; `least` when it has none to spare. */
  fewest?: number
  /** The narrowest band body it is worn in; narrower, it wears `fallback`. */
  minColumns: number
  /** Draws its words (and its "...") itself, so the band draws no bubble beside it. */
  ownsBubble?: boolean
  /** Its bottom row is a floor or a ledge, which stays on the prompt: the band's button keeps to its own corner beside it. */
  hasFloor?: boolean
  /** The classic sprite worn in its place: experimental! off, a surface it can't draw on, too little room. */
  fallback: string
  /** The bubble's border, its name in pet-control, its card when current: a theme key. */
  bubble: Color
  /** It grows from a seed word and remembers: `/pet seed`, and a memory per word in the store. */
  isGrown?: boolean
  /**
   * For a grown look that keeps count of finished turns: what it remembers
   * once one more has finished, given what it remembered (undefined: nothing
   * yet). Undefined for a memory it does not recognise, which is then left
   * as it is. Counted whatever look is worn, so it grows with the work.
   */
  turned?(memory: unknown, seed: number): unknown
  /** The person's pet, born from `seed` and resuming `memory` when given. */
  start(seed: number, memory?: unknown): Live
  /** A sample for its gallery card: not the person's own, so the card shows the kind at its best. */
  demo(): Live
  /**
   * Steps a tick in `frames` frames (2 to 10), each TICK_MS / frames apart,
   * for motion smoother than the tick: the clock steps it again between
   * ticks with `frame` 1 and on, and blits its `cells` while it is drawn.
   * Undefined: once a tick, as every look but such a one.
   */
  frames?: number
  /** Paints with block elements (U+2580-259F) and backgrounds, as well as braille: a rig look in truecolor cells, or a scene's field (scene/cells.ts). */
  blocks?: true
}

/**
 * Whether a look may draw code point `cp` as one cell of its own words: one
 * that takes exactly one cell wherever braille does (printable ASCII, Latin-1
 * and Latin Extended-A, general punctuation, box drawing, braille), but never
 * a blank braille cell, U+2800, since a look draws an empty cell as a space
 * (and `petLine` turns one in a line into a space before any look sees it).
 * The one rule for a bubble a look draws itself: `isCellSafe` hands it only
 * lines of these, and the lab's standard lets it draw every one of them.
 */
export const isCellSafeChar = (cp: number): boolean => cp !== 0x2800 && isNarrow(cp)

/**
 * Whether a look may draw every character of `text` in its own bubble
 * (`isCellSafeChar`). A look that draws its own bubble gets only such lines;
 * the band bubbles the rest (emoji, CJK) itself.
 */
export function isCellSafe(text: string): boolean {
  for (const char of text) if (!isCellSafeChar(char.codePointAt(0) ?? 0)) return false
  return true
}

/** Cells a row of runs takes: every glyph a lab look draws is one cell wide. */
export const widthOf = (row: readonly LabRun[]): number => row.reduce((cells, run) => cells + [...run.text].length, 0)

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Rows `top` to `top + rows` of a frame's cells as a Raster takes them:
 * standard padded base64 of little-endian u32 triplets.
 */
export function cellsBase64(cells: LabCells, top = 0, rows = cells.rows - top): string {
  const words = cells.data.subarray(top * cells.columns * 3, (top + rows) * cells.columns * 3)
  const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength)
  const fast = (bytes as Uint8Array & { toBase64?: () => string }).toBase64
  if (typeof fast === 'function') return fast.call(bytes)
  let out = ''
  for (let at = 0; at < bytes.length; at += 3) {
    const a = bytes[at]!
    const b = bytes[at + 1]
    const c = bytes[at + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += BASE64[(n >> 18) & 63]! + BASE64[(n >> 12) & 63]! + (b === undefined ? '=' : BASE64[(n >> 6) & 63]!) + (c === undefined ? '=' : BASE64[n & 63]!)
  }
  return out
}
