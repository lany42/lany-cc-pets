// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A sea angel (Clione): a see-through sliver of a sea slug that swims on two
// little wings, its heart showing through. It is precious. Then it eats, and
// its head opens into hooks. Then it is precious again.
import type { Sprite } from '../sprite'

// cols:    0123456789012
const HEAD = '    _.-._    '
const OPEN = '    _\\|/_    '
const WIDE = '    \\\\|//    '
const FACE = '   ( ^.^ )   '
const BODY = ' ~=(  <3 )=~ '
const TAIL = '    \\   /    '
const TIP = '     \\_/     '

export const sprite: Sprite = {
  id: 'sea-angel',
  name: 'Sea Angel',
  persona: 'a see-through sea angel with tiny wings, a visible heart, and a head that opens into hooks',
  color: 'suggestion',
  width: 13,
  height: 5,
  frames: {
    rest: [HEAD, FACE, BODY, TAIL, TIP],
    // idle: slow wingbeats, a drift of the tail
    beatDown: [HEAD, FACE, ' -=(  <3 )=- ', TAIL, TIP],
    beatUp: [HEAD, FACE, ' ^=(  <3 )=^ ', TAIL, TIP],
    blink: [HEAD, '   ( -.- )   ', BODY, TAIL, TIP],
    sway: [HEAD, FACE, BODY, TAIL, '     \\_\\     '],
    sparkle: ['  * _.-._    ', FACE, BODY, TAIL, TIP],
    sparkle2: ['    _.-._  + ', FACE, BODY, TAIL, TIP],
    // idle: the rare peek at what's under the head
    hungry: [HEAD, '   ( ^w^ )   ', BODY, TAIL, TIP],
    hooks: [OPEN, '   ( ^w^ )   ', BODY, TAIL, TIP],
    hooksWide: [WIDE, '   ( ^w^ )   ', BODY, TAIL, TIP],
    // busy: swimming hard toward your work, a quick downstroke then a glide
    swimA: [HEAD, '   ( o.o )   ', ' ^=(  <3 )=^ ', TAIL, TIP],
    swimB: [HEAD, '   ( o.o )   ', ' -=(  <3 )=- ', TAIL, '     \\_\\     '],
    swimC: [HEAD, '   ( o.o )   ', ' ^=(  <3 )=^ ', TAIL, TIP],
    swimD: [HEAD, '   ( o.o )   ', ' -=(  <3 )=- ', TAIL, '     /_/     '],
    // ponder
    huhA: [HEAD, '   ( o.O ) ? ', BODY, TAIL, TIP],
    huhB: ['    _.-._ ?  ', '   ( o.O )   ', BODY, TAIL, TIP],
    // talk: the mouth flaps... and on the big words, the head opens
    talkOpen: [HEAD, '   ( ^o^ )   ', BODY, TAIL, TIP],
    talkShut: [HEAD, FACE, BODY, TAIL, TIP],
    talkHooks: [OPEN, '   ( ^o^ )   ', BODY, TAIL, TIP],
    talkHooksWide: [WIDE, '   ( ^O^ )   ', BODY, TAIL, TIP],
  },
  loops: {
    idle: [
      ['rest', 8], ['beatDown', 2], ['rest', 2], ['beatUp', 2], ['rest', 6], 'blink', ['rest', 5],
      ['sway', 3], ['rest', 4], ['sparkle', 2], ['sparkle2', 2], ['rest', 6], ['beatDown', 2], ['rest', 2], ['beatUp', 2],
      ['rest', 8], ['hungry', 2], 'hooks', ['hooksWide', 2], 'hooks', ['hungry', 2], ['rest', 6], 'blink', ['rest', 4],
    ],
    busy: [['swimA', 2], 'swimB', ['swimC', 2], 'swimD'],
    ponder: [['huhA', 3], ['huhB', 3]],
    talk: [['talkOpen', 2], 'talkShut', 'talkOpen', 'talkHooks', ['talkHooksWide', 2], 'talkHooks', 'talkOpen', ['talkShut', 2]],
  },
}
