// The band's rules, pure: its sizes, what the pet is doing at a tick, the
// words it shows, the rooms the band and the pet window give a look (and
// whether a pet draws its window picture there, its bubble beside or above
// it), the resting step a look is put on with, and where its band self comes
// from while the window shows the big picture. register.tsx draws with
// these, and the dev tools and the studio drive looks with them, so a
// preview and the band never disagree. Imports nothing at run
// time but pure modules, so Node loads it as well as the engine does.
import type { EmoteMark, Speech } from '../types'

import { bodyAt } from './body'
import { ANSWER_CHARS } from './comment'
import { labMoodOf, roomRows, sceneSizes, windowRoom } from './lab'
import type { LabInput, LabLook, LabMood, Live, Room } from './lab/look'
import { bubbleFor, fitScene, wrapRows } from './layout'
import type { Bubble, SceneFit } from './layout'
import { TICK_MS } from './sprite'
import type { Mood } from './sprite'

/** Ticks the pet keeps talking after a new line arrives: three seconds. */
export const TALK_TICKS = Math.round(3000 / TICK_MS)
/** The widest the band's bubble grows. */
export const BUBBLE_MAX = 56
/** The band's button to pet-control: short, so its corner costs the look little. */
export const BAND_BUTTON = 'pet-ctrl'
/**
 * The band's right-hand gutter: the button and the gap before it. The button
 * sits in it on the band's bottom row, flush with the band's bottom-right
 * corner, whatever look is worn and however it grows: it never moves and
 * never takes a row.
 */
export const GUTTER_COLUMNS = BAND_BUTTON.length + 1
/**
 * Columns the engine keeps at the band's right end for its own `[-]` mark,
 * on the band's top row: the band's bodyColumns are the terminal's less
 * these. The mod is handed bodyColumns and never uses this; it is here so
 * the dev tools mock the band as the engine lays it out.
 */
export const ENGINE_MARK_COLUMNS = 5

/** How the pet stands at a tick: its mood, the tick that mood's loop is at, and the emote by its head. */
export type Pose = { mood: Mood; at: number; glyph?: string }

/**
 * What the pet is doing at `t`: thinking of a line, saying one, glad (a win, a
 * pat), watching Claude work, asleep while the person is away, or nothing
 * much. Words come first; the body shows when there are none. Talk starts its
 * loop as its line lands and cheer as its emote does, so each tells its little
 * story from the top.
 */
export function poseOf(isThinking: boolean, said: Speech | null, t: number, isWorking: boolean, shown: EmoteMark | null, isAsleep: boolean): Pose {
  const { glyph, isGlad } = bodyAt(shown, isAsleep, t)
  if (isThinking) return { mood: 'ponder', at: t, glyph }
  if (said !== null && t - said.tick < TALK_TICKS) return { mood: 'talk', at: t - said.tick, glyph }
  if (isGlad && shown !== null) return { mood: 'cheer', at: t - shown.tick, glyph }
  if (isWorking) return { mood: 'busy', at: t, glyph }
  return { mood: isAsleep ? 'sleep' : 'idle', at: t, glyph }
}

/** The mood the clock tells a lab look: the band's, the open turn standing in for its isWorking, with no emote or sleep. */
export const labMoodAt = (isThinking: boolean, said: Speech | null, t: number, isWorking: boolean): LabMood => labMoodOf(poseOf(isThinking, said, t, isWorking, null, false).mood)

/** Whether `said` is still up at `t`: a line fades once its time is up. */
export const isShownAt = (said: Speech | null, t: number): said is Speech => said !== null && t - said.tick < said.ttl

/** The words the pet shows at `t`: its "..." while it thinks of a line, the line while it is up, else none. */
export const wordsAt = (isThinking: boolean, said: Speech | null, t: number): string | undefined => (isThinking ? '...' : isShownAt(said, t) ? said.text : undefined)

/** The columns the look and its words get in a band `bodyColumns` wide: the band less the button's gutter. */
export const bandColumnsOf = (bodyColumns: number): number => bodyColumns - GUTTER_COLUMNS

/**
 * A scene in a band of `columns` and `rows`, with `words` it couldn't draw
 * itself: the band's bubble above it (never taking the scene's fewest rows;
 * with no room for one the line goes unshown), the rows left for the scene,
 * and how it fits them (undefined: too few, the band wears its fallback).
 */
export function sceneInBand(look: LabLook, words: string | undefined, columns: number, rows: number): { bubble: Bubble | undefined; rows: number; fit: SceneFit | undefined } {
  const sizes = sceneSizes(look)
  const bubble = words === undefined ? undefined : bubbleFor(words, columns, 0, 0, BUBBLE_MAX, rows - sizes.fewest)
  const room = rows - (bubble?.rows ?? 0)
  return { bubble, rows: room, fit: fitScene(sizes, room) }
}

/** Whether a lab pet drawing `artRows` rows stands in a band of `rows`: one that grows round its words needs only its rest. */
export const petFits = (look: LabLook, artRows: number, rows: number): boolean => (look.most !== undefined ? look.height : artRows) <= rows

/**
 * The room the clock steps a worn look in: the pet window's while it is open
 * and has drawn, else the band's columns and the rows it last had for the
 * look (a scene composed in them, from its least to its height).
 */
export function stepRoom(look: LabLook, band: { columns: number; rows: number | undefined }, window: Room | undefined): Room {
  return window !== undefined ? windowRoom(look, window) : { columns: band.columns, rows: roomRows(look, band.rows) }
}

/** A bubble above a look in the pet window: as wide as its words and their border, up to the band's widest and the window's columns. */
export const aboveWidth = (text: string, columns: number): number => Math.min([...text].length + 4, BUBBLE_MAX, columns)

/** Where the pet window puts a bubble by a pet: beside it, or above it, and its box. */
export type WindowBubble = { place: 'beside' | 'above'; width: number; rows: number }

/**
 * The bubble for `text` by a pet `art` big in the pet window's `room`: beside
 * it, or above it as wide as its words up to the band's widest, whichever
 * fits the room's rows in fewer (a big picture leaves a bubble beside it few
 * columns), beside on a tie; beside when neither fits, as a small pet in a
 * short window has it.
 */
export function windowBubbleFor(text: string, room: Room, art: { width: number; height: number }): WindowBubble {
  const beside = bubbleFor(text, room.columns, art.width, art.height, BUBBLE_MAX)
  const width = aboveWidth(text, room.columns)
  const above: WindowBubble = { place: 'above', width, rows: wrapRows(text, width - 4) + 2 }
  const besideRows = beside === undefined ? Number.POSITIVE_INFINITY : Math.max(beside.rows, art.height)
  const aboveRows = art.height + above.rows
  if (beside !== undefined && (aboveRows > room.rows || (besideRows <= room.rows && besideRows <= aboveRows))) return { place: 'beside', width: beside.width, rows: beside.rows }
  return above
}

/** As long a line as the pet says (ANSWER_CHARS), in words of five: what a window picture keeps room for. */
const LONGEST_LINE = 'words '.repeat(ANSWER_CHARS / 6).trimEnd()

/**
 * Whether `look` draws its window picture in the pet window's `room` (never
 * the band's): it has one, and the room holds it whole with the bubble of
 * the longest line beside it or above it, so neither is ever cut. Else it
 * draws its band self there.
 */
export function showsWindow(look: LabLook, room: Room): boolean {
  const box = look.window
  if (box === undefined || box.width > room.columns || box.height > room.rows) return false
  const bubble = windowBubbleFor(LONGEST_LINE, room, box)
  return (bubble.place === 'beside' ? Math.max(bubble.rows, box.height) : box.height + bubble.rows) <= room.rows
}

/** The step a look is put on with: at rest, with no line and no "...", so it always has a resting frame to show. */
export const birthInput = (input: LabInput): LabInput => ({ ...input, line: undefined, mood: input.mood === 'ponder' ? 'idle' : input.mood })

/**
 * Whether `live`, a live `look` stepped in the pet window's room, draws there
 * anything but its band self, so that pet-control's preview needs a second of
 * it stepped in the band's room: a scene (a rig look among them) is composed
 * in whatever room it is given, its window's picture in the window's (a
 * rig look painted tall). A pet is its band self in every room: its
 * `bandRuns` beside a window picture, else all it draws.
 */
export const drawsWindowOnly = (look: LabLook, live: Live): boolean => look.layout === 'scene' && live.bandRuns === undefined

/** The input of a look's band self while the worn one steps in the pet window: the same tick and news, in the band's `room`, never its window picture. */
export function bandInput(input: LabInput, room: Room): LabInput {
  const { isWindow: _picture, ...rest } = input
  return { ...rest, room }
}
