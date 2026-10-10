// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// An iceberg in cross-section: a small tip above the waterline, the bulk below.
import type { Sprite } from '../sprite'

const TIP = '       /\\      '
const WATER = '~~~~~~/  \\~~~~~'
const UPPER = "     /    `-.  "
const MIDDLE = '    (        ) '
const BASE = "     `--.___.' "

export const sprite: Sprite = {
  id: 'iceberg',
  name: 'Iceberg',
  persona: 'an iceberg adrift, with nine-tenths of itself below the waterline',
  color: { kind: 'shiny', color: 'suggestion', shine: 'text' },
  width: 15,
  height: 5,
  frames: {
    rest: [TIP, WATER, UPPER, MIDDLE, BASE],
    // idle: sun glints off the tip
    glint: ['       /\\ *    ', WATER, UPPER, MIDDLE, BASE],
    glintFade: ['       /\\ .    ', WATER, UPPER, MIDDLE, BASE],
    // idle: a lone swell rolls past
    swellA: [TIP, '~~^~~~/  \\~~~~~', UPPER, MIDDLE, BASE],
    swellB: [TIP, '~~~~^~/  \\~~~~~', UPPER, MIDDLE, BASE],
    swellC: [TIP, '~~~~~~/  \\~^~~~', UPPER, MIDDLE, BASE],
    swellD: [TIP, '~~~~~~/  \\~~~^~', UPPER, MIDDLE, BASE],
    // busy: drifting, the water streams past
    driftA: [TIP, '~-~~~-/  \\~-~~~', UPPER, MIDDLE, BASE],
    driftB: [TIP, '~~-~~~/  \\~~-~~', UPPER, MIDDLE, BASE],
    driftC: [TIP, '~~~-~~/  \\~~~-~', UPPER, MIDDLE, BASE],
    driftD: [TIP, '-~~~-~/  \\-~~~-', UPPER, MIDDLE, BASE],
    // ponder: a bubble of ancient air works loose and rises
    bubbleDeep: [TIP, WATER, UPPER, MIDDLE, "  .  `--.___.' "],
    bubbleMid: [TIP, WATER, UPPER, '  o (        ) ', BASE],
    bubbleHigh: [TIP, WATER, '   O /    `-.  ', MIDDLE, BASE],
    bubbleSurface: [TIP, '~~~O~~/  \\~~~~~', UPPER, MIDDLE, BASE],
    bubblePop: ['   \'   /\\      ', WATER, UPPER, MIDDLE, BASE],
    // talk: rings spread out from the berg
    ringA: [TIP, '~~~~~(/  \\)~~~~', UPPER, MIDDLE, BASE],
    ringB: [TIP, '~~~~(~/  \\~)~~~', UPPER, MIDDLE, BASE],
    ringC: [TIP, '~~~(~~/  \\~~)~~', UPPER, MIDDLE, BASE],
  },
  loops: {
    idle: [
      ['rest', 28], ['glint', 2], ['glintFade', 1], ['rest', 22],
      ['swellA', 2], ['swellB', 2], ['rest', 2], ['swellC', 2], ['swellD', 2], ['rest', 14],
    ],
    busy: [['driftA', 2], ['driftB', 2], ['driftC', 2], ['driftD', 2]],
    ponder: [['bubbleDeep', 2], ['bubbleMid', 2], ['bubbleHigh', 2], ['bubbleSurface', 1], ['bubblePop', 1], ['rest', 3]],
    talk: [['ringA', 1], ['ringB', 1], ['ringC', 1], ['rest', 1]],
  },
}
