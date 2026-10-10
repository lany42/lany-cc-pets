// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A fruit bat hanging upside down from a branch, wrapped in its own wings.
// Everything about it is upside down: its happy face is (v m v), and when it
// sleeps its z's fall instead of rising.
import type { Sprite } from '../sprite'

// cols:     01234567890
const BRANCH = "===='='===="
const LEGS = '   /   \\   '
const WINGS = '  ( /|\\ )  '
const EARS = '   \\/ \\/   '

export const sprite: Sprite = {
  id: 'fruit-bat',
  name: 'Fruit Bat',
  persona: 'a fruit bat no bigger than a fig, hanging upside down and wrapped in its own wings',
  color: 'autoAccept',
  width: 11,
  height: 5,
  frames: {
    // idle: asleep upside down; its z's drift *down*
    sleep: [BRANCH, LEGS, WINGS, '  (- m -)  ', EARS],
    z1: [BRANCH, LEGS, WINGS, '  (- m -)z ', EARS],
    z2: [BRANCH, LEGS, WINGS, '  (- m -)  ', '   \\/ \\/ Z '],
    peek: [BRANCH, LEGS, WINGS, '  (o m -)  ', EARS],
    earFlick: [BRANCH, LEGS, WINGS, '  (- m -)  ', '   \\/ \\|   '],
    stretch: [BRANCH, LEGS, '  ( /|\\ \\  ', '  (- m -)  ', EARS],
    awake: [BRANCH, LEGS, WINGS, '  (o m o)  ', EARS],
    happy: [BRANCH, LEGS, WINGS, '  (v m v)  ', EARS],
    blush: [BRANCH, LEGS, WINGS, ' *(v m v)* ', EARS],
    // busy: wide awake, wings rustling with excitement
    rustleA: [BRANCH, LEGS, WINGS, '  (O m O)  ', EARS],
    rustleB: [BRANCH, LEGS, '  ( \\|/ )  ', '  (O m O)  ', EARS],
    squeak: [BRANCH, '   /   \\ ! ', '  ( \\|/ )  ', '  (O m O)  ', EARS],
    // ponder: an upside-down head tilt; its question marks fall, too
    huhA: [BRANCH, LEGS, WINGS, '  (o m O) ?', EARS],
    huhB: [BRANCH, LEGS, WINGS, '  (o m O)  ', '   \\/ \\/ ? '],
    huhC: [BRANCH, LEGS, WINGS, '  (O m o)  ', EARS],
    // talk: an upside-down open mouth
    talkOpen: [BRANCH, LEGS, WINGS, '  (v o v)  ', EARS],
    talkShut: [BRANCH, LEGS, WINGS, '  (v m v)  ', EARS],
    talkWide: [BRANCH, LEGS, WINGS, '  (v O v)  ', EARS],
  },
  loops: {
    idle: [
      ['sleep', 10], ['z1', 3], ['z2', 3], ['sleep', 6], 'earFlick', ['sleep', 8], ['peek', 4], ['sleep', 6],
      ['z1', 3], ['z2', 3], ['sleep', 4], ['stretch', 3], ['sleep', 3], ['awake', 3], ['happy', 2], ['blush', 4],
      ['happy', 2], ['sleep', 8], 'earFlick', 'sleep', 'earFlick', ['sleep', 4],
    ],
    busy: [['rustleA', 2], ['rustleB', 1], ['rustleA', 1], ['squeak', 2], ['rustleA', 2]],
    ponder: [['huhA', 3], ['huhB', 2], ['huhC', 2]],
    talk: [['talkOpen', 2], 'talkShut', 'talkWide', 'talkShut', ['talkOpen', 1], ['talkShut', 2]],
  },
}
