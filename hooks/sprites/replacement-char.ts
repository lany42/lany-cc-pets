// U+FFFD, the replacement character: the diamond-boxed question mark that
// shows up wherever a byte couldn't be decoded.
import type { Sprite } from '../sprite'

const TOP = '  / \\  '
const BOT = '  \\ /  '
const box = (inner: string) => [TOP, ` <${inner}> `, BOT]

export const sprite: Sprite = {
  id: 'replacement-char',
  name: 'Replacement Character',
  persona: 'U+FFFD, the replacement character, standing in for a byte nobody could decode',
  color: 'text',
  width: 7,
  height: 3,
  frames: {
    rest: box(' ? '),
    // idle: a flicker of whatever it used to be
    glitch: box(' # '),
    memory: box(' e '),
    // busy: it spins like a coin (idle borrows `narrow` for a flinch)
    edgeOn: ['   |   ', '   |   ', '   |   '],
    narrow: ['   ^   ', '  <?>  ', '   v   '],
    narrowBack: ['   ^   ', '  < >  ', '   v   '],
    back: box('   '),
    // ponder: dots fill the box
    dot1: box('.  '),
    dot2: box('.. '),
    dot3: box('...'),
    // talk: it speaks in garbled bytes
    sayA: box(' & '),
    sayB: box(' % '),
    sayC: box(' ! '),
  },
  loops: {
    idle: [
      ['rest', 18], 'glitch', ['rest', 14], ['memory', 2], ['rest', 16],
      'narrow', ['rest', 10], 'glitch', 'rest', 'glitch', ['rest', 12],
    ],
    busy: [['rest', 2], 'narrow', 'edgeOn', 'narrowBack', ['back', 2], 'narrowBack', 'edgeOn', 'narrow'],
    ponder: [['dot1', 2], ['dot2', 2], ['dot3', 3], ['rest', 1]],
    talk: [['sayA', 1], ['rest', 1], ['sayB', 1], ['rest', 2], ['sayC', 1], ['rest', 1]],
  },
}
