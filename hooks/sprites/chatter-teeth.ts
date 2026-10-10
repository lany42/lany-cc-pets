// Wind-up chattering teeth: a big pink grin on two little feet, with a key
// in the side. At rest the jaw is shut and the key ticks round now and then.
// While Claude works it marches in place, lifting one foot then the other as
// the key spins; while it thinks a "?" bobs over the key; when it talks the
// upper jaw clacks open and shut.
import type { Sprite } from '../sprite'

const GUM = '  .-------.  '
const UPPER = '  (VVVVVVV)  '
const LOWER = '  (AAAAAAA)=8'
const LOWER_TURNED = '  (AAAAAAA)=|'
const FEET = " (_'-----'_) "

export const sprite: Sprite = {
  id: 'chatter-teeth',
  name: 'Chattering Teeth',
  persona: 'a pair of wind-up chattering teeth from a joke shop',
  color: 'error',
  width: 13,
  height: 4,
  frames: {
    shut: [GUM, UPPER, LOWER, FEET],
    turned: [GUM, UPPER, LOWER_TURNED, FEET],
    glint: [GUM, '  (VVVVV*V)  ', LOWER, FEET],
    open: ['  .VVVVVVV.  ', '  (       )  ', LOWER, FEET],
    // busy: a sole leaves the ground (_ to -) while the key turns edge-on
    liftLeft: [GUM, UPPER, LOWER_TURNED, " (-'-----'_) "],
    liftRight: [GUM, UPPER, LOWER_TURNED, " (_'-----'-) "],
    wonder: ['  .-------. ?', UPPER, LOWER, FEET],
  },
  loops: {
    idle: [
      ['shut', 14], ['glint', 2], ['shut', 10], 'turned', 'shut', 'turned', ['shut', 8], 'open', ['shut', 10],
    ],
    busy: [['liftLeft', 2], 'shut', ['liftRight', 2], 'shut'],
    ponder: [['wonder', 3], ['shut', 2]],
    talk: [['open', 1], ['shut', 1], ['open', 2], ['shut', 1], ['open', 1], ['shut', 2]],
  },
}
