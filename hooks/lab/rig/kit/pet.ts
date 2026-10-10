// What a painted pet is: the one shape the painted look's runtime (look.ts)
// wears. The rig engine's adapter (../adapter.ts) makes every rig pet one: its
// window form painted from the rig, its band form (`chibi`, when it has one) a
// pixel pet posed by the rig's channels, its director stepping the drivers.
// Without a band form, short rooms show its `fallback` sprite instead.
// look.ts lays it out, repaints what moved, encodes it, draws its words and
// makes it a lab look. Pure: imports nothing at run time.
import type { Color } from 'claude-code'

import type { Canvas } from './canvas'
import type { Affine } from './pen'

/** The moods a painted pet is told: the lab's four (asleep rests as idle, glad talks). */
export type Mood = 'idle' | 'busy' | 'ponder' | 'talk'

/** What a director is told each frame. */
export type Cue = {
  /** Its time in seconds: the tick's, plus the frame's share of it. */
  t: number
  mood: Mood
  /** Seconds in this mood. */
  since: number
  /** True on the frame a line landed. */
  spoke: boolean
  /** True on the frame a long turn ended, with a spectacle earned. */
  spectacle: boolean
  /** Turns finished since the last frame. */
  turnsEnded: number
}

/**
 * A pose: every channel a continuous number, and nothing else, so any two
 * poses blend and every frame between two expressions is as clean as the two.
 */
export type Channels = Record<string, number>

/** A pet's own clock: the cue in, a pose out. Deterministic from its seed (never Math.random). */
export type Directing<S extends Channels> = { pose(cue: Cue): S }

/**
 * One part of the window form, for repainting only what moved: a box in the
 * units of its own space, and the channels that move or change anything
 * inside it. A step repaints each part whose channels changed, where it was
 * and where it is; anything a channel changes outside its parts' boxes is
 * left stale on screen (the tests hold every pet to that).
 */
export type Part<S extends Channels> = {
  box: readonly [x0: number, y0: number, x1: number, y1: number]
  /**
   * Its channels by name. Plain strings, not `keyof S`, so every pet fits the
   * one `PaintedPet` the registry holds; the tests hold each name to a
   * channel of the pet's `rest`.
   */
  keys: readonly string[]
  /** The part's units to canvas samples at `pose`, under the layout's `m`: the head turned on its neck, the chest risen. */
  space(pose: S, m: Affine): Affine
}

/** A painted pet: who it is, how it moves, and its two forms. */
export type PaintedPet<S extends Channels = Channels> = {
  // ---- who it is (a lab look's fields; the rest of the look is the kind's)
  /** Lowercase, hyphenated: what `/pet as <id>` takes. */
  id: string
  name: string
  /** A noun phrase the side model is told it is, 1-120 characters, never "you". */
  persona: string
  /** Its gallery card's line, at most 24 characters. */
  blurb: string
  /** The classic sprite worn in its place (desktop, too narrow, experimental! off). */
  fallback: string
  /** Its name and card in pet-control: a theme key. */
  bubble: Color
  /** Its own bubble's border, 0xRRGGBB, on a dark theme and on a light: two of its own colors that read on each. */
  border: { dark: number; light: number }

  // ---- how it moves
  /** Its pose at rest, as idle holds it between acts: where the studio's stills and previews start. */
  rest: S
  /** Its director, from a seed: the same seed and cues give the same poses. */
  director(seed: number): Directing<S>

  // ---- the window form: painted from vectors, from 10 rows up
  window: {
    /** Its box in its own units (y down): everything it paints at rest is inside. */
    width: number
    height: number
    /** The units a short window (10 rows) frames, top to bottom; from 30 rows the whole box shows, eased between. */
    crop: { top: number; bottom: number }
    /** Units from the box's left to its face's left edge: its words stay left of it. */
    faceLeft: number
    /** Its mouth, in units: its bubble's tail points there. */
    mouth: readonly [x: number, y: number]
    /** Paints it at `pose` under `m` (its units to samples); a clipped canvas paints only the clip. */
    paint(canvas: Canvas, pose: S, m: Affine): void
    /** Its parts, for repainting what moved; together they must cover every channel. */
    parts: readonly Part<S>[]
    /**
     * Channels that move whole samples rather than a hundredth: 1 a sample, 2
     * a half (Momiji's chest 1, bob 2). Between them nothing they move changes,
     * so an eased value creeping on repaints nothing.
     */
    snap?: Readonly<Record<string, number>>
  }

  // ---- the band form: pixel art for the band, below 10 rows
  /** Its band form. Left out, rooms under 10 rows show its `fallback` sprite instead (look.ts, `asciiOf`). */
  chibi?: BandForm<S>
}

/** A band form: a pixel pet posed by a painted pet's channels, for rooms under 10 rows. */
export type BandForm<S extends Channels = Channels> = {
  /** Its size in cells (one pixel a column, two a row). */
  columns: number
  rows: number
  /** Its mouth's cell, from its top left: its bubble's tail points there. */
  mouth: { c: number; r: number }
  /** Paints it at cell column `c0`, its top `top` pixel rows (half cells) down. */
  paint(canvas: Canvas, pose: S, c0: number, top: number): void
  /** What it shows at `pose`, as a key: the same key, the same pixels (it repaints only when the key changes). */
  key(pose: S): string
}
