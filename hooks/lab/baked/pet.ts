// The baked kind: a miniature drawn dot by dot ahead of time, kept as frames
// and loops like a classic Sprite, with one ink per cell from its own palette;
// and maybe a bigger picture for the pet window, its own frames and loops in
// the same palette. Stateless: a live one only records the mood and tick the
// clock last gave it.
// Pure: imports nothing at run time but the lab's own shape and a Sprite's
// loops (sprite.ts: a loop's steps, as a baked pet's are the same).
import type { Color } from 'claude-code'

import { addCell } from '../../runs'
import { MAX_LOOP_TICKS, ticksOf } from '../../sprite'
import type { Step } from '../../sprite'
import type { LabLook, LabMood, LabRun, Live } from '../look'
import { LAB_MOODS } from '../look'

/** A frame's name for one tick, or `[name, ticks]` to hold it that long: a Sprite's Step. */
export type { Step }
/** A loop as one frame name per tick, as a Sprite's. */
export { ticksOf }

/** One frame: per row, its glyphs, and per cell the ink digit that colors it ('1' is `palette[0]`, ' ' none). */
export type Baked = { lines: readonly string[]; ink: readonly string[] }

/** One ink: the theme key the band paints it with, and the exact colors its artist tuned for a dark and a light theme. */
export type Ink = { name: string; key: Color; dark: string; light: string }

/** Frames, and the loops that play them: the band's picture, or the window's. */
export type Picture = { frames: Readonly<Record<string, Baked>>; loops: Readonly<Record<LabMood, readonly Step[]>> }

/** A pet's window picture: its own size, frames and loops for the same four moods, in the pet's own palette. */
export type BakedWindow = Picture & { width: number; height: number }

/**
 * A window picture as pets.ts keeps it (the builder packs it): every distinct
 * row once, its glyphs and its ink digits, and each frame as its rows' numbers.
 */
export type PackedWindow = {
  width: number
  height: number
  rows: readonly (readonly [line: string, ink: string])[]
  frames: Readonly<Record<string, readonly number[]>>
  loops: Readonly<Record<LabMood, readonly Step[]>>
}

export type BakedPet = {
  id: string
  name: string
  persona: string
  width: number
  height: number
  /** Ink '1' is `palette[0]`, the body: the bubble's border is drawn in it too. */
  palette: readonly Ink[]
  fallback: string
  frames: Readonly<Record<string, Baked>>
  loops: Readonly<Record<LabMood, readonly Step[]>>
  /** Its bigger picture for the pet window, if it has one, packed. */
  window?: PackedWindow
}

const MAX_INKS = 9
/** The largest window picture: the same bound the lab's checks hold a window to. */
const WINDOW_MOST = { width: 120, height: 39 }

/** A window picture packed for pets.ts: identical rows kept once, as a wing that moves changes few rows of a tall frame. */
export function packWindow(window: BakedWindow): PackedWindow {
  const rows: (readonly [string, string])[] = []
  const at = new Map<string, number>()
  const frames: Record<string, number[]> = {}
  for (const [name, frame] of Object.entries(window.frames)) {
    frames[name] = frame.lines.map((line, row) => {
      const ink = frame.ink[row] ?? ''
      const key = `${line}\n${ink}`
      const known = at.get(key)
      if (known !== undefined) return known
      at.set(key, rows.length)
      rows.push([line, ink])
      return rows.length - 1
    })
  }
  return { width: window.width, height: window.height, rows, frames, loops: window.loops }
}

/** A packed window picture's frames as they were drawn. */
export function unpackWindow(packed: PackedWindow): BakedWindow {
  const frames: Record<string, Baked> = {}
  for (const [name, rows] of Object.entries(packed.frames)) {
    frames[name] = { lines: rows.map(row => packed.rows[row]?.[0] ?? ''), ink: rows.map(row => packed.rows[row]?.[1] ?? '') }
  }
  return { width: packed.width, height: packed.height, frames, loops: packed.loops }
}

/** The frame `mood` shows `at` ticks into its loop, of the band's picture or the window's. */
export function frameOf(picture: Picture, mood: LabMood, at: number): Baked | undefined {
  const names = ticksOf(picture.loops[mood])
  const name = names[((at % names.length) + names.length) % names.length]
  return name !== undefined && Object.hasOwn(picture.frames, name) ? picture.frames[name] : Object.values(picture.frames)[0]
}

/** A frame's rows as runs of one ink each, in theme keys, so they follow the person's light or dark theme. */
export function inkRuns(pet: BakedPet, frame: Baked): LabRun[][] {
  return frame.lines.map((line, row) => {
    const runs: LabRun[] = []
    const inks = frame.ink[row] ?? ''
    let column = 0
    for (const char of line) {
      const digit = inks[column] ?? ' '
      column += 1
      // A blank joins the run it sits in, so a row stays a few runs.
      addCell(runs, char, char === ' ', digit === ' ' ? undefined : pet.palette[Number(digit) - 1]?.key)
    }
    return runs
  })
}

/** What breaks a picture's rules (its frames' size, glyphs and inks, its loops), each said after `of`. */
function pictureProblems(picture: Picture, width: number, height: number, inks: number, of: string): string[] {
  const problems: string[] = []
  const fail = (why: string) => problems.push(`${of}${why}`)
  for (const [name, frame] of Object.entries(picture.frames)) {
    if (frame.lines.length !== height || frame.ink.length !== height) fail(`frame "${name}" is not ${height} rows`)
    // Pure braille: a cell is dots or a space, never a letter, a block or an empty braille cell.
    frame.lines.forEach((line, row) => {
      for (const char of line) {
        const cp = char.codePointAt(0) ?? 0
        if (char !== ' ' && !(cp >= 0x2801 && cp <= 0x28ff)) fail(`frame "${name}" row ${row + 1} draws U+${cp.toString(16).toUpperCase().padStart(4, '0')}, not braille dots or a space`)
      }
    })
    frame.ink.forEach((digits, row) => {
      if (digits.length !== width) fail(`frame "${name}" ink row ${row + 1} is ${digits.length} cells, not ${width}`)
      for (const digit of digits) {
        if (digit !== ' ' && !(Number(digit) >= 1 && Number(digit) <= inks)) fail(`frame "${name}" uses ink "${digit}"`)
      }
    })
  }
  for (const mood of LAB_MOODS) {
    const loop = picture.loops[mood]
    if (loop === undefined || loop.length === 0) {
      fail(`mood "${mood}" has no loop`)
      continue
    }
    const names = ticksOf(loop)
    if (names.length > MAX_LOOP_TICKS) fail(`mood "${mood}" runs ${names.length} ticks, over ${MAX_LOOP_TICKS}`)
    for (const name of new Set(names)) if (!Object.hasOwn(picture.frames, name)) fail(`mood "${mood}" plays "${name}", which is not a frame`)
    const distinct = new Set(names.map(name => (picture.frames[name]?.lines ?? []).join('\n')))
    if (mood !== 'idle' && distinct.size < 2) fail(`mood "${mood}" never changes`)
  }
  return problems
}

/** What breaks a baked pet's own rules (its loops and inks, and its window picture's); the lab's checker holds what it draws. */
export function checkBaked(pet: BakedPet): string[] {
  const problems: string[] = []
  const fail = (why: string) => problems.push(why)
  if (pet.palette.length < 1 || pet.palette.length > MAX_INKS) fail(`palette has ${pet.palette.length} inks, not 1-${MAX_INKS}`)
  problems.push(...pictureProblems(pet, pet.width, pet.height, pet.palette.length, ''))
  if (pet.window === undefined) return problems
  const { width, height, rows } = pet.window
  if (width < pet.width || height < pet.height || width > WINDOW_MOST.width || height > WINDOW_MOST.height) {
    fail(`window picture is ${width}x${height}: at least the band's ${pet.width}x${pet.height}, at most ${WINDOW_MOST.width}x${WINDOW_MOST.height}`)
  }
  rows.forEach(([line], at) => {
    if ([...line].length !== width) fail(`window row ${at + 1} is ${[...line].length} cells, not ${width}`)
  })
  for (const [name, numbers] of Object.entries(pet.window.frames)) {
    if (numbers.some(row => !Number.isInteger(row) || row < 0 || row >= rows.length)) fail(`window frame "${name}" names a row it doesn't have`)
  }
  problems.push(...pictureProblems(unpackWindow(pet.window), width, height, pet.palette.length, 'window '))
  return problems
}

/**
 * A baked pet, alive: the frame its mood is at, of its window picture while
 * the clock says the pet window holds it. Talk plays from the top as its
 * line lands, as a sprite's does; the other moods run on the clock, in the
 * window as in the band.
 */
function play(pet: BakedPet, window: BakedWindow | undefined): Live {
  let mood: LabMood = 'idle'
  let at = 0
  let isWindow = false
  let runs: LabRun[][] = []
  const live: Live = {
    step(input) {
      mood = input.mood
      at = mood === 'talk' ? input.since : input.tick
      isWindow = window !== undefined && input.isWindow === true
      const frame = frameOf(isWindow && window !== undefined ? window : pet, mood, at)
      runs = frame === undefined ? [] : inkRuns(pet, frame)
    },
    runs: () => runs,
  }
  if (window !== undefined) {
    // The band's frame at the same mood and tick, for the band and pet-control while the window shows the big one.
    live.bandRuns = () => {
      if (!isWindow) return runs
      const frame = frameOf(pet, mood, at)
      return frame === undefined ? [] : inkRuns(pet, frame)
    }
  }
  return live
}

/** A baked pet as a lab look, its card saying `blurb`: a pet beside the band's bubble, its first ink the bubble's. */
export function bakedLook(pet: BakedPet, blurb: string): LabLook {
  // Unpacked once, as the look is made: every live one plays the same frames.
  const window = pet.window === undefined ? undefined : unpackWindow(pet.window)
  return {
    id: pet.id,
    name: pet.name,
    persona: pet.persona,
    blurb,
    layout: 'pet',
    width: pet.width,
    height: pet.height,
    ...(window !== undefined ? { window: { width: window.width, height: window.height } } : {}),
    minColumns: 50,
    fallback: pet.fallback,
    bubble: pet.palette[0]?.key ?? 'claude',
    start: () => play(pet, window),
    demo: () => play(pet, window),
    audit: () => checkBaked(pet),
  }
}
