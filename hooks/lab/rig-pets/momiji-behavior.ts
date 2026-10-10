// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Momiji's behavior: when her moods, acts, blinks, glances and strand
// change, as code on the rig kit (rig/behavior.ts). Each frame it is handed
// the runtime's cue and writes the timeline her drivers play: it decides
// when, the clips decide how. Her acts last as long as their clips.
//
// What she does, by mood (the clips do the rest):
//   idle    a face every 22-55 s (a smirk, a soft smile or a beam), the
//           first 9-18 s in; her stray strand slips a step every 11-26 s,
//           6-14 s once it is low, until it hangs over her eye, then a toss
//           sweeps it back (the first in 10-22 s); left alone 75 s, a yawn,
//           at most one in 300 s. A glance every 2.5-7 s (the first in 3-8
//           s): at you (55%), aside to either side, or down at the prompt.
//   busy    reading: a glance along the prompt every 0.9-2.6 s, a nod every
//           7-15 s (the first in 4-9 s), the strand still slipping.
//   ponder, talk   their mood's clip; talk's mouth is its `talking` clip.
// Her faces, toss and yawn are big: 6 s of calm after each, and nothing
// that waits for quiet (a face, the strand, a yawn, a nod) starts while a
// face, a toss, a yawn or a wink is under way. A blink every 2.5-6 s (2-4.5
// busy; the first in 0.8-2.5 s), 15% of them doubled, none of her own while
// a beam, toss, yawn or wink plays nor 0.6 s after.
// News: a spectacle winks, at once; a finished turn earns a smile 0.4 s
// later unless a face is under way. Her first frame, a step back or a gap
// over 2 s starts it all over: no acts, every first time drawn afresh; her
// strand, calm, glance and last blink are kept.
//
// It writes, every frame:
//   strand, glance, mood, talk, breath   hold lanes, each one instance from
//                                        the frame's own time: where the
//                                        strand rests, the glance, the
//                                        mood's clip, `talking` or `quiet`,
//                                        the mood's breath
//   acts     every act not ended, in the order played, each its clip with
//            `roll` and `from` (where the strand was), a slip's `to`, a
//            toss's `pleased` (its roll under 0.5)
//   blinks   her last blink and its double while they run
//
// Pure: imports the kit, the adapter's `Behavior` and `rigPetById`, and the
// shared cue type.
import type { Cue } from '../rig/kit/pet'
import type { Behavior } from '../rig/adapter'
import { rigPetById } from '../rig/adapter'
import { actsOf, between, hold, isBusy, isPlaying, isQuiet, lasting, lengthsOf, play, roll, scheduleOf, startsOver } from '../rig/behavior'
import type { DriversDoc, Timeline } from '../rig/schema'

/** Her bigger moments (`BIG`), and the calm (`CALM`, seconds) each leaves before the next. */
const BIG: ReadonlySet<string> = new Set(['smile', 'beam', 'smirk', 'toss', 'yawn'])
const CALM = 6
/** Acts that close her eyes or move her head: no blink of her own meanwhile, nor `HOLD_OFF` after (`HOLDS_BLINK`). */
const HOLDS_BLINK: ReadonlySet<string> = new Set(['beam', 'toss', 'yawn', 'wink'])
const HOLD_OFF = 0.6
/** The faces a finished turn's smile waits out. */
const FACES: ReadonlySet<string> = new Set(['smile', 'beam', 'smirk', 'wink'])
/** What keeps a face, the strand, a yawn and a nod waiting: a face, a toss, a yawn or a wink under way or to come. */
const STIRS: ReadonlySet<string> = new Set(['smile', 'beam', 'smirk', 'toss', 'yawn', 'wink'])
const SLIP: ReadonlySet<string> = new Set(['slip'])
/** Seconds alone before a yawn, and at least this long between two. */
const YAWN_AFTER = 75
const YAWN_EVERY = 300

/** Where a slip leaves the strand: a fifth to a third further down, never below 0. */
const slipTo = (from: number, roll: number): number => Math.max(0, from - (0.2 + roll * 0.18))

/** Her behavior from `seed`, timing her acts by `drivers`' clips (hers in RIG_PETS unless given). */
export function momijiBehavior(seed: number, drivers: DriversDoc = rigPetById('momiji').drivers): Behavior {
  const lengthOf = lengthsOf(drivers)
  const blink = lengthOf('blink')
  const schedule = scheduleOf(seed)
  let nextBlink = 0
  let blinkAt = -10
  let doubleAt = -10
  let glance = { x: 0, y: 0 }
  let nextGlance = 0
  let nextFace = 0
  let nextHair = 0
  let nextNod = 0
  /** Where the stray strand rests between acts: 1 swept aside, 0 over her eye. */
  let strand = 1
  let lastYawn = -1e9
  let idleFrom = 0

  /** Plays `clip` at `at`: its roll drawn, with where the strand was; a slip or a toss moves where it rests after. */
  const act = (clip: string, at: number): void => {
    const r = roll(schedule)
    const args: Record<string, number> = { roll: r, from: strand }
    if (clip === 'slip') strand = args.to = slipTo(strand, r)
    if (clip === 'toss') {
      args.pleased = r < 0.5 ? 1 : 0
      strand = 1
    }
    play(schedule, clip, at, lengthOf(clip), args, BIG.has(clip) ? CALM : undefined)
  }

  return {
    step(cue: Cue) {
      const t = cue.t
      const mood = cue.mood
      if (startsOver(schedule, t)) {
        nextBlink = t + between(schedule, 0.8, 2.5)
        nextGlance = t + between(schedule, 3, 8)
        nextFace = t + between(schedule, 9, 18)
        nextHair = t + between(schedule, 10, 22)
        nextNod = t + between(schedule, 4, 9)
        idleFrom = t
      }
      if (mood !== 'idle') idleFrom = t

      // ---- the news, on the frame it comes
      if (cue.spectacle) act('wink', t)
      if (cue.turnsEnded > 0 && !isBusy(schedule, t, FACES)) act('smile', t + 0.4)

      // ---- each track in turn, quiet judged once
      const isCalm = isQuiet(schedule, t, STIRS)
      if (t >= nextFace) {
        if (mood === 'idle' && isCalm) act(roll(schedule) < 0.5 ? 'smirk' : roll(schedule) < 0.55 ? 'smile' : 'beam', t)
        nextFace = t + (mood === 'idle' ? between(schedule, 22, 55) : between(schedule, 40, 80))
      }
      if (t >= nextHair) {
        // Hanging over her eye, it is tossed away; else it slips a little further.
        if ((mood === 'idle' || mood === 'busy') && isCalm && !isBusy(schedule, t, SLIP)) act(strand <= 0.08 ? 'toss' : 'slip', t)
        nextHair = t + (strand <= 0.3 ? between(schedule, 6, 14) : between(schedule, 11, 26))
      }
      if (mood === 'idle' && t - idleFrom > YAWN_AFTER && t - lastYawn > YAWN_EVERY && isCalm) {
        act('yawn', t)
        lastYawn = t
      }
      if (mood === 'busy' && t >= nextNod) {
        if (isCalm) act('nod', t)
        nextNod = t + between(schedule, 7, 15)
      }
      if (t >= nextGlance) {
        // Idle: mostly at you, now and then aside or down; busy: reading along the prompt.
        if (mood === 'busy') glance = { x: between(schedule, -0.85, -0.25), y: between(schedule, 0.35, 0.6) }
        else {
          const pick = roll(schedule)
          glance =
            pick < 0.55
              ? { x: 0, y: 0 }
              : pick < 0.75
                ? { x: between(schedule, 0.45, 0.8), y: between(schedule, -0.2, 0.2) }
                : pick < 0.9
                  ? { x: between(schedule, -0.8, -0.45), y: between(schedule, 0, 0.3) }
                  : { x: -0.5, y: 0.55 }
        }
        nextGlance = t + (mood === 'busy' ? between(schedule, 0.9, 2.6) : between(schedule, 2.5, 7))
      }

      // ---- blinks: sometimes twice
      if (isPlaying(schedule, t, HOLDS_BLINK)) nextBlink = Math.max(nextBlink, t + HOLD_OFF)
      if (t >= nextBlink) {
        blinkAt = t
        doubleAt = roll(schedule) < 0.15 ? t + 0.3 + between(schedule, 0.15, 0.22) : -10
        nextBlink = t + (mood === 'busy' ? between(schedule, 2, 4.5) : between(schedule, 2.5, 6))
      }

      const timeline: Timeline = {
        strand: hold('strand', t, { rest: strand }),
        glance: hold('glance', t, { x: glance.x, y: glance.y }),
        mood: hold(mood, t),
        talk: hold(mood === 'talk' ? 'talking' : 'quiet', t),
        breath: hold(mood === 'busy' ? 'breathBusy' : 'breathIdle', t),
        acts: actsOf(schedule),
        blinks: [...lasting('blink', blinkAt, blink, t), ...lasting('blink', doubleAt, blink, t)],
      }
      return { timeline }
    },
  }
}
