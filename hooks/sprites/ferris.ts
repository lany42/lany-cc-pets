// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Ferris the Rustacean, Rust's crab mascot, in its happy pose: a wide dome of
// a shell with the Rust gear's teeth along its top, two big eyes low on its
// face, a small smile under them, and both claws raised. At rest it blinks,
// glances at the bubble and snips hello. While Claude works the gear on its
// back turns, one tooth at a time; while it thinks, a question mark hangs at
// its claw, as in the Rust book's code that doesn't compile; when it talks it
// raises a claw to make its point. Asleep, its claws come down.
import type { Sprite } from '../sprite'

// cols:      012345678901234
const CROWN = '    .^^^^^.    '
const SHOULDERS = '\\/ ^       ^ \\/'

/** The gear's teeth as [row, col], round the shell from left to right: a shoulder, the five on top, a shoulder. */
const TEETH: readonly (readonly [row: number, col: number])[] = [[1, 3], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [1, 11]]

/** `rows` with `text` written over row `row` from column `col`. */
const put = (rows: readonly string[], row: number, col: number, text: string): string[] =>
  rows.map((line, at) => (at === row ? line.slice(0, col) + text + line.slice(col + text.length) : line))

/** Ferris with `eyes` (the nine cells inside its shell) and `mouth`, claws raised. */
const ferris = (eyes = '  o   o  ', mouth = 'v'): string[] => [CROWN, SHOULDERS, ` \\(${eyes})/ `, `  /'/\`-${mouth}-'\\'\\  `]

/** The claw on the bubble's side lifted high, to make a point. */
const point = (rows: readonly string[]): string[] => put(put(put(rows, 0, 0, '\\/'), 1, 0, ' \\'), 2, 1, ' ')
/** Both claws lifted high. */
const hooray = (rows: readonly string[]): string[] => put(put(put(point(rows), 0, 13, '\\/'), 1, 13, '/ '), 2, 13, ' ')
/** Both claws let down to its sides. */
const rested = (rows: readonly string[]): string[] => put(put(put(put(rows, 1, 0, '  '), 1, 13, '  '), 2, 0, '\\/'), 2, 13, '\\/')
/** The shell with tooth `index` turned down: the gear, part way round. */
const turned = (index: number, rows = ferris()): string[] => {
  const [row, col] = TEETH[index] ?? [1, 3]
  return put(rows, row, col, '-')
}

const REST = ferris()
const BLINK = ferris('  -   -  ')
/** Looking toward the bubble, with a question mark at its claw. */
const ask = (eyes: string, mouth: string) => put(ferris(eyes, mouth), 0, 2, '?')

export const sprite: Sprite = {
  id: 'ferris',
  name: 'Ferris',
  persona: "Ferris the Rustacean, the Rust language's crab mascot, with a shell toothed like a gear",
  // Rust's own red-orange: the reddest theme key that isn't crab's, worn a little weathered on dark
  color: 'diffRemovedWord',
  width: 15,
  height: 4,
  frames: {
    rest: REST,
    blink: BLINK,
    glance: ferris(' o   o   '),
    // idle: a little snip hello with the claw on the bubble's side
    snip: put(REST, 1, 0, '\\|'),
    // busy: the gear on its back turns, one tooth at a time
    gear0: turned(0),
    gear1: turned(1),
    gear2: turned(2),
    gear3: turned(3),
    gear3Blink: turned(3, BLINK),
    gear4: turned(4),
    gear5: turned(5),
    gear6: turned(6),
    // ponder: eyes on the question mark at its claw
    ask: ask(' o   o   ', '.'),
    askBlink: ask(' -   -   ', '.'),
    askHmm: ask(' o   o   ', '-'),
    // talk: a claw up to make its point, its mouth working, a snip on the big word
    pointOpen: point(ferris(undefined, 'o')),
    pointSmile: point(REST),
    pointShut: point(ferris(undefined, '-')),
    pointSnip: put(point(ferris(undefined, 'o')), 0, 0, '\\|'),
    // sleep: claws down at its sides, eyes shut, a slow breath
    doze: rested(ferris('  -   -  ', '.')),
    dozeIn: rested(ferris('  -   -  ', 'o')),
    // cheer: fearless, both claws high, snipping
    yay: hooray(ferris('  ^   ^  ')),
    yayOpen: hooray(ferris('  ^   ^  ', 'o')),
    yaySnip: put(put(hooray(ferris('  ^   ^  ', 'o')), 0, 0, '\\|'), 0, 13, '|/'),
  },
  loops: {
    idle: [
      ['rest', 20], 'blink', ['rest', 13], ['glance', 7], ['rest', 16], 'snip', 'rest', 'snip', ['rest', 12],
      'blink', ['rest', 2], 'blink', ['rest', 14],
    ],
    // twice round; the second time the gear catches for a tick while it blinks
    busy: [
      ['gear0', 2], ['gear1', 2], ['gear2', 2], ['gear3', 2], ['gear4', 2], ['gear5', 2], ['gear6', 2],
      ['gear0', 2], ['gear1', 2], ['gear2', 2], 'gear3', 'gear3Blink', 'gear3', ['gear4', 2], ['gear5', 2], ['gear6', 2],
    ],
    ponder: [['ask', 3], 'askBlink', ['ask', 3], ['askHmm', 2], ['ask', 2]],
    talk: [
      ['pointOpen', 2], 'pointSmile', 'pointOpen', 'pointShut', ['pointOpen', 2], 'pointSnip', 'pointOpen', 'pointSmile',
      ['rest', 2],
    ],
    sleep: [['doze', 10], ['dozeIn', 10]],
    cheer: [['yay', 2], 'yayOpen', 'yaySnip', ['yay', 2], 'yayOpen', 'yaySnip'],
  },
}
