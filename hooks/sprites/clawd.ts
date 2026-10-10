// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Clawd, after the orange pixel mascot on Claude Code's welcome screen: a
// block of `#` pixels whose eyes are two holes left in it, with stubby arms
// and four little feet. It blinks by drawing a lid across each hole, glances
// at its bubble, and now and then lifts its arms. While Claude works it pumps
// its arms and keeps its eyes on the bubble; while it thinks a little star
// twinkles on its head; and it has no mouth until it has something to say.
// Ligatures: `##` runs join into a more solid body in fonts that ligate them;
// `#_` and `#?` would fuse, so its lids are `-` and it thinks with a star.
import type { Sprite } from '../sprite'

// cols:        0123456789A
const TOP = ' ######### '
const EYES = ' ## ### ## '
const LEFT = ' # ### ### '
const RIGHT = ' ### ### # '
const SHUT = ' ##-###-## '
const GLAD = ' ##^###^## '
const ARMS = '=#########='
const FEET = "  ''   ''  "
/** Clawd with `eyes`, its arm row `arms` (where a mouth opens too) and `top`. */
const clawd = (eyes = EYES, arms = ARMS, top = TOP) => [top, eyes, arms, FEET]

export const sprite: Sprite = {
  id: 'clawd',
  name: 'Clawd',
  persona: 'a small blocky creature made of orange pixels, with two square holes for eyes',
  color: 'claude',
  width: 11,
  height: 4,
  frames: {
    rest: clawd(),
    blink: clawd(SHUT),
    lookLeft: clawd(LEFT),
    lookRight: clawd(RIGHT),
    stretch: clawd(EYES, "'#########'"),
    // busy: arms pumping, one up while the other is down, eyes on the bubble
    pumpLeft: clawd(LEFT, "'#########."),
    pumpRight: clawd(LEFT, ".#########'"),
    // ponder: a star twinkles on its head, and it looks up at it
    twinkleDot: clawd(RIGHT, ARMS, ' #########.'),
    twinklePlus: clawd(RIGHT, ARMS, ' #########+'),
    twinkleStar: clawd(RIGHT, ARMS, ' #########*'),
    // talk: a mouth opens, and a hand goes up toward the bubble
    talkOpen: clawd(EYES, '=####o####='),
    talkWide: clawd(EYES, "'####O####="),
    talkHand: clawd(EYES, "'####o####="),
    talkHandShut: clawd(EYES, "'#########="),
    // sleep: lids down, arms rising and falling with each breath
    doze: clawd(SHUT),
    dozeOut: clawd(SHUT, '-#########-'),
    // cheer: both arms up, happy eyes
    yay: [TOP, '\\##^###^##/', ' ####o#### ', FEET],
    glad: clawd(GLAD, '=####o####='),
  },
  loops: {
    idle: [
      ['rest', 18], 'blink', ['rest', 10], ['lookLeft', 6], ['rest', 14], ['stretch', 2], ['rest', 20],
      'blink', ['rest', 3], 'blink', ['rest', 12], ['lookRight', 4], ['rest', 4],
    ],
    busy: [['pumpLeft', 2], ['pumpRight', 2]],
    ponder: [['twinkleDot', 2], 'twinklePlus', ['twinkleStar', 2], 'twinklePlus'],
    talk: [['talkOpen', 2], 'rest', ['talkWide', 2], 'talkHand', 'talkHandShut', ['talkOpen', 2], ['rest', 3]],
    sleep: [['doze', 10], ['dozeOut', 10]],
    cheer: [['yay', 2], ['glad', 2]],
  },
}
