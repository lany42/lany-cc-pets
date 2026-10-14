// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Dracaena's behavior: when her moods, acts, blinks and glances change, and
// how warm she is, as code on the rig kit (rig/behavior.ts). Each frame it is
// handed the runtime's cue and writes the timeline her drivers play: it
// decides when, the clips (and her pendulums and sparks) decide how. Her acts
// last as long as their clips.
//
// What she does, by mood (the clips do the rest):
//   idle    an act from her idle pool after each rest (the first 6-14 s in,
//           then 18-38 s after the last ends): a weighted draw over fourteen
//           acts, leaving out the last three she played, so none follows
//           itself and no two alternate; her hand acts weigh half her face
//           acts, and warmth makes her appraise more and glare less. Every
//           55-110 s (shortened by up to two fifths as she warms; the first
//           25-50 s in) she steals a sidelong peek at the person. Left alone
//           200 s, she yawns; the next yawn waits 400-600 s more alone. A
//           glance every 3.5-10 s: at the person (35%), aside (30%), down at
//           her own sleeve (20%), or far off up to her left (15%). Glances
//           move her eyes only: her head turns in her acts, so her hair
//           swings for them alone.
//   busy    one spot below and to her left, a glance there every 1.5-4.5 s;
//           an act every 9-20 s (the first 4-9 s in): her eyes along a line
//           (55%), an impatient huff (25%) or a quick check on the person.
//   ponder  eyes up and aside; a fingertip to her lip as it begins.
//   talk    eyes on the person; talk's syllables are its clip.
// Her idle acts, the peek, the yawn, her verdict, the hmph, the fluster and
// her spectacles are big: 7.5 s of calm after each, in which nothing that
// waits for quiet (an idle or busy act, the peek, the yawn) starts; quiet is
// judged afresh before each, so no two of those start on one frame.
// A blink every 3.4-7.2 s (2.6-5.6 busy, 2.2-4.8 talking; the first in
// 1-3 s), one in seven doubled 0.45 s later; none of her own while an act
// holds her eyes shut, nor 0.8 s after.
// Warmth, 0 to 1, starts cool: each finished turn warms her by 0.12, and in
// idle she cools by 0.1 every 120 s. It shows as a faint blush (its hold
// lane), and the peek and the verdict take it as an arg.
// News: a spectacle plays at once: the first a sparkle, then any of the
// three except the last one played. A finished turn warms her, then plays
// her verdict 0.35 s later unless an act is under way; but if it lands while
// she peeks, while the yawn's real smile shows, or takes her to full warmth,
// she is caught: startled at once (flustered, at full warmth, which drops
// her back to cool), then hmph 0.8 s later. Her own line landing while she
// peeks or smiles catches her too.
// Her first frame, a step back or a gap over 2 s starts it all over: no
// acts, every first time drawn afresh; her warmth, her last idle acts, her
// last spectacle, her glance and her calm are kept.
//
// It writes, every frame:
//   mood    her mood's clip, from when the cue says it began
//   warmth  her warmth, in twentieths, from now
//   glance  where her eyes rest, from when they went there (never later
//           than now)
//   talk    her syllables while she talks, from when she began; else none
//   breath  her breath at the mood's pace, from the mood's start
//   acts    every act not ended, in the order played (the peek and the
//           verdict with her warmth; her wand acts with a roll for their
//           sparks)
//   blinks  her blinks while they run
//
// Pure: imports the kit, the adapter's `Behavior` and `rigPetById`, and the
// shared cue type.
import type { Behavior } from '../rig/adapter'
import { rigPetById } from '../rig/adapter'
import { actsOf, between, hold, isBusy, isPlaying, isQuiet, lengthsOf, play, roll, scheduleOf, startsOver } from '../rig/behavior'
import type { Cue } from '../rig/kit/pet'
import type { DriversDoc, Instance, Timeline, Values } from '../rig/schema'

/** Her big acts, and the calm (seconds) after each before anything that waits for quiet. */
const BIG = new Set(['smirk', 'roll', 'scoff', 'sniff', 'appraise', 'sigh', 'blow', 'nails', 'tuck', 'knot', 'twirl', 'stifle', 'flick', 'glare', 'peek', 'yawn', 'verdict', 'hmph', 'fluster', 'sparkle', 'flip', 'ohoho'])
const CALM = 7.5
/** Her idle pool and each act's weight; her hand acts weigh half. */
const POOL: readonly (readonly [act: string, weight: number])[] = [
  ['smirk', 2],
  ['roll', 2],
  ['scoff', 2],
  ['sniff', 2],
  ['appraise', 2],
  ['sigh', 2],
  ['blow', 2],
  ['glare', 2],
  ['nails', 1],
  ['tuck', 1],
  ['knot', 1],
  ['twirl', 1],
  ['stifle', 1],
  ['flick', 1],
]
/** How many of her last idle acts the next draw leaves out. */
const MEMORY = 3
/** Acts that hold her eyes shut (or squeezed, or arched in a laugh): no blink of her own meanwhile, nor `HOLD_OFF` after. */
const HOLDS_BLINK = new Set(['sniff', 'sigh', 'huff', 'stifle', 'hmph', 'fluster', 'yawn', 'ohoho', 'sparkle', 'verdict'])
const HOLD_OFF = 0.8
/** Acts that raise her arm: a fingertip to her lip waits for none of them to be under way. */
const HAND = new Set(['nails', 'tuck', 'knot', 'twirl', 'stifle', 'flick', 'muse', 'yawn', 'sparkle', 'flip', 'ohoho'])
/** Left alone this long, seconds, she yawns (`QUIET_AFTER`). */
const QUIET_AFTER = 200
/** The yawn's real smile, seconds into it (its clip's): news then catches her. */
const SOFT_FROM = 3.6
const SOFT_TO = 6.0
/** A finished turn's verdict, this long after (seconds). */
const VERDICT_AFTER = 0.35
/** Caught: the hmph this long after the startle (the startle's peak, its clip). */
const HMPH_AFTER = 0.8
/** Warmth: a step a turn, cooling a step every `COOL_EVERY` seconds in idle; full at `FULL`. */
const WARM_STEP = 0.12
const COOL_STEP = 0.1
const COOL_EVERY = 120
const FULL = 0.95
/** A second blink this long after the first, one in `DOUBLE` of them. */
const DOUBLE_AFTER = 0.45
const DOUBLE = 7
/** Her spectacles: the first always the wand, then the others, never the same twice running. */
const SPECTACLES = ['sparkle', 'flip', 'ohoho'] as const
/** The places her eyes rest, by mood: x and y of her gaze (the clip's turn and chin, held at 0: her head stays). */
type Glance = { readonly x: number; readonly y: number; readonly turn: number; readonly chin: number }
const AHEAD: Glance = { x: 0, y: 0, turn: 0, chin: 0 }
const PEEK = new Set(['peek'])

/** Her behavior from `seed`, timing her acts by `drivers`' clips (hers in RIG_PETS unless given). */
export function dracaenaBehavior(seed: number, drivers: DriversDoc = rigPetById('dracaena').drivers): Behavior {
  const lengthOf = lengthsOf(drivers)
  const blink = lengthOf('blink')
  const schedule = scheduleOf(seed)
  const waits = new Set([...POOL.map(([act]) => act), 'peek', 'yawn', 'scan', 'huff', 'check'])
  let warmth = 0
  let coolFrom = 0
  let recent: string[] = []
  let lastSpectacle: string | undefined
  let nextIdle = 0
  let nextPeek = 0
  let nextBusy = 0
  let nextGlance = 0
  let nextBlink = 0
  let blinkAt = -10
  let doubleAt = -10
  let glance = AHEAD
  let glanceAt = 0
  let idleFrom = 0
  let mood: string | undefined
  /** When her last yawn began. */
  let yawnAt = -100
  /** A pending hmph after a startle, when it plays. */
  let hmphAt: number | undefined

  const act = (clip: string, at: number, args?: Values): void => void play(schedule, clip, at, lengthOf(clip), args, BIG.has(clip) ? CALM : undefined)
  const warm = (): Values => ({ warmth: Math.round(warmth * 20) / 20 })

  /** The next idle act: a weighted draw, the last few left out. */
  const draw = (): string => {
    const left = POOL.filter(([one]) => !recent.includes(one))
    const weightOf = ([one, w]: readonly [string, number]): number => (one === 'appraise' ? w * (1 + warmth) : one === 'glare' ? w * (1 - 0.6 * warmth) : w)
    const total = left.reduce((sum, one) => sum + weightOf(one), 0)
    let pick = roll(schedule) * total
    for (const one of left) {
      pick -= weightOf(one)
      if (pick < 0) return one[0]
    }
    return left[left.length - 1]![0]
  }

  /** Caught: startled (flustered at full warmth, which cools her), then hmph. */
  const caught = (t: number, full: boolean): void => {
    act(full ? 'fluster' : 'startle', t)
    hmphAt = t + (full ? lengthOf('fluster') - 0.3 : HMPH_AFTER)
    if (full) warmth = 0
  }

  return {
    step(cue: Cue) {
      const t = cue.t
      if (startsOver(schedule, t)) {
        hmphAt = undefined
        nextIdle = t + between(schedule, 6, 14)
        nextPeek = t + between(schedule, 25, 50)
        nextBusy = t + between(schedule, 4, 9)
        nextGlance = t + between(schedule, 1, 3)
        nextBlink = t + between(schedule, 1, 3)
        idleFrom = t
        coolFrom = t
        yawnAt = -100
      }
      const moodNow = cue.mood
      if (moodNow !== 'idle') {
        idleFrom = t
        coolFrom = t
      }
      const moodAt = t - Math.max(0, cue.since)

      // ---- the news, on the frame it comes
      if (cue.spectacle) {
        const pick = lastSpectacle === undefined ? 'sparkle' : (() => {
          const others = SPECTACLES.filter(one => one !== lastSpectacle)
          return others[Math.floor(roll(schedule) * others.length)] ?? others[0]!
        })()
        lastSpectacle = pick
        act(pick, t, pick === 'sparkle' ? { roll: roll(schedule) } : undefined)
      }
      const peeking = isPlaying(schedule, t, PEEK)
      const softening = t - yawnAt >= SOFT_FROM && t - yawnAt < SOFT_TO
      if (cue.turnsEnded > 0) {
        warmth = Math.min(1, warmth + WARM_STEP * cue.turnsEnded)
        if (peeking || softening || warmth >= FULL) caught(t, warmth >= FULL)
        else if (!isBusy(schedule, t)) act('verdict', t + VERDICT_AFTER, { ...warm(), cool: warmth < 0.3 ? 1 : 0 })
      } else if (cue.spoke && (peeking || softening)) caught(t, false)
      if (hmphAt !== undefined && t >= hmphAt) {
        act('hmph', t)
        hmphAt = undefined
      }

      // ---- warmth cools in idle
      if (moodNow === 'idle' && t - coolFrom >= COOL_EVERY) {
        warmth = Math.max(0, warmth - COOL_STEP)
        coolFrom = t
      }

      // ---- each track in turn, quiet judged afresh before each, so no two start together
      const quiet = (): boolean => isQuiet(schedule, t, waits)
      if (moodNow === 'idle' && t - idleFrom > QUIET_AFTER && quiet()) {
        act('yawn', t)
        yawnAt = t
        // Her next yawn waits longer: 400 to 600 s more alone.
        idleFrom = t + between(schedule, 200, 400)
      }
      if (t >= nextIdle) {
        if (moodNow === 'idle' && quiet()) {
          const one = draw()
          act(one, t, one === 'twirl' ? { roll: roll(schedule) } : undefined)
          recent = [one, ...recent].slice(0, MEMORY)
          nextIdle = t + lengthOf(one) + between(schedule, 18, 38)
        } else nextIdle = t + between(schedule, 3, 6)
      }
      if (t >= nextPeek) {
        if (moodNow === 'idle' && quiet()) {
          act('peek', t, warm())
        }
        nextPeek = t + between(schedule, 55, 110) * (1 - 0.4 * warmth)
      }
      if (moodNow === 'busy' && t >= nextBusy) {
        if (quiet()) {
          const pick = roll(schedule)
          act(pick < 0.55 ? 'scan' : pick < 0.8 ? 'huff' : 'check', t, pick >= 0.8 ? warm() : undefined)
        }
        nextBusy = t + between(schedule, 9, 20)
      }
      if (moodNow !== mood) {
        if (moodNow === 'ponder' && !isBusy(schedule, t, HAND)) act('muse', t)
        mood = moodNow
        nextGlance = t
      }
      if (t >= nextGlance) {
        if (moodNow === 'busy') glance = { x: between(schedule, -0.45, -0.3), y: between(schedule, 0.5, 0.65), turn: 0, chin: 0 }
        else if (moodNow === 'ponder') glance = { x: between(schedule, -0.7, -0.5), y: between(schedule, -0.75, -0.6), turn: 0, chin: 0 }
        else if (moodNow === 'talk') glance = AHEAD
        else {
          const pick = roll(schedule)
          const side = roll(schedule) < 0.5 ? -1 : 1
          glance =
            pick < 0.35
              ? AHEAD
              : pick < 0.65
                ? { x: side * between(schedule, 0.4, 0.6), y: between(schedule, -0.15, -0.05), turn: 0, chin: 0 }
                : pick < 0.85
                  ? { x: between(schedule, -0.45, -0.3), y: between(schedule, 0.5, 0.65), turn: 0, chin: 0 }
                  : { x: between(schedule, 0.6, 0.75), y: between(schedule, -0.5, -0.35), turn: 0, chin: 0 }
        }
        glanceAt = t
        nextGlance = t + (moodNow === 'busy' ? between(schedule, 1.5, 4.5) : moodNow === 'idle' ? between(schedule, 3.5, 10) : between(schedule, 2, 5))
      }

      // ---- blinks: one in seven doubled
      if (isPlaying(schedule, t, HOLDS_BLINK)) nextBlink = Math.max(nextBlink, t + HOLD_OFF)
      if (t >= nextBlink) {
        blinkAt = t
        doubleAt = roll(schedule) * DOUBLE < 1 ? t + DOUBLE_AFTER : -10
        nextBlink = t + (moodNow === 'busy' ? between(schedule, 2.6, 5.6) : moodNow === 'talk' ? between(schedule, 2.2, 4.8) : between(schedule, 3.4, 7.2))
      }

      const blinks: Instance[] = [...(t - blinkAt < blink ? [{ clip: 'blink', at: blinkAt }] : []), ...(doubleAt <= t && t - doubleAt < blink ? [{ clip: 'blink', at: doubleAt }] : [])]
      const timeline: Timeline = {
        mood: hold(moodNow, moodAt),
        warmth: hold('warmth', t, warm()),
        glance: hold('glance', Math.min(glanceAt, t), { x: glance.x, y: glance.y, turn: glance.turn, chin: glance.chin }),
        talk: moodNow === 'talk' ? hold('talk.syllables', moodAt) : [],
        breath: hold(moodNow === 'busy' ? 'breath.busy' : 'breath.idle', moodAt),
        acts: actsOf(schedule),
        blinks,
      }
      return { timeline }
    },
  }
}
