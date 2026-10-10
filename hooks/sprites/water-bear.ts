// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A tardigrade: a pudgy, eight-legged speck with a round little tube of a
// mouth. Its stubby legs paddle at nothing; now and then it tucks them in,
// dries into a barrel and naps through the end of the world.
import type { Sprite } from '../sprite'

// cols:   01234567890
const HEAD = "  .-'''-.  "
const FACE = 'm( . o . )m'
const BELLY = 'm(  ~ ~  )m'
const FEET = " m'-----'m "
// legs tucked away, one pair at a time
const BELLY_IN = '.(  ~ ~  ).'
const FEET_IN = " .'-----'. "

export const sprite: Sprite = {
  id: 'water-bear',
  name: 'Water Bear',
  persona: 'a microscopic water bear, pudgy, eight-legged and very hard to kill',
  color: 'planMode',
  width: 11,
  height: 4,
  frames: {
    rest: [HEAD, FACE, BELLY, FEET],
    blink: [HEAD, 'm( - o - )m', BELLY, FEET],
    paddleL: [HEAD, FACE, 'n(  ~ ~  )m', FEET],
    paddleR: [HEAD, FACE, 'm(  ~ ~  )n', FEET],
    happy: [HEAD, 'm( ^ o ^ )m', BELLY, FEET],
    blush: [HEAD, 'm(*^ o ^*)m', BELLY, FEET],
    // idle: it tucks in its legs pair by pair, curls into a tun and naps
    tuck1: [HEAD, 'm( - o - )m', BELLY, FEET_IN],
    tuck2: [HEAD, 'm( - o - )m', BELLY_IN, FEET_IN],
    tuck3: [HEAD, '.( - o - ).', BELLY_IN, FEET_IN],
    tunZ: ["  .-'''-.z ", '.( - . - ).', BELLY_IN, FEET_IN],
    tunZZ: ["  .-'''-.Z ", '.( - . - ).', BELLY_IN, FEET_IN],
    tunZz: ["  .-'''-. z", '.( - . - ).', BELLY_IN, FEET_IN],
    // busy: front legs up, cheering for you
    cheerUp: [HEAD, '\\( ^ o ^ )/', BELLY, FEET],
    cheerYay: ["  .-'''-.! ", '\\( ^ O ^ )/', BELLY, FEET],
    cheerDown: [HEAD, 'm( ^ o ^ )m', BELLY, FEET],
    // ponder
    huhA: ["  .-'''-.? ", FACE, BELLY, FEET],
    huhB: ["  .-'''-. ?", 'm( . ~ . )m', BELLY, FEET],
    // talk: the little tube mouth puckers open and shut
    talkO: [HEAD, 'm( ^ O ^ )m', BELLY, FEET],
    talko: [HEAD, 'm( ^ o ^ )m', BELLY, FEET],
    talkDot: [HEAD, 'm( ^ . ^ )m', BELLY, FEET],
  },
  loops: {
    idle: [
      ['rest', 10], 'paddleL', 'rest', 'paddleR', 'rest', 'paddleL', ['rest', 8], 'blink', ['rest', 4], ['happy', 2], ['blush', 4], ['happy', 1], ['rest', 4],
      ['blink', 2], ['tuck1', 2], ['tuck2', 2], ['tuck3', 3], ['tunZ', 4], ['tunZZ', 3], ['tunZz', 3], ['tunZ', 2],
      ['tuck3', 2], 'tuck2', 'tuck1', ['blink', 1], ['rest', 5], 'paddleR', 'rest', 'paddleR', ['rest', 6],
    ],
    busy: [['cheerUp', 2], ['cheerYay', 1], ['cheerUp', 1], ['cheerDown', 2]],
    ponder: [['huhA', 3], ['huhB', 3]],
    talk: [['talkO', 2], 'talkDot', 'talko', 'talkO', ['talkDot', 2], ['talko', 1]],
  },
}
