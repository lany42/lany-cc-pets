// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A rubber duck, the one every developer explains their bug to. It floats
// facing the bubble. At rest it bobs now and then, and rings spread out from
// it; while Claude works it listens, nodding along; while it thinks it looks
// up at a question; when it talks it squeaks.
import type { Sprite } from '../sprite'

// cols:   012345678901
const HEAD = '    __      '
const BODY = '   ( ._> /  '
const WATER = "~~~~`---'~~~"
/** The head row: `beak` then `eye`, facing left. */
const face = (beak: string, eye: string) => `  ${beak}(${eye} )___  `
const REST = face('<', 'o')

export const sprite: Sprite = {
  id: 'rubber-duck',
  name: 'Rubber Duck',
  persona: 'a yellow rubber duck that has listened to every bug explained out loud',
  color: 'warning',
  width: 12,
  height: 4,
  frames: {
    rest: [HEAD, REST, BODY, WATER],
    blink: [HEAD, face('<', '-'), BODY, WATER],
    glance: [HEAD, '  <( o)___  ', BODY, WATER],
    // idle: it bobs under, comes back up, and rings spread out either side
    sink: [HEAD, REST, BODY, "~~~~`~~~'~~~"],
    ring1: [HEAD, REST, BODY, "~~~-`---'-~~"],
    ring2: [HEAD, REST, BODY, "~~-~`---'~-~"],
    ring3: [HEAD, REST, BODY, "~-~~`---'~~-"],
    // busy: you explain, it listens, nodding along: the beak tips down toward the water
    nod: [HEAD, '   (o )___  ', '  <( ._> /  ', WATER],
    nodBlink: [HEAD, '   (- )___  ', '  <( ._> /  ', WATER],
    // ponder: it looks up at the question
    huhA: ['    __ ?    ', face('<', "'"), BODY, WATER],
    huhB: ['    __  ?   ', face('<', "'"), BODY, WATER],
    // talk: the beak squeaks open and shut
    talkOpen: [HEAD, face('<', '^'), BODY, WATER],
    talkShut: [HEAD, face('-', '^'), BODY, WATER],
    squeak: [' ,  __      ', face('<', '^'), BODY, WATER],
  },
  loops: {
    idle: [
      ['rest', 12], 'blink', ['rest', 8], ['sink', 2], 'rest', 'ring1', 'ring2', 'ring3', ['rest', 10],
      ['glance', 4], ['rest', 3], 'blink', ['rest', 9], ['sink', 2], 'rest', 'ring1', 'ring2', 'ring3', ['rest', 7],
    ],
    busy: [['rest', 2], 'nod', ['rest', 1], 'nod', ['rest', 4], 'nodBlink', ['rest', 2]],
    ponder: [['huhA', 3], ['huhB', 3]],
    talk: [['squeak', 2], 'talkShut', 'talkOpen', 'talkShut', ['squeak', 1], ['talkShut', 2]],
  },
}
