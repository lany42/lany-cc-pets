// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A pop-up toaster. Two slices peek out of the slots at rest. While Claude
// works the lever goes down and heat wavers off the slots; while it thinks a
// wisp of smoke curls into a question mark; when it talks the slices hop.
import type { Sprite } from '../sprite'

const TOAST_UP = '   .--. .--.   '
const SLOTS_UP = ' .-|  |-|  |-. '
const SLOTS_DOWN = ' .-|__|-|__|-. '
const FACE = ' |  o     o  |='
const FACE_LEVER_DOWN = ' |  o     o  | '
const BLINK_LEVER_DOWN = ' |  -     -  | '
const HAPPY = ' |  ^     ^  |='
const BASE = " '-----------' "
const BASE_LEVER_DOWN = " '-----------'="

// busy: one wisp of heat over each slot, wavering out of step with the other
const HEAT_A = '    ~     ~    '
const HEAT_B = '     ~    ~    '
const HEAT_C = '     ~   ~     '
const HEAT_D = '    ~    ~     '

export const sprite: Sprite = {
  id: 'toaster',
  name: 'Toaster',
  persona: 'a dented chrome pop-up toaster that runs a little hot',
  color: 'claude',
  width: 15,
  height: 4,
  frames: {
    rest: [TOAST_UP, SLOTS_UP, FACE, BASE],
    blink: [TOAST_UP, SLOTS_UP, ' |  -     -  |=', BASE],
    lookLeft: [TOAST_UP, SLOTS_UP, ' | o     o   |=', BASE],
    shine: [TOAST_UP, ' *-|  |-|  |-. ', FACE, BASE],
    heatA: [HEAT_A, SLOTS_DOWN, FACE_LEVER_DOWN, BASE_LEVER_DOWN],
    heatB: [HEAT_B, SLOTS_DOWN, FACE_LEVER_DOWN, BASE_LEVER_DOWN],
    heatC: [HEAT_C, SLOTS_DOWN, FACE_LEVER_DOWN, BASE_LEVER_DOWN],
    heatCBlink: [HEAT_C, SLOTS_DOWN, BLINK_LEVER_DOWN, BASE_LEVER_DOWN],
    heatD: [HEAT_D, SLOTS_DOWN, FACE_LEVER_DOWN, BASE_LEVER_DOWN],
    smokeA: ['    ?          ', SLOTS_DOWN, FACE_LEVER_DOWN, BASE_LEVER_DOWN],
    smokeB: ['     ?         ', SLOTS_DOWN, FACE_LEVER_DOWN, BASE_LEVER_DOWN],
    popped: [TOAST_UP, SLOTS_UP, HAPPY, BASE],
    dipLeft: ['        .--.   ', ' .-|__|-|  |-. ', HAPPY, BASE],
    dipRight: ['   .--.        ', ' .-|  |-|__|-. ', HAPPY, BASE],
  },
  loops: {
    idle: [
      ['rest', 14], 'blink', ['rest', 9], ['lookLeft', 5], ['rest', 3],
      'blink', ['rest', 8], ['shine', 2], ['rest', 6],
    ],
    busy: [
      ['heatA', 2], 'heatB', ['heatC', 2], 'heatD',
      ['heatA', 2], 'heatB', 'heatC', 'heatCBlink', 'heatC', 'heatD',
    ],
    ponder: [['smokeA', 3], ['smokeB', 3]],
    talk: [['popped', 2], ['dipLeft', 2], ['popped', 2], ['dipRight', 2]],
  },
}
