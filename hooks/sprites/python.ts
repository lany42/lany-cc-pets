// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The two snakes of the Python logo, alive: the blue one on top, its one eye
// toward the bubble, and the yellow one below, its one eye on the far side.
// At rest they keep still; now and then one blinks or flicks its tongue, or
// the blue one steals a look at the other and gets caught. While Claude works
// they share one lock, like CPython's: one tastes the air while the other waits
// with its eye shut, then they swap. While they think, they pass a question
// back and forth; when they talk, the blue one starts and the yellow one has
// the last word.
import type { Sprite } from '../sprite'

/**
 * The pair, 14 x 5. `blue` and `yellow` are each one's eye and jaw line, three
 * cells with the eye at the snout: `o--` for the blue one, `--o` for the
 * yellow. A tongue (`>`, `<`) may flick out of either snout, and a `?` may
 * hang by either head.
 */
const snakes = (blue = 'o--', yellow = '--o', { blueTongue = ' ', yellowTongue = ' ', blueAsks = ' ', yellowAsks = ' ' } = {}) => [
  // cols 0123456789012
  ` ${blueAsks}${blueTongue}.------.   `,
  `.--'${blue}   |--.`,
  "|  .------'  |",
  `'--|   ${yellow}.--'`,
  `    '-----'${yellowTongue}${yellowAsks} `,
]

export const sprite: Sprite = {
  id: 'python',
  name: 'Python',
  persona: 'the two one-eyed snakes of the Python logo, a blue one and a yellow one, sharing one bubble',
  // One paint, both colors: a rainbow of only the logo's blue and yellow that
  // never slides. Its stripes run up to the right, two cells a row, and the
  // first six (the top left) ink the blue snake, every later one the yellow;
  // they would step once every billion ticks, about eight years, so they hold
  // still. The bubble matches: its border blue, its words blue for their first
  // 18 characters and yellow after, so the blue one starts and the yellow one
  // finishes.
  color: { kind: 'rainbow', colors: Array.from({ length: 40 }, (_, at) => (at < 6 ? 'ide' : 'warning')), ticks: 1_000_000_000 },
  width: 14,
  height: 5,
  frames: {
    rest: snakes(),
    // idle: a blink each, a tongue each, and a sideways look that gets caught
    blinkBlue: snakes('---'),
    blinkYellow: snakes('o--', '---'),
    peek: snakes('-o-'),
    caught: snakes('-o-', '-o-'),
    stare: snakes('o--', '-o-'),
    tongueBlue: snakes('o--', '--o', { blueTongue: '>' }),
    tongueYellow: snakes('o--', '--o', { yellowTongue: '<' }),
    // busy: one lock between them, so one tastes the air while the other waits, eye shut
    blueHolds: snakes('o--', '---'),
    blueTastes: snakes('o--', '---', { blueTongue: '>' }),
    yellowHolds: snakes('---', '--o'),
    yellowTastes: snakes('---', '--o', { yellowTongue: '<' }),
    // ponder: one question, passed back and forth
    blueAsks: snakes('o--', '--o', { blueAsks: '?' }),
    yellowAsks: snakes('o--', '--o', { yellowAsks: '?' }),
    // sleep: both eyes shut, sinking a little deeper on each breath
    doze: snakes('---', '---'),
    dozeDeep: snakes('_--', '--_'),
    // cheer: glad eyes, tongues out by turns
    gladBlue: snakes('^--', '--^', { blueTongue: '>' }),
    gladYellow: snakes('^--', '--^', { yellowTongue: '<' }),
  },
  loops: {
    idle: [
      ['rest', 20], 'blinkBlue', ['rest', 16], ['peek', 4], ['caught', 3], ['stare', 3], ['rest', 17], 'tongueBlue',
      'rest', 'tongueBlue', ['rest', 13], 'blinkYellow', ['rest', 10], 'tongueYellow', ['rest', 4],
    ],
    busy: [
      ['blueHolds', 2], 'blueTastes', 'blueHolds', 'blueTastes', ['blueHolds', 3],
      ['yellowHolds', 2], 'yellowTastes', 'yellowHolds', 'yellowTastes', ['yellowHolds', 3],
    ],
    ponder: [['blueAsks', 3], ['yellowAsks', 3]],
    // talk: the blue one says its piece, and the yellow one has the last word
    talk: [['tongueBlue', 2], 'rest', 'tongueBlue', ['rest', 2], 'tongueYellow', 'rest', 'tongueYellow', ['rest', 3]],
    sleep: [['doze', 10], ['dozeDeep', 10]],
    cheer: [['gladBlue', 2], ['gladYellow', 2]],
  },
}
