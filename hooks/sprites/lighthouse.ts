// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Lighthouse, a striped tower on a sea rock: only its lamp and the sea move. idle: two flashes, its
// light characteristic, and now and then a set of waves; busy: the lens turns the beam round; ponder:
// it signals ? in Morse (..--..) toward the bubble; talk: the beam swings to the bubble and flares
// with each word; sleep: lamp out for the day, an ember breathing; cheer: a searchlight swing.
import type { Sprite } from '../sprite'

const REST = [
  '      /^\\    ',
  '      |o|    ',
  '     [###]   ',
  '     /   \\   ',
  '~~~~/#####\\~~',
]

/** `rows` with `text` written over row `row` from column `col`. */
const put = (rows: readonly string[], row: number, col: number, text: string): string[] =>
  rows.map((line, at) => (at === row ? line.slice(0, col) + text + line.slice(col + text.length) : line))

/** The lamp, lit. */
const LIT = put(REST, 1, 7, '*')
/** The beam out to the bubble's side, and out to the other. */
const BEAM_LEFT = put(LIT, 1, 2, '==--')
const BEAM_RIGHT = put(LIT, 1, 9, '--==')
/** The lamp out: by day a lighthouse sleeps. */
const OFF = put(REST, 1, 7, ' ')
/** Morse for "?", built out from the lamp a symbol at a time; it reads the same from either end. */
const QUESTION = '..--..'
const morse = (symbols: number): string[] => put(REST, 1, 6 - symbols, QUESTION.slice(6 - symbols))
/** The Morse sent on its way: its last symbols leave the lamp first. */
const sent = (left: number): string[] => put(REST, 1, 0, QUESTION.slice(0, left))

export const sprite: Sprite = {
  id: 'lighthouse',
  name: 'Lighthouse',
  persona: 'a small striped lighthouse on a rock at sea, its lens turned by clockwork',
  // Regions is opt-in, pending review; declined, it wears its steady key, 'warning'.
  color: {
    kind: 'regions',
    colors: ['error', 'warning', 'ide'],
    map: [
      '2222221112222',
      '2222221212222',
      '2222211111222',
      '3333311111333',
      '3333111111133',
    ],
    border: 'warning',
  },
  width: 13,
  height: 5,
  frames: {
    rest: REST,
    lit: LIT,
    wave: put(REST, 4, 3, '^'),
    splash: put(put(REST, 4, 3, '^'), 3, 3, "'"),
    spray: put(REST, 3, 3, "'"),
    beamLeft: BEAM_LEFT,
    beamRight: BEAM_RIGHT,
    dim: put(REST, 1, 7, '.'),
    morse1: morse(1),
    morse2: morse(2),
    morse3: morse(3),
    morse4: morse(4),
    morse5: morse(5),
    morse6: morse(6),
    sent4: sent(4),
    sent2: sent(2),
    open: put(LIT, 1, 5, '-'),
    flare: put(put(BEAM_LEFT, 0, 1, '-.'), 2, 1, "-'"),
    flareRight: put(put(BEAM_RIGHT, 0, 11, '.-'), 2, 11, "'-"),
    off: OFF,
  },
  loops: {
    // The studio's choreographer, seed 24: two flashes, a set of two waves, two flashes.
    idle: [
      ['rest', 26], 'lit', 'rest', 'lit', ['rest', 25], 'wave', 'splash', 'spray', ['rest', 5],
      'wave', 'splash', 'spray', ['rest', 15], 'lit', 'rest', 'lit', ['rest', 13],
    ],
    busy: [['beamLeft', 2], ['lit', 2], ['beamRight', 2], ['dim', 3]],
    ponder: [['morse1', 2], ['morse2', 2], ['morse3', 2], ['morse4', 2], ['morse5', 2], ['morse6', 3], 'sent4', 'sent2', ['rest', 2]],
    talk: ['open', ['beamLeft', 2], 'flare', 'beamLeft', 'flare', ['beamLeft', 2], 'flare', 'beamLeft', 'open', 'rest'],
    sleep: [['off', 10], ['dim', 10]],
    cheer: ['lit', 'beamLeft', ['flare', 2], 'lit', 'beamRight', ['flareRight', 2], 'lit', 'rest', 'lit', 'rest'],
  },
}
