// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura's behavior: when her moods, acts, blinks, glances and the petals in
// her hair change, as code on the rig kit (rig/behavior.ts). Each frame it is
// handed the runtime's cue and writes the timeline her drivers play: it
// decides when, the clips (and her particle and lookAt drivers) decide how.
// Her acts last as long as their clips.
//
// What she does, by mood (the clips do the rest):
//   idle    a face every 35-75 s (the first 15-35 s in): a hum (45%), a
//           tilted smile (35%) or a giggle. A gust every 45-95 s (the first
//           10-22 s in) blows one petal (40%), two (40%) or three past her,
//           from either side; each in turn lands on her nose (16%, which
//           ends the gust), catches in her hair while it has room (46%), or
//           blows past. One bound for her nose lands 2.1 s after it sets off,
//           the petals 1.5 s apart: then she plays `nose`, blowing it away
//           and the ones in her hair with it. Left alone 210 s, she dozes,
//           and her time alone starts over. A glance every 4.5-11 s (the
//           first 1.5-5 s in): at you (40%), up at the blossom in her hair,
//           at nothing with heavier lids, or down after a petal only she
//           sees.
//   busy    one spot of the work, a glance there every 3-6 s; a peek up at
//           you every 12-24 s (the first 5-12 s in).
//   ponder, talk   their mood's clip; talk's syllables are its `talk` clip.
// Her faces, nose, doze and shower are big: 9 s of calm after each, and
// nothing that waits for quiet (a face, a gust, the doze, a peek) starts
// while a big act or a gust is under way. A blink every 4-9 s (5-10 busy,
// 2.5-5.5 talking; the first in 1.2-3.5 s): three in four a slow blink, one
// in four only a droop; none of her own while a hum, giggle, nose, doze or
// shower plays nor 1 s after.
// News: a spectacle showers petals, at once; a finished turn earns a giggle
// 0.3 s later unless a big act is under way. Her first frame, a step back or
// a gap over 2 s starts it all over: no acts, no petal bound for her nose,
// every first time drawn afresh; the petals in her hair, her calm, her glance
// and her last blink and droop are kept.
//
// It writes, every frame:
//   mood    her mood's clip (`mood.idle` ...), from when the cue says it began
//   drowsy  from when she was last left alone: her lids' slow ramp
//   glance  where her eyes rest, from when they went there (never later than
//           now: after a step back it holds from now), its falling hops
//           counting from then
//   held    the petals her hair holds
//   talk    her syllables while she talks, from when she began; else none
//   breath  her breath at the mood's period, from the mood's start
//   acts    every act not ended, in the order played: a gust as its fates'
//           clip (`gust.hpn`) with `from` (the petals held as it began),
//           `side` and `roll`; the nose's with `from`; the rest bare
//   blinks  her last blink and her last droop while they run
//
// Pure: imports the kit, the adapter's `Behavior` and `rigPetById`, and the
// shared cue type.
import type { Cue } from '../rig/kit/pet'
import type { Behavior } from '../rig/adapter'
import { rigPetById } from '../rig/adapter'
import { actsOf, between, hold, isBusy, isPlaying, isQuiet, lengthsOf, play, roll, scheduleOf, startsOver } from '../rig/behavior'
import type { DriversDoc, Instance, Timeline, Values } from '../rig/schema'

/** Her bigger moments (`BIG`), and the calm (`CALM`, seconds) she lingers in after each before the next. */
const BIG: ReadonlySet<string> = new Set(['smile', 'hum', 'giggle', 'nose', 'doze', 'shower'])
const CALM = 9
/** Acts that close her eyes or hold them on something: no blink of her own meanwhile, nor `HOLD_OFF` after (`HOLDS_BLINK`). */
const HOLDS_BLINK: ReadonlySet<string> = new Set(['hum', 'giggle', 'nose', 'doze', 'shower'])
const HOLD_OFF = 1.0
/** Left alone this long, seconds, she nods off (`DOZE_AFTER`). */
const DOZE_AFTER = 210
/** A gust's petals set off `SPACING` apart, and one bound for her nose lands `ON_NOSE` after it sets off. */
const SPACING = 1.5
const ON_NOSE = 2.1
/** How many petals her hair holds. */
const ROOM = 3

/** What a gust blows: its petals' fates in order (`h` caught in her hair, `p` blown past, `n` onto her nose), and its wind's side (-1 the viewer's left). */
type Gust = { readonly fates: string; readonly side: number }

/** Her behavior from `seed`, timing her acts by `drivers`' clips (hers in RIG_PETS unless given). */
export function sakuraBehavior(seed: number, drivers: DriversDoc = rigPetById('sakura').drivers): Behavior {
  const lengthOf = lengthsOf(drivers)
  const [blink, droop] = [lengthOf('blink'), lengthOf('droop')]
  /** What keeps her tracks waiting: a big act, or a gust (every `gust.` clip of her drivers), under way or to come. */
  const stirs: ReadonlySet<string> = new Set([...BIG, ...drivers.clips.map(clip => clip.id).filter(id => id.startsWith('gust.'))])
  const schedule = scheduleOf(seed)
  let nextBlink = 0
  let blinkAt = -10
  let droopAt = -10
  let glance = { x: 0, y: 0, lid: 0, fall: 0 }
  let glanceAt = 0
  let nextGlance = 0
  let nextFace = 0
  let nextGust = 0
  let nextPeek = 0
  /** Petals caught in her hair, 0 to 3. */
  let petals = 0
  /** When the petal on its way to her nose lands, if one is. */
  let noseAt: number | undefined
  /** Since when she has been left alone (her drowsiness counts from it; the doze starts it over). */
  let idleFrom = 0

  /** Plays `clip` at `at`, its roll drawn (every act draws one): a gust's petals change what her hair holds, the nose empties it. */
  const act = (clip: string, at: number, gust?: Gust): void => {
    const r = roll(schedule)
    const args: Values | undefined = gust !== undefined ? { from: petals, side: gust.side, roll: r } : clip === 'nose' ? { from: petals } : undefined
    play(schedule, clip, at, lengthOf(clip), args, BIG.has(clip) ? CALM : undefined)
    if (gust !== undefined) {
      petals = Math.min(ROOM, petals + [...gust.fates].filter(fate => fate === 'h').length)
      if (gust.fates.endsWith('n')) noseAt = at + ((gust.fates.length - 1) * SPACING + ON_NOSE)
    }
    if (clip === 'nose') petals = 0
  }

  /** A gust at `t`: how many petals, each one's fate in turn, its side. */
  const blowGust = (t: number): void => {
    const count = roll(schedule) < 0.4 ? 1 : roll(schedule) < 0.67 ? 2 : 3
    let fates = ''
    let room = ROOM - petals
    for (let k = 0; k < count; k++) {
      const r = roll(schedule)
      if (r < 0.16) {
        fates += 'n'
        break
      }
      if (room > 0 && r < 0.62) {
        fates += 'h'
        room--
      } else fates += 'p'
    }
    const side = roll(schedule) < 0.5 ? -1 : 1
    act(`gust.${fates}`, t, { fates, side })
  }

  /** Her face act: humming 45%, a tilted smile 35%, a giggle 20%. */
  const face = (): string => {
    const pick = roll(schedule)
    return pick < 0.45 ? 'hum' : pick < 0.8 ? 'smile' : 'giggle'
  }

  return {
    step(cue: Cue) {
      const t = cue.t
      const mood = cue.mood
      if (startsOver(schedule, t)) {
        noseAt = undefined
        nextGust = t + between(schedule, 10, 22)
        nextFace = t + between(schedule, 15, 35)
        nextGlance = t + between(schedule, 1.5, 5)
        nextBlink = t + between(schedule, 1.2, 3.5)
        nextPeek = t + between(schedule, 5, 12)
        idleFrom = t
      }
      if (mood !== 'idle') idleFrom = t

      // ---- the news, on the frame it comes
      if (cue.spectacle) act('shower', t)
      if (cue.turnsEnded > 0 && !isBusy(schedule, t, BIG)) act('giggle', t + 0.3)

      // ---- each track in turn, quiet judged once
      const isCalm = isQuiet(schedule, t, stirs)
      if (t >= nextFace) {
        if (mood === 'idle' && isCalm) act(face(), t)
        nextFace = t + (mood === 'idle' ? between(schedule, 35, 75) : between(schedule, 50, 100))
      }
      if (t >= nextGust) {
        if (mood === 'idle' && isCalm) blowGust(t)
        nextGust = t + between(schedule, 45, 95)
      }
      if (noseAt !== undefined && t >= noseAt) {
        noseAt = undefined
        act('nose', t)
      }
      if (mood === 'idle' && t - idleFrom > DOZE_AFTER && isCalm) {
        act('doze', t)
        idleFrom = t
      }
      if (mood === 'busy' && t >= nextPeek) {
        if (isCalm) act('peek', t)
        nextPeek = t + between(schedule, 12, 24)
      }
      if (t >= nextGlance) {
        // Idle: at you, up at the blossom in her hair, spacing out, or down after a petal only she sees; busy: one spot of the work.
        if (mood === 'busy') glance = { x: between(schedule, -0.55, -0.35), y: between(schedule, 0.45, 0.6), lid: 0, fall: 0 }
        else {
          const pick = roll(schedule)
          glance =
            pick < 0.4
              ? { x: 0, y: 0, lid: 0, fall: 0 }
              : pick < 0.6
                ? { x: between(schedule, 0.45, 0.7), y: between(schedule, -0.85, -0.6), lid: 0, fall: 0 }
                : pick < 0.82
                  ? { x: between(schedule, -0.15, 0.2), y: between(schedule, 0.05, 0.2), lid: 0.22, fall: 0 }
                  : { x: between(schedule, -0.5, 0.5), y: -0.7, lid: 0, fall: 1 }
        }
        glanceAt = t
        nextGlance = t + (mood === 'busy' ? between(schedule, 3, 6) : between(schedule, 4.5, 11))
      }

      // ---- blinks: three in four a blink, one in four a droop
      if (isPlaying(schedule, t, HOLDS_BLINK)) nextBlink = Math.max(nextBlink, t + HOLD_OFF)
      if (t >= nextBlink) {
        if (roll(schedule) * 4 < 3) blinkAt = t
        else droopAt = t
        nextBlink = t + (mood === 'busy' ? between(schedule, 5, 10) : mood === 'talk' ? between(schedule, 2.5, 5.5) : between(schedule, 4, 9))
      }

      const moodAt = t - Math.max(0, cue.since)
      // Her blink and droop by their age, `t - at < length` (the kit's `lasting` tests `t < at + length`, which may differ in the last place).
      const blinks: Instance[] = [...(t - blinkAt < blink ? [{ clip: 'blink', at: blinkAt }] : []), ...(t - droopAt < droop ? [{ clip: 'droop', at: droopAt }] : [])]
      const timeline: Timeline = {
        mood: hold(`mood.${mood}`, moodAt),
        drowsy: hold('drowsy', idleFrom),
        glance: hold('glance', Math.min(glanceAt, t), { x: glance.x, y: glance.y, lid: glance.lid, fall: glance.fall }),
        held: hold('held', t, { count: petals }),
        talk: mood === 'talk' ? hold('talk', moodAt) : [],
        breath: hold(mood === 'busy' ? 'breath.busy' : 'breath.idle', moodAt),
        acts: actsOf(schedule),
        blinks,
      }
      return { timeline }
    },
  }
}
