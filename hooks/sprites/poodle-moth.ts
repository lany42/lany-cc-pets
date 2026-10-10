// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// A Venezuelan poodle moth: a puff of white fluff with two feathery antennae
// and enormous dark eyes. It is very drawn to the glow of your screen.
import type { Sprite } from '../sprite'

// cols:     0123456789012
const TOP = ' _  \\E 3/  _ '
const LOWER = " '-.{~~~}.-' "
// wings: open, and the beat where the tips lift
const UP = ' .  \\E 3/  . '

export const sprite: Sprite = {
  id: 'poodle-moth',
  name: 'Poodle Moth',
  persona: 'a fluffy white poodle moth who mistakes the monitor for the moon',
  color: 'text',
  width: 13,
  height: 3,
  frames: {
    rest: [TOP, "( '.{o.o}.' )", LOWER],
    blink: [TOP, "( '.{-.-}.' )", LOWER],
    twitch: [' _  \\E 3|  _ ', "( '.{o.o}.' )", LOWER],
    flapL: [' .  \\E 3/  _ ', "( '.{o.o}.' )", LOWER],
    flapR: [' _  \\E 3/  . ', "( '.{o.o}.' )", LOWER],
    // idle: the glow catches its eye
    glow: ['*_  \\E 3/  _ ', "( '.{o.o}.' )", LOWER],
    starry: ['*_  \\E 3/  _ ', "( '.{*.*}.' )", LOWER],
    starryBeat: ['*.  \\E 3/  . ', "( '.{*.*}.' )", LOWER],
    content: [TOP, "( '.{^.^}.' )", LOWER],
    // busy: fluttering at the light of your work
    beatA: [TOP, "( '.{*.*}.' )", LOWER],
    beatB: [UP, "( '.{*.*}.' )", LOWER],
    beatC: [TOP, "( '.{*.*}.' )", " ',.{~~~}.,' "],
    // ponder: one antenna curls up
    huhA: [' _  \\E ?/  _ ', "( '.{o.o}.' )", LOWER],
    huhB: [' _  \\E 3/ ?_ ', "( '.{o.O}.' )", LOWER],
    // talk
    talkOpen: [TOP, "( '.{^o^}.' )", LOWER],
    talkShut: [TOP, "( '.{^.^}.' )", LOWER],
    talkFlap: [UP, "( '.{^o^}.' )", LOWER],
  },
  loops: {
    idle: [
      ['rest', 10], 'blink', ['rest', 6], 'twitch', 'rest', 'twitch', ['rest', 8], 'flapL', 'rest', 'flapR', ['rest', 6],
      ['glow', 3], ['starry', 4], 'starryBeat', 'starry', 'starryBeat', ['starry', 3], ['content', 4],
      ['rest', 8], 'blink', ['rest', 4], 'twitch', ['rest', 5],
    ],
    busy: [['beatA', 1], ['beatB', 1], ['beatA', 1], ['beatC', 1]],
    ponder: [['huhA', 3], ['huhB', 3]],
    talk: [['talkOpen', 2], 'talkShut', 'talkFlap', 'talkShut', ['talkOpen', 1], ['talkShut', 2]],
  },
}
