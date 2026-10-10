// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// An unresolved merge conflict: two versions of the same face, ours pulling
// left and theirs pulling right, stuck either side of the ======= divider.
import type { Sprite } from '../sprite'

const DIVIDER = '==========='
const ours = (face: string) => `<<<(${face})<<<`
const theirs = (face: string) => `>>>(${face})>>>`
// leaning: each side strains toward its own arrows
const oursPull = (face: string) => `<<(${face})<<<<`
const theirsPull = (face: string) => `>>>>(${face})>>`

export const sprite: Sprite = {
  id: 'merge-conflict',
  name: 'Merge Conflict',
  persona: 'an unresolved git merge conflict, two versions of the same line split by =======',
  color: 'error',
  width: 11,
  height: 3,
  frames: {
    rest: [ours('o_o'), DIVIDER, theirs('o_o')],
    // idle: they blink out of step, and sneak looks at each other
    oursBlink: [ours('-_-'), DIVIDER, theirs('o_o')],
    theirsBlink: [ours('o_o'), DIVIDER, theirs('-_-')],
    oursPeek: [ours('._.'), DIVIDER, theirs('o_o')],
    theirsPeek: [ours('o_o'), DIVIDER, theirs("'_'")],
    caught: [ours('._.'), DIVIDER, theirs("'_'")],
    huff: [ours('<_<'), DIVIDER, theirs('>_>')],
    // busy: a tug-of-war over the divider
    oursTug: [oursPull('>_<'), DIVIDER, theirs('o_o')],
    theirsTug: [ours('o_o'), DIVIDER, theirsPull('>_<')],
    // ponder: both eye the question sitting between them
    askC: [ours('._.'), '=====?=====', theirs("'_'")],
    askL: [ours('._.'), '====?======', theirs("'_'")],
    askR: [ours('._.'), '======?====', theirs("'_'")],
    // talk: they take turns
    oursSays: [ours('^o^'), DIVIDER, theirs('^_^')],
    theirsSay: [ours('^_^'), DIVIDER, theirs('^o^')],
  },
  loops: {
    idle: [
      ['rest', 12], 'oursBlink', ['rest', 2], 'theirsBlink', ['rest', 14],
      ['oursPeek', 3], ['caught', 2], ['huff', 4], ['rest', 16],
      'theirsBlink', 'rest', 'oursBlink', ['rest', 10], ['theirsPeek', 3], ['rest', 8],
    ],
    busy: [['oursTug', 3], 'rest', ['theirsTug', 3], 'rest'],
    ponder: [['askC', 2], ['askL', 2], ['askC', 2], ['askR', 2]],
    talk: [['oursSays', 2], ['theirsSay', 2]],
  },
}
