// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A small ghost that lives in the git reflog, where every commit anyone gave
// up on goes to wait. Its hem ripples on its own; now and then it thins out
// until only its eyes are left, then pulls itself back together. While Claude
// works its hem flutters and its eyes follow along; when it talks it says boo.
import type { Sprite } from '../sprite'

// cols:   012345678
const TOP = '  .---.  '
const HEM = ' \\/\\/\\/\\ '
const HEM_FLIP = ' /\\/\\/\\/ '
/** The ghost with `eyes` (five cells, so they can look aside) and `mouth`. */
const body = (eyes: string, mouth: string, top = TOP, hem = HEM) => [top, ` /${eyes}\\ `, ` |  ${mouth}  | `, hem]

export const sprite: Sprite = {
  id: 'reflog-ghost',
  name: 'Reflog Ghost',
  persona: 'a small ghost from the git reflog, keeping every commit anyone gave up on',
  // grey, a little see-through
  color: 'inactive',
  width: 9,
  height: 4,
  frames: {
    rest: body(' o o ', 'o'),
    ripple: body(' o o ', 'o', TOP, HEM_FLIP),
    blink: body(' - - ', 'o'),
    glance: body('o o  ', 'o'),
    // idle: it thins out to nothing but its eyes, then gathers itself back up
    thin: [' .:---:. ', ' : o o : ', ' :  o  : ', " ':.:.:' "],
    thinner: ['  . . .  ', ' . o o . ', ' .     . ', '  . . .  '],
    gone: ['         ', '   o o   ', '         ', '         '],
    // busy: hem fluttering, eyes following your work back and forth
    flutterL: body('o o  ', 'o'),
    flutterR: body('o o  ', 'o', TOP, HEM_FLIP),
    flutterAhead: body(' o o ', 'o'),
    flutterAheadFlip: body(' o o ', 'o', TOP, HEM_FLIP),
    // ponder: rummaging through what it keeps
    huhA: body(" ' ' ", '.', '  .---. ?'),
    huhB: body(" ' ' ", '.', '  .---.? ', HEM_FLIP),
    // talk: boo
    booOpen: body(' ^ ^ ', 'O'),
    booShut: body(' ^ ^ ', 'o', TOP, HEM_FLIP),
  },
  loops: {
    idle: [
      ['rest', 8], ['ripple', 4], ['rest', 6], 'blink', ['rest', 3], ['ripple', 5], ['rest', 4], ['glance', 4],
      ['rest', 3], ['ripple', 3], ['rest', 5], ['thin', 2], ['thinner', 2], ['gone', 6], ['thinner', 1], ['thin', 1],
      ['rest', 6], 'blink', ['rest', 2], ['ripple', 6], ['rest', 4],
    ],
    busy: ['flutterL', 'flutterR', 'flutterL', 'flutterR', 'flutterAhead', 'flutterAheadFlip', 'flutterAhead', 'flutterAheadFlip'],
    ponder: [['huhA', 3], ['huhB', 3]],
    talk: [['booOpen', 2], 'booShut', 'booOpen', ['booShut', 2]],
  },
}
