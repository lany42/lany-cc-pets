// The "experimental!" tier: every lab look, which look the person wears where,
// and how the pet's marks become a look's input each tick. Pure: register.tsx
// keeps the atoms and the live looks, and asks these what to do with them.
import type { RenderSurface } from 'claude-code'

import type { Speech } from '../../types'
import type { SceneSizes } from '../layout'
import type { Mood } from '../sprite'
import type { Sprite } from '../sprite'
import { spriteById, SPRITES } from '../sprites'
import { BAKED_LOOKS } from './baked'
import { BROKEN_LOOKS } from './broken'
import { DRAWN_LOOKS } from './drawn'
import { FIXTURE_LOOKS } from './fixture'
import { GROWN_LOOKS } from './grown'
import { seedOf, seedWord } from './grown/core'
import { PIXEL_LOOKS } from './pixel'
import { RIG_LOOKS } from './rig-pets'
import { SCENE_LOOKS } from './scene'
import type { LabInput, LabLook, LabMood, LabRun, Live, Room } from './look'
import { widthOf } from './look'

/** Every lab look, in the order the gallery lists them after the classic ones. */
export const LAB: readonly LabLook[] = [...BAKED_LOOKS, ...GROWN_LOOKS, ...SCENE_LOOKS, ...DRAWN_LOOKS, ...PIXEL_LOOKS, ...RIG_LOOKS]

/** Lab looks since renamed, by the id a person may still have stored, and the id each one wears now. */
const RENAMED: ReadonlyMap<string, string> = new Map([
  ['momiji-rig', 'momiji'],
  ['sakura-rig', 'sakura'],
])

/** A lab look by id (or by an id it had before it was renamed): one of LAB's, or one of the tests' own (one that breaks on purpose, a fixture), worn only where the store names it. */
export const labById = (id: string): LabLook | undefined => {
  const current = RENAMED.get(id) ?? id
  return LAB.find(look => look.id === current) ?? [...BROKEN_LOOKS, ...FIXTURE_LOOKS].find(look => look.id === id)
}

/** What the person wears, or what a surface draws of it: a lab look, or a classic sprite. */
export type Look = { kind: 'lab'; lab: LabLook } | { kind: 'sprite'; sprite: Sprite }

/** Where a look would be drawn: the surface, and the band body's columns. */
export type Place = { surface: RenderSurface | null; columns: number }

/**
 * The one resolver. A lab id with experimental! on is that lab look. With
 * it off, the pick waits and the person wears `classic`, the last classic
 * look they wore (else the lab look's own fallback), so switching off and on
 * again brings the lab pet back. Given a `place`, a lab look is drawn only
 * where it can be: on the terminal (the Svg phase will bring the desktop),
 * at least its `minColumns` wide; elsewhere its own fallback stands in, so a
 * band at a threshold never flips between it and an unrelated classic look.
 * Whether the band's rows hold it the band fits as it draws (fitScene,
 * fitPet). Without a place, it is the look the pet is (its voice, its name).
 */
export function lookFor(id: string, isExperimental: boolean, place?: Place, classic?: string | null): Look {
  const lab = labById(id)
  if (lab === undefined) return { kind: 'sprite', sprite: spriteById(id) }
  const standIn: Look = { kind: 'sprite', sprite: spriteById(lab.fallback) }
  if (!isExperimental) {
    const kept = SPRITES.find(sprite => sprite.id === classic)
    return kept === undefined ? standIn : { kind: 'sprite', sprite: kept }
  }
  if (place === undefined) return { kind: 'lab', lab }
  if (place.surface !== 'terminal' || place.columns < lab.minColumns) return standIn
  return { kind: 'lab', lab }
}

/** A scene's rows as the band fits it: its height, the fewest its artist composes it in, the fewest it is cropped to. */
export function sceneSizes(look: LabLook): SceneSizes {
  const least = look.least ?? look.height
  return { height: look.height, least, fewest: look.fewest ?? least }
}

/**
 * The rows the clock steps `look` in, given the `rows` the band last had for
 * it: a scene is composed in them, from its least to its height; a pet that
 * draws its own bubble may talk in all of them. Before the band has drawn,
 * the look's own height.
 */
export function roomRows(look: LabLook, rows: number | undefined): number {
  if (rows === undefined) return look.height
  if (look.layout === 'pet') return rows
  const { height, least } = sceneSizes(look)
  return Math.min(height, Math.max(least, rows))
}

/** The most rows the pet window composes a scene in, however tall it is docked: as tall as its artists drew them. */
export const WINDOW_MOST_ROWS = 40

/**
 * The room the pet window gives `look` in its `body`, less a row for its
 * button: a scene all of it, from its own height up to WINDOW_MOST_ROWS, more
 * sky and water rather than stretched; a pet every row, to talk in.
 */
export function windowRoom(look: LabLook, body: Room): Room {
  const rows = Math.max(look.height, body.rows - 1)
  return { columns: body.columns, rows: look.layout === 'scene' ? Math.min(WINDOW_MOST_ROWS, rows) : rows }
}

/** A braille cell with no dot, or a space: what an empty row of a look is made of. */
const BLANK = /^[\s\u2800]*$/

/** How many of a drawing's top rows are empty: never all of them, so a look keeps a row. */
export function blankTop(rows: readonly (readonly LabRun[])[]): number {
  const at = rows.findIndex(row => !BLANK.test(row.map(run => run.text).join('')))
  return at === -1 ? Math.max(0, rows.length - 1) : at
}

/** The look's id, name and persona, whichever kind it is. */
export const aboutOf = (look: Look): { id: string; name: string; persona: string } => (look.kind === 'lab' ? look.lab : look.sprite)

/** The band's mood as a lab look takes it: asleep it rests as idle, glad it talks, as a sprite without those loops does. */
export function labMoodOf(mood: Mood): LabMood {
  if (mood === 'sleep') return 'idle'
  return mood === 'cheer' ? 'talk' : mood
}

// Seeds: a grown look is born from a word the person keeps, and remembers
// under that word, so a new seed never loses the old pet.

/** The store key holding the word the person's `id` grows from. */
export const seedKey = (id: string): string => `genSeed:${id}`
/** The store key holding what the `id` born from `word` remembers. */
export const memoryKey = (id: string, word: string): string => `gen:${id}:${word}`

const SEED_WORD = /^[a-z0-9][a-z0-9-]{0,23}$/

/** Why `word` can't be a seed, if it can't: one word of letters, digits and hyphens. */
export function seedProblem(word: string): string | undefined {
  return SEED_WORD.test(word) ? undefined : 'A seed is one word: letters, digits or hyphens, 24 at most.'
}

/** A new pronounceable seed word ("moki", "korimu") from a roll in [0, 1). */
export const newSeedWord = (roll: number): string => seedWord(Math.floor(roll * 2 ** 32) >>> 0)

export { seedOf }

// The clock: what a live look last saw, so the pet's marks (the turn, the
// speech) become one-tick events in its input.

/** A turn at least this long earns a scene its spectacle when it ends... */
export const SPECTACLE_TURN_MS = 90_000
/** ...at most once in this long. */
export const SPECTACLE_GAP_MS = 15 * 60_000

/** Whether a turn of `durationMs` finishing at `now` earns a spectacle, the last one played at `lastAt` (0: never). */
export const earnsSpectacle = (durationMs: number, now: number, lastAt: number): boolean =>
  durationMs >= SPECTACLE_TURN_MS && (lastAt === 0 || now - lastAt >= SPECTACLE_GAP_MS)

export type Seen = {
  mood?: LabMood
  /** The tick `mood` began. */
  moodAt: number
  /** The line it last saw; undefined until its first tick. */
  spokeAt?: number | null
}

export const UNSEEN: Seen = { moodAt: 0 }

/**
 * The marks the clock reads each tick, as they stand, and the news the turn's
 * end brought since the look's last step: how many finished, and whether one
 * earned a spectacle (counted as they finish, so none is lost to a nap).
 */
export type Marks = { tick: number; mood: LabMood; said: Speech | null; now: number; room: Room; isLight: boolean; turnsEnded: number; spectacle: boolean; isWindow?: boolean }

/**
 * A look's input this tick, and what it has now seen. A line landed since
 * its last tick is news once; its first tick only looks, so a load never
 * replays the last line.
 */
export function inputOf(seen: Seen, marks: Marks): { input: LabInput; seen: Seen } {
  const { tick, mood, said, now } = marks
  const moodAt = seen.mood === mood ? seen.moodAt : tick
  const spokeAt = said?.tick ?? null
  const spoke = seen.spokeAt !== undefined && spokeAt !== null && spokeAt !== seen.spokeAt
  const isShown = said !== null && tick - said.tick < said.ttl
  return {
    input: {
      tick,
      mood,
      since: tick - moodAt,
      turnsEnded: marks.turnsEnded,
      spoke,
      spectacle: marks.spectacle,
      ...(isShown ? { line: { text: said.text, age: tick - said.tick } } : {}),
      now,
      room: marks.room,
      isLight: marks.isLight,
      ...(marks.isWindow === true ? { isWindow: true } : {}),
    },
    seen: { mood, moodAt, spokeAt },
  }
}

/** A gallery card's lab look, alive, and the tick it was born on. */
export type Card = { live: Live; bornAt: number }

/**
 * Steps `look`'s gallery card in `cards` with `input`, born at tick `t` on its
 * first. One that throws, being born or stepping, is let go, to be born again
 * next tick: the gallery and the clock go on.
 */
export function stepCard(cards: Map<string, Card>, look: LabLook, t: number, input: LabInput): void {
  try {
    const card = cards.get(look.id) ?? { live: look.demo(), bornAt: t }
    cards.set(look.id, card)
    card.live.step(input)
  } catch {
    cards.delete(look.id)
  }
}

/** A gallery card's input: idle, as the classic cards play, in a room of its own. */
export function cardInput(tick: number, since: number, look: LabLook, now: number, isLight: boolean): LabInput {
  return { tick, mood: 'idle', since, turnsEnded: 0, spoke: false, spectacle: false, now, room: cardRoom(look), isLight }
}

/** The room a gallery card gives a look: a scene its thumbnail, a pet a roomy band. */
export function cardRoom(look: LabLook): Room {
  return look.layout === 'scene' ? { columns: look.width, rows: look.height } : { columns: 80, rows: look.height }
}

/** A gallery card's width, border and padding in: pets one size, scenes their thumbnail's. */
export const cardWidth = (look: LabLook): number => Math.max(24, look.width) + 4

/** The theme row's value names a light theme ("light", "light-daltonized"...). */
export const isLightTheme = (value: unknown): boolean => typeof value === 'string' && value.includes('light')

/** The rightmost `columns` cells of each row: a wide look's preview where only a pet's room is. */
export function cropRight(rows: readonly (readonly LabRun[])[], columns: number): (readonly LabRun[])[] {
  return rows.map(row => {
    let skip = widthOf(row) - columns
    if (skip <= 0) return row
    const kept: LabRun[] = []
    for (const run of row) {
      const chars = [...run.text]
      if (skip >= chars.length) {
        skip -= chars.length
        continue
      }
      kept.push({ ...run, text: chars.slice(skip).join('') })
      skip = 0
    }
    return kept
  })
}
