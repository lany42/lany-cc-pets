// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A jumping spider: a fuzzy little hunter with two enormous glossy eyes up
// front and two more beside them. It never blinks. Its palps are always going.
// It has decided you are interesting.
import type { Sprite } from '../sprite'

// cols:    01234567890123
const HEAD = '  /\\ .~~. /\\  '
const EYES = ' /  (oOOo)  \\ '
const PALPS = '/ /  "  "  \\ \\'

export const sprite: Sprite = {
  id: 'jumping-spider',
  name: 'Jumping Spider',
  persona: 'a fuzzy jumping spider the size of a pea, with two huge glossy eyes up front',
  color: 'success',
  width: 14,
  height: 3,
  frames: {
    rest: [HEAD, EYES, PALPS],
    // idle: palps flicking, eyes focusing on you, a little wave hello
    palpL: [HEAD, EYES, "/ /  '  \"  \\ \\"],
    palpR: [HEAD, EYES, "/ /  \"  '  \\ \\"],
    focus: [HEAD, ' /  (o@@o)  \\ ', PALPS],
    waveUp: [' \\_  .~~. /\\  ', EYES, PALPS],
    waveDown: [' _/\\ .~~. /\\  ', EYES, PALPS],
    lookYou: [HEAD, ' /  (OOoo)  \\ ', PALPS],
    // busy: eyes locked on your work, palps tapping along as you type
    tapA: [HEAD, ' /  (o@@o)  \\ ', "/ /  '  \"  \\ \\"],
    tapB: [HEAD, ' /  (o@@o)  \\ ', "/ /  \"  '  \\ \\"],
    tapC: [HEAD, ' /  (o@@o)  \\ ', "/ /  '  '  \\ \\"],
    // ponder: a curious tilt
    huhA: ['  /\\ .~~. /\\? ', EYES, PALPS],
    huhB: ['  /\\ .~~. /\\? ', ' /  (ooOO)  \\ ', PALPS],
    huhC: ['  /\\ .~~. /\\ ?', ' /  (ooOO)  \\ ', PALPS],
    // talk: the palps work like a little mouth
    talkA: [HEAD, EYES, '/ /  >  <  \\ \\'],
    talkB: [HEAD, EYES, PALPS],
    talkC: [HEAD, ' /  (o^^o)  \\ ', '/ /  >  <  \\ \\'],
  },
  loops: {
    idle: [
      ['rest', 8], 'palpL', 'rest', 'palpR', 'rest', 'palpL', ['rest', 7], ['focus', 6], ['rest', 6], 'palpR', 'palpL',
      ['rest', 6], ['waveUp', 2], ['waveDown', 1], ['waveUp', 2], ['waveDown', 1], ['rest', 6], ['lookYou', 5], ['rest', 5],
      'palpL', 'rest', 'palpR', ['rest', 4],
    ],
    busy: [['tapA', 1], ['tapB', 1], ['tapA', 1], ['tapC', 1], ['tapB', 1], ['tapA', 1]],
    ponder: [['huhA', 2], ['huhB', 2], ['huhC', 2], ['huhB', 1]],
    talk: [['talkA', 2], 'talkB', 'talkA', ['talkC', 2], 'talkA', 'talkB'],
  },
}
