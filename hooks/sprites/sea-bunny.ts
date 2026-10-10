// A sea bunny (Jorunna parva): a sea slug that is, by accident, a perfect
// little rabbit. Two stubby ears, a fuzzy back, a gill tuft for a tail, and a
// slug's foot that ripples as it glides along.
import type { Sprite } from '../sprite'

// cols:    012345678901
const BACK = '  n n.-~-.  '
const BODY = ' (.w.):.:.)*'
const FOOT = "  '~~~~~~~' "

export const sprite: Sprite = {
  id: 'sea-bunny',
  name: 'Sea Bunny',
  persona: 'a sea bunny, a fingernail-sized sea slug that looks exactly like a fluffy rabbit',
  // nudibranchs are the rainbow of the sea; this one is the sweetest of them
  color: { kind: 'rainbow', ticks: 3 },
  width: 12,
  height: 3,
  frames: {
    rest: [BACK, BODY, FOOT],
    blink: [BACK, ' (-w-):.:.)*', FOOT],
    tuft: [BACK, ' (.w.):.:.)+', FOOT],
    earFlop: ['  n ^.-~-.  ', BODY, FOOT],
    // idle: it glides, a ripple running down its foot
    glide1: [BACK, BODY, "  '-~~~~~~' "],
    glide2: [BACK, BODY, "  '~~~-~~~' "],
    glide3: [BACK, BODY, "  '~~~~~-~' "],
    happy: [BACK, ' (^w^):.:.)*', FOOT],
    blush: [BACK, '*(^w^):.:.)*', FOOT],
    bubble: ['  n n.-~-.  ', ' (.o.):.:.)*', FOOT],
    bubbleUp: ['o n n.-~-.  ', ' (.w.):.:.)*', FOOT],
    // busy: ears perked and wiggling, tuft fluttering
    perkA: ['  n n.-~-.! ', ' (owo):.:.)*', FOOT],
    perkB: ['  ^ n.-~-.! ', ' (owo):.:.)+', FOOT],
    perkC: ['  n ^.-~-.  ', ' (owo):.:.)*', FOOT],
    // ponder: one ear bends into a question
    huhA: ['  n ?.-~-.  ', BODY, FOOT],
    huhB: ['  n n.-~-.? ', ' (.~.):.:.)*', FOOT],
    // talk
    talkOpen: [BACK, ' (^o^):.:.)*', FOOT],
    talkShut: [BACK, ' (^w^):.:.)*', FOOT],
    talkWide: ['  ^ ^.-~-.  ', ' (^O^):.:.)*', FOOT],
  },
  loops: {
    idle: [
      ['rest', 8], ['tuft', 2], ['rest', 6], 'glide1', 'glide2', 'glide3', ['rest', 6], 'blink', ['rest', 7],
      ['earFlop', 3], ['rest', 6], ['tuft', 2], ['rest', 4], ['bubble', 2], ['bubbleUp', 2], ['rest', 5],
      'glide1', 'glide2', 'glide3', ['rest', 3], ['happy', 3], ['blush', 4], ['happy', 2], ['rest', 6],
    ],
    busy: [['perkA', 2], ['perkB', 1], ['perkA', 1], ['perkC', 2]],
    ponder: [['huhA', 3], ['huhB', 3]],
    talk: [['talkOpen', 2], 'talkShut', 'talkWide', 'talkShut', ['talkOpen', 1], ['talkShut', 2]],
  },
}
