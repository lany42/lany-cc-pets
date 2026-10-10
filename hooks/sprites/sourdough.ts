// A jar of sourdough starter with a rubber band marking its level. When Claude
// works, it ferments: it rises above the band and churns. Its bubbles sit
// off-center on purpose, so they read as bubbles, not as a face.
import type { Sprite } from '../sprite'

const LID = '  [=====]  '
const EMPTY = '  |     |  '
const LEVEL = ' -|~~~~~|- '
const BUBBLES = '  |.o  .|  '
const BASE = "  '-----'  "

export const sprite: Sprite = {
  id: 'sourdough',
  name: 'Sourdough',
  persona: 'a jar of sourdough starter, kept alive and fed every morning since 1987',
  color: 'warning',
  width: 11,
  height: 5,
  frames: {
    rest: [LID, EMPTY, LEVEL, BUBBLES, BASE],
    // idle: a bubble works its way up and pops, and a new one starts where it was
    riseL: [LID, EMPTY, ' -|~o~~~|- ', '  |.   .|  ', BASE],
    popL: [LID, "  | '   |  ", LEVEL, '  |.   .|  ', BASE],
    seedL: [LID, EMPTY, LEVEL, '  |..  .|  ', BASE],
    // ... and the speck on the right swells and follows it
    swellR: [LID, EMPTY, LEVEL, '  |.o  o|  ', BASE],
    riseR: [LID, EMPTY, ' -|~~~~o|- ', '  |.o   |  ', BASE],
    popR: [LID, "  |    '|  ", LEVEL, '  |.o   |  ', BASE],
    // busy: risen above the band, bubbles climbing up two columns
    risenA: [LID, '  |~~~o~|  ', ' -|.    |- ', '  | o  .|  ', BASE],
    risenB: [LID, '  |~~~.~|  ', ' -|.o   |- ', '  |    .|  ', BASE],
    risenC: [LID, '  |~o~~~|  ', ' -|.    |- ', '  |   o.|  ', BASE],
    risenD: [LID, '  |~.~~~|  ', ' -|.  o |- ', '  |    .|  ', BASE],
    // ponder: one big bubble swells at the surface
    swell: [LID, EMPTY, ' -|~~o~~|- ', BUBBLES, BASE],
    dome: [LID, '  |  _  |  ', ' -|~( )~|- ', BUBBLES, BASE],
    burst: [LID, "  | ' ' |  ", LEVEL, BUBBLES, BASE],
    // talk: it burbles, a bubble swelling and popping at the surface
    talko: [LID, EMPTY, ' -|~~o~~|- ', BUBBLES, BASE],
    talkO: [LID, EMPTY, ' -|~~O~~|- ', BUBBLES, BASE],
    talkPop: [LID, "  |  '  |  ", LEVEL, BUBBLES, BASE],
  },
  loops: {
    idle: [
      ['rest', 30], ['riseL', 3], ['popL', 1], ['seedL', 6], ['rest', 18],
      ['swellR', 4], ['riseR', 2], ['popR', 1], ['rest', 16],
    ],
    busy: [['risenA', 2], ['risenB', 1], ['risenC', 2], ['risenD', 1]],
    ponder: [['swell', 3], ['dome', 4], ['burst', 1], ['rest', 3]],
    talk: [['talko', 1], ['talkO', 2], ['talkPop', 1], ['talkO', 1], ['talkPop', 1]],
  },
}
