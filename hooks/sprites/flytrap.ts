// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A potted venus flytrap, jaws open toward the speech bubble. Its rare idle
// event is a bug wandering past, then wandering back in and getting caught.
import type { Sprite } from '../sprite'

const OPEN = '   .vvvvv.  '
const SHUT = '   .-----.  '
const WRIGGLE = '   .-~~~-.  '
const HINGE = '          ) '
const CLAMPED = '   <vvvvv ) '
const LOWER = "   '^^^^^'  "
const STEM = '      ||    '
const POT = '   \\__||__/ '

export const sprite: Sprite = {
  id: 'flytrap',
  name: 'Flytrap',
  persona: 'a potted Venus flytrap that lives on a diet of bugs',
  color: 'success',
  width: 12,
  height: 5,
  frames: {
    open: [OPEN, HINGE, LOWER, STEM, POT],
    shut: [SHUT, CLAMPED, LOWER, STEM, POT],
    wriggle: [WRIGGLE, CLAMPED, LOWER, STEM, POT],
    // a bug drifting in from the left
    bugFar: ['x  .vvvvv.  ', HINGE, LOWER, STEM, POT],
    bugNear: [OPEN, ' x        ) ', LOWER, STEM, POT],
    bugIn: [OPEN, '     x    ) ', LOWER, STEM, POT],
    // busy: a bug buzzing just out of reach
    buzzUp: [' x .vvvvv.  ', HINGE, LOWER, STEM, POT],
    buzzMid: [OPEN, 'x         ) ', LOWER, STEM, POT],
    buzzLow: [OPEN, HINGE, " x '^^^^^'  ", STEM, POT],
    buzzClose: [OPEN, '  x       ) ', LOWER, STEM, POT],
    // ponder: a question lands in the jaws and gets chewed over
    question: [OPEN, '      ?   ) ', LOWER, STEM, POT],
  },
  loops: {
    idle: [
      ['open', 36], ['buzzMid', 1], ['buzzUp', 2], ['bugFar', 1], ['open', 24],
      ['bugFar', 2], ['bugNear', 2], ['bugIn', 1],
      ['shut', 3], ['wriggle', 2], ['shut', 2], ['wriggle', 1], ['shut', 9],
    ],
    busy: [['buzzUp', 2], ['buzzMid', 2], ['buzzLow', 2], ['buzzClose', 2]],
    ponder: [['question', 3], ['shut', 1], ['wriggle', 2], ['shut', 2], ['wriggle', 2], ['shut', 2]],
    // talk opens on a snap, since its rest pose is already open
    talk: [['shut', 1], ['open', 2], ['shut', 2], ['open', 1], ['shut', 1], ['open', 2]],
  },
}
