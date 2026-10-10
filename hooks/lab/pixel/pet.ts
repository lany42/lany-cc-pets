// What a pixel pet is: the one shape the pixel kind's runtime (index.ts)
// wears. A pixel pet is hand-drawn pixel art the size of a band pet, one
// pixel a column and two a row, painted by letter of its palette onto the
// kind's pixel surface (pixels.ts) and mapped straight into truecolor block
// cells; it stands right of the band's bubble as a braille pet does, is
// drawn as one Raster on the terminal, and moves on a frame clock of its own
// between the band's ticks. Its own file brings its art and its director and
// ties them together in one PixelPet. Pure: imports nothing at run time.
import type { Color } from 'claude-code'

import type { LabMood } from '../look'
import type { Letter, Palette, Pixels } from './pixels'

/** What a pixel pet's director is told each frame. */
export type Cue = {
  /** Its time in seconds: the tick's, plus the frame's share of it. */
  t: number
  mood: LabMood
  /** Seconds in this mood, the frame's share included. */
  since: number
  /** True on the frame a line landed. */
  spoke: boolean
  /** True on the frame a long turn ended, with a spectacle earned. */
  spectacle: boolean
  /** Turns finished since the last frame. */
  turnsEnded: number
}

/** A pet's own clock: the cue in, a pose out. Deterministic from its seed (never Math.random). */
export type Directing<P> = { pose(cue: Cue): P }

export type PixelPet<P> = {
  /** Lowercase, hyphenated: what `/pet as <id>` takes. */
  id: string
  name: string
  /** A noun phrase the side model is told it is, 1-120 characters, never "you". */
  persona: string
  /** Its gallery card's line, at most 24 characters. */
  blurb: string
  /** The classic sprite worn in its place (desktop, too narrow, experimental! off). */
  fallback: string
  /** The band's bubble border beside it, its name and card in pet-control: a theme key. */
  bubble: Color
  /** Its box in cells, at rest and always: one pixel a column, two a row. */
  columns: number
  rows: number
  /** Frames a tick on its clock (2-10): 4 make 16 a second. */
  frames: number
  /** Its director: the person's from their seed; its gallery card's a sample with something to show. */
  director(seed: number): Directing<P>
  demo(): Directing<P>
  /** Its colors by letter, 0xRRGGBB, the same in both themes: all it can paint ('.' is bare). */
  palette: Palette
  /** Paints it at `pose` onto its box's pixels, for the theme: by letter of its palette, at whole pixels. The adapter clears them first, every step. */
  paint(pixels: Pixels, pose: P, isLight: boolean): void
  /** Letters it writes into its cells over the art (its z's), each a printable ASCII code point, its column and row in its box and its 0xRRGGBB ink. */
  letters?(pose: P, isLight: boolean): readonly Letter[]
}
