// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Pomelo's behavior: when its moods, acts, blinks and glances change, as
// code on the rig kit (rig/behavior.ts). Each frame it is handed the
// runtime's cue and writes the timeline its drivers play: it decides when,
// the clips (and its gills' pendulums) decide how. Its acts last as long as
// their clips. Its numbers live in the code below, each drawn inside its
// natural range from its placid, underwater temperament (a studio tool
// measures them); the Motion of its sheet, in the studio, lists them.
//
// What it does, by mood (the clips do the rest):
//   idle    its eyes rest ahead, then drift to one thing for a moment and
//           come back: most often up toward the surface, else low to one
//           side, as at something sinking past, else level to one side.
//           Now and then a face: mostly content, else a curious tilt to
//           either side. Rarer, its bubble, the story: when one is due it
//           waits for a quiet idle moment well after the last big act. Left
//           alone a long while, a slow gill stretch, at most one in minutes.
//   busy    straight down at the prompt, often to a new place there; now
//           and then a ripple down its gills.
//   ponder  far to one side and a little down, as if listening, held for
//           the whole mood.
//   talk    at you, held; its syllables are the looping `talking` clip, which
//           runs on the timeline's own time, so where in its loop a
//           line starts is wherever the clock is.
// Content, curious, the bubble, the stretch and the wiggle are big: a calm
// after each, and nothing that waits for quiet (a face, the bubble, the
// stretch, a ripple) starts while one of them or a flick is under way. Its
// blinks are slow and unhurried, a little quicker busy, some of them
// doubled; none of its own while content, the bubble, the stretch or the
// wiggle plays, nor just after.
// News: a spectacle wiggles, at once (not over another wiggle, and not
// before a running curious tilt ends: both add to the tilt); a finished
// turn earns a gill flick a beat later unless a big act or a flick is
// under way or it flicked lately, and not before a running ripple ends
// (both add to the gills). Its first frame, a step back or a gap over 2 s
// starts it all over: no acts, every first time drawn afresh and sooner;
// its glance (held from now), its calm, its last blink and its last
// stretch are kept.
//
// It writes, every frame:
//   mood     the mood's clip (`idle`, `busy`, `ponder`, `talk`), from when the
//            cue says it began (never later than now)
//   glance   where its pupils rest, from when they went there (never later
//            than now)
//   talk     `talking` while it talks, else `hush`
//   breath   `breath.quick` busy, else `breath.slow` (both looping on the
//            timeline's own time, so a mood change keeps the phase)
//   acts     every act not ended, in the order played: `curious` with its
//            `side`, the rest bare
//   blinks   its last blink and its double while they run
//
// Pure: imports the kit, the adapter's `Behavior` and `rigPetById`, and the
// shared cue and mood types.
import type { Cue, Mood } from '../rig/kit/pet'
import type { Behavior } from '../rig/adapter'
import { rigPetById } from '../rig/adapter'
import { actsOf, between, hold, isBusy, isPlaying, isQuiet, lasting, lengthsOf, play, roll, scheduleOf, startsOver } from '../rig/behavior'
import type { DriversDoc, Timeline } from '../rig/schema'

/**
 * Its big moments (`BIG`), and the calm (`CALM`, seconds) each leaves before
 * the next: the sheet's Motion, "calm". A placid pet's long calm: the
 * reserved end of a calm's natural 5-10 s.
 */
const BIG: ReadonlySet<string> = new Set(['content', 'curious', 'bubble', 'stretch', 'wiggle'])
const CALM = 8.5
/** What keeps a face, the bubble, the stretch and a ripple waiting: a big act or a flick under way or to come. */
const STIRS: ReadonlySet<string> = new Set([...BIG, 'flick'])
/** Acts that shut or busy its eyes: no blink of its own meanwhile, nor `HOLD_OFF` seconds after. */
const HOLDS_BLINK: ReadonlySet<string> = new Set(['content', 'bubble', 'stretch', 'wiggle'])
const HOLD_OFF = 0.35
/** The share of blinks doubled (natural: 10-20%). */
const DOUBLE = 0.1
/** A finished turn's flick comes this many seconds after the news. */
const TURN_DELAY = 0.18
/** A flick waits out these: another flick (skipped) and a ripple (delayed to its end), which add to the same gills. */
const FLICK: ReadonlySet<string> = new Set(['flick'])
/** Seconds after a flick before another turn earns one: a placid pet doesn't flick for every turn. */
const FLICK_REST = 45
/** A spectacle's wiggle waits out these: another wiggle (skipped) and a curious tilt (delayed to its end), which add to the same tilt. */
const WIGGLE: ReadonlySet<string> = new Set(['wiggle'])
/** Seconds the story's bubble waits after the last big act ends: the sheet's Motion, "story". */
const BUBBLE_QUIET = 15
/** The share of faces that are content (the rest a curious tilt). */
const CONTENT = 0.7
/** Where an idle look goes, by chance: up toward the surface, else low to one side, else level to one side. */
const LOOK_UP = 0.6
const LOOK_LOW = 0.88

/** A place for its pupils. */
type Place = { x: number; y: number }

/** Its behavior from `seed`, timing its acts by `drivers`' clips (its own in RIG_PETS unless given). */
export function pomeloBehavior(seed: number, drivers: DriversDoc = rigPetById('pomelo').drivers): Behavior {
  const lengthOf = lengthsOf(drivers)
  const blink = lengthOf('blink')
  const schedule = scheduleOf(seed)
  let nextBlink = 0
  let blinkAt = -10
  let doubleAt = -10
  let glance: Place = { x: 0, y: 0 }
  let glanceAt = 0
  let nextGlance = 0
  let glanceMood: Mood | undefined
  /** Whether its eyes are away on a look (else resting ahead). */
  let away = false
  let nextFace = 0
  let nextBubble = 0
  let nextRipple = 0
  let rippleEnd = Number.NEGATIVE_INFINITY
  let tiltEnd = Number.NEGATIVE_INFINITY
  let bigEnd = Number.NEGATIVE_INFINITY
  let lastFlick = Number.NEGATIVE_INFINITY
  let lastStretch = -1e9
  let stretchAfter = 0
  let stretchGap = 0

  /** Plays `clip` at `at`: a curious tilt to the side its roll picks, the rest bare. */
  const act = (clip: string, at: number): void => {
    const args = clip === 'curious' ? { side: roll(schedule) < 0.5 ? -1 : 1 } : undefined
    const placed = play(schedule, clip, at, lengthOf(clip), args, BIG.has(clip) ? CALM : undefined)
    if (clip === 'ripple') rippleEnd = placed.end
    if (clip === 'curious' || clip === 'wiggle') tiltEnd = placed.end
    if (BIG.has(clip)) bigEnd = Math.max(bigEnd, placed.end)
  }

  /** Its eyes resting ahead, at you. */
  const ahead = (): Place => ({ x: between(schedule, -0.06, 0.06), y: between(schedule, -0.05, 0.05) })
  /** An idle look at one thing: up toward the surface, low to one side, or level to one side. */
  const look = (): Place => {
    const pick = roll(schedule)
    const side = roll(schedule) < 0.5 ? -1 : 1
    if (pick < LOOK_UP) return { x: between(schedule, -0.25, 0.25), y: between(schedule, -1, -0.82) }
    if (pick < LOOK_LOW) return { x: side * between(schedule, 0.85, 1), y: between(schedule, 0.15, 0.3) }
    return { x: side * between(schedule, 0.3, 0.42), y: between(schedule, -0.12, -0.02) }
  }
  /** Where its eyes go in a mood other than idle. */
  const placeFor = (mood: Mood): Place => {
    if (mood === 'busy') return { x: between(schedule, -0.2, 0.25), y: between(schedule, 0.78, 1) }
    if (mood === 'ponder') return { x: (roll(schedule) < 0.5 ? -1 : 1) * between(schedule, 0.88, 1), y: between(schedule, 0.08, 0.26) }
    return { x: between(schedule, -0.08, 0.08), y: between(schedule, -0.06, 0.06) }
  }

  return {
    step(cue: Cue) {
      const t = cue.t
      const mood = cue.mood
      if (startsOver(schedule, t)) {
        nextBlink = t + between(schedule, 0.6, 1.6)
        nextGlance = t + between(schedule, 4, 7)
        nextFace = t + between(schedule, 20, 35)
        nextBubble = t + between(schedule, 30, 60)
        nextRipple = t + between(schedule, 2.8, 6)
        stretchAfter = between(schedule, 120, 150)
        stretchGap = between(schedule, 420, 540)
        glanceAt = Math.min(glanceAt, t)
        away = false
        rippleEnd = Number.NEGATIVE_INFINITY
        tiltEnd = Number.NEGATIVE_INFINITY
      }

      // ---- the news, on the frame it comes
      if (cue.spectacle && !isBusy(schedule, t, WIGGLE)) act('wiggle', Math.max(t, tiltEnd))
      if (cue.turnsEnded > 0 && !isBusy(schedule, t, BIG) && !isBusy(schedule, t, FLICK) && t - lastFlick >= FLICK_REST) {
        act('flick', Math.max(t + TURN_DELAY, rippleEnd))
        lastFlick = t
      }

      // ---- each in turn, quiet judged once
      const quiet = isQuiet(schedule, t, STIRS)
      if (t >= nextFace) {
        if (mood === 'idle' && quiet) act(roll(schedule) < CONTENT ? 'content' : 'curious', t)
        nextFace = t + between(schedule, 50, 80)
      }
      // The bubble is rare: when due it waits for its moment, well after the last big act, then draws the next.
      if (t >= nextBubble && mood === 'idle' && quiet && !isBusy(schedule, t) && t >= bigEnd + BUBBLE_QUIET) {
        act('bubble', t)
        nextBubble = t + between(schedule, 70, 170)
      }
      if (mood === 'idle' && cue.since > stretchAfter && t - lastStretch > stretchGap && quiet && !isBusy(schedule, t)) {
        act('stretch', t)
        lastStretch = t
        stretchAfter = between(schedule, 120, 150)
        stretchGap = between(schedule, 420, 540)
      }
      if (mood === 'busy' && t >= nextRipple) {
        if (quiet) act('ripple', t)
        nextRipple = t + between(schedule, 9, 20)
      }

      // ---- glances: idle rests ahead between looks; busy reads the prompt; ponder and talk hold one place
      if (mood !== glanceMood) {
        away = false
        glance = mood === 'idle' ? ahead() : placeFor(mood)
        glanceAt = t
        glanceMood = mood
        if (mood === 'idle') nextGlance = t + between(schedule, 4, 7)
        else if (mood === 'busy') nextGlance = t + between(schedule, 1, 1.6)
      } else if ((mood === 'idle' || mood === 'busy') && t >= nextGlance) {
        if (mood === 'busy') {
          glance = placeFor(mood)
          nextGlance = t + between(schedule, 1, 1.6)
        } else {
          away = !away
          glance = away ? look() : ahead()
          nextGlance = t + (away ? between(schedule, 1.9, 2.9) : between(schedule, 8, 12))
        }
        glanceAt = t
      }

      // ---- blinks: sometimes twice
      if (isPlaying(schedule, t, HOLDS_BLINK)) nextBlink = Math.max(nextBlink, t + HOLD_OFF)
      if (t >= nextBlink) {
        blinkAt = t
        doubleAt = roll(schedule) < DOUBLE ? t + between(schedule, 0.62, 0.74) : -10
        nextBlink = t + (mood === 'busy' ? between(schedule, 4, 6.5) : between(schedule, 5.5, 9))
      }

      // When the mood began, never later than now (a mood's first frame may carry since < 0).
      const from = t - Math.max(0, cue.since)
      const timeline: Timeline = {
        mood: hold(mood, from),
        glance: hold('glance', glanceAt, { x: glance.x, y: glance.y }),
        talk: hold(mood === 'talk' ? 'talking' : 'hush', from),
        breath: hold(mood === 'busy' ? 'breath.quick' : 'breath.slow', from),
        acts: actsOf(schedule),
        blinks: [...lasting('blink', blinkAt, blink, t), ...lasting('blink', doubleAt, blink, t)],
      }
      return { timeline }
    },
  }
}
