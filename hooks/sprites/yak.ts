// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A yak, half shaved: the front of it bare, the back still shaggy down to the
// ground. It got this way from a task that started as a one-line fix. At rest
// it chews and swishes its tail; while Claude works the wool comes off a little
// more with each pass, and grows right back; while it thinks it chews the
// question over; when it talks, it moos.
import type { Sprite } from '../sprite'

// cols:     0123456789012345
const HORNS = '.__    __.      '

/**
 * The head, then a body of six cells: the first `shaved` of them bare (its
 * front legs show), the rest wool hanging to the ground.
 */
const yak = (shaved: number, eyes = 'oo', mouth = '__', top = HORNS, tail = '.') => [
  top,
  `   \\(${eyes})/${'_'.repeat(shaved)}${'m'.repeat(6 - shaved)}${tail}`,
  `    (${mouth})\\${' '.repeat(shaved)}${'M'.repeat(6 - shaved)})`,
  `        ${'||'.padEnd(shaved + 1)}${'W'.repeat(6 - shaved)} `,
]

export const sprite: Sprite = {
  id: 'yak',
  name: 'Yak',
  persona: 'a yak, half shaved, left over from a task that started as a one-line fix',
  color: 'claude',
  width: 16,
  height: 4,
  frames: {
    rest: yak(3),
    blink: yak(3, '--'),
    chew: yak(3, 'oo', '--'),
    swish: yak(3, 'oo', '__', HORNS, '~'),
    // idle: a tuft comes loose by itself and drifts down, and it watches it go
    tuftLoose: [HORNS, '   \\(oo)/___mmm.', "    (__)\\   'MM)", '        ||  WWW '],
    tuftFall: [HORNS, '   \\(..)/___mmm.', '    (__)\\  , MM)', '        ||  WWW '],
    tuftDown: [HORNS, '   \\(..)/___mmm.', '    (__)\\    MM)', '        || .WWW '],
    sigh: [HORNS, '   \\(--)/___mmm.', '    (__)\\    MM)', '        || .WWW '],
    // busy: another pass of the clippers, a cell of wool at a time... and it grows right back
    shave2: yak(2),
    shave3: yak(3),
    shave4: yak(4),
    shave5: yak(5, '..'),
    // ponder: chewing the question over, between the horns
    huhA: yak(3, 'oo', '__', '.__ ?  __.      '),
    huhB: yak(3, 'oo', '--', '.__  ? __.      '),
    // talk: moo
    talkOpen: yak(3, '^^', '<>'),
    talkShut: yak(3, '^^'),
  },
  loops: {
    idle: [
      ['rest', 10], 'chew', 'rest', 'chew', ['rest', 7], 'blink', ['rest', 6], ['swish', 2], ['rest', 9],
      ['tuftLoose', 3], 'tuftFall', ['tuftDown', 4], ['sigh', 3], ['rest', 6], 'chew', 'rest', 'chew', 'rest', 'chew',
      ['rest', 8], ['swish', 1], 'rest', ['swish', 1], ['rest', 5],
    ],
    busy: [['shave2', 2], ['shave3', 2], ['shave4', 2], ['shave5', 3], 'shave4', 'shave3'],
    ponder: [['huhA', 2], ['huhB', 2]],
    talk: [['talkOpen', 2], 'talkShut', 'talkOpen', ['talkShut', 2]],
  },
}
