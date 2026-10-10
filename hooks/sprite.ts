// The pet's look, standardized. A Sprite is pure data: its frames, and the
// loop of frames each mood plays. This file draws one and checks one against
// the standard (`checkSprite` below states its rules). Neither this file nor
// sprites/*.ts imports anything at run time but paint.ts, which imports
// nothing, so the dev tools load them under Node.
import { paintFitProblems, paintProblems } from './paint'
import type { Paint } from './paint'

/** What the pet is doing; the band picks one each tick. */
export type Mood = CoreMood | OptionalMood
/** The moods every sprite draws. */
export type CoreMood = 'idle' | 'busy' | 'ponder' | 'talk'
/** The moods a sprite may draw; one it leaves out borrows another's frames (loopOf). */
export type OptionalMood = 'sleep' | 'cheer'

export const MOODS: readonly CoreMood[] = ['idle', 'busy', 'ponder', 'talk']
export const OPTIONAL_MOODS: readonly OptionalMood[] = ['sleep', 'cheer']

/** One animation tick in milliseconds: every step of every loop lasts this long. */
export const TICK_MS = 250

export const MAX_WIDTH = 16
export const MIN_HEIGHT = 2
export const MAX_HEIGHT = 5
/** The longest a loop may run before it repeats: 96 ticks, 24 seconds. */
export const MAX_LOOP_TICKS = 96

/** A frame's name for one tick, or `[name, ticks]` to hold it that long. */
export type Step = string | readonly [frame: string, ticks: number]

export type Sprite = {
  /** Lowercase, hyphenated: what `/pet as <id>` takes. */
  id: string
  /** What `/pet as` lists it as. */
  name: string
  /** A noun phrase the side model is told it is: "a tiny ASCII cat who naps in the warm glow of the screen". */
  persona: string
  /**
   * How it is painted, and its speech bubble with it: a theme key (`claude`,
   * `success`...) or raw color, `{ kind: 'rainbow' }` or `{ kind: 'shiny', color }`,
   * or (opt-in) `{ kind: 'regions', colors, map }`, a few colors held still,
   * cell by cell. Default `claude`.
   */
  color?: Paint
  /** Cells across; every line of every frame is exactly this long. */
  width: number
  /** Rows; every frame is exactly this many lines. */
  height: number
  frames: Readonly<Record<string, readonly string[]>>
  loops: Readonly<Record<CoreMood, readonly Step[]>> & Readonly<Partial<Record<OptionalMood, readonly Step[]>>>
}

const expanded = new WeakMap<readonly Step[], readonly string[]>()

/** A loop as one frame name per tick. */
export function ticksOf(loop: readonly Step[]): readonly string[] {
  let names = expanded.get(loop)
  if (names === undefined) {
    names = loop.flatMap(step =>
      typeof step === 'string' ? [step] : Array.from({ length: step[1] }, () => step[0]),
    )
    expanded.set(loop, names)
  }
  return names
}

const rests = new WeakMap<Sprite, readonly Step[]>()

/**
 * The loop `mood` plays: the sprite's own, or for an optional mood it leaves
 * out, the nearest it has. Asleep, it holds its rest pose (idle's first
 * frame), still; glad, it plays its talk.
 */
export function loopOf(sprite: Sprite, mood: Mood): readonly Step[] {
  const own = sprite.loops[mood]
  if (own !== undefined) return own
  if (mood !== 'sleep') return sprite.loops.talk
  let rest = rests.get(sprite)
  if (rest === undefined) {
    rest = [ticksOf(sprite.loops.idle)[0] ?? '']
    rests.set(sprite, rest)
  }
  return rest
}

/** The lines to draw for `mood` at animation tick `tick`. */
export function frame(sprite: Sprite, mood: Mood, tick: number): readonly string[] {
  const names = ticksOf(loopOf(sprite, mood))
  const name = names[tick % names.length]
  const lines = name !== undefined && Object.hasOwn(sprite.frames, name) ? sprite.frames[name] : undefined
  return lines ?? Object.values(sprite.frames)[0] ?? []
}

const ID = /^[a-z][a-z0-9-]{1,23}$/
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

/** Everything about `sprite` that breaks the standard; empty when it holds. */
export function checkSprite(sprite: Sprite): string[] {
  const problems: string[] = []
  const fail = (why: string) => problems.push(why)

  if (!ID.test(sprite.id)) fail(`id "${sprite.id}" is not lowercase letters, digits and hyphens (2-24)`)
  if (sprite.name.trim() === '' || sprite.name.length > 32) fail('name must be 1-32 characters')
  if (sprite.persona.trim() === '' || sprite.persona.length > 100) fail('persona must be 1-100 characters')
  if (!Number.isInteger(sprite.width) || sprite.width < 1 || sprite.width > MAX_WIDTH) {
    fail(`width ${sprite.width} is outside 1-${MAX_WIDTH}`)
  }
  if (!Number.isInteger(sprite.height) || sprite.height < MIN_HEIGHT || sprite.height > MAX_HEIGHT) {
    fail(`height ${sprite.height} is outside ${MIN_HEIGHT}-${MAX_HEIGHT}`)
  }
  paintProblems(sprite.color).forEach(fail)
  // A regions paint (opt-in) is drawn cell by cell: its map is the sprite's own size.
  paintFitProblems(sprite.color, sprite.width, sprite.height).forEach(fail)

  const names = Object.keys(sprite.frames)
  if (names.length === 0) fail('there are no frames')
  for (const name of names) {
    const lines = sprite.frames[name] ?? []
    if (lines.length !== sprite.height) fail(`frame "${name}" has ${lines.length} lines, not ${sprite.height}`)
    lines.forEach((line, row) => {
      if (line.length !== sprite.width) {
        fail(`frame "${name}" line ${row + 1} is ${line.length} cells, not ${sprite.width}: ${JSON.stringify(line)}`)
      }
      if (!PRINTABLE_ASCII.test(line)) fail(`frame "${name}" line ${row + 1} has a character outside printable ASCII`)
    })
  }

  // An optional mood is held to the same rules once a sprite draws it.
  const drawn = OPTIONAL_MOODS.filter(mood => sprite.loops[mood] !== undefined)
  for (const mood of [...MOODS, ...drawn]) {
    const loop = sprite.loops[mood] as readonly Step[] | undefined
    if (loop === undefined || loop.length === 0) {
      fail(`mood "${mood}" has no loop`)
      continue
    }
    let length = 0
    let isPlayable = true
    for (const step of loop) {
      const [name, ticks] = typeof step === 'string' ? [step, 1] : step
      if (!Object.hasOwn(sprite.frames, name)) {
        fail(`mood "${mood}" plays "${name}", which is not a frame`)
        isPlayable = false
      }
      if (!Number.isInteger(ticks) || ticks < 1) {
        fail(`mood "${mood}" holds "${name}" for ${ticks} ticks`)
        isPlayable = false
      } else {
        length += ticks
      }
    }
    // Sized from the holds before anything is expanded, so a typo'd hold can't stall or throw here.
    if (length > MAX_LOOP_TICKS) fail(`mood "${mood}" runs ${length} ticks, over ${MAX_LOOP_TICKS}`)
    if (!isPlayable || length > MAX_LOOP_TICKS) continue
    const distinct = new Set(ticksOf(loop).map(name => (sprite.frames[name] ?? []).join('\n')))
    // Idle and sleep may hold one pose; every other mood visibly moves.
    if (mood !== 'idle' && mood !== 'sleep' && distinct.size < 2) {
      fail(`mood "${mood}" never changes: it needs 2 or more distinct frames`)
    }
  }

  return problems
}
