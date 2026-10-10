// The pet's look, standardized. A Sprite is pure data: its frames, and the
// loop of frames each mood plays. This file draws one. Neither this file nor
// sprites/*.ts imports anything at run time from outside them (paint.ts
// gives only its types), so the dev tools load them under Node.
import type { Paint } from './paint'

/** What the pet is doing; the band picks one each tick. */
export type Mood = CoreMood | OptionalMood
/** The moods every sprite draws. */
export type CoreMood = 'idle' | 'busy' | 'ponder' | 'talk'
/** The moods a sprite may draw; one it leaves out borrows another's frames (loopOf). */
export type OptionalMood = 'sleep' | 'cheer'

/** One animation tick in milliseconds: every step of every loop lasts this long. */
export const TICK_MS = 250

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
