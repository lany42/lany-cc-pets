// A baby axolotl, all frilly gills and permanent smile. Its gills ripple on
// their own; when it gets excited, they flutter like little flags.
import type { Sprite } from '../sprite'

// cols:   01234567890
const TOP = '\\\\.-----.//'
const BOT = "//'-----'\\\\"

export const sprite: Sprite = {
  id: 'axolotl',
  name: 'Axolotl',
  persona: 'a baby axolotl with feathery gills and a smile it was born with',
  color: 'claude',
  width: 11,
  height: 3,
  frames: {
    rest: [TOP, '=( o w o )=', BOT],
    blink: [TOP, '=( - w - )=', BOT],
    rippleL: [TOP, '~( o w o )=', BOT],
    rippleR: [TOP, '=( o w o )~', BOT],
    happy: [TOP, '=( ^ w ^ )=', BOT],
    blush: [TOP, '=(*^ w ^*)=', BOT],
    yawn: [TOP, '=( - o - )=', BOT],
    yawnBig: [TOP, '=( - O - )=', BOT],
    // busy: starry-eyed, gills flapping like it's cheering you on
    cheerA: [TOP, '~( * w * )=', BOT],
    cheerB: [TOP, '=( * w * )~', BOT],
    cheerC: ['\\\\.-----.\\\\', '=( * w * )=', BOT],
    cheerD: [TOP, '=( * w * )=', "//'-----'//"],
    // ponder: one gill curls into a question as its head tilts back and forth
    tiltA: ['\\\\.-----./?', '=( o . O )=', BOT],
    tiltB: [TOP, '=( O . o )=', BOT],
    // talk
    talkO: [TOP, '=( ^ o ^ )=', BOT],
    talkW: [TOP, '=( ^ w ^ )=', BOT],
    talkBig: [TOP, '~( ^ O ^ )~', BOT],
  },
  loops: {
    idle: [
      ['rest', 10], 'rippleL', 'rest', 'rippleR', ['rest', 9], 'blink', ['rest', 7],
      ['happy', 3], ['blush', 4], ['happy', 2], ['rest', 8], 'rippleR', 'rest', 'rippleL',
      ['rest', 6], ['yawn', 1], ['yawnBig', 3], ['yawn', 1], ['blink', 2], ['rest', 6],
    ],
    busy: [['cheerA', 2], ['cheerC', 1], ['cheerB', 2], ['cheerD', 1]],
    ponder: [['tiltA', 3], ['tiltB', 2]],
    talk: [['talkO', 2], 'talkW', ['talkBig', 1], ['talkW', 1], ['talkO', 1], ['talkW', 2]],
  },
}
