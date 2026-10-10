// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A little crab, the only look two rows tall: eyes up on stalks, claws at its
// sides. At rest it blinks, waves a claw, and now and then scuttles a step
// sideways and back. While Claude works it holds both claws up and snips
// along; while it thinks it taps its chin; when it talks it pinches for
// emphasis.
import type { Sprite } from '../sprite'

// cols:     01234567890123
const EYES = '     o  o     '
const DOWN = '(\\/)(_,,_)(\\/)'
const UP_EYES = '(\\/) o  o (\\/)'
const UP_ARMS = ' \\_\\(_,,_)/_/ '

/** The crab two cells wider, standing `at` cells in from the left (0-2; 1 is home). */
const at = (lines: readonly string[], step = 1) => lines.map(line => ' '.repeat(step) + line + ' '.repeat(2 - step))

export const sprite: Sprite = {
  id: 'crab',
  name: 'Crab',
  persona: 'a pocket-sized crab that scuttles sideways and pinches for emphasis',
  color: 'error',
  width: 16,
  height: 2,
  frames: {
    rest: at([EYES, DOWN]),
    blink: at(['     -  -     ', DOWN]),
    peer: at(['     .  o     ', DOWN]),
    // idle: a wave to you, with the claw on the bubble's side
    wave: at(['(\\/) o  o     ', ' \\_\\(_,,_)(\\/)']),
    waveSnip: at(['(||) o  o     ', ' \\_\\(_,,_)(\\/)']),
    // idle: a scuttle, two steps toward the bubble and back
    stepL: at([EYES, DOWN], 0),
    stepR: at([EYES, DOWN], 2),
    // busy: both claws up, snipping along with the work
    upOpen: at([UP_EYES, UP_ARMS]),
    snipL: at(['(||) o  o (\\/)', UP_ARMS]),
    snipR: at(['(\\/) o  o (||)', UP_ARMS]),
    // ponder: one claw up at its chin, tapping, a question on the bubble's side
    chin: at(['  ?  o  o (\\/)', '(\\/)(_,,_)/_/ ']),
    chinTap: at(['  ?  o  o (||)', '(\\/)(_,,_)/_/ ']),
    // talk: claws up, the mouth working and a claw snapping shut on the big words
    talkOpen: at([UP_EYES, ' \\_\\(_<>_)/_/ ']),
    talkShut: at([UP_EYES, UP_ARMS]),
    talkPinch: at(['(||) o  o (||)', ' \\_\\(_<>_)/_/ ']),
  },
  loops: {
    idle: [
      ['rest', 10], 'blink', ['rest', 7], ['peer', 4], ['rest', 6], ['stepL', 3], ['rest', 2], ['stepR', 3], ['rest', 8],
      ['wave', 2], 'waveSnip', 'wave', 'waveSnip', ['wave', 2], ['rest', 9], 'blink', ['rest', 3], 'blink', ['rest', 6],
    ],
    busy: [['upOpen', 2], 'snipL', 'upOpen', ['upOpen', 1], 'snipR', ['upOpen', 2], 'snipL', 'snipR'],
    ponder: [['chin', 3], 'chinTap', 'chin', 'chinTap', ['chin', 2]],
    talk: [['talkOpen', 2], 'talkShut', 'talkPinch', 'talkOpen', ['talkShut', 2]],
  },
}
