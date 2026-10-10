// The default look (DEFAULT_SPRITE in index.ts). The format is the `Sprite`
// type of ../sprite.ts.
import type { Sprite } from '../sprite'

const EARS = '  /\\_/\\  '
const NOSE = '  > ^ <  '

export const sprite: Sprite = {
  id: 'cat',
  name: 'Cat',
  persona: 'a tiny ASCII cat who naps in the warm glow of the screen',
  color: 'claude',
  width: 9,
  height: 3,
  frames: {
    open: [EARS, ' ( o.o ) ', NOSE],
    blink: [EARS, ' ( -.- ) ', NOSE],
    lookLeft: [EARS, ' (o.o  ) ', NOSE],
    lookRight: [EARS, ' (  o.o) ', NOSE],
    ponderA: ['  /\\_/\\ ?', ' ( o.o ) ', NOSE],
    ponderB: [EARS, ' ( o.o ) ', NOSE],
    talkOpen: [EARS, ' ( ^.^ ) ', '  > o <  '],
    talkShut: [EARS, ' ( ^.^ ) ', NOSE],
    doze: [EARS, ' ( -_- ) ', NOSE],
    glad: [EARS, ' ( ^o^ ) ', NOSE],
  },
  loops: {
    idle: [['open', 12], 'blink', ['open', 8], ['lookLeft', 4], ['open', 2], ['lookRight', 4], ['open', 3]],
    // busy: reading along as Claude writes, left to right, then a snap back to the next line
    busy: [['lookLeft', 2], ['open', 2], ['lookRight', 2], ['lookLeft', 2], ['open', 2], ['lookRight', 3], 'blink'],
    ponder: [['ponderA', 2], ['ponderB', 2]],
    talk: [['talkOpen', 2], ['talkShut', 2]],
    sleep: [['blink', 10], ['doze', 10]],
    cheer: [['glad', 2], ['talkShut', 2]],
  },
}
