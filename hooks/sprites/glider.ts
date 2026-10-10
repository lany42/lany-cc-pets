// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A Game of Life glider (B3/S23) on a patch of its grid. Each period of four
// generations it creeps one cell down and to the left, toward the bubble, and
// the patch recenters on it.
import type { Sprite } from '../sprite'

export const sprite: Sprite = {
  id: 'glider',
  name: 'Glider',
  persona: 'a Game of Life glider, five cells crawling diagonally across an endless grid',
  color: 'success',
  width: 7,
  height: 4,
  frames: {
    // the four generations, at their true positions on the patch
    gen0: ['. . O .', '. O . .', '. O O O', '. . . .'],
    gen1: ['. . . .', '. O . O', '. O O .', '. . O .'],
    gen2: ['. . . .', '. O . .', '. O . O', '. O O .'],
    gen3: ['. . . .', '. . O .', 'O O . .', '. O O .'],
    // idle: a cell flickers where the next generation will be born
    stir: ['. . O .', '. O . o', '. O O O', '. . . .'],
    // ponder: a question over each cell it is deciding about
    askA: ['. . O .', '. O . ?', '. O O O', '. . . .'],
    askB: ['. . O .', '. O . .', '. O O O', '. . ? .'],
    // talk: the live cells pulse
    bold: ['. . @ .', '. @ . .', '. @ @ @', '. . . .'],
  },
  loops: {
    idle: [
      ['gen0', 16], ['stir', 2], ['gen0', 12],
      ['gen1', 2], ['gen2', 2], ['gen3', 2], ['gen0', 20],
      ['stir', 1], ['gen0', 3], ['stir', 1], ['gen0', 14],
    ],
    busy: [['gen0', 2], ['gen1', 2], ['gen2', 2], ['gen3', 2]],
    ponder: [['askA', 3], ['gen0', 1], ['askB', 3], ['gen0', 1]],
    talk: [['bold', 2], ['gen0', 1], ['bold', 1], ['gen0', 2]],
  },
}
