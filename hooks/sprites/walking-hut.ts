// A hut from the old forest tales, standing on chicken legs. It faces left,
// toward the bubble: lit window in front, door behind, smoke trailing back.
import type { Sprite } from '../sprite'

// cols:   01234567890123
const ROOF = '   /_______\\  '
const WALL = '    |[o] n|   '
const KNEES = '     \\   \\    '
const FEET = '    _/  _/    '
const SMOKE = '    ____[]_ ( '
const DRIFT = '    ____[]_ ) '

export const sprite: Sprite = {
  id: 'walking-hut',
  name: 'Walking Hut',
  persona: 'a little hut on chicken legs that wanders the woods',
  color: 'warning',
  width: 14,
  height: 5,
  frames: {
    rest: [SMOKE, ROOF, WALL, KNEES, FEET],
    drift: [DRIFT, ROOF, WALL, KNEES, FEET],
    blink: [SMOKE, ROOF, '    |[-] n|   ', KNEES, FEET],
    // idle: it rests on one leg for a while, the way birds do
    tuck: [DRIFT, ROOF, WALL, '    _\\   \\    ', '        _/    '],
    // busy: it trots in place, smoke puffing with each step
    stepL: [DRIFT, ROOF, WALL, '    _\\   \\    ', '        _/    '],
    stepR: [DRIFT, ROOF, WALL, '     \\  _\\    ', '    _/        '],
    // ponder: the chimney puffs a question
    puffQ: ['    ____[]_ ? ', ROOF, WALL, KNEES, FEET],
    puffQ2: ['    ____[]_  ?', ROOF, WALL, KNEES, FEET],
    // talk: the door claps open and shut, and the chimney puffs on every word
    doorOpen: [DRIFT, ROOF, '    |[o]  |   ', KNEES, FEET],
  },
  loops: {
    idle: [
      ['rest', 10], ['drift', 6], ['rest', 8], 'blink', ['rest', 7], ['drift', 5],
      ['tuck', 10], ['drift', 3], ['rest', 6], 'blink', ['rest', 2], 'blink', ['rest', 5], ['drift', 7],
    ],
    busy: [['stepL', 2], ['rest', 2], ['stepR', 2], ['rest', 2]],
    ponder: [['puffQ', 3], ['puffQ2', 3]],
    talk: [['doorOpen', 2], 'rest', 'doorOpen', ['rest', 2]],
  },
}
