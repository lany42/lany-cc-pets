// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A little campfire: two logs crossed between stones, and a flame that never
// holds still for long. At rest it burns low and lazy, now and then spitting a
// spark or settling a log; while Claude works it roars up tall; while it
// thinks someone holds a marshmallow over it; when it talks it crackles.
import type { Sprite } from '../sprite'

// cols:  0123456789
const BASE = ' o==\\/==o '
const SETTLED = ' o=_\\/==o '
const AIR = '          '

/** The fire's three rows above the logs, top first. */
const fire = (top: string, middle: string, bottom: string, base = BASE) => [top, middle, bottom, base]

export const sprite: Sprite = {
  id: 'campfire',
  name: 'Campfire',
  persona: 'a small campfire that never quite goes out',
  // the glow slides through the flame's own colors, and the bubble burns with it
  color: { kind: 'rainbow', colors: ['warning', 'claude', 'error', 'claude'], ticks: 3 },
  width: 10,
  height: 4,
  frames: {
    // idle: low and lazy, a cell or two moving at a time
    lowA: fire(AIR, '   ) (    ', '  ( ) )   '),
    lowB: fire(AIR, '   ) (    ', '  ( ( )   '),
    lowC: fire(AIR, '   ( (    ', '  ( ( )   '),
    lowD: fire(AIR, '   ( (    ', '  ) ( )   '),
    ebb: fire(AIR, '    (     ', '  ) ( )   '),
    // a spark works loose and drifts up out of the frame
    spark1: fire(AIR, '   ) (.   ', '  ( ) )   '),
    spark2: fire("      '   ", '   ) (    ', '  ( ) )   '),
    // a log settles into the embers with a puff
    settle: fire('    .     ', '   ) (    ', '  ( ) )   ', SETTLED),
    settled: fire(AIR, '   ) (    ', '  ( ) )   ', SETTLED),
    // busy: roaring up, three rows of flame
    roarA: fire('    (     ', '   ) )(   ', '  ( ( ))  '),
    roarB: fire('   )   .  ', '   ( ) )  ', '  ) ) ( ( '),
    roarC: fire("     ) '  ", '   ( (    ', '  ) ) )(  '),
    roarD: fire(" '  (     ", '   ) ) (  ', '  ( ( ) ) '),
    // ponder: a marshmallow on a stick, held in to toast
    mallowIn: fire(AIR, '   ) []---', '  ( ) )   '),
    mallowLick: fire(AIR, '   ( []---', '  ) ( (   '),
    mallowPuff: fire("     '    ", '   ) []---', '  ( ) )   '),
    // talk: it crackles, sparks popping off with each word
    crackA: fire('  *   .   ', '   ( (    ', '  ) ) )   '),
    crackB: fire("    '   * ", '   ) )    ', '  ( ( (   '),
    crackC: fire(" .    *   ", '   ( )    ', '  ) ( )   '),
  },
  loops: {
    idle: [
      ['lowA', 5], ['lowB', 3], ['lowC', 4], ['lowD', 2], ['ebb', 5], ['lowD', 2], ['lowC', 3], ['lowB', 2],
      ['lowA', 4], ['spark1', 1], ['spark2', 2], ['lowA', 6], ['lowB', 2], ['lowC', 3], ['lowB', 4], ['lowA', 5],
      ['settle', 1], ['settled', 6], ['lowB', 3], ['lowC', 2], ['lowD', 4], ['lowC', 2], ['lowB', 3],
      ['lowA', 2], ['spark1', 1], ['spark2', 2], ['lowA', 4],
    ],
    busy: ['roarA', 'roarB', ['roarC', 2], 'roarD', 'roarB', 'roarA', ['roarD', 2], 'roarC'],
    ponder: [['mallowIn', 3], ['mallowLick', 2], ['mallowPuff', 2], ['mallowIn', 2], ['mallowLick', 2]],
    talk: [['crackA', 2], 'crackB', 'crackC', ['crackA', 1], ['crackB', 2], 'crackC'],
  },
}
