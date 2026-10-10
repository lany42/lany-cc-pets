// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The grown pets' shared core (from braille-generative, its algorithms as
// they were): a seeded PRNG, a dot field drawn in braille, and the one
// encoder the band uses, styled runs. The Raster, Svg and ANSI encoders wait
// for their phase. Pure: imports nothing at run time but the lab's shape and
// its braille (braille.ts: the dot canvas and the highest-ink rule).
import { addCell } from '../../runs'
import { Dots, topCell } from '../braille'
import type { LabMood, LabRun } from '../look'

export { Dots }

export type Mood = LabMood

// ---------------------------------------------------------------------------
// Seeds and randomness

/** A seed from anything the person types: FNV-1a over the UTF-16 units, then mixed. */
export function seedOf(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return mix32(h)
}

/** A 32-bit finalizer (murmur3's): spreads every input bit over the output. */
export function mix32(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A stable hash of a few integers: the same dot always gets the same answer (no boiling). */
export function hash3(a: number, b: number, c: number): number {
  return mix32((Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)) >>> 0)
}

/** hash3 as a number in [0, 1). */
export const hash01 = (a: number, b: number, c: number): number => hash3(a, b, c) / 4294967296

/** A seeded PRNG (mulberry32): fast, 32 bits of state, good enough for art. */
export type Rng = {
  /** [0, 1) */
  next(): number
  /** [lo, hi) */
  range(lo: number, hi: number): number
  /** an integer in [lo, hi] */
  int(lo: number, hi: number): number
  /** true with probability p */
  chance(p: number): boolean
  /** The state, to save and resume. */
  state(): number
}

export function rng(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor((hi - lo + 1) * next()),
    chance: p => next() < p,
    state: () => s,
  }
}

const SYLLABLES = ['ka', 'ki', 'ko', 'mi', 'mo', 'na', 'no', 'ri', 'ru', 'sa', 'shi', 'ta', 'to', 'yu', 'wa', 'ha', 'ho', 'fu', 'ne', 'pi', 'po', 'su', 'te', 'mu']

/** A pronounceable name from a seed, e.g. "korimu": what a new pet is born from, and what the person keeps. */
export function seedWord(seed: number): string {
  const r = rng(seed)
  let word = ''
  for (let i = r.int(2, 3); i > 0; i--) word += SYLLABLES[r.int(0, SYLLABLES.length - 1)]
  return word
}

/** Smooth 1D value noise in [-1, 1], periodic in nothing, stable per seed. */
export function noise1(seed: number, x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  const a = hash01(seed, i, 7) * 2 - 1
  const b = hash01(seed, i + 1, 7) * 2 - 1
  return a + (b - a) * u
}

// ---------------------------------------------------------------------------
// Inks: what a dot is made of. A pet names its inks; each has a color per
// theme and a theme key for the Text path, which follows the person's theme.

export type Ink = {
  name: string
  /** 0xRRGGBB on a dark terminal (Konsole's Breeze, #232627). */
  dark: number
  /** 0xRRGGBB on a light terminal (#fcfcfc). */
  light: number
  /** The theme key the Text path paints it with (`success`, `claude`...). */
  key: string
}

// ---------------------------------------------------------------------------
// The frame: a grid of cells, each a code point and an ink index.
// Ink 0 is "nothing": an empty cell is a space in the terminal's own colors.

export type Frame = {
  cols: number
  rows: number
  /** Code point per cell, row-major; 0x20 when empty. */
  glyph: Uint16Array
  /** Ink index per cell (0 = none). */
  ink: Uint8Array
}

export function newFrame(cols: number, rows: number): Frame {
  const frame = { cols, rows, glyph: new Uint16Array(cols * rows), ink: new Uint8Array(cols * rows) }
  frame.glyph.fill(0x20)
  return frame
}

// ---------------------------------------------------------------------------
// The dot field: the lab's `Dots` (braille.ts), (2 x cols) by (4 x rows)
// dots, each holding an ink (0 = off). Packed into braille at the end: a cell's code point is U+2800 + its dot mask,
// its ink the highest-numbered ink among its dots, so a pet orders its inks
// from background (low) to foreground (high): leaves over bark, eyes over all.

/**
 * A line of dots from (x0, y0) to (x1, y1), in float coordinates: even
 * steps, as many as it is long rounded up, each dot laid only over a lower
 * ink (`Dots.over`).
 */
export function lineOver(d: Dots, x0: number, y0: number, x1: number, y1: number, ink: number): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let i = 0; i <= n; i++) d.over(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ink)
}

/** Packs the dots into `frame` as braille, by the highest ink (cells already holding a glyph are kept). */
export function packFrame(d: Dots, frame: Frame): void {
  const { cols, rows, w, dot } = d
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const at = r * cols + c
      if (frame.glyph[at] !== 0x20 && frame.glyph[at] !== 0) continue
      const cell = topCell(dot, r * 4 * w + c * 2, w)
      frame.glyph[at] = cell === 0 ? 0x20 : 0x2800 + (cell & 0xff)
      frame.ink[at] = cell >> 8
    }
  }
}

/** Clears a frame back to empty cells. */
export function clearFrame(frame: Frame): void {
  frame.glyph.fill(0x20)
  frame.ink.fill(0)
}

// ---------------------------------------------------------------------------
// The pet: born from a seed (and what it remembers), then ticked.

/** What the band tells a pet each tick. */
export type TickInput = {
  /** The band's tick (250 ms each). */
  tick: number
  mood: Mood
  /** Main turns completed since the last tick, usually 0 or 1 (the pet may grow, land, cheer). */
  turnsEnded: number
  /** True on the one tick a new line landed in the bubble. */
  spoke: boolean
  /** The month, 0-11, for pets that follow the seasons. */
  month: number
}

export type GenPet<S> = {
  id: string
  name: string
  /** As a Sprite's: the noun phrase the side model is told it is. */
  persona: string
  cols: number
  rows: number
  /** Index 0 is unused (no ink); 1.. from background to foreground. */
  inks: readonly Ink[]
  /** A new pet from `seed`, resuming from `memory` (what its `turned` last kept in the store for the seed's word) when given. */
  born(seed: number, memory?: unknown): S
  /** Advances one tick and draws the result into `out` (cleared by the pet). */
  tick(state: S, input: TickInput, out: Frame): void
  /** For one that counts finished turns: its memory once one more finished; undefined for a memory it doesn't recognise. */
  turned?(memory: unknown, seed: number): unknown
  /** This one pet in a few words for pet-control, after its seed word: "42 twigs from 50 turns". */
  describe(state: S): string
}

// ---------------------------------------------------------------------------
// The encoder: one frame as styled runs.

/**
 * The frame as runs of theme keys, one row each (the band's Text path):
 * merges neighbours of one ink, and lets spaces join whatever run they sit
 * in (runs.ts `addCell`). They follow the person's light or dark theme.
 */
export function runs(frame: Frame, inks: readonly Ink[]): LabRun[][] {
  const out: LabRun[][] = []
  for (let r = 0; r < frame.rows; r++) {
    const row: LabRun[] = []
    for (let c = 0; c < frame.cols; c++) {
      const at = r * frame.cols + c
      const cp = frame.glyph[at]!
      const ink = frame.ink[at]!
      addCell(row, String.fromCharCode(cp), cp === 0x20, ink === 0 ? undefined : inks[ink]?.key)
    }
    out.push(row)
  }
  return out
}

// ---------------------------------------------------------------------------
// Small math

/** Moves `v` toward `target` by at most `step`. */
export const approach = (v: number, target: number, step: number): number =>
  v < target ? Math.min(target, v + step) : Math.max(target, v - step)
export const TAU = Math.PI * 2
