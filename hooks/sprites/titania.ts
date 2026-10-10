// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Titania, an ocean liner of the grand old steamship era, bow to the left:
// toward her bubble, and in the gallery toward the iceberg beside her. Four
// funnels stand on her deckhouse, a lookout's mast at the bow, a row of lit
// portholes, and the sea under her keel. Only three funnels ever puff: the
// fourth is just for show, as on the great liners.
import type { Sprite } from '../sprite'

const MAST = ' +   |  |  |  | '
const DECKHOUSE = ' |  _|__|__|__|_'
const DECK = '_|__|__________|'
const HULL = '\\ o o o o o o o/'
const SEA = '~~~~~~~~~~~~~~~~'
// busy: smoke trailing from the three working funnels; the fourth never smokes
const STEAM = ' +   |~ |~ |~ | '

export const sprite: Sprite = {
  id: 'titania',
  name: 'Titania',
  persona: 'Titania, a grand four-funneled ocean liner of the steamship era, billed as unsinkable',
  color: 'warning',
  width: 16,
  height: 5,
  frames: {
    rest: [MAST, DECKHOUSE, DECK, HULL, SEA],
    // idle: a lazy wisp from the first funnel, a cabin light out and on again, a swell
    wispLow: [' +   |. |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    wispHigh: [" +   | '|  |  | ", DECKHOUSE, DECK, HULL, SEA],
    cabinDark: [MAST, DECKHOUSE, DECK, '\\ o o o o . o o/', SEA],
    swellA: [MAST, DECKHOUSE, DECK, HULL, '~~^~~~~~~~~~~~~~'],
    swellB: [MAST, DECKHOUSE, DECK, HULL, '~~~~~~^~~~~~~~~~'],
    swellC: [MAST, DECKHOUSE, DECK, HULL, '~~~~~~~~~~^~~~~~'],
    swellD: [MAST, DECKHOUSE, DECK, HULL, '~~~~~~~~~~~~~~^~'],
    // busy: full steam, a puff chuffing from each working funnel in turn, the
    // sea streaming past from bow to stern
    steamA: [STEAM, DECKHOUSE, DECK, HULL, '-~~~~~~~~~~~~~~~'],
    steamB: [" +   |~'|~ |~ | ", DECKHOUSE, DECK, HULL, '~~-~~~~~~~~~~~~~'],
    steamC: [STEAM, DECKHOUSE, DECK, HULL, '~~~~-~~~~~~~~~~~'],
    steamD: [" +   |~ |~'|~ | ", DECKHOUSE, DECK, HULL, '~~~~~~-~~~~~~~~~'],
    steamE: [STEAM, DECKHOUSE, DECK, HULL, '~~~~~~~~-~~~~~~~'],
    steamF: [" +   |~ |~ |~'| ", DECKHOUSE, DECK, HULL, '~~~~~~~~~~-~~~~~'],
    steamG: [STEAM, DECKHOUSE, DECK, HULL, '~~~~~~~~~~~~-~~~'],
    steamH: [STEAM, DECKHOUSE, DECK, HULL, '~~~~~~~~~~~~~~-~'],
    // ponder: the wireless at the masthead taps out dots
    dit: [' +.  |  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    ditDit: [' +.. |  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    ditDitDit: [' +...|  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    // talk: the whistle on the first funnel blows, and the sound rolls off toward her bubble
    whistle: [' +  "|  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    blastNear: [' + ("|  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    blastFar: [' +( "|  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    echo: [' +(  |  |  |  | ', DECKHOUSE, DECK, HULL, SEA],
    // sleep: most cabins dark, the banked fires breathing a wisp
    night: [MAST, DECKHOUSE, DECK, '\\ . . . . . o ./', SEA],
    nightWisp: [' +   |. |  |  | ', DECKHOUSE, DECK, '\\ . . . . . o ./', SEA],
    // cheer: a salute, two quick toots under a full head of steam
    fullSteam: [STEAM, DECKHOUSE, DECK, HULL, SEA],
    toot: [' +  "|~ |~ |~ | ', DECKHOUSE, DECK, HULL, SEA],
    tootCall: [' + ("|~ |~ |~ | ', DECKHOUSE, DECK, HULL, SEA],
  },
  loops: {
    idle: [
      ['rest', 26], ['wispLow', 2], ['wispHigh', 2], ['rest', 20], ['cabinDark', 12], ['rest', 8],
      ['swellA', 2], ['swellB', 2], ['swellC', 2], ['swellD', 2], ['rest', 14],
    ],
    busy: [
      ['steamA', 2], ['steamB', 2], ['steamC', 2], ['steamD', 2],
      ['steamE', 2], ['steamF', 2], ['steamG', 2], ['steamH', 2],
    ],
    ponder: [['dit', 2], ['ditDit', 2], ['ditDitDit', 3], ['rest', 2]],
    talk: [
      'whistle', 'blastNear', 'blastFar', 'echo', ['rest', 2],
      'whistle', 'blastNear', 'blastFar', 'echo', ['rest', 2],
    ],
    sleep: [['night', 10], ['nightWisp', 10]],
    cheer: ['toot', 'tootCall', 'fullSteam', 'toot', 'tootCall', ['fullSteam', 3]],
  },
}
