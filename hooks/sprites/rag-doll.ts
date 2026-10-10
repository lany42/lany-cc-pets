// A rag doll of the old kind: a mop of red yarn, a stitched smile, one button
// eye and an X sewn where the other button was. It sits very still. Its head
// is tilted when you look back, though nobody saw it move; its heart shows
// only when it beats.
import type { Sprite } from '../sprite'

// cols:    01234567890
const HAIR = '  ,%%%%%%, '
const FACE = ' %( @  X )%'
const SMILE = ' %(\\+-+-/)%'
const BODY = '  o/(  )\\o '
// the heart under the dress, and the dress pulled tight when it beats
const HEART = '  o/(<3)\\o '
const THUMP = '  o/{<3}\\o '
// the head tipped toward the bubble: crown and eyes one cell left, the chin where it was
const HAIR_TIPPED = ' ,%%%%%%,  '
const FACE_TIPPED = '%( @  X )% '

export const sprite: Sprite = {
  id: 'rag-doll',
  name: 'Rag Doll',
  persona: 'a rag doll with red yarn hair, one button eye, and an X stitched where the other button was',
  color: 'error',
  width: 11,
  height: 4,
  frames: {
    rest: [HAIR, FACE, SMILE, BODY],
    // idle: the X's stitches turn, a blink only an X can do
    turn: [HAIR, ' %( @  + )%', SMILE, BODY],
    // the button slides along its thread, toward you
    glance: [HAIR, ' %(@   X )%', SMILE, BODY],
    // the head has tipped. nobody saw it go. a thread works loose from the X
    tipped: [HAIR_TIPPED, FACE_TIPPED, SMILE, BODY],
    thread: [HAIR_TIPPED, '%( @  X,)% ', SMILE, BODY],
    // the heart shows through the dress: once in idle, as if something beat;
    // busy: it shows and beats while Claude works, the button watching
    heart: [HAIR, FACE, SMILE, HEART],
    thump: [HAIR, FACE, SMILE, THUMP],
    heartWatch: [HAIR, ' %(@   X )%', SMILE, HEART],
    thumpWatch: [HAIR, ' %(@   X )%', SMILE, THUMP],
    // ponder: a curl of yarn springs loose into a question
    curlIn: ['  ,%%%%%?, ', FACE, SMILE, BODY],
    curlOut: ['  ,%%%%%%,?', FACE, SMILE, BODY],
    // talk: the words come out between the stitches; a wink of the button to close
    talkOpen: [HAIR, FACE, ' %(\\+o+-/)%', BODY],
    talkWide: [HAIR, FACE, ' %(\\+O+-/)%', BODY],
    talkStrain: [HAIR, FACE, ' %(\\+O+o/)%', BODY],
    wink: [HAIR, ' %( -  X )%', SMILE, BODY],
    // sleep: slumped, the button turned edge-on; the heart still beats, slowly
    slump: [HAIR_TIPPED, '%( -  X )% ', SMILE, BODY],
    slumpBeat: [HAIR_TIPPED, '%( -  X )% ', SMILE, HEART],
    // cheer: arms up, heart out, the button squeezed glad
    armsUp: [HAIR, FACE, SMILE, '  \\o(<3)o/ '],
    gladUp: [HAIR, ' %( ^  X )%', SMILE, '  \\o(<3)o/ '],
  },
  loops: {
    idle: [
      ['rest', 20], 'turn', ['rest', 14], ['glance', 8], ['rest', 6], ['tipped', 16], ['thread', 9], ['tipped', 7],
      ['rest', 9], ['heart', 2], ['rest', 4],
    ],
    // a heartbeat every two seconds, lub-dub; between beats the button slides over to watch, and back
    busy: [
      'thump', 'heart', 'thump', ['heart', 3], ['heartWatch', 2],
      'thumpWatch', 'heartWatch', 'thumpWatch', ['heartWatch', 3], ['heart', 2],
    ],
    ponder: [['curlIn', 3], ['curlOut', 3]],
    talk: [
      ['talkOpen', 2], 'talkWide', 'talkOpen', 'rest', 'talkOpen', 'talkStrain', 'talkOpen', 'rest', 'talkOpen', 'rest', 'wink',
    ],
    sleep: [['slump', 14], ['slumpBeat', 6]],
    cheer: [['armsUp', 2], ['heart', 2], ['gladUp', 2], ['heart', 2]],
  },
}
