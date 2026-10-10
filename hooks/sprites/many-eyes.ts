// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A lump of something from outside, wearing more eyes than it needs. They
// open and shut on their own; when it speaks, the lower ones part into a mouth.
import type { Sprite } from '../sprite'

// cols:   0123456789012
const TOP = '   .-~-.~-.  '
const LEGS = '   )/(\\)/(   '
// every eye open: the upper row, then the lower
const UP = '  ( o  O o)  '
const LOW = '  (o o  o )  '

export const sprite: Sprite = {
  id: 'many-eyes',
  name: 'Many Eyes',
  persona: 'a small many-eyed thing that seeped in from the dark between the stars',
  color: 'success',
  width: 13,
  height: 4,
  frames: {
    // idle: a few eyes always asleep, waking and dozing at their own pace
    rest: [TOP, '  ( o  O -)  ', '  (- o  o )  ', LEGS],
    bigBlink: [TOP, '  ( o  - -)  ', '  (- o  o )  ', LEGS],
    peek: [TOP, UP, '  (- o  o )  ', LEGS],
    shift: [TOP, '  ( o  O -)  ', '  (o o  o )  ', LEGS],
    shifted: [TOP, '  ( o  O -)  ', '  (o -  o )  ', LEGS],
    curl: [TOP, '  ( o  O -)  ', '  (- o  o )  ', '   )/(\\)\\(   '],
    // wide awake, every eye at once: a rare start in idle, the stare between busy scans
    awake: [TOP, UP, LOW, LEGS],
    // busy: wide awake, a blink rolling across every eye
    w1: [TOP, UP, '  (- o  o )  ', LEGS],
    w2: [TOP, '  ( -  O o)  ', LOW, LEGS],
    w3: [TOP, UP, '  (o -  o )  ', LEGS],
    w4: [TOP, '  ( o  - o)  ', LOW, LEGS],
    w5: [TOP, UP, '  (o o  - )  ', LEGS],
    w6: [TOP, '  ( o  O -)  ', LOW, LEGS],
    // ponder: every eye shut, a question bobbing overhead
    shutQ: ['   .-~-.~-. ?', '  ( -  - -)  ', '  (- -  - )  ', LEGS],
    shutQ2: ['   .-~-.~-.? ', '  ( -  - -)  ', '  (- -  - )  ', LEGS],
    // talk: the lower eyes part into a mouth
    mouthOpen: [TOP, UP, '  (o vVv o)  ', LEGS],
    mouthShut: [TOP, UP, '  (o ~~~ o)  ', LEGS],
  },
  loops: {
    idle: [
      ['rest', 12], 'bigBlink', ['rest', 9], ['peek', 6], ['rest', 7], ['curl', 5], ['rest', 6],
      ['shift', 4], ['shifted', 8], ['shift', 3], ['rest', 8], 'bigBlink', ['rest', 4], ['awake', 2], ['rest', 6],
    ],
    busy: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', ['awake', 4]],
    ponder: [['shutQ', 3], ['shutQ2', 3]],
    talk: [['mouthOpen', 2], 'mouthShut', 'mouthOpen', ['mouthShut', 2]],
  },
}
