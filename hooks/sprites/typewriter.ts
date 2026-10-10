// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A portable typewriter: a sheet of paper over the platen, a bank of round
// keys. While Claude works the keys clatter and the typebars strike; while it
// thinks it types an ellipsis; when it talks it types out a line and dings.
import type { Sprite } from '../sprite'

const PLATEN = 'o=[=========]=o'
const STRIKE = 'o=[====|====]=o'
const KEYS = '  /ooooooooo\\  '
const BASE = ' /___________\\ '

/** The sheet showing `text` (up to 7 cells) on its current line. */
const paper = (text: string) => `   |${text.padEnd(7)}|   `
/** The key bank with the key at `index` (0-8) pressed down. */
const press = (index: number) => `  /${'o'.repeat(index)}.${'o'.repeat(8 - index)}\\  `

const LINE = paper('~~~ ~~')

export const sprite: Sprite = {
  id: 'typewriter',
  name: 'Typewriter',
  persona: 'a mint-green portable typewriter that has typed four unfinished novels',
  color: 'planMode',
  width: 15,
  height: 4,
  frames: {
    rest: [LINE, PLATEN, KEYS, BASE],
    twitch: [LINE, PLATEN, press(6), BASE],
    curl: ['   |~~~ ~~ )   ', PLATEN, KEYS, BASE],

    clackA: [LINE, STRIKE, press(2), BASE],
    clackB: [LINE, PLATEN, press(7), BASE],
    clackC: [LINE, STRIKE, press(4), BASE],
    clackD: [LINE, PLATEN, press(1), BASE],

    dot1: [paper('.'), STRIKE, press(8), BASE],
    dot1rest: [paper('.'), PLATEN, KEYS, BASE],
    dot2: [paper('..'), STRIKE, press(8), BASE],
    dot2rest: [paper('..'), PLATEN, KEYS, BASE],
    dot3: [paper('...'), STRIKE, press(8), BASE],
    dot3rest: [paper('...'), PLATEN, KEYS, BASE],

    type1: [paper('~'), STRIKE, press(3), BASE],
    type2: [paper('~~'), STRIKE, press(6), BASE],
    type3: [paper('~~~'), STRIKE, press(1), BASE],
    type4: [paper('~~~ '), PLATEN, KEYS, BASE],
    type5: [paper('~~~ ~'), STRIKE, press(5), BASE],
    type6: [paper('~~~ ~~'), STRIKE, press(2), BASE],
    type7: [paper('~~~ ~~~'), STRIKE, press(7), BASE],
    ding: [paper('~~~ ~~~'), 'o=[=========]=*', KEYS, BASE],
    done: [paper('~~~ ~~~'), PLATEN, KEYS, BASE],
  },
  loops: {
    idle: [
      ['rest', 16], 'twitch', ['rest', 11], ['curl', 3], ['rest', 9], 'twitch', ['rest', 2], 'twitch', ['rest', 7],
    ],
    busy: ['clackA', 'clackB', 'clackC', 'clackD', 'clackB', 'clackA', ['rest', 2]],
    ponder: [['dot1', 1], ['dot1rest', 2], ['dot2', 1], ['dot2rest', 2], ['dot3', 1], ['dot3rest', 5]],
    talk: ['type1', 'type2', 'type3', 'type4', 'type5', 'type6', 'type7', ['ding', 2], ['done', 3]],
  },
}
