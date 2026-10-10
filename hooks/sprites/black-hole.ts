// A pocket black hole: an empty void ringed by bent light, with its accretion
// disk running out either side. Stray characters drift in and are gone.
import type { Sprite } from '../sprite'

// cols:  0123456789012345
const TOP = '    .-~~~~-.    '
const MID = ' ~-=(      )=-~ '
const BOT = "    '-~~~~-'    "

export const sprite: Sprite = {
  id: 'black-hole',
  name: 'Black Hole',
  persona: 'a pocket-sized black hole that slurps up stray characters',
  color: 'autoAccept',
  width: 16,
  height: 3,
  frames: {
    rest: [TOP, MID, BOT],
    rippleTop: ['    .-~-~~-.    ', MID, BOT],
    rippleBot: [TOP, MID, "    '-~~-~-'    "],
    // idle: a lone star wanders too close, speeds up, and is swallowed
    star1: [' *  .-~~~~-.    ', MID, BOT],
    star2: ['   +.-~~~~-.    ', MID, BOT],
    star3: [TOP, ' ~-=(.     )=-~ ', BOT],
    star4: [TOP, ' ~-=(  .   )=-~ ', BOT],
    burp: [TOP, ' ~-*(      )=-~ ', BOT],
    // busy: spare characters from the work get pulled in from both sides
    a1: [' {  .-~~~~-.    ', MID, BOT],
    a2: ['   {.-~~~~-.    ', MID, "    '-~~~~-'  ; "],
    a3: [TOP, ' ~-=( {    )=-~ ', "    '-~~~~-';   "],
    a4: [TOP, ' ~-=(    ; )=-~ ', BOT],
    b1: [TOP, MID, " $  '-~~~~-'    "],
    b2: ['    .-~~~~-.  % ', MID, "   $'-~~~~-'    "],
    b3: ['    .-~~~~-.%   ', ' ~-=( $    )=-~ ', BOT],
    b4: [TOP, ' ~-=(    % )=-~ ', BOT],
    // ponder: a question teeters on the edge
    q1: ['  ? .-~~~~-.    ', MID, BOT],
    q2: ['   ?.-~~~~-.    ', MID, BOT],
    // talk: sparks of radiation fizz off the horizon, the only thing that escapes
    spark1: ["   '.-~~~~-.    ", MID, "    '-~~~~-'.   "],
    spark2: ['    .-~~~~-.`   ', MID, "   ,'-~~~~-'    "],
  },
  loops: {
    idle: [
      ['rest', 14], 'rippleTop', ['rest', 10], 'rippleBot', ['rest', 9],
      ['star1', 3], ['star2', 2], 'star3', 'star4', ['rest', 2], 'burp', ['rest', 16],
    ],
    busy: [['a1', 2], 'a2', 'a3', 'a4', ['rest', 2], ['b1', 2], 'b2', 'b3', 'b4', ['rest', 2]],
    ponder: [['q1', 3], ['q2', 2], ['q1', 2], ['q2', 3]],
    talk: [['spark1', 2], 'rest', ['spark2', 2], 'rest'],
  },
}
