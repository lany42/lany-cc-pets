// What a rig pet's behavior is written on: the parts of a pet's timing that
// every pet shares, with no pet in them. A pet's behavior is code, one
// module a pet beside its definition (hooks/lab/rig-pets/<id>-behavior.ts):
// stepped once a frame with the runtime's cue, it returns the timeline its
// drivers play at that moment (adapter.ts's `Behavior`). It decides only
// when things change, never how they look: what plays is its drivers' clips,
// by id, at the times it picks, with the args it draws. This kit is what
// every behavior shares, written once:
//
//   chance   `roll`, `between`: draws in [0, 1) from a hash of the seed and a
//            count, `hash(seed, count++, 0x51ed)` (never Math.random or the
//            clock), so the same seed and cues give the same timeline in a
//            studio render as on the person's screen
//   resync   `startsOver`: the first frame, a step back in time or a gap over
//            2 s (the drivers' GAP) starts the schedule over, its acts
//            dropped; each frame it also drops the acts that have ended
//   acts     `play` an act (a big one keeps a calm after it), `isBusy`,
//            `isPlaying`, `isQuiet`, and `actsOf`: the acts lane
//   lanes    `hold`: a hold lane's one instance; `lasting`: a blink's
//            instance while it runs
//   lengths  `lengthsOf`: each clip's length, read from the drivers
//            document, so an act lasts exactly as long as its clip
//
// The shared state is one plain object (`Schedule`) a pet's module makes from
// its seed and keeps beside its own (its timers, a strand, the petals held).
// Its acts are kept with their ends, which their instances don't carry; the
// acts lane is their instances, in the order played. Pure: imports the
// shared hash (../motion.ts) and the drivers' gap.
import { hash } from '../motion'
import { GAP } from './drivers'
import type { DriversDoc, Instance, Values } from './schema'

/** The salt of a behavior's chance: the third input of every roll's hash. */
export const SALT = 0x51ed

/** An act on the acts lane: its instance, and when it ends (`at` plus its clip's length). */
export type Act = { readonly instance: Instance; readonly end: number }

/** What every behavior keeps: its seed and the rolls it has drawn, the last frame's time, its acts and its calm. */
export type Schedule = {
  readonly seed: number
  /** Rolls drawn so far: the next is `hash(seed, count, SALT)`. */
  count: number
  /** The last frame's time; undefined before the first. */
  last: number | undefined
  /** Every act played that hasn't ended, in the order played: playing, or still to come. */
  acts: Act[]
  /** Nothing that waits for quiet starts before this: the calm after the last big act. */
  calmUntil: number
}

/** A schedule from `seed` (as an integer), before its first frame. */
export function scheduleOf(seed: number): Schedule {
  return { seed: seed | 0, count: 0, last: undefined, acts: [], calmUntil: 0 }
}

/** The next roll in [0, 1): its chance, from its seed. */
export function roll(schedule: Schedule): number {
  return hash(schedule.seed, schedule.count++, SALT)
}

/** A number drawn evenly from [a, b): one roll. */
export function between(schedule: Schedule, a: number, b: number): number {
  return a + (b - a) * roll(schedule)
}

/**
 * The first call of each frame, at its time `t`: it drops the acts that have
 * ended, and says whether the schedule starts over (its first frame, a step
 * back in time, or a gap over GAP seconds: the pet hidden or asleep). Then
 * all its acts are dropped too, and the pet draws its first times afresh;
 * what it keeps across (a strand, a calm, its last blink) is its own.
 */
export function startsOver(schedule: Schedule, t: number): boolean {
  const dt = schedule.last === undefined ? 0 : t - schedule.last
  const isFresh = schedule.last === undefined || dt < 0 || dt > GAP
  schedule.last = t
  schedule.acts = isFresh ? [] : schedule.acts.filter(act => t < act.end)
  return isFresh
}

/**
 * Plays `clip` at `at` for `length` seconds (its clip's: `lengthsOf`), with
 * `args` (none: the instance has no `args`). A big act, given its `calm`,
 * keeps what waits for quiet from starting until `calm` seconds after it
 * ends.
 */
export function play(schedule: Schedule, clip: string, at: number, length: number, args?: Values, calm?: number): Act {
  const end = at + length
  const act: Act = { instance: args === undefined ? { clip, at } : { clip, at, args }, end }
  schedule.acts.push(act)
  if (calm !== undefined) schedule.calmUntil = Math.max(schedule.calmUntil, end + calm)
  return act
}

/** Whether an act of `clips` (any act, none given) hasn't ended by `t`: playing, or still to come. */
export function isBusy(schedule: Schedule, t: number, clips?: ReadonlySet<string>): boolean {
  return schedule.acts.some(act => t < act.end && (clips === undefined || clips.has(act.instance.clip)))
}

/** Whether an act of `clips` is playing at `t`: begun, and not ended (an act that holds the blinks back). */
export function isPlaying(schedule: Schedule, t: number, clips: ReadonlySet<string>): boolean {
  return schedule.acts.some(act => act.instance.at <= t && t < act.end && clips.has(act.instance.clip))
}

/** Whether it is quiet at `t`: the calm over, and no act of `clips` (those that keep the others waiting) under way or to come. */
export function isQuiet(schedule: Schedule, t: number, clips: ReadonlySet<string>): boolean {
  return t >= schedule.calmUntil && !isBusy(schedule, t, clips)
}

/** The acts lane: every act not ended, its instance, in the order played. */
export function actsOf(schedule: Schedule): Instance[] {
  return schedule.acts.map(act => act.instance)
}

/** A hold lane's timeline: its one instance, `clip` from `at`, with `args` (none: no `args`). */
export function hold(clip: string, at: number, args?: Values): Instance[] {
  return [args === undefined ? { clip, at } : { clip, at, args }]
}

/** `clip` from `at`, while it runs at `t` (the drivers' own test, `t < at + length`), else nothing: a blink's lane, a blink an instance. */
export function lasting(clip: string, at: number, length: number, t: number): Instance[] {
  return t < at + length ? [{ clip, at }] : []
}

/** Each clip's length in `drivers`, by its id; one the document lacks throws, by name. */
export function lengthsOf(drivers: DriversDoc): (clip: string) => number {
  const lengths = new Map(drivers.clips.map(clip => [clip.id, clip.length]))
  return clip => {
    const length = lengths.get(clip)
    if (length === undefined) throw new Error(`no clip "${clip}" in the drivers of rig "${drivers.rig}"`)
    return length
  }
}
