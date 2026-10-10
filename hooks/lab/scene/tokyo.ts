// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Tokyo Cat: a small apartment bedroom high above Tokyo, seen from inside at
// a cat's height. A sliding balcony door fills the middle of the back wall;
// through it, past the railing, the city: hazy blocks, glass towers, Tokyo
// Tower in its orange and white, the Skytree far off. The light follows the
// person's own clock: by day a blue sky with drifting clouds and passing
// birds, and the sun coming in through the glass in dithered shafts that land
// as a bright patch on the floorboards, moving as the hours go; at dusk the
// city lights come on window by window; at night Tokyo Tower glows, the
// Skytree wears its blue or purple, red beacons breathe on the towers, and
// the real moon, in tonight's phase, is up when it is really up. The desk at
// the left has a computer whose monitor shows, very small, a familiar orange
// creature. The bed is at the right. The pet is a calico cat.
//
// Layout: the core strip is the floor, the cat, the bed's edge, the desk's
// legs and the foot of the balcony door with the city's tops above its rail.
// A taller room shows more of the room: 74% of the extra rows go up (the
// door's glass and sky, the clock, the shelf, the air conditioner, the
// ceiling) and 26% go down (floorboards, the rug, the toys).
//
//   idle    it sleeps curled up where the sun lies on the floor (on the bed
//           when there is no sun, or by it in a short room), breathing
//           slowly; it gets up and follows the patch when the patch has
//           moved on without it
//   busy    awake: it walks about, bats its ball of yarn across the floor,
//           sits at the glass watching the city; outside the clouds hurry,
//           more birds cross, and the monitor fills with lines
//   ponder  its tail curls up into a question mark and an ear flicks (lying
//           down, it stays lying down)
//   talk    it sits up as the line lands, faces its words and meows them,
//           and holds still until they fade
//   spectacle (a long turn just ended)  a sparrow lands on the balcony rail;
//           the cat runs to the glass and chatters at it, the bird flies off,
//           and the cat has the zoomies across the room before settling
//   rewards after half a minute of quiet, dust motes drift in the sunbeam;
//           after a minute and a half it dreams (its paws paddle), and now and
//           then it opens one eye
import { clamp, smoothstep } from '../util'
import type { Frame, Ink, SceneDef, SceneInput, SceneInstance } from './kit'
import { bayer, Dots, drawBubble, drawMoon, hash, ink, moonPhase, noise1, packFast } from './kit'

// ---------------------------------------------------------------- inks

const P = {
  wall: 1, trim: 2, frame: 3, seam: 4, wood: 5, woodDim: 6, curtain: 7, duvet: 8,
  sheet: 9, rug: 10, metal: 11, bezel: 12, text: 13, clawd: 14, lampOn: 15, lampCone: 16,
  mug: 17, steam: 18, plant: 19, led: 20, yarn: 21, toyMouse: 22, feather: 23, book1: 24,
  clockFace: 25, ac: 26, fairy: 27, fairyOn: 28, print: 29, foam: 30, cushion: 31, sisal: 32,
  skyHi: 33, skyLo: 34, goldHi: 35, goldLo: 36, dusk: 37, night: 38, sun: 39, sunHalo: 40,
  moon: 41, moonRim: 42, moonHalo: 43, maria: 44, star: 45, cloud: 46, cloudShade: 47, cloudGold: 48,
  cloudNight: 49, farDay: 50, midDay: 51, farNight: 52, midNight: 53, winWarm: 54, winCool: 55, towerRed: 56,
  towerWhite: 57, towerLit: 58, skytree: 59, iki: 60, miyabi: 61, beacon: 62, train: 63, trainWin: 64,
  bird: 65, plane: 66, contrail: 67, rail: 68, slab: 69, beam: 70, beamGold: 71, patch: 72,
  patchHot: 73, patchGold: 74, moonPatch: 75, mote: 76, furW: 77, furO: 78, furK: 79, eye: 80,
  nose: 81, mouth: 82, border: 83, words: 84, midLit: 85, sparrow: 86,
} as const

const PALETTE: Ink[] = []
PALETTE[0] = ink(0, 0, 0)
PALETTE[P.wall] = ink(0x2c2e35, 0xe4e0d8)
PALETTE[P.trim] = ink(0x3e4149, 0xc4beb4, 1.2)
PALETTE[P.frame] = ink(0x5f656f, 0x9aa0a8, 1.4)
PALETTE[P.seam] = ink(0x2f2a25, 0xddd2c0, 1)
PALETTE[P.wood] = ink(0x77593f, 0xa07c58, 1.5)
PALETTE[P.woodDim] = ink(0x4c3d31, 0xc8b29a, 1.3)
PALETTE[P.curtain] = ink(0x5d7766, 0x88a894, 1.3)
PALETTE[P.duvet] = ink(0x40609a, 0x5a78b0, 1.5)
PALETTE[P.sheet] = ink(0xb8b3a8, 0xa8a296, 1.5)
PALETTE[P.rug] = ink(0x7e4a3e, 0xc8846e, 1.2)
PALETTE[P.metal] = ink(0x5a5e66, 0x8a8e96, 1.4)
PALETTE[P.bezel] = ink(0x4e5159, 0x6a6e76, 1.6)
PALETTE[P.text] = ink(0x7f95ad, 0x4a6a90, 1.5)
PALETTE[P.clawd] = ink(0xd77757, 0xd77757, 9)
PALETTE[P.lampOn] = ink(0xf2c46e, 0xd4900c, 4)
PALETTE[P.lampCone] = ink(0x6e5a36, 0xf0d8a0, 1.1)
PALETTE[P.mug] = ink(0xd8d4cc, 0x8a847a, 2)
PALETTE[P.steam] = ink(0x5a5e66, 0xc4c8ce, 1.2)
PALETTE[P.plant] = ink(0x4c7646, 0x4f8a48, 1.6)
PALETTE[P.led] = ink(0x6ad08a, 0x1f9a4a, 6)
PALETTE[P.yarn] = ink(0xd25670, 0xc0304e, 3)
PALETTE[P.toyMouse] = ink(0x9a9690, 0x75706a, 2)
PALETTE[P.feather] = ink(0x5ab4d0, 0x1f8aae, 3)
PALETTE[P.book1] = ink(0xa8584a, 0x9c3d2e, 2)
PALETTE[P.clockFace] = ink(0x9a958c, 0x7a766e, 1.4)
PALETTE[P.ac] = ink(0x9a9ca0, 0xa4a6ac, 1.4)
PALETTE[P.fairy] = ink(0x6a6048, 0xc8bc98, 2)
PALETTE[P.fairyOn] = ink(0xffd68a, 0xd89a10, 4)
PALETTE[P.print] = ink(0x4a78b0, 0x2a5a9a, 2)
PALETTE[P.foam] = ink(0xd8e2ee, 0x8aa2c0, 2.2)
PALETTE[P.cushion] = ink(0x8e423c, 0xc06058, 1.5)
PALETTE[P.sisal] = ink(0x7a6a4e, 0xa88c5c, 1.4)
PALETTE[P.skyHi] = ink(0x2c5582, 0x8cb6e4)
PALETTE[P.skyLo] = ink(0x4f82b8, 0x9cc4e8)
PALETTE[P.goldHi] = ink(0x86587a, 0xc08aa8)
PALETTE[P.goldLo] = ink(0xe0965a, 0xe08a40)
PALETTE[P.dusk] = ink(0x4a3c6c, 0x9a88c0)
PALETTE[P.night] = ink(0x2a3148, 0xb0b6cc)
PALETTE[P.sun] = ink(0xfff2c0, 0xe0a020, 3)
PALETTE[P.sunHalo] = ink(0xe0c070, 0xf0cc60, 1.2)
PALETTE[P.moon] = ink(0xefe9cc, 0x8d7f45, 2)
PALETTE[P.moonRim] = ink(0x6e6a52, 0xb9b08a, 1.3)
PALETTE[P.moonHalo] = ink(0x45443a, 0xddd6bc)
PALETTE[P.maria] = ink(0xbdb594, 0xa99d6c, 2)
PALETTE[P.star] = ink(0x7a84a0, 0x9aa2b4, 1.2)
PALETTE[P.cloud] = ink(0xe6ecf2, 0x9eaec2, 1.3)
PALETTE[P.cloudShade] = ink(0x94a2b6, 0xc2ccda, 1.2)
PALETTE[P.cloudGold] = ink(0xf0aa86, 0xd8865a, 1.3)
PALETTE[P.cloudNight] = ink(0x3c4256, 0xb4bac8, 1.1)
PALETTE[P.farDay] = ink(0x4a6080, 0xa8b8cc)
PALETTE[P.midDay] = ink(0x7a8ca2, 0x76889e, 1.2)
PALETTE[P.farNight] = ink(0x2c3446, 0xa0a8b8)
PALETTE[P.midNight] = ink(0x3e465a, 0x6e7686, 1.1)
PALETTE[P.winWarm] = ink(0xf2d38a, 0xb8820e, 3)
PALETTE[P.winCool] = ink(0xbfe0f2, 0x2f86b0, 3)
PALETTE[P.towerRed] = ink(0xec6a3c, 0xd8461c, 2.5)
PALETTE[P.towerWhite] = ink(0xece8e0, 0x9a9894, 2.4)
PALETTE[P.towerLit] = ink(0xffa646, 0xe07a10, 3)
PALETTE[P.skytree] = ink(0xb8c4d2, 0x8494a8, 1.8)
PALETTE[P.iki] = ink(0x7ab4ff, 0x2f6ad8, 3)
PALETTE[P.miyabi] = ink(0xb48cf0, 0x7a3ad0, 3)
PALETTE[P.beacon] = ink(0xff4a4a, 0xd81e1e, 6)
PALETTE[P.train] = ink(0x9ccd3a, 0x5a9a10, 2)
PALETTE[P.trainWin] = ink(0xf2e6b0, 0x8a7a30, 2.5)
PALETTE[P.bird] = ink(0xa0a6b0, 0x3a3e46, 2)
PALETTE[P.plane] = ink(0xd8dce4, 0x5a6070, 2)
PALETTE[P.contrail] = ink(0x8a98ae, 0xc4ccd8, 1.1)
PALETTE[P.rail] = ink(0x7a8ca2, 0x76889e, 1.3)
PALETTE[P.slab] = ink(0x3c4148, 0xb4b8c0, 1.2)
PALETTE[P.beam] = ink(0x7c6c44, 0xe8d498, 1.1)
PALETTE[P.beamGold] = ink(0x8c5c36, 0xf0bc88, 1.1)
PALETTE[P.patch] = ink(0xae985e, 0xe2c070, 1.1)
PALETTE[P.patchHot] = ink(0xe6cc84, 0xd2a434, 1.2)
PALETTE[P.patchGold] = ink(0xe0904c, 0xe89a50, 1.2)
PALETTE[P.moonPatch] = ink(0x3e4c66, 0xc4cee0)
PALETTE[P.mote] = ink(0xf0e2b0, 0xb89a40, 4)
PALETTE[P.furW] = ink(0xece6da, 0x9c9284, 2)
PALETTE[P.furO] = ink(0xe8944a, 0xd0782c, 2.5)
PALETTE[P.furK] = ink(0x6e665e, 0x3c3632, 2.5)
PALETTE[P.eye] = ink(0xc8e070, 0x5c8a10, 9)
PALETTE[P.nose] = ink(0xf0a0a8, 0xd0606e, 6)
PALETTE[P.mouth] = ink(0xa04050, 0x8a2a38, 6)
PALETTE[P.border] = ink(0xb1b9f9, 0x5769f7, 9)
PALETTE[P.words] = ink(0xd6d6d6, 0x2e2e2e, 9)
PALETTE[P.midLit] = ink(0xb4c2d2, 0x56687e, 1.3)
PALETTE[P.sparrow] = ink(0xc89462, 0x8a5428, 4)

/** The inks the sky is hatched in: a cloud, a plane or a bird may cover these, never a tower or a roof. */
const SKYISH = new Uint8Array(PALETTE.length + 1)
for (const k of [P.skyHi, P.skyLo, P.goldHi, P.goldLo, P.dusk, P.night, P.sunHalo, P.star, P.sun, P.cloudShade]) SKYISH[k] = 1

// ---------------------------------------------------------------- the cat
// Drawn facing left, flipped to face right. W white fur, O orange and K black
// patches (a calico), E eyes, N nose, M an open mouth; ',' is a dot kept
// clear (the closed eyes, the line between head and body).
type Art = readonly string[]

/** `art` widened to `w` columns on its right, so its variants share a middle. */
const pad = (art: Art, w: number): Art => art.map(row => row.padEnd(w, '.'))
/** `art` with `ch` set at each [x, y]: a tail curled up behind it, an ear moved. */
function mark(art: Art, at: readonly (readonly [number, number])[], ch = 'K'): Art {
  const rows = art.map(row => row.split(''))
  for (const [x, y] of at) if (rows[y] !== undefined && x < rows[y]!.length) rows[y]![x] = ch
  return rows.map(r => r.join(''))
}

const SLEEP: Art = [
  '...............OOOOOO..........',
  '............OOOOOOOOOOOW.......',
  '.K.....O..OOOOOOOOOOOWWWWW.....',
  '.KK...OO,,OOOOOOOOOWWWWWWWW....',
  '.KKK.OOO,OOOOOOOOWWWWWWWWWWW...',
  'KKKKKOOOO,OOOOWWWWWWWWWWWWWWW..',
  'KKKKWWOOO,WWWWWWWWWWWWWWWWWWWW.',
  'KWWWWWWOO,WWWWWWWWWWWWWWWWWWWW.',
  'W,,WWW,,W,WWWWWWWWWWWWWWWWWWWWW',
  'WWWWNWWWW,WWWWWWWWWWWWWWWWWWWWW',
  '.WWWWWWW,,,,,,,,,,WWWWWWWWWWWW.',
  '..KKKKOOOOKKKKOOOO,WWWWWWWWWW..',
  '...KKKOOOOKKKKOOOO..WWWWWW.....',
]
// breathing in: the back rises a dot
const SLEEP_IN: Art = [
  '..............OOOOOOOO.........',
  '............OOOOOOOOOOOWW......',
  ...SLEEP.slice(2),
]
// one eye open, a peek at the room
const SLEEP_PEEK: Art = SLEEP.map((row, y) => (y === 8 ? 'W,,WWWEEW' + row.slice(9) : row))
// dreaming: a front paw paddles out under the chin
const SLEEP_DREAM: Art = SLEEP.map((row, y) => (y === 10 ? 'WWWWWWWW' + row.slice(8) : y === 11 ? 'W.KKKKOOOOKKKKOOOO,WWWWWWWWWW..' : row))
const LOAF: Art = [
  '.K.....O................',
  '.KK...OO................',
  '.KKKOOOO.....OOOOOO.....',
  'KKKKOOOOO.OOOOOOOOOOW...',
  'KEEKWOEEO,OOOOOOOOWWWW..',
  'KKKWNWOOO,OOOOOWWWWWWWW.',
  '.WWWWWWW,WWWWWWWWWWWWWWW',
  '..WWWWW,WWWWWWWWWWWWWWWW',
  '.WWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWW,WWWWWWWWWWWWWWWWKKO',
  'WWWW,,WWWWWWWWWWWKKOOKK.',
]
const SIT: Art = [
  '.K.....O.....',
  '.KK...OO.....',
  '.KKKOOOO.....',
  'KKKKOOOOO....',
  'KEEKWOEEO....',
  'KKKWNWOOO....',
  '.WWWWWWW.....',
  '..WWWWW......',
  '..WWWWWWO....',
  '.WWWWWWOOO...',
  '.WWWWWWOOOOO.',
  '.WWWWWWWOOOOK',
  '.WWWWWWWWOOKK',
  '.WWWWWWWWWKKK',
  '.WW,WWWWWWWWW',
  '.WW,WWWWWWWWW',
  'WWW,WWKKOOKKO',
]
const SIT_BLINK: Art = SIT.map((row, y) => (y === 4 ? 'K,,KWO,,O....' : row))
const SIT_TALK: Art = SIT.map((row, y) => (y === 5 ? 'KKKWNWOOO....' : y === 6 ? '.WWWMWWW.....' : y === 7 ? '..WMMMW......' : row))
// thinking: the tail up and curled into a question mark
const SIT_Q: Art = [
  '.K.....O......KK.',
  '.KK...OO.....K..K',
  '.KKKOOOO........K',
  'KKKKOOOOO......K.',
  'KEEKWOEEO.....K..',
  'KKKWNWOOO.....K..',
  '.WWWWWWW......K..',
  '..WWWWW.......K..',
  '..WWWWWWO....K...',
  '.WWWWWWOOO..K....',
  '.WWWWWWOOOOK.....',
  '.WWWWWWWOOOO.....',
  '.WWWWWWWWOOO.....',
  '.WWWWWWWWWWW.....',
  '.WW,WWWWWWWW.....',
  '.WW,WWWWWWWW.....',
  'WWW,WWWWWWWW.....',
]
// an ear flicks
const SIT_Q_FLICK: Art = SIT_Q.map((row, y) => (y === 0 ? 'K......O......KK.' : y === 1 ? 'KK....OO.....K..K' : row))
// from behind, looking out of the window; its tail twitches
const BACK: Art = [
  '.K.....O.....',
  '.KK...OO.....',
  '.KKKOOOO.....',
  'KKKKOOOOO....',
  'KKKKOOOOO....',
  '.KKKOOOO.....',
  '..WWWWW......',
  '..WWWWWW.....',
  '.WWWWOOOO....',
  '.WWWWOOOOO...',
  'WWWWWOOOOO...',
  'WWWWWWOOOO...',
  'WWWWWWWWWW...',
  'WWWWWWWWWW...',
  'WWWWWWWWWWKK.',
  '.WWWWWWWWW.KK',
  '..........KK.',
]
const BACK_TWITCH: Art = BACK.map((row, y) => (y === 13 ? 'WWWWWWWWWW..K' : y === 14 ? 'WWWWWWWWWWKK.' : y === 15 ? '.WWWWWWWWW...' : y === 16 ? '.............' : row))
const WALK_HEAD = [
  '.K.....O..................KK.',
  '.KK...OO...................K.',
  '.KKKOOOO...................K.',
  'KKKKOOOOO.................K..',
  'KEEKWOEEO.................K..',
  'KKKWNWOOO................K...',
  '.WWWWWWWWOOOOOOOOOOWWWWWWK...',
  '..WWWWWWOOOOOOOOOOOOWWWWWW...',
  '...WWWWWWOOOOOOOOOOWWWWWWW...',
  '...WWWWWWWWWWWWWWWWWWWWWWW...',
  '....WWWWWWWWWWWWWWWWWWWWW....',
]
const WALK: Art[] = [
  [...WALK_HEAD, '....WW.WW..........WW.WW.....', '...WW...WW........WW...WW....', '...W.....W........W.....W....'],
  [...WALK_HEAD, '.....WWW...........WWW.......', '.....WWW...........WWW.......', '.....W.W...........W.W.......'],
]
const BAT: Art[] = [
  [
    '...K.....O.....',
    '...KK...OO.....',
    '...KKKOOOO.....',
    '..KKKKOOOOO....',
    '..KEEKWOEEO....',
    '..KKKWNWOOO....',
    'WW.WWWWWWW.....',
    '.WWWWWWWW......',
    '...WWWWWWWO....',
    '...WWWWWWOOO...',
    '...WWWWWWOOOOO.',
    '...WWWWWWWOOOOK',
    '...WWWWWWWWOOKK',
    '...WWWWWWWWWKKK',
    '...WW,WWWWWWWWW',
    '...WW,WWWWWWWWW',
    '..WWW,WWKKOOKKO',
  ],
  [
    '...K.....O.....',
    '...KK...OO.....',
    '...KKKOOOO.....',
    '..KKKKOOOOO....',
    '..KEEKWOEEO....',
    '..KKKWNWOOO....',
    '...WWWWWWW.....',
    '....WWWWW......',
    '....WWWWWWO....',
    '...WWWWWWOOO...',
    '...WWWWWWOOOOO.',
    '...WWWWWWWOOOOK',
    '...WWWWWWWWOOKK',
    '...WWWWWWWWWKKK',
    '...WW,WWWWWWWWW',
    'WWWWW,WWWWWWWWW',
    'WW.WW,WWKKOOKKO',
  ],
]
const RUN: Art[] = [
  [
    '..K..O.........................',
    '.KKOOO.........................',
    'KEEOOOO.......................K',
    'KKWNOOOOOOOOOOOOOOWWWWWWWWWKKK.',
    '.WWWWWOOOOOOOOOOOOOWWWWWWWW....',
    '..WWWWWWOOOOOOOOOWWWWWWWWW.....',
    '...WWWWWWWWWWWWWWWWWWWWWW......',
    '..WW..................WWW......',
    '.WW.....................WW.....',
    'WW.......................WW....',
  ],
  [
    '...............................',
    '...K..O........................',
    '..KKOOO......................KK',
    '.KEEOOOOOOOOOOOOOOWWWWWWWWWKK..',
    '.KKWNWOOOOOOOOOOOOWWWWWWWW.....',
    '..WWWWWWOOOOOOOOOWWWWWWWW......',
    '....WWWWWWWWWWWWWWWWWWWW.......',
    '......WWW.......WWWW...........',
    '.......WWW....WWW..............',
    '........WW...WW................',
  ],
]
type Pose = 'sleep' | 'sleepIn' | 'peek' | 'dream' | 'wonder' | 'wonderFlick' | 'loaf' | 'sit' | 'blink' | 'meow' | 'ask' | 'askFlick' | 'back' | 'twitch' | 'walk0' | 'walk1' | 'bat0' | 'bat1' | 'run0' | 'run1'
/** The same cat drawn larger, the hero of a tall window. */
// lying and wondering: the tail's tip curls up behind it into a question mark
const L_TAIL = [[33, 0], [34, 0], [32, 1], [35, 1], [35, 2], [34, 3], [33, 4], [32, 5], [32, 6], [31, 7]] as const
const L_WONDER = mark(pad(SLEEP, 36), L_TAIL)
const LARGE: Record<Pose, Art> = {
  sleep: pad(SLEEP, 36), sleepIn: pad(SLEEP_IN, 36), peek: pad(SLEEP_PEEK, 36), dream: pad(SLEEP_DREAM, 36), loaf: LOAF,
  wonder: L_WONDER, wonderFlick: mark(mark(L_WONDER, [[1, 2], [2, 3]], '.'), [[0, 2], [1, 3]]),
  sit: SIT, blink: SIT_BLINK, meow: SIT_TALK, ask: SIT_Q, askFlick: SIT_Q_FLICK,
  back: BACK, twitch: BACK_TWITCH, walk0: WALK[0]!, walk1: WALK[1]!, bat0: BAT[0]!, bat1: BAT[1]!, run0: RUN[0]!, run1: RUN[1]!,
}
const FUR: Readonly<Record<string, number>> = { W: P.furW, O: P.furO, K: P.furK, E: P.eye, N: P.nose, M: P.mouth }
/** Where each pose's head is (dots from its left, and up from its feet, facing left), for the bubble's tail. */
const HEAD_L: Readonly<Record<Pose, [number, number]>> = {
  sleep: [4, 6], sleepIn: [4, 6], peek: [4, 6], dream: [4, 6], wonder: [4, 6], wonderFlick: [4, 6], loaf: [4, 8], sit: [4, 13], blink: [4, 13], meow: [4, 13],
  ask: [4, 13], askFlick: [4, 13], back: [4, 13], twitch: [4, 13], walk0: [4, 10], walk1: [4, 10], bat0: [6, 13], bat1: [6, 13], run0: [3, 7], run1: [3, 7],
}

// The band's cat, the one people know: about 20 dots long asleep.
const S_SLEEP: Art = [
  '.K..O.....OOOO......',
  '.KK.OO..OOOOOOOW....',
  '.KKKOO,OOOOOWWWWW...',
  'KKKKOOO,OOOWWWWWWW..',
  'KKKWWOO,OWWWWWWWWW..',
  'W,,W,,W,WWWWWWWWWWW.',
  'WWNWWWW,WWWWWWWWWWW.',
  '.WWWWW,,,,,,WWWWWWWW',
  '..KKKKOOOOK,.WWWWWW.',
]
const S_SIT: Art = [
  '.K....O...',
  '.KK..OO...',
  'KKKWOOOO..',
  'KW,WW,OO..',
  '.WWNNWW...',
  '..WWWWW...',
  '..WWWWO...',
  '.WWWWWOO..',
  '.WWWWWOOO.',
  '.WWWWWWOKK',
  '.WWWWWWWKK',
  '.W,WWWWWWK',
  'WW,WWKKOO.',
]
const S_ASK: Art = [
  '.K....O....KK.',
  '.KK..OO...K..K',
  'KKKWOOOO.....K',
  'KW,WW,OO....K.',
  '.WWNNWW.....K.',
  '..WWWWW.....K.',
  '..WWWWO....K..',
  '.WWWWWOO..K...',
  '.WWWWWOOOK....',
  '.WWWWWWOO.....',
  '.WWWWWWWW.....',
  '.W,WWWWWW.....',
  'WW,WWWWWW.....',
]
const S_BACK: Art = [
  '.K....O...',
  '.KK..OO...',
  'KKKKOOOO..',
  'KKKKOOOO..',
  '.KKKOOO...',
  '..WWWW....',
  '.WWWOOO...',
  '.WWWOOOO..',
  'WWWWWOOO..',
  'WWWWWWWW..',
  'WWWWWWWWK.',
  '.WWWWWWW.K',
  '........KK',
]
const S_WALK_TOP = [
  '.K....O.............K',
  '.KK..OO.............K',
  'KKKWOOOO...........K.',
  'KW,WW,OO..........K..',
  '.WWNNWWOOOOOOOWWWWK..',
  '..WWWWWOOOOOOOOWWWW..',
  '..WWWWWWOOOOOWWWWWW..',
  '...WWWWWWWWWWWWWWWW..',
]
const S_BAT_TOP = [
  '...K....O...',
  '...KK..OO...',
  '..KKKWOOOO..',
  '..KW,WW,OO..',
  '...WWNNWW...',
]
const S_BAT_BODY = [
  '...WWWWWOO..',
  '...WWWWWOOO.',
  '...WWWWWWOKK',
  '...WWWWWWWKK',
]
const S_TAIL = [[20, 0], [21, 0], [19, 1], [22, 1], [22, 2], [21, 3], [20, 4], [19, 5]] as const
const S_WONDER = mark(pad(S_SLEEP, 23), S_TAIL)
const SMALL: Record<Pose, Art> = {
  sleep: pad(S_SLEEP, 23),
  sleepIn: pad(['.K..O....OOOOOO.....', '.KK.OO.OOOOOOOOW....', ...S_SLEEP.slice(2)], 23),
  peek: pad(S_SLEEP.map((row, y) => (y === 5 ? 'W,,WEEW,' + row.slice(8) : row)), 23),
  dream: pad(S_SLEEP.map((row, y) => (y === 7 ? 'WWWWWW,,,,,,WWWWWWWW' : y === 8 ? 'W.KKKKOOOOK,.WWWWWW.' : row)), 23),
  wonder: S_WONDER,
  wonderFlick: mark(mark(S_WONDER, [[1, 0], [1, 1]], '.'), [[0, 0], [0, 1]]),
  loaf: [
    '.K....O..........',
    '.KK..OO..........',
    'KKKWOOOO..OOOO...',
    'KW,WW,OOOOOOOOW..',
    '.WWNNWWOOOOOWWWW.',
    '.WWWWWW,WWWWWWWWW',
    '.WWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWKK',
    'WWW,WWWWWWWWWKKOO',
  ],
  sit: S_SIT,
  blink: S_SIT.map((row, y) => (y === 3 ? 'KWWWWWOO..' : row)),
  meow: S_SIT.map((row, y) => (y === 5 ? '..WMMWW...' : row)),
  ask: S_ASK,
  askFlick: S_ASK.map((row, y) => (y === 0 ? 'K.....O....KK.' : y === 1 ? 'KK...OO...K..K' : row)),
  back: S_BACK,
  twitch: S_BACK.map((row, y) => (y === 10 ? 'WWWWWWWW.K' : y === 11 ? '.WWWWWWWK.' : y === 12 ? '..........' : row)),
  walk0: [...S_WALK_TOP, '...WW.W.......WW.W...', '..WW...W.....WW...W..'],
  walk1: [...S_WALK_TOP, '....WWW........WWW...', '....W.W........W.W...'],
  bat0: [...S_BAT_TOP, 'WW.WWWWWW...', '.WWWWWWO....', '..WWWWWWOO..', ...S_BAT_BODY, '...W,WWWWWWK', '..WW,WWKKOO.'],
  bat1: [...S_BAT_TOP, '...WWWWWW...', '....WWWWO...', '...WWWWWOO..', ...S_BAT_BODY, 'WWWW,WWWWWWK', 'WW.W,WWKKOO.'],
  run0: [
    '.K..O..................',
    'KKOOO.................K',
    'K,OOOOOOOOOOOOWWWWWWKK.',
    'KWNOOOOOOOOOOOOWWWWW...',
    '.WWWWWOOOOOOOWWWWWW....',
    '..WWWWWWWWWWWWWWWWW....',
    '.WW..............WW....',
    'WW.................WW..',
  ],
  run1: [
    '..K..O.................',
    '.KKOOO...............KK',
    '.K,OOOOOOOOOOOWWWWWWK..',
    '.KWNOOOOOOOOOOWWWWW....',
    '..WWWWWOOOOOOWWWWW.....',
    '....WWWWWWWWWWWWWW.....',
    '......WWW...WWW........',
    '.......WW...WW.........',
  ],
}
const HEAD_S: Readonly<Record<Pose, [number, number]>> = {
  sleep: [3, 4], sleepIn: [3, 4], peek: [3, 4], dream: [3, 4], wonder: [3, 4], wonderFlick: [3, 4], loaf: [3, 6], sit: [3, 10], blink: [3, 10], meow: [3, 10],
  ask: [3, 10], askFlick: [3, 10], back: [3, 10], twitch: [3, 10], walk0: [3, 7], walk1: [3, 7], bat0: [5, 10], bat1: [5, 10], run0: [2, 5], run1: [2, 5],
}

// The easter egg on the monitor: Claude Code's own little creature, nine dots wide.
const CLAWD: Art = ['.#######.', '.#.###.#.', '#########', '.#######.', '..##.##..']

// Tokyo Tower and the Skytree for a short window, drawn by hand: r its
// orange, w its white (the decks), s the Skytree's steel.
const TOWER_SMALL: Art = [
  '.....r.....',
  '.....r.....',
  '.....w.....',
  '....rwr....',
  '....r.r....',
  '....rrr....',
  '...wwwww...',
  '...r...r...',
  '...rr.rr...',
  '..r..r..r..',
  '..r.r.r.r..',
  '.r..r.r..r.',
  '.r.r...r.r.',
  'r.........r',
]
const SKYTREE_SMALL: Art = [
  '..s..',
  '..s..',
  '..s..',
  '..s..',
  '.ddd.',
  '..s..',
  '..s..',
  '.sss.',
  'ddddd',
  '.sss.',
  '.s.s.',
  '.s.s.',
  '.s.s.',
  's.s.s',
  's...s',
]

// A sparrow on the rail (facing left), and one in flight.
const SPARROW: Art[] = [['.bb..', 'bbbbb', '.bbb.', '.b.b.'], ['.....', '.bb..', 'bbbbb', '.b.b.']]
const FLAP: Art[] = [['b...b', '.b.b.', '..b..'], ['.....', 'bb.bb', '..b..']]

// ---------------------------------------------------------------- the clock and the sky

/** The light of the person's own day: where the sun and the moon are, and how lit the city is. */
type Sky = {
  hour: number
  /** 0 night .. 1 full day */
  day: number
  /** 0..1: the warm hour around sunrise and sunset */
  gold: number
  /** 0..1: the blue hour just after sunset and before sunrise */
  dusk: number
  sunAlt: number
  /** degrees from the window's straight-out view, negative to the left */
  sunAz: number
  moonAlt: number
  moonAz: number
  phase: number
  /** the share of the city's windows lit */
  lights: number
  /** the Skytree wears Iki (blue) or Miyabi (purple), a day each */
  iki: boolean
}

function skyAt(now: number): Sky {
  const date = new Date(now)
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
  const start = new Date(date.getFullYear(), 0, 1).getTime()
  const doy = (now - start) / 86_400_000
  // 1 at midsummer, -1 at midwinter: longer days, a higher sun
  const season = Math.cos((2 * Math.PI * (doy - 172)) / 365)
  const rise = 6.3 - 1.0 * season
  const set = 18.0 + 1.3 * season
  const u = (hour - rise) / (set - rise)
  const top = 51 + 19 * season
  const sunAlt = u > -0.25 && u < 1.25 ? Math.sin(Math.PI * u) * top : -top * 0.7
  // the window faces southwest: the sun reaches in from late morning, from
  // the left, and comes nearly straight in as it sets
  const sunAz = -112 + 112 * u
  const day = smoothstep(-6, 5, sunAlt)
  const gold = sunAlt > -3 && sunAlt < 16 ? 1 - Math.abs(sunAlt - 4) / 12 : 0
  const dusk = sunAlt < 3 && sunAlt > -14 ? 1 - Math.abs(sunAlt + 5) / 9 : 0
  // the city: offices and homes light up at dusk, and go dark in the small hours
  const lateness = hour >= 1 && hour < 5 ? 0.45 : 1
  const lights = smoothstep(8, -4, sunAlt) * 0.42 * lateness
  const phase = moonPhase(now)
  // the moon crosses the south at about noon at new moon, midnight at full
  let ha = hour - (12 + 24 * phase)
  ha = ((ha % 24) + 36) % 24 - 12
  const moonAlt = 58 * Math.cos((ha * Math.PI) / 12) - 9
  const moonAz = ha * 13 - 22
  const days = Math.floor(now / 86_400_000)
  return { hour, day, gold: Math.max(0, gold), dusk: Math.max(0, dusk), sunAlt, sunAz, moonAlt, moonAz, phase, lights, iki: days % 2 === 0 }
}

// ---------------------------------------------------------------- the room's layout

type Layout = ReturnType<typeof layoutOf>

function layoutOf(cols: number, rows: number) {
  const W = cols * 2, H = rows * 4
  // a short room (the band) is drawn plainer: fewer lines, the door left of the middle
  const compact = H <= 32
  const depth = H <= 24 ? (H <= 20 ? 5 : 6) : Math.min(44, Math.round(6 + (H - 24) * 0.26))
  const base = H - depth // where the back wall meets the floor
  const foot = base + 2 // where the furniture against it stands
  const catY = Math.min(H - 1, base + Math.max(3, Math.round(depth * 0.5)))
  const ceil = base >= 64 ? Math.max(2, Math.round(H * 0.025)) : -1
  // the balcony door: two panes of glass, its frame, the sill
  const winC = Math.round(W * (compact ? 0.44 : 0.5))
  const winW = clamp(Math.round(W * (compact ? 0.36 : 0.34)), 28, 140)
  const x0 = winC - (winW >> 1), x1 = x0 + winW
  const doorH = ceil >= 0 ? base - ceil - Math.max(12, Math.round((base - ceil) * 0.17)) : 96
  const gy1 = base - 3
  const gy0 = gy1 - doorH
  const top = Math.max(0, gy0)
  const visH = gy1 - top
  const railH = compact ? 2 : clamp(Math.round(visH * 0.26), 4, 22)
  const railY = gy1 - railH
  const hY = railY + 1 // the city's foot, just behind the rail
  const skyH = Math.max(4, hY - top)
  const cw = compact ? 2 : clamp(Math.round(winW * 0.13), 4, 16)
  // two sliding panes, or one in a narrow room
  const panes = compact || winW < 60 ? 1 : 2
  // the desk, left of the door
  const deskW = compact ? Math.round(W * 0.22) : clamp(Math.round(W * 0.24), 36, 84)
  const deskR = compact ? Math.min(x0 - 4, Math.round(W * 0.25)) : x0 - cw - Math.max(4, Math.round(W * 0.02))
  const deskL = deskR - deskW
  const deskTop = foot - 27
  const monX = deskL + Math.round(deskW * 0.45)
  // the bed, at the right
  const bedW = compact ? clamp(Math.round(W * 0.17), 16, 40) : clamp(Math.round(W * 0.25), 20, 100)
  let bedL = compact ? W - bedW : Math.max(W - bedW, x1 + cw + 2)
  if (W - bedL < 16) bedL = W - 16
  const bedTop = foot - 15
  // where the cat may be, where it sleeps in the sun (the right third), and on the bare floor
  const catMin = Math.max(18, deskL + 18)
  const catMax = W - 16
  const sunMin = Math.round(W * (compact ? 0.66 : 0.6))
  const sunMax = compact ? Math.min(W - 18, bedL - 2) : Math.min(W - 18, bedL + 10)
  const restX = clamp(compact ? Math.round(W * 0.75) : Math.round((x1 + cw + bedL) / 2), sunMin, W - 18)
  const toyX = Math.round(W * (compact ? 0.3 : 0.4))
  // the floor right at the glass, where the cat sits to watch the city
  const glassY = Math.min(catY, base + 5)
  return { W, H, cols, rows, compact, panes, depth, base, foot, catY, ceil, winC, winW, x0, x1, gy0, gy1, top, visH, railH, railY, hY, skyH, cw, deskW, deskL, deskR, deskTop, monX, bedL, bedTop, catMin, catMax, sunMin, sunMax, restX, toyX, glassY }
}

// ---------------------------------------------------------------- painting helpers

// ---------------------------------------------------------------- the still room

type Building = { x0: number; x1: number; top: number; far: boolean; seed: number; crown: number }
type Room = {
  key: string
  L: Layout
  /** the room's lines: walls, door, curtains, furniture, decor */
  struct: Dots
  /** what is solid: the light stops there */
  solid: Uint8Array
  /** where the sky shows through the glass */
  sky: Uint8Array
  buildings: Building[]
  tower: { x: number; h: number } | undefined
  tree: { x: number; h: number } | undefined
  /** beacons on the tallest roofs: x, y */
  beacons: number[]
  /** the bulbs of the string of lights: x, y */
  bulbs: number[]
  /** the screen's inside: x0, y0, x1, y1 */
  screen: [number, number, number, number] | undefined
  mug: [number, number] | undefined
  lamp: [number, number] | undefined
  clock: [number, number, number] | undefined
}

function roomOf(cols: number, rows: number, seed: number): Room {
  const L = layoutOf(cols, rows)
  const { W, H } = L
  const s = new Dots(cols, rows)
  const solid = new Uint8Array(W * H)
  const solidRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, Math.round(y0)); y <= Math.min(H - 1, Math.round(y1)); y++) {
      for (let x = Math.max(0, Math.round(x0)); x <= Math.min(W - 1, Math.round(x1)); x++) solid[y * W + x] = 1
    }
  }
  const room: Room = { key: `${cols}x${rows}`, L, struct: s, solid, sky: new Uint8Array(W * H), buildings: [], tower: undefined, tree: undefined, beacons: [], bulbs: [], screen: undefined, mug: undefined, lamp: undefined, clock: undefined }

  // ---- the city, through the glass
  const gx0 = L.x0, gx1 = L.x1 - 1
  const gw = gx1 - gx0 + 1
  const skyline = new Int16Array(W).fill(L.hY)
  const buildings: Building[] = []
  // far blocks, low and hazy
  for (let x = gx0 - 3, i = 0; x <= gx1 + 3; i++) {
    const w = (L.compact ? 5 : 3) + Math.floor(hash(i, seed, 101) * (L.compact ? 8 : 6))
    const h = Math.max(2, Math.round(L.skyH * (L.compact ? 0.3 + 0.35 * hash(i, seed, 102) : 0.12 + 0.3 * hash(i, seed, 102) ** 1.5)))
    buildings.push({ x0: x, x1: x + w - 1, top: L.hY - h, far: true, seed: i, crown: 0 })
    x += w + (hash(i, seed, 103) < 0.3 ? 1 : 0)
  }
  // the landmarks' feet stand in a park: the roofs around them stay low
  const towerX = gx0 + Math.round(gw * 0.3)
  const towerH = clamp(Math.round(L.skyH * (L.compact ? 0.86 : 0.66)), 11, 60)
  for (const b of buildings) {
    const half = L.compact ? 7 : towerH * 0.22
    if (b.x1 >= towerX - half && b.x0 <= towerX + half) b.top = Math.max(b.top, L.hY - Math.max(2, Math.round(towerH * (L.compact ? 0.22 : 0.3))))
  }
  // the landmarks: Tokyo Tower nearer, the Skytree far off
  room.tower = { x: towerX, h: towerH }
  if (gw >= 40) room.tree = { x: gx0 + Math.round(gw * 0.8), h: clamp(Math.round(L.skyH * (L.compact ? 1.1 : 0.9)), 13, 86) }
  // nearer towers, kept low around the landmarks
  for (let x = gx0 - 2, i = 0; x <= gx1 + 2; i++) {
    const w = (L.compact ? 6 : 4) + Math.floor(hash(i, seed, 111) * 8)
    let h = Math.round(L.skyH * (0.12 + 0.3 * hash(i, seed, 112) ** 1.6))
    if (hash(i, seed, 113) < 0.14) h = Math.round(L.skyH * (0.38 + 0.14 * hash(i, seed, 114)))
    if (L.compact) h = Math.round(L.skyH * (0.22 + 0.4 * hash(i, seed, 112)))
    const mid = x + w / 2
    if (Math.abs(mid - towerX) < towerH * 0.24 + w / 2 + 1) h = Math.min(h, Math.round(towerH * 0.3))
    if (room.tree !== undefined && Math.abs(mid - room.tree.x) < w / 2 + 3) h = Math.min(h, Math.round(room.tree.h * 0.28))
    if (hash(i, seed, 115) < 0.16) { x += 2 + Math.floor(hash(i, seed, 116) * 3); continue }
    buildings.push({ x0: x, x1: x + w - 1, top: L.hY - Math.max(2, h), far: false, seed: i, crown: Math.floor(hash(i, seed, 117) * 5) })
    x += w + 1 + Math.floor(hash(i, seed, 118) * 2)
  }
  room.buildings = buildings
  for (const b of buildings) for (let x = Math.max(gx0, b.x0); x <= Math.min(gx1, b.x1); x++) skyline[x] = Math.min(skyline[x]!, b.top - (b.crown === 1 ? 2 : 0))
  // beacons on the tallest roofs and the landmarks' tips
  for (const b of buildings) if (!b.far && L.hY - b.top > L.skyH * 0.33 && b.x0 > gx0 && b.x1 < gx1) room.beacons.push(Math.round((b.x0 + b.x1) / 2), b.top - 1)
  const small = L.skyH < 22
  const towerTip = L.hY - (small ? TOWER_SMALL.length : towerH)
  if (towerTip >= 0) room.beacons.push(towerX, towerTip)
  const treeTip = room.tree === undefined ? -1 : L.hY - (small ? SKYTREE_SMALL.length : room.tree.h)
  if (room.tree !== undefined && treeTip >= 0) room.beacons.push(room.tree.x, treeTip)
  // the sky: inside the glass, above the roofs and the rail
  for (let y = L.top; y <= L.gy1; y++) {
    for (let x = gx0; x <= gx1; x++) if (y < skyline[x]! && y < L.railY) room.sky[y * W + x] = 1
  }

  // ---- the railing, the balcony's edge, the door's frame
  for (let x = gx0; x <= gx1; x++) {
    s.set(x, L.railY, P.rail)
    if (!L.compact) s.set(x, L.railY + 1, P.rail)
    if (!L.compact) { s.set(x, L.gy1, P.slab); s.set(x, L.gy1 - 1, P.slab) }
  }
  if (!L.compact) for (let x = gx0 + 2; x <= gx1 - 1; x += 4) s.vline(x, L.railY + 2, L.gy1 - 2, P.rail)
  const fy0 = Math.max(0, L.gy0 - 1)
  if (L.compact) {
    s.vline(gx0 - 1, fy0, L.gy1 + 1, P.frame)
    s.vline(gx1 + 1, fy0, L.gy1 + 1, P.frame)
  } else if (L.panes === 2) {
    s.vline(L.winC - 1, fy0, L.gy1, P.frame)
    s.vline(L.winC, fy0, L.gy1, P.frame)
  }
  if (!L.compact) s.hline(gx0 - 1, gx1 + 1, L.gy1 + 1, P.frame)
  if (L.gy0 >= 1) s.hline(gx0 - 1, gx1 + 1, L.gy0 - 1, P.frame)
  solidRect(gx0 - 1, fy0, gx0 - 1, L.gy1 + 1)
  solidRect(gx1 + 1, fy0, gx1 + 1, L.gy1 + 1)
  // a glint on each pane, high up
  if (L.gy0 >= 0 && L.visH > 40) {
    for (const [px, len] of (L.panes === 2 ? [[gx0 + 4, 7], [L.winC + 4, 5]] : [[gx0 + 4, 7]]) as [number, number][]) {
      for (let k = 0; k < len; k++) if (k !== 3) room.sky[(L.gy0 + 3 + k) * W + px + len - k] = 2
    }
  }

  // ---- the ceiling, the wall's foot, the curtains
  if (L.ceil >= 0) {
    s.hline(0, W - 1, L.ceil, P.trim)
    s.hline(0, W - 1, L.ceil + 1, P.wall, 3)
  }
  for (let x = 0; x < W; x++) s.set(x, L.base, P.trim)
  const railTop = L.gy0 >= 3 ? L.gy0 - 4 : -1
  if (railTop >= 0) {
    s.hline(gx0 - L.cw - 3, gx1 + L.cw + 3, railTop, P.woodDim)
    s.hline(gx0 - L.cw - 3, gx1 + L.cw + 3, railTop + 1, P.woodDim, 2)
  }
  const drape = (xa: number, xb: number, gather: number) => {
    // a curtain hanging from the rail to just above the floor, folds wavier
    // toward the hem, gathered toward the window's edge
    const y0 = Math.max(0, railTop + 1), y1 = L.base - 2
    const n = Math.max(2, Math.round((xb - xa) / 3))
    for (let y = y0; y <= y1; y++) {
      const u = (y - y0) / Math.max(1, y1 - y0)
      s.set(xa + Math.round(Math.sin(y / 5) * 0.6 * u), y, P.curtain)
      s.set(xb + Math.round(Math.sin(y / 5 + 1) * 0.6 * u), y, P.curtain)
      for (let k = 1; k < n; k++) {
        const fx = xa + ((xb - xa) * k) / n + Math.sin(y / (6 + k) + k * 2.1) * (0.4 + u * 0.9)
        if ((y + k) % 3 !== 0 || u > 0.7) s.set(fx, y, P.curtain)
      }
      solidRect(xa, y, xb, y)
    }
    for (let x = xa; x <= xb; x++) s.set(x, y1 + ((x + gather) % 3 === 0 ? 1 : 0), P.curtain)
  }
  if (!L.compact) {
    drape(gx0 - L.cw - 1, gx0 - 1, 0)
    drape(gx1 + 1, gx1 + L.cw + 1, 1)
  }

  // ---- the floor: boards running across, their joints staggered, and a rug
  if (!L.compact) {
    const seams = L.depth >= 10 ? [0.28, 0.55, 0.85] : [0.5]
    for (const f of seams) {
      const y = L.base + 1 + Math.round(f * (L.depth - 2))
      if (y >= H) continue
      const run = 26 + Math.round(f * 30)
      for (let x = 0; x < W; x++) {
        const k = Math.floor((x + hash(y, seed, 5) * run) / run)
        const at = (x + hash(y, seed, 5) * run) % run
        if (at < 1) continue
        if (L.depth >= 16 && ((x - Math.round(L.W * 0.36)) / (L.W * 0.14 + 1)) ** 2 + ((y - L.base - Math.round(L.depth * 0.6)) / (Math.max(3, Math.round(L.depth * 0.24)) + 1)) ** 2 < 1) continue
        if ((x + y) % 2 === 0 || f > 0.4) s.set(x, y, P.seam)
        if (at < 2 && y + 1 < H && hash(k, y, 6) < 0.6) s.set(x, y + 1, P.seam)
      }
    }
  }
  if (L.depth >= 16) {
    const cx = Math.round(L.W * 0.36), cy = L.base + Math.round(L.depth * 0.6)
    const rx = Math.round(L.W * 0.14), ry = Math.max(3, Math.round(L.depth * 0.24))
    for (let a = 0; a < 2 * Math.PI; a += 0.5 / rx) {
      s.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, P.rug)
      if (Math.floor(a * rx) % 2 === 0) s.set(cx + Math.cos(a) * (rx - 3), cy + Math.sin(a) * (ry - 1.4), P.rug)
    }
    for (let y = cy - ry + 2; y <= cy + ry - 2; y++) {
      for (let x = cx - rx + 4; x <= cx + rx - 4; x++) {
        const e = ((x - cx) / (rx - 4)) ** 2 + ((y - cy) / (ry - 1.6)) ** 2
        if (e < 0.55 && (x + 3 * y) % 7 === 0 && y % 2 === 0) s.set(x, y, P.rug)
      }
    }
  }

  // ---- the walls' decor, tall rooms only
  const wallH = L.deskTop - Math.max(0, L.ceil)
  if (L.ceil >= 0 && wallH > 40) {
    // a wall clock above the monitor; its hands are the real time
    const cy = L.ceil + Math.round((L.deskTop - 24 - L.ceil) * 0.42)
    const r = clamp(Math.round(wallH * 0.07), 4, 7)
    for (let a = 0; a < 2 * Math.PI; a += 1.3 / r) s.set(L.monX + Math.cos(a) * r, cy + Math.sin(a) * r, P.clockFace)
    for (let k = 0; k < 12; k += 3) s.set(L.monX + Math.cos((k * Math.PI) / 6) * (r - 1.5), cy + Math.sin((k * Math.PI) / 6) * (r - 1.5), P.clockFace)
    room.clock = [L.monX, cy, r]
    solidRect(L.monX - r, cy - r, L.monX + r, cy + r)
    // a print of the Great Wave, over the corner
    const pw = 17, ph = 11
    const room0 = L.monX + r + 6, room1 = gx0 - L.cw - 6
    const px = room1 - room0 >= pw ? Math.round((room0 + room1 - pw) / 2) : L.deskL > 30 ? Math.round(L.deskL / 2) - 11 : -1
    const py = cy - (ph >> 1)
    if (px > 2) {
      s.box(px, py, px + pw, py + ph, P.woodDim)
      solidRect(px, py, px + pw, py + ph)
      const wave = [
        '.......ff......',
        '.....ffbbf.....',
        '....fbb..bf....',
        '...fbb....f....',
        '..bbb.....f.ff.',
        '.bbbb..fffbbbbb',
        'bbbbbbbbbbbbbbb',
      ]
      s.stamp(wave, px + 1, py + 2, { b: P.print, f: P.foam })
    }
    // the air conditioner, high on the wall over the bed
    const acW = Math.min(40, W - L.bedL - 8)
    if (acW >= 24) {
      const ax = L.bedL + 4, ay = L.ceil + 5
      s.hline(ax + 1, ax + acW - 1, ay, P.ac)
      s.hline(ax + 1, ax + acW - 1, ay + 8, P.ac)
      s.vline(ax, ay + 1, ay + 7, P.ac)
      s.vline(ax + acW, ay + 1, ay + 7, P.ac)
      s.hline(ax + 3, ax + acW - 3, ay + 6, P.ac, 2)
      s.set(ax + acW - 3, ay + 2, P.led)
      solidRect(ax, ay, ax + acW, ay + 8)
    }
    // a shelf of books over the bed, a plant trailing from it
    const sy = L.foot - Math.round(wallH * 0.62)
    const sx0 = L.bedL + 6, sx1 = Math.min(W - 6, sx0 + 34)
    if (sy > L.ceil + 18 && sx1 - sx0 > 20) {
      s.hline(sx0, sx1, sy, P.wood)
      s.hline(sx0, sx1, sy + 1, P.woodDim)
      let bx = sx0 + 2
      for (let i = 0; bx < sx0 + 18; i++) {
        const bh = 5 + Math.floor(hash(i, seed, 41) * 4)
        const c = P.book1
        const lean = i === 4 ? 1 : 0
        for (let k = 0; k < bh; k++) { s.set(bx + (lean && k > bh / 2 ? 1 : 0), sy - 1 - k, c); s.set(bx + 1 + (lean && k > bh / 2 ? 1 : 0), sy - 1 - k, c) }
        bx += 3
      }
      const ppx = sx1 - 8
      s.box(ppx, sy - 5, ppx + 5, sy - 1, P.woodDim)
      for (let k = 0; k < 14; k++) {
        s.set(ppx + 5 + Math.round(Math.sin(k / 2.5) * 1.5), sy + 1 + k, P.plant)
        if (k % 3 === 1) s.set(ppx + 6 + Math.round(Math.sin(k / 2.5) * 1.5), sy + 1 + k, P.plant)
      }
      for (let k = 0; k < 4; k++) s.set(ppx + 1 + k, sy - 6 - (k % 2), P.plant)
      // a string of fairy lights, swagged under the shelf
      const fx0 = L.bedL + 2, fx1 = W - 3, fy = sy + Math.round((L.bedTop - sy) * 0.42)
      for (let x = fx0; x <= fx1; x++) {
        const u = (x - fx0) / (fx1 - fx0)
        const yy = fy + Math.round(Math.sin(u * Math.PI * 2) ** 2 * 4)
        if (x % 2 === 0 && (x - fx0) % 6 !== 3) s.set(x, yy, P.fairy)
        if ((x - fx0) % 6 === 3) room.bulbs.push(x, yy + 1)
      }
    }
  }

  // ---- a monstera in a pot, between the door and the bed
  if (!L.compact && L.bedL - (gx1 + L.cw) > 24 && L.ceil >= 0) {
    const px = Math.round((gx1 + L.cw + L.bedL) / 2), py = L.foot
    s.stamp(['.pppppppp.', '.p......p.', '..p....p..', '..pppppp..'], px - 5, py - 3, { p: P.cushion })
    solidRect(px - 4, py - 3, px + 4, py)
    const leaves: [number, number, number][] = [[-9, -22, 5], [7, -27, 6], [-3, -33, 5], [11, -16, 4], [-12, -12, 4], [2, -18, 4]]
    for (const [lx, ly, r] of leaves) {
      s.trace(px, py - 4, px + lx * 0.6, py + ly * 0.7, P.plant)
      for (let a = 0; a < 2 * Math.PI; a += 0.35) {
        if (Math.abs(Math.sin(a * 3)) > 0.85) continue // the monstera's splits
        s.set(px + lx + Math.cos(a) * r, py + ly + Math.sin(a) * r * 0.6, P.plant)
      }
      s.trace(px + lx - r * 0.7, py + ly, px + lx + r * 0.7, py + ly, P.plant)
    }
  }

  // ---- the desk, its computer, and the chair
  const dt = L.deskTop
  if (L.deskR > 4) {
    // a cat tower in the corner, if there is room for it
    if (L.deskL > 22 && !L.compact) {
      const cx = Math.round(L.deskL / 2)
      const tall = Math.min(L.foot - Math.max(2, L.ceil + 8), 52)
      s.vline(cx - 2, L.foot - tall, L.foot, P.sisal)
      s.vline(cx + 2, L.foot - tall, L.foot, P.sisal)
      for (let y = L.foot - tall + 1; y < L.foot; y += 2) s.hline(cx - 1, cx + 1, y, P.sisal)
      const plat = (y: number, w: number) => {
        s.hline(cx - w, cx + w, y, P.cushion)
        s.hline(cx - w + 1, cx + w - 1, y + 1, P.cushion)
        solidRect(cx - w, y, cx + w, y + 1)
      }
      plat(L.foot - tall, 8)
      if (tall > 30) plat(L.foot - Math.round(tall * 0.55), 7)
      const bw = 9
      s.box(cx - bw, L.foot - 12, cx + bw, L.foot, P.cushion)
      solidRect(cx - bw, L.foot - 12, cx + bw, L.foot)
      for (let a = 0; a < 2 * Math.PI; a += 0.4) s.set(cx + Math.cos(a) * 3.5, L.foot - 6 + Math.sin(a) * 3.5, P.cushion)
      solidRect(cx - 2, L.foot - tall, cx + 2, L.foot)
    }
    // the desk itself
    s.hline(L.deskL, L.deskR, dt, P.wood)
    s.hline(L.deskL, L.deskR, dt + 1, P.wood)
    solidRect(L.deskL, dt, L.deskR, dt + 1)
    for (const lx of [L.deskL + 1, L.deskR - 2]) {
      s.vline(lx, dt + 2, L.foot, L.compact ? P.metal : P.wood)
      if (!L.compact) s.vline(lx + 1, dt + 2, L.foot, P.wood)
      solidRect(lx, dt + 2, lx + 1, L.foot)
    }
    if (L.compact) {
      const tx0 = L.deskL + 4, tx1 = L.deskL + 11
      s.box(tx0, L.foot - 9, tx1, L.foot, P.metal)
      s.set(tx0 + 2, L.foot - 7, P.led)
      solidRect(tx0, L.foot - 9, tx1, L.foot)
    } else {
      // drawers on the right
      const dx0 = L.deskR - 17, dx1 = L.deskR - 3
      s.box(dx0, dt + 2, dx1, L.foot - 1, P.wood)
      for (const f of [0.33, 0.66]) {
        const y = Math.round(dt + 2 + (L.foot - dt - 3) * f)
        s.hline(dx0, dx1, y, P.wood)
        s.hline(Math.round((dx0 + dx1) / 2) - 1, Math.round((dx0 + dx1) / 2) + 1, y - 3, P.metal)
      }
      s.hline(Math.round((dx0 + dx1) / 2) - 1, Math.round((dx0 + dx1) / 2) + 1, L.foot - 4, P.metal)
      solidRect(dx0, dt + 2, dx1, L.foot)
      // the computer under the left of the desk, its light on
      const tx0 = L.deskL + 5, tx1 = L.deskL + 14
      if (L.deskW >= 50) s.box(tx0, L.foot - 20, tx1, L.foot, P.metal)
      if (L.deskW >= 50) {
        for (let y = L.foot - 16; y < L.foot - 3; y += 2) s.hline(tx0 + 3, tx1 - 2, y, P.metal, 2)
        s.set(tx0 + 2, L.foot - 18, P.led)
        solidRect(tx0, L.foot - 20, tx1, L.foot)
      }
    }
    // the monitor: bezel, stand, and the screen's glow
    const mw = 28, mh = 18
    const mx0 = L.monX - (mw >> 1), mx1 = mx0 + mw - 1, my1 = dt - 5, my0 = my1 - mh + 1
    if (my1 > 0) {
      s.box(mx0, my0, mx1, my1, P.bezel)
      s.hline(mx0 + 1, mx1 - 1, my1 - 1, P.bezel)
      solidRect(mx0, my0, mx1, my1)
      s.vline(L.monX - 1, my1 + 1, dt - 1, P.metal)
      s.vline(L.monX, my1 + 1, dt - 1, P.metal)
      s.hline(L.monX - 5, L.monX + 4, dt - 1, P.metal)
      const sx0 = mx0 + 2, sy0 = my0 + 2, sx1 = mx1 - 2, sy1 = my1 - 3
      room.screen = [sx0, sy0, sx1, sy1]
      // the glow: a faint ordered dither, kept clear around the corner where it sits
      // the welcome: the little orange creature, and three short lines by it
      s.stamp(CLAWD, sx0 + 1, sy0 + 1, { '#': P.clawd })
      s.hline(sx0 + 12, sx0 + 19, sy0 + 1, P.text)
      s.hline(sx0 + 12, sx0 + 16, sy0 + 3, P.text, 2)
      s.hline(sx0 + 12, sx0 + 21, sy0 + 5, P.text, 2)
      // keyboard and mouse
      for (let x = L.monX - 13; x <= L.monX + 9; x++) if (x % 2 === 0 || x === L.monX - 13 || x === L.monX + 9) s.set(x, dt - 1, P.sheet)
      s.hline(L.monX + 13, L.monX + 15, dt - 1, P.sheet)
      s.set(L.monX + 14, dt - 2, P.sheet)
      // a mug of coffee on the right
      const gx = Math.min(L.deskR - 9, mx1 + 6)
      if (gx > mx1 + 3) {
        s.box(gx, dt - 6, gx + 4, dt - 1, P.mug)
        s.vline(gx + 5, dt - 5, dt - 3, P.mug)
        s.set(gx + 6, dt - 4, P.mug)
        room.mug = [gx + 2, dt - 7]
        solidRect(gx, dt - 6, gx + 4, dt - 1)
      }
      // a desk lamp on the left, its head bent over the keyboard
      const lx = L.deskL + 5
      if (lx > 1 && lx < mx0 - 8) {
        s.hline(lx - 3, lx + 3, dt - 1, P.metal)
        s.vline(lx, dt - 15, dt - 2, P.metal)
        s.trace(lx, dt - 15, lx + 6, dt - 21, P.metal)
        s.stamp(['.hhh..', 'hhhhh.', '.hhhhh', '...hh.'], lx + 5, dt - 22, { h: P.metal })
        room.lamp = [lx + 9, dt - 18]
      }
    }
    // a wooden chair, seen from behind, pulled out in front of the desk
    if (!L.compact) {
      const cx = L.monX - 2
      const fy = Math.min(L.H - 1, L.foot + Math.max(2, Math.round(L.depth * 0.32)))
      const seat = fy - 15, back = seat - 15
      for (const lx of [cx - 8, cx + 8]) s.vline(lx, back, fy, P.wood)
      for (const lx of [cx - 6, cx + 6]) s.vline(lx, seat + 2, fy - 2, P.wood)
      s.hline(cx - 9, cx + 9, seat, P.wood)
      s.hline(cx - 9, cx + 9, seat + 1, P.wood)
      s.hline(cx - 8, cx + 8, back, P.wood)
      s.hline(cx - 8, cx + 8, back + 1, P.wood)
      s.hline(cx - 8, cx + 8, back + 5, P.wood)
      solidRect(cx - 9, back, cx + 9, back + 1)
      solidRect(cx - 9, back + 5, cx + 9, back + 5)
      solidRect(cx - 9, seat, cx + 9, seat + 1)
    }
  }

  // ---- the bed: legs, frame, mattress, the duvet over it, the pillow, the headboard
  {
    const b0 = L.bedL, b1 = W - 1
    const bt = L.bedTop
    const ft = L.foot
    for (const lx of [b0 + 2, b1 - 4]) { s.vline(lx, ft - 2, ft, P.wood); s.vline(lx + 1, ft - 2, ft, P.wood) }
    s.hline(b0, b1, ft - 3, P.wood)
    s.hline(b0, b1, ft - 4, P.wood)
    solidRect(b0, bt - 5, b1, ft - 3)
    // the mattress, its side quilted
    s.hline(b0 + 1, b1, ft - 5, P.sheet, 2)
    // the pillow, at the head of the bed
    const pw = Math.min(16, Math.round((b1 - b0) * 0.3))
    const px0 = b1 - pw - 2
    for (let x = px0; x <= px0 + pw; x++) {
      const u = (x - px0) / pw
      const hump = Math.round(Math.sin(u * Math.PI) * 3)
      s.set(x, bt - 1 - hump, P.sheet)
      if (x === px0 || x === px0 + pw) s.vline(x, bt - 1 - hump, bt, P.sheet)
    }
    // the duvet: a soft top, a fold back at the head, polka dots, the hem hanging over the side
    const hem = ft - 6
    for (let x = b0; x < px0; x++) {
      const k = x - b0
      const yTop = bt + 1 - Math.round(1.2 + Math.sin(k / 6 + 0.7) * 0.9 - (k < 4 ? (4 - k) * 0.6 : 0))
      s.set(x, yTop, P.duvet)
      const yHem = hem + (k % 7 < 4 ? 1 : 0)
      s.set(x, yHem, P.duvet)
      for (let y = yTop + 1; y < yHem; y++) if (y % 3 === 1 && (x + y) % 6 === 0 && (!L.compact || y > yTop + 2)) s.set(x, y, P.duvet)
      if (k % 15 === 8) for (let y = yTop + 2; y < yHem - 1; y++) if (y % 2 === 0) s.set(x, y, P.duvet)
    }
    if (!L.compact) {
      s.vline(b0, bt, hem, P.duvet)
      s.vline(px0 - 1, bt - 1, hem, P.sheet)
    }
    // the headboard
    s.vline(b1, bt - 18, ft - 3, P.wood)
    s.vline(b1 - 1, bt - 18, ft - 3, P.wood)
    s.hline(b1 - 3, b1, bt - 18, P.wood)
    solidRect(b1 - 3, bt - 18, b1, ft)
  }

  // ---- toys left about: a mouse on a string, a feather wand
  {
    const my = L.catY
    const mx = Math.round(L.W * 0.13)
    if (!L.compact) {
      s.stamp(['..mm...', '.mmmm..', 'mmmmmm.'], mx, my - 3, { m: P.toyMouse })
      s.hline(mx + 6, mx + 10, my - 1, P.yarn)
    }
    if (L.depth >= 16) {
      const fx = Math.round(L.W * 0.5), fy = Math.min(L.H - 3, L.base + Math.round(L.depth * 0.82))
      s.trace(fx, fy, fx + 16, fy - 3, P.woodDim)
      s.stamp(['.ff.', 'ffff', '.ff.', '..f.'], fx + 16, fy - 6, { f: P.feather })
    }
  }

  return room
}

// ---------------------------------------------------------------- the light, cached for a while

type Light = {
  key: string
  layer: Uint8Array
  /** where the sunbeam is in the air, for the motes */
  beam: Uint8Array
  /** the patch's middle on the cat's row, if the sun is on the floor */
  spot: number | undefined
  /** which way the light falls across the floor: 1 to the right, -1 to the left */
  lean: number
  sky: Sky
  night: boolean
}

/** The room as the light of `sky` falls on it: everything that changes only by the minute. */
function lightOf(room: Room, sky: Sky, key: string): Light {
  const L = room.L
  const { W, H } = L
  const out = new Dots(W / 2, H / 4)
  const a = out.dot
  const beam = new Uint8Array(W * H)
  const gx0 = L.x0, gx1 = L.x1 - 1
  const night = sky.day < 0.5

  // ---- the sky through the glass
  const sunUp = sky.sunAlt > -2
  const toScreen = (alt: number, az: number): [number, number] => [L.winC + (az / 88) * (L.winW / 2), L.hY - (alt / 52) * L.skyH]
  const [sunX, sunY] = toScreen(sky.sunAlt, sky.sunAz)
  // hatched like an engraving: lines closer together and longer toward the
  // haze at the horizon, blue by day, rose and orange in the warm hour,
  // violet after sunset, and at night only the city's glow low down
  for (let y = L.top; y <= L.gy1; y++) {
    for (let x = gx0; x <= gx1; x++) if (room.sky[y * W + x] === 2 && sky.day > 0.4) a[y * W + x] = P.cloudShade
  }
  const tone = 0.1 + sky.day * 0.8 + sky.gold * 0.3 + sky.dusk * 0.4
  // the haze stops at the lower roofs: what shows between them is the city's dark
  const roofs: number[] = []
  for (const b of room.buildings) if (!b.far) roofs.push(b.top)
  roofs.sort((p, q) => p - q)
  const hazeFloor = roofs.length > 0 ? roofs[Math.floor(roofs.length * 0.6)]! : L.hY
  const sunR = 10 + L.skyH * 0.16
  for (let y = Math.min(L.hY, hazeFloor) - 1; y >= L.top;) {
    const v = clamp((y - L.top) / L.skyH, 0, 1) // 0 high, 1 at the horizon
    const fill = clamp(tone * (0.16 + 0.6 * v * v), 0, 0.8)
    const c = sky.gold > 0.4 ? (v > 0.5 ? P.goldLo : P.goldHi) : sky.day > 0.5 ? (v > 0.55 ? P.skyLo : P.skyHi) : sky.dusk > 0.3 ? P.dusk : P.night
    const S = 9 + Math.round(hash(y, 31) * 7)
    for (let x = gx0; x <= gx1; x++) {
      const i = y * W + x
      if (room.sky[i] !== 1) continue
      const u = x + y * 7
      const seg = Math.floor(u / S)
      const at = (u - seg * S - Math.floor(hash(seg, y, 32) * S) + S * 2) % S
      let f = fill, ci = c
      if (sunUp) {
        const dd = Math.hypot(x - sunX, (y - sunY) * 1.2)
        if (dd < sunR) f = Math.min(0.9, f + 0.55 * (1 - dd / sunR) ** 1.4)
      }
      if (at < f * S) a[i] = ci
    }
    y -= Math.round(2 + 3.5 * (1 - v) ** 1.4)
  }
  // a few stars, the brightest ones the city lets through
  if (night) {
    for (let y = L.top; y < L.hY - 6; y++) {
      for (let x = gx0; x <= gx1; x++) {
        if (room.sky[y * W + x] !== 1) continue
        if (hash(x, y, 77) < 0.006) a[y * W + x] = P.star
      }
    }
  }
  // the sun, when it is in the glass
  if (sunUp) {
    const r = clamp(Math.round(L.skyH * 0.045), 2, 4)
    for (let y = -r - 1; y <= r + 1; y++) {
      for (let x = -r - 1; x <= r + 1; x++) {
        const dd = Math.hypot(x, y)
        const px = Math.round(sunX) + x, py = Math.round(sunY) + y
        if (px < gx0 || px > gx1 || py < 0 || py >= H || room.sky[py * W + px] !== 1) continue
        if (dd <= r + 0.3) a[py * W + px] = sky.gold > 0.6 ? P.goldLo : P.sun
        else if (dd <= r + 1.3) a[py * W + px] = 0
      }
    }
  }
  // the moon, in its real phase, when it is up
  if (sky.moonAlt > 3 && sky.phase > 0.03 && sky.phase < 0.97) {
    const [mx, my] = toScreen(sky.moonAlt, sky.moonAz)
    const r = clamp(Math.round(L.skyH * 0.06), 3, 7)
    if (mx > gx0 + r + 2 && mx < gx1 - r - 2 && my > L.top + r + 1 && my < L.hY - r - 2) {
      const tmp = new Dots(Math.ceil(W / 2), Math.ceil(H / 4))
      drawMoon(tmp, Math.round(mx), Math.round(my), r, sky.phase, P.moon, P.moonRim, night ? P.moonHalo : 0, P.maria)
      for (let y = Math.round(my) - r - 4; y <= Math.round(my) + r + 4; y++) {
        for (let x = Math.round(mx) - r - 4; x <= Math.round(mx) + r + 4; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H || room.sky[y * W + x] !== 1) continue
          const v = tmp.get(x, y)
          // by day the moon is pale: its lit side only
          if (v !== 0 && (night || v === P.moon || v === P.maria)) a[y * W + x] = night ? v : P.cloudShade
          else if (v === 0 && Math.hypot(x - mx, y - my) <= r + 1) a[y * W + x] = 0
        }
      }
    }
  }

  // ---- the city, drawn as a skyline: each roof, and each wall where it stands
  // above its neighbor; windows inside, glinting by day and lit by night
  const clip = (x: number) => x >= gx0 && x <= gx1
  const farTop = new Int16Array(W).fill(L.hY), nearTop = new Int16Array(W).fill(L.hY)
  const nearSeed = new Int32Array(W).fill(-1), nearX0 = new Int16Array(W)
  for (const b of room.buildings) {
    for (let x = Math.max(gx0, b.x0); x <= Math.min(gx1, b.x1); x++) {
      if (b.far && L.compact) { if (b.top < nearTop[x]!) { nearTop[x] = b.top; nearSeed[x] = b.seed + 500; nearX0[x] = b.x0 } }
      else if (b.far) farTop[x] = Math.min(farTop[x]!, b.top)
      else if (b.top < nearTop[x]!) { nearTop[x] = b.top; nearSeed[x] = b.seed; nearX0[x] = b.x0 }
    }
  }
  const put = (x: number, y: number, v: number) => { if (clip(x) && y >= 0 && y < H) a[y * W + x] = v }
  const skyline = (tops: Int16Array, under: Int16Array | undefined, ink: number, wallMost: number) => {
    for (let x = gx0; x <= gx1; x++) {
      const t = tops[x]!, floor = under !== undefined ? under[x]! : L.hY
      if (t >= floor) continue
      for (let y = t; y < floor; y++) a[y * W + x] = 0
      put(x, t, ink)
      // a wall shows where the next roof along is lower (in a short window, only its corner);
      // by day the wall toward the sun is lit, the other in shade
      for (const n of [x - 1, x + 1]) {
        const tn = n >= gx0 && n <= gx1 ? Math.max(tops[n]!, Math.min(floor, under !== undefined ? under[n]! : L.hY)) : t
        const sunny = (n < x) === sky.sunAz < 0
        const wall = night || wallMost < 9 ? ink : sunny ? P.midLit : ink
        for (let y = t + 1; y < Math.min(tn + 1, floor, t + 1 + wallMost); y++) put(x, y, wall)
      }
    }
  }
  skyline(farTop, nearTop, night ? P.farNight : P.farDay, 2)
  for (let x = gx0; x <= gx1; x++) {
    for (let y = farTop[x]! + 2; y < nearTop[x]!; y += 2) if (night && (x & 1) === 0 && hash(x, y, 13) < sky.lights * 0.45) a[y * W + x] = P.winWarm
  }
  const small = L.skyH < 22
  const stampCity = (art: Art, x: number, map: Readonly<Record<string, number>>) => {
    const ox = x - (art[0]!.length >> 1), oy = L.hY - art.length
    for (let y = 0; y < art.length; y++) for (let k = 0; k < art[y]!.length; k++) { const v = map[art[y]![k]!]; if (v !== undefined) put(ox + k, oy + y, v) }
  }
  // the Skytree, far off: a slender lattice with its two observation decks
  if (room.tree !== undefined) {
    const { x: tx, h } = room.tree
    const lit = night ? (sky.iki ? P.iki : P.miyabi) : P.skytree
    if (small) stampCity(SKYTREE_SMALL, tx, { s: lit, d: night ? P.towerWhite : lit })
    else {
      for (let k = 0; k <= h; k++) {
        const u = k / h
        const y = L.hY - k
        if (y < 0) continue
        if (u > 0.8) { put(tx, y, lit); continue }
        const w = u < 0.55 ? Math.max(1, Math.round(h * 0.05 * (1 - u * 0.9))) : u < 0.72 ? 1 : 0
        for (let x = tx - w; x <= tx + w; x++) put(x, y, x === tx - w || x === tx + w || (k + x) % 3 === 0 ? lit : 0)
        const deck = Math.abs(u - 0.55) < (0.6 / h) * 2 ? 3 : Math.abs(u - 0.72) < 0.6 / h ? 2 : 0
        if (deck > 0) for (let x = tx - w - deck + 1; x <= tx + w + deck - 1; x++) put(x, y, night ? P.towerWhite : lit)
      }
    }
  }
  // Tokyo Tower: its legs curving in, its lattice, the two decks, the mast;
  // painted in bands of orange and white by day, lit warm orange by night
  if (room.tower !== undefined) {
    const { x: tx, h } = room.tower
    if (small) stampCity(TOWER_SMALL, tx, night ? { r: P.towerLit, w: P.winWarm } : { r: P.towerRed, w: P.towerWhite })
    else {
      const half = (u: number) => Math.max(0.5, h * 0.21 * (1 - u) ** 1.9)
      const paint = (u: number) => {
        if (night) return P.towerLit
        const bands = [0.18, 0.31, 0.42, 0.53, 0.63, 0.73, 0.82, 0.9]
        return bands.some(b => Math.abs(u - b) < 0.5 / h + 0.012) ? P.towerWhite : P.towerRed
      }
      for (let k = 0; k <= h; k++) {
        const u = k / h, y = L.hY - k
        if (y < 0) continue
        const c = paint(u)
        if (u > 0.82) { put(tx, y, c); continue }
        const w = half(u)
        const xl = Math.round(tx - w), xr = Math.round(tx + w)
        for (let x = xl; x <= xr; x++) {
          const onLeg = x <= xl + (w > 4 ? 1 : 0) || x >= xr - (w > 4 ? 1 : 0)
          const brace = w > 2.5 && (Math.abs((x - tx) - (((k % 6) - 3) * w) / 3) < 0.7 || Math.abs((tx - x) - (((k % 6) - 3) * w) / 3) < 0.7)
          put(x, y, onLeg || brace ? c : 0)
        }
        const deck = Math.abs(u - 0.45) * h < 1.1 ? 2 : Math.abs(u - 0.75) * h < 0.6 ? 1 : 0
        if (deck > 0) for (let x = xl - deck; x <= xr + deck; x++) put(x, y, night ? P.winWarm : P.towerWhite)
      }
      const w0 = half(0)
      for (let x = Math.round(tx - w0 * 0.6); x <= Math.round(tx + w0 * 0.6); x++) {
        const yy = L.hY - Math.round(Math.sqrt(Math.max(0, 1 - ((x - tx) / (w0 * 0.6)) ** 2)) * h * 0.08)
        if (yy < L.hY) put(x, yy, paint(0.05))
      }
    }
  }
  // the nearer towers over all that
  skyline(nearTop, undefined, night ? P.midNight : P.midDay, L.compact ? 2 : 99)
  for (let x = gx0; x <= gx1; x++) {
    const t = nearTop[x]!, sd = nearSeed[x]!
    if (sd < 0) continue
    const lit = hash(sd, 3) < 0.6 ? P.winWarm : P.winCool
    for (let y = t + 2; y < L.hY; y++) {
      if ((x - nearX0[x]!) % 2 !== 1 || (y - t) % 3 !== 2) continue
      if (night) { if (hash(x, y, sd + 9) < sky.lights) a[y * W + x] = lit }
      else if (!L.compact && hash(x, y, sd + 9) < 0.12) a[y * W + x] = P.midDay
    }
    // crowns: an antenna, a water tank
    const b0 = nearX0[x]!
    if (!small && hash(sd, 117) < 0.2 && x === b0 + 1) { put(x, t - 1, night ? P.midNight : P.midDay); put(x, t - 2, night ? P.midNight : P.midDay) }
    if (!small && hash(sd, 117) > 0.8 && (x === b0 + 2 || x === b0 + 3)) put(x, t - 1, night ? P.midNight : P.midDay)
  }

  // ---- the room's lines over all that
  const s = room.struct.dot
  for (let i = 0; i < a.length; i++) if (s[i] !== 0) a[i] = s[i]!

  // ---- the sunbeam. Sunlight is parallel: a point of the glass at height f
  // (0 its foot, 1 its top) lands on the floor f of the way out, shifted
  // sideways by the sun's bearing. The patch is the glass laid on the floor,
  // the stile's shadow down it and the railing's bars across its near end;
  // the shafts are the rays on their way there, seen beside the glass.
  let spot: number | undefined
  let lean = 1
  const shine = sky.day * clamp((sky.sunAlt - 1) / 6, 0, 1) * (sky.sunAz > -88 && sky.sunAz < 70 ? 1 : 0)
  if (shine > 0.05) {
    const gold = sky.gold > 0.45
    const gh = L.gy1 - L.gy0
    const len = clamp(Math.round(L.depth * (0.6 + (40 - clamp(sky.sunAlt, 0, 40)) / 40 * 0.4)), 2, L.depth - 1)
    const shift = -Math.sin((sky.sunAz * Math.PI) / 180) * L.winW * 1.1
    lean = shift >= 0 ? 1 : -1
    // the patch, in streaks along the floorboards
    for (let y = Math.max(L.base + 1, ((L.base >> 2) + 1) << 2); y <= Math.min(H - 1, L.base + len); y++) {
      const f = (y - L.base) / len
      const off = shift * f
      const src = L.gy1 - f * gh // the row of glass this light came through
      const barred = src > L.railY + 1
      const railRow = src >= L.railY - 1 && src <= L.railY + 2
      // a weak sun narrows the patch toward its middle rather than thinning it
      const pinch = (1 - Math.min(1, shine * 1.25)) * (gx1 - gx0) * 0.38
      const xl = gx0 + off + pinch, xr = gx1 + off - pinch
      if (y === L.catY) spot = (xl + xr) / 2
      if (railRow) continue
      for (let x = Math.max(0, Math.floor(xl)); x <= Math.min(W - 1, Math.ceil(xr)); x++) {
        const i = y * W + x
        if ((a[i] !== 0 && a[i] !== P.seam) || room.solid[i] !== 0) continue
        a[i] = 0
        const lx = x - off // where on the glass
        if (L.panes === 2 && Math.abs(lx - (L.winC - 0.5)) < 1.6) continue
        if (barred && ((Math.round(lx) - gx0 - 2) % 4 + 4) % 4 === 0) continue
        const edge = Math.min(x - xl, xr - x)
        const dens = (0.35 + 0.65 * Math.min(1, shine * 1.25)) * (edge < 2 ? 0.45 : 0.9) * (y % 2 === 0 ? 1 : 0.12)
        // a dash along the board, its gaps where the light breaks
        const S = 7 + (y % 3)
        const b = (((x + Math.floor(hash(y, 51) * S)) % S) + 0.5) / S
        if (b < dens) a[i] = gold ? P.patchGold : (y >> 2) % 2 === 0 ? P.patchHot : P.patch
      }
    }
    // the shafts beside the glass: rays down toward the patch, a few bright ones
    if (Math.abs(shift) > 2) {
      const dy = gh + len
      const side = shift > 0 ? 1 : -1
      const edgeX = side > 0 ? gx1 + 1 : gx0 - 1
      const reach = Math.abs(shift) + 2
      for (let y = Math.max(0, L.gy0); y < L.base; y++) {
        for (let k = 1; k <= reach; k++) {
          const x = edgeX + side * k
          if (x < 0 || x >= W) break
          const i = y * W + x
          // back along the ray to the glass's edge: is it inside the glass, and not yet on the floor?
          const ySrc = y - (k * dy) / Math.abs(shift)
          if (ySrc < L.gy0 || ySrc > L.gy1) continue
          const fSrc = (L.gy1 - ySrc) / gh
          if (y > L.base + len * fSrc) continue
          beam[i] = 1
          if (a[i] !== 0 || room.solid[i] !== 0) continue
          // a few bright rays, each a dotted line that fades out on its way down
          const along = Math.round(x - side * ((y - L.gy1) * Math.abs(shift)) / dy) // the same all along one ray
          const lane = Math.floor(along / 4)
          const strength = 0.6 - hash(lane, 43)
          if (strength <= 0) continue
          const fade = Math.max(0, 1 - (k / reach) * 1.6)
          if (bayer(x, y) < shine * strength * fade * 0.5) a[i] = gold ? P.beamGold : P.beam
        }
      }
    }
  }
  // moonlight on the floor, faint and cool
  if (night && sky.moonAlt > 8 && sky.phase > 0.2 && sky.phase < 0.8) {
    const len = clamp(Math.round(L.depth * 0.5), 2, L.depth - 1)
    const shift = Math.sin((sky.moonAz * Math.PI) / 180) * -0.8
    for (let y = L.base + 1; y <= Math.min(H - 1, L.base + len); y++) {
      const k = y - L.base
      for (let x = Math.round(gx0 + k * shift * 3); x <= Math.round(gx1 + k * shift * 3); x++) {
        const i = y * W + x
        if (x < 0 || x >= W || a[i] !== 0 || room.solid[i] !== 0) continue
        if (bayer(x, y) < 0.16) a[i] = P.moonPatch
      }
    }
  }

  // ---- time on the wall, a lamp at night, the string of lights
  if (room.clock !== undefined) {
    const [cx, cy, r] = room.clock
    const hAng = ((sky.hour % 12) / 12) * 2 * Math.PI - Math.PI / 2
    const mAng = ((sky.hour % 1) * 2 * Math.PI) - Math.PI / 2
    out.trace(cx, cy, cx + Math.cos(hAng) * (r * 0.5), cy + Math.sin(hAng) * (r * 0.5), P.clockFace)
    out.trace(cx, cy, cx + Math.cos(mAng) * (r * 0.8), cy + Math.sin(mAng) * (r * 0.8), P.clockFace)
  }
  if (room.lamp !== undefined && sky.day < 0.6) {
    const [lx, ly] = room.lamp
    for (let y = ly + 1; y < L.deskTop - 1; y++) {
      const half = (y - ly) * 0.6
      for (let x = Math.round(lx - half); x <= Math.round(lx + half); x++) {
        const i = y * W + x
        if (x < 0 || x >= W || a[i] !== 0) continue
        if (bayer(x, y) < 0.12 * (1 - (y - ly) / (L.deskTop - ly))) a[i] = P.lampCone
      }
    }
    out.hline(lx - 2, lx + 2, ly - 1, P.lampOn)
  }
  for (let k = 0; k < room.bulbs.length; k += 2) out.set(room.bulbs[k]!, room.bulbs[k + 1]!, night || sky.dusk > 0.3 ? P.fairyOn : P.fairy)

  return { key, layer: a, beam, spot, lean, sky, night }
}

// ---------------------------------------------------------------- the cat's moves

type Act = 'sleep' | 'wonder' | 'loaf' | 'sit' | 'walk' | 'bat' | 'gaze' | 'run' | 'ask' | 'meow'
type Cloud = { x: number; y: number; w: number; seed: number; top: Int8Array }

/** A cumulus's outline: for each column, how far above its flat base the top is (bumps of a few overlapping domes). */
function cloudTop(w: number, seed: number): Int8Array {
  const top = new Int8Array(w)
  const n = 3 + Math.floor(hash(seed, 1, 81) * 2)
  for (let k = 0; k < n; k++) {
    const bx = w * (0.16 + 0.68 * (k / (n - 1))) + (hash(seed, k, 82) - 0.5) * w * 0.08
    const mid = 1 - Math.abs(k / (n - 1) - 0.45) * 1.4
    const r = w * (0.1 + 0.08 * hash(seed, k, 83) + 0.1 * mid)
    for (let x = 0; x < w; x++) {
      const dx = x - bx
      if (Math.abs(dx) >= r) continue
      const h = Math.round(Math.sqrt(r * r - dx * dx) * 0.8 + 1 + r * 0.35 * mid)
      if (h > top[x]!) top[x] = Math.min(60, h)
    }
  }
  // a flat, slightly ragged base under the domes
  for (let x = 0; x < w; x++) if (top[x] === 0 && x > w * 0.06 && x < w * 0.94) top[x] = 1
  return top
}
type Bird = { x: number; y: number; vx: number; vy: number; flap: number; land: number; perched: number; leave: number }
type Mote = { x: number; y: number; seed: number }

const CAT_W = 40, CAT_H = 22

class Tokyo implements SceneInstance {
  private d = new Dots(1, 1)
  private out: Frame | undefined
  private seed: number
  private last = -1
  private room: Room | undefined
  private light: Light | undefined
  // the cat: where its paws are (the middle of its pose, its feet's row), the way it faces
  private x = -1
  private y = -1
  private face = -1
  private act: Act = 'sleep'
  private actFor = 0
  private until = 0
  private target = -1
  private targetY = -1
  private next: Act = 'sleep'
  private legs = 0
  private calmFor = 0
  private mood = 'idle'
  private moodFor = 0
  private dreamAt = 400
  private peekAt = 700
  // what the cat shows, dot by dot, in its own small canvas: it eases toward the pose
  private shown = new Uint8Array(CAT_W * CAT_H)
  private want = new Uint8Array(CAT_W * CAT_H)
  private shownAt: [number, number] = [-999, -999]
  private rank = new Uint16Array(CAT_W * CAT_H)
  private shownH = 0
  private moved = new Uint8Array(CAT_W * CAT_H)
  // the ball of yarn
  private ballX = -1
  private ballV = 0
  // outside
  private clouds: Cloud[] = []
  private birds: Bird[] = []
  private plane: { x: number; y: number; vx: number; trail: number } | undefined
  private trainAt = -1
  private trainDir = 1
  private motes: Mote[] = []
  // the monitor's lines while Claude works
  private lines: number[] = []
  private lineAt = 0
  // the spectacle: a sparrow on the rail
  private showAt = -1
  /** Which leg of the zoomies it is on, -1 before they start. */
  private zoom = -1
  private lastSpectacle: number | undefined
  private sparrow: Bird | undefined
  /** The words drawn last tick: a line landing turns the cat at once; any other change of words keeps the tick to itself. */
  private lastWords: string | undefined

  constructor(seed: number) {
    this.seed = seed
    for (let i = 0; i < this.rank.length; i++) {
      const x = i % CAT_W, y = Math.floor(i / CAT_W)
      this.rank[i] = (CAT_H - 1 - y) * 64 + Math.floor(bayer(x, y) * 16) * 4 + Math.floor(hash(x, y, 3) * 4)
    }
  }

  frame(input: SceneInput): Frame {
    const { cols, rows } = input
    if (this.d.cols !== cols || this.d.rows !== rows) {
      this.d = new Dots(cols, rows)
      this.out = undefined
    }
    if (this.room === undefined || this.room.key !== `${cols}x${rows}`) {
      this.room = roomOf(cols, rows, this.seed)
      this.light = undefined
      this.clouds = []
      this.motes = []
      this.x = -1
      this.shownAt = [-999, -999]
      this.shown.fill(0)
    }
    const minute = Math.floor(input.now / 30_000)
    const key = `${this.room.key}|${minute}`
    if (this.light === undefined || this.light.key !== key) this.light = lightOf(this.room, skyAt(input.now), key)
    const steps = this.last < 0 ? 1 : Math.max(0, Math.min(8, input.tick - this.last))
    for (let k = 0; k < steps; k++) this.step(input, input.tick - steps + 1 + k)
    this.last = input.tick
    this.draw(input)
    this.out = packFast(this.d, PALETTE, this.out)
    return this.out
  }

  // ---------------------------------------------------------------- behaviour

  /** Dots a running step covers: as many as the room can show without a jolt. */
  private dash(): number {
    const L = this.room!.L
    return clamp(Math.round((L.W * L.H) / 1500), 1, 3)
  }

  /** A tall window shows the larger cat. */
  private hero(): boolean {
    return this.room!.L.H >= 60
  }

  private home(): { x: number; y: number } {
    const room = this.room!, L = room.L
    const spot = this.light?.spot
    if (spot !== undefined && spot > L.W * 0.4) return { x: clamp(Math.round(spot), L.sunMin, L.sunMax), y: L.catY }
    // no sun on the floor: the bed in a room tall enough, else the floor by it
    if (L.bedTop - 14 > 0 && L.W - L.bedL > 40) return { x: L.bedL + 16, y: L.bedTop + 1 }
    return { x: L.restX, y: L.catY }
  }

  private step(input: SceneInput, t: number): void {
    const room = this.room!, L = room.L
    const mood = input.mood
    if (mood !== this.mood) { this.mood = mood; this.moodFor = 0 } else this.moodFor++
    this.calmFor = mood === 'idle' ? this.calmFor + 1 : 0
    this.actFor++

    if (this.x < 0) {
      const h = this.home()
      this.x = h.x
      this.y = h.y
      this.act = 'sleep'
      this.ballX = L.toyX
    }

    // the spectacle: a sparrow comes to the rail
    if (input.spectacle !== undefined && input.spectacle !== this.lastSpectacle && t >= input.spectacle) {
      this.lastSpectacle = input.spectacle
      this.showAt = t
      this.zoom = -1
      const lx = clamp(Math.round(L.winC + L.winW * 0.18), L.x0 + 6, L.x1 - 8)
      this.sparrow = { x: L.x1 + 6, y: Math.max(1, L.railY - 22), vx: -1.2, vy: 0, flap: 0, land: lx, perched: -1, leave: -1 }
    }
    const show = this.showAt >= 0 ? t - this.showAt : -1
    if (this.sparrow !== undefined) this.stepSparrow(t, show)

    const speaking = input.bubble !== undefined && input.bubble !== '...'
    const walkEvery = clamp(Math.round(40 / Math.max(1, (L.W * L.H) / 120)), 1, 4)

    if (show >= 0 && !speaking) this.stepShow(t, show)
    else if (speaking || mood === 'talk') this.settleTo(mood === 'talk' && this.moodFor < 10 ? 'meow' : 'sit')
    else if (mood === 'ponder') this.settleTo(this.act === 'sleep' || this.act === 'wonder' || this.act === 'loaf' ? 'wonder' : 'ask')
    else if (mood === 'busy') this.patrol(t, walkEvery)
    else this.rest(t, walkEvery)

    // the ball rolls, slowing
    if (Math.abs(this.ballV) > 0.05) {
      this.ballX = clamp(this.ballX + this.ballV, L.catMin - 10, L.catMax + 8)
      this.ballV *= 0.86
    } else this.ballV = 0

    this.stepWeather(input, t)
  }

  /** Stops where it is and takes up `act` (sitting to talk, to wonder). */
  private settleTo(act: Act): void {
    if (this.act === 'walk' || this.act === 'run') this.legs = 0
    if (this.act !== act) { this.act = act; this.actFor = 0 }
  }

  /** Idle: home to where the sun is (or the bed), sit, lie down, sleep. */
  private rest(t: number, every: number): void {
    if (this.act === 'wonder') { this.act = 'sleep'; this.actFor = 300 }
    const h = this.home()
    const L = this.room!.L
    const away = Math.abs(h.x - this.x) > (this.act === 'sleep' ? 16 : 2) || (this.y !== h.y && this.act !== 'sleep')
    if (away && this.act !== 'walk') {
      if (this.act === 'sleep' && this.actFor < 240) return // let the patch move on a while before following it
      this.act = 'walk'
      this.actFor = 0
      this.target = h.x
      this.targetY = h.y
    }
    if (this.act === 'walk') {
      if (this.walkTo(this.target, every, t, this.targetY > L.catY - 2 || this.targetY >= L.glassY ? this.targetY : L.catY)) {
        // reached it: hop up onto the bed if that is home
        this.y = this.targetY >= 0 ? this.targetY : L.catY
        this.act = 'sit'
        this.actFor = 0
      }
      return
    }
    if (this.act === 'sit' || this.act === 'meow' || this.act === 'ask' || this.act === 'bat' || this.act === 'gaze') {
      if (this.actFor > 10) { this.act = 'loaf'; this.actFor = 0 }
      return
    }
    if (this.act === 'loaf' && this.actFor > 14) { this.act = 'sleep'; this.actFor = 0; this.face = -1 }
  }

  /** Busy: up and about. */
  private patrol(t: number, every: number): void {
    const L = this.room!.L
    if (this.act === 'sleep' || this.act === 'loaf' || this.act === 'wonder') {
      if (this.act !== 'loaf') { this.act = 'loaf'; this.actFor = 0; return }
      if (this.actFor > 4) { this.act = 'sit'; this.actFor = 0; this.until = 8 }
      return
    }
    if (this.act === 'walk') {
      if (this.walkTo(this.target, every, t, this.targetY)) {
        this.act = this.next
        this.actFor = 0
        if (this.next === 'gaze') this.face = -1
      }
      return
    }
    if (this.act === 'bat') {
      // a swipe every few ticks; the ball rolls off
      if (this.actFor % 6 === 2 && Math.abs(this.ballX - (this.x + this.face * 11)) < 6) this.ballV = this.face * (1.5 + hash(t, 5) * 1.5)
      if (this.actFor > this.until) this.choose(t)
      return
    }
    if (this.actFor > this.until) this.choose(t)
  }

  private choose(t: number): void {
    const L = this.room!.L
    const roll = hash(t, this.seed, 51)
    const toBall = clamp(Math.round(this.ballX + (this.ballX > this.x ? -12 : 12)), L.catMin, L.catMax)
    if (roll < 0.45) {
      this.go(toBall, 'bat')
      this.until = 16 + Math.floor(hash(t, 52) * 16)
    } else if (roll < 0.75) {
      this.go(clamp(L.winC + Math.round((hash(t, 53) - 0.5) * L.winW * 0.4), L.catMin, L.catMax), 'gaze')
      this.until = 24 + Math.floor(hash(t, 54) * 30)
    } else {
      this.go(clamp(Math.round(L.catMin + hash(t, 55) * (L.catMax - L.catMin)), L.catMin, L.catMax), 'sit')
      this.until = 12 + Math.floor(hash(t, 56) * 16)
    }
  }

  private go(x: number, then: Act): void {
    const L = this.room!.L
    this.act = 'walk'
    this.actFor = 0
    this.target = x
    this.targetY = then === 'gaze' ? L.glassY : L.catY
    this.next = then
    if (this.y < L.glassY) this.y = L.catY // down off the bed
  }

  /** A step toward `x` every `every` ticks; true when there. */
  private walkTo(x: number, every: number, t: number, y = this.room!.L.catY): boolean {
    const L = this.room!.L
    if (this.y < L.glassY) this.y = L.catY // down off the bed
    const dx = x - this.x, dy = y - this.y
    if (Math.abs(dx) < 1 && dy === 0) return true
    if (dx !== 0) this.face = dx < 0 ? -1 : 1
    if (t % every === 0) {
      if (Math.abs(dx) >= 1) this.x += Math.sign(dx)
      if (dy !== 0 && (Math.abs(dx) < 1 || t % (every * 2) === 0)) this.y += Math.sign(dy)
      this.legs ^= 1
    }
    return false
  }

  private stepSparrow(t: number, show: number): void {
    const b = this.sparrow!
    const L = this.room!.L
    if (b.perched < 0) {
      // gliding in to the rail
      const tx = b.land, ty = L.railY - 4
      b.x += (tx - b.x) * 0.12
      b.y += (ty - b.y) * 0.12
      b.flap = (b.flap + 1) % 2
      if (Math.abs(b.x - tx) < 1 && Math.abs(b.y - ty) < 1) { b.x = tx; b.y = ty; b.perched = t }
    } else if (b.leave < 0) {
      // hops now and then, pecks
      if (show > 100 && !(this.act === 'gaze' && this.actFor < 30)) b.leave = t
      else if ((t - b.perched) % 18 === 9) b.x += hash(t, 61) < 0.5 ? -2 : 2
    } else {
      b.x -= 1.4
      b.y -= 0.9
      b.flap = (b.flap + 1) % 2
      if (b.y < -6 || b.x < L.x0 - 8) this.sparrow = undefined
    }
  }

  /** The spectacle's cat: wakes, runs to the glass, chatters, then the zoomies. */
  private stepShow(t: number, show: number): void {
    const L = this.room!.L
    const b = this.sparrow
    if (show < 8) {
      if (this.act === 'sleep' || this.act === 'loaf') { this.act = 'sit'; this.actFor = 0 }
      return
    }
    if (b !== undefined && b.leave < 0) {
      // to the glass beside the bird, not under it, so the bird stays in sight over its shoulder
      const tx = clamp(Math.round(b.land + (this.hero() ? 16 : 11)), L.catMin, L.catMax)
      if (this.act !== 'gaze') {
        if (this.y < L.glassY) this.y = L.catY
        if (Math.abs(tx - this.x) >= 2 || this.y !== L.glassY) {
          this.act = 'run'
          if (Math.abs(tx - this.x) >= 1) this.face = tx < this.x ? -1 : 1
          this.x += Math.sign(tx - this.x) * Math.min(this.dash() - 1 || 1, Math.abs(tx - this.x))
          this.y += Math.sign(L.glassY - this.y) * Math.min(2, Math.abs(L.glassY - this.y))
          this.legs ^= t % 2
        } else { this.act = 'gaze'; this.actFor = 0 }
      }
      return
    }
    // the bird is gone: the zoomies, out to the bed and back to the desk, then home
    if (this.zoom < 0) { this.zoom = 0; this.act = 'run'; this.actFor = 0 }
    const legs = [L.catMax, L.catMin + 4, this.home().x]
    const tx = legs[this.zoom]
    if (tx === undefined) { this.zoom = -1; this.act = 'sit'; this.actFor = 0; this.showAt = -1; return }
    if (Math.abs(tx - this.x) < 2) this.zoom++
    else {
      this.face = tx < this.x ? -1 : 1
      this.x += this.face * Math.min(this.dash(), Math.abs(tx - this.x))
      this.y += Math.sign(L.catY - this.y) * Math.min(2, Math.abs(L.catY - this.y))
      this.legs ^= 1
    }
  }

  // ---------------------------------------------------------------- weather and the city's life

  /** A cloud's base row: high in the sky, each cloud at its own height. */
  private cloudY(i: number, t: number): number {
    const L = this.room!.L
    return L.top + Math.round(L.skyH * (0.08 + 0.1 * (i % 3) + 0.12 * hash(i, t, 72))) + 5
  }

  private stepWeather(input: SceneInput, t: number): void {
    const room = this.room!, L = room.L
    const busy = input.mood === 'busy'
    const light = this.light!
    // clouds: a few, drifting left, faster while Claude works
    if (this.clouds.length === 0 && !L.compact) {
      const n = Math.max(1, Math.round(L.winW / 40))
      for (let i = 0; i < n; i++) {
        const w = clamp(Math.round(Math.min(L.winW, 90) * (0.22 + 0.18 * hash(i, 73))), 8, 32)
        this.clouds.push({ x: L.x0 + ((i + hash(i, this.seed, 71)) / n) * L.winW, y: this.cloudY(i, 0), w, seed: i, top: cloudTop(w, i + this.seed) })
      }
    }
    const every = busy ? 4 : 14
    this.clouds.forEach((c, i) => {
      if ((t + i * 5) % every === 0) c.x -= 1
      if (c.x + c.w < L.x0 - 2) { c.x = L.x1 + 2 + Math.round(hash(t, i, 74) * 10); c.y = this.cloudY(i, t) }
    })
    // birds cross the glass now and then; more often while Claude works
    const chance = (busy ? 0.012 : 0.004) * (light.night ? 0.2 : 1)
    if (this.birds.length === 0 && hash(t, this.seed, 81) < chance && L.skyH > 8) {
      const n = 1 + Math.floor(hash(t, 82) * (L.winW > 60 ? 4 : 2))
      const dir = hash(t, 83) < 0.6 ? -1 : 1
      const y0 = L.top + 2 + hash(t, 84) * L.skyH * 0.5
      for (let k = 0; k < n; k++) this.birds.push({ x: (dir < 0 ? L.x1 + 3 : L.x0 - 6) - dir * k * 5, y: y0 + k * 2 * (k % 2 ? 1 : -1), vx: dir * 0.5, vy: 0, flap: k, land: 0, perched: -1, leave: -1 })
    }
    for (const b of this.birds) {
      if (t % 2 === 0) b.x += b.vx * 2
      if (t % 4 === 0) b.flap ^= 1
      b.y += Math.sin((t + b.flap * 7) / 9) * 0.06
    }
    this.birds = this.birds.filter(b => b.x > L.x0 - 12 && b.x < L.x1 + 12)
    // a plane, high up, once in a while
    if (this.plane === undefined && hash(t, this.seed, 91) < (busy ? 0.004 : 0.0015) && L.skyH > 20) {
      this.plane = { x: L.x1 + 2, y: L.top + 2 + Math.round(hash(t, 92) * L.skyH * 0.25), vx: -0.25, trail: 0 }
    }
    if (this.plane !== undefined) {
      this.plane.x += this.plane.vx
      this.plane.trail = Math.min(this.plane.trail + 0.25, 30)
      if (this.plane.x < L.x0 - 34) this.plane = undefined
    }
    // a train on the line behind the railing, every few minutes
    if (this.trainAt < 0 && hash(Math.floor(t / 4), this.seed, 95) < (busy ? 0.006 : 0.003)) {
      this.trainAt = t
      this.trainDir = hash(t, 96) < 0.5 ? -1 : 1
    }
    if (this.trainAt >= 0 && t - this.trainAt > L.winW + 70) this.trainAt = -1
    // the monitor fills while Claude works, a line every couple of seconds, and keeps it a while
    if (busy && t - this.lineAt >= 7) {
      this.lineAt = t
      this.lines.push(4 + Math.floor(hash(t, this.seed, 97) * 15))
      const sc = room.screen
      const most = sc !== undefined ? Math.floor((sc[3] - ((((sc[1] + 5) >> 2) + 1) << 2)) / 2) : 4
      while (this.lines.length > Math.max(1, most)) this.lines.shift()
    }
    // the dust in the sunbeam: a reward for half a minute of quiet
    const wantMotes = this.calmFor > 120 && light.spot !== undefined ? Math.min(12, 2 + Math.round((L.W * L.H) / 4000)) : 0
    if (this.motes.length < wantMotes && t % 9 === 0) {
      for (let k = 0; k < 40; k++) {
        const x = Math.floor(hash(t, k, 98) * L.W), y = Math.floor(hash(t, k, 99) * L.base)
        if (light.beam[y * L.W + x] === 1) { this.motes.push({ x, y, seed: t + k }); break }
      }
    }
    if (wantMotes === 0 && this.motes.length > 0 && t % 4 === 0) this.motes.pop()
    for (const m of this.motes) {
      if ((t + m.seed) % 6 !== 0) continue
      const nx = m.x + Math.round((noise1(t / 40, m.seed) - 0.5) * 2.4)
      const ny = m.y + (noise1(t / 50, m.seed + 7) < 0.45 ? 1 : noise1(t / 50, m.seed + 7) > 0.6 ? -1 : 0)
      if (light.beam[ny * L.W + nx] === 1) { m.x = nx; m.y = ny }
    }
  }

  // ---------------------------------------------------------------- drawing

  private draw(input: SceneInput): void {
    const d = this.d
    const room = this.room!, light = this.light!, L = room.L
    const t = input.tick
    const W = L.W
    d.dot.set(light.layer)
    d.glyph.fill(0)
    const dot = d.dot
    const sky = light.sky

    // clouds, hatched like the sky: a bright outline over their domes, lines inside, a shaded base
    const cloudInk = light.night ? P.cloudNight : sky.gold > 0.5 ? P.cloudGold : P.cloud
    for (const c of this.clouds) {
      const cx = Math.round(c.x)
      for (let k = 0; k < c.w; k++) {
        const x = cx + k
        if (x < 0 || x >= W) continue
        const h = c.top[k]!
        if (h === 0) continue
        const rim = c.y - h
        const side = Math.min(c.top[k - 1] ?? 0, c.top[k + 1] ?? 0)
        for (let y = rim; y <= c.y; y++) {
          const i = y * W + x
          if (y < 0 || room.sky[i] !== 1 || (light.layer[i] !== 0 && SKYISH[light.layer[i]!] === 0)) continue
          let v = 0
          if (y === c.y) v = (x + c.seed) % 3 !== 0 ? cloudInk : 0
          else if (y === rim || y < c.y - side) v = cloudInk
          else if ((c.y - y) % 2 === 0 && (x + y * 5) % 9 < (light.night ? 2 : 6)) v = cloudInk
          dot[i] = v
        }
      }
    }
    // the plane and its trail
    if (this.plane !== undefined) {
      const p = this.plane
      const px = Math.round(p.x), py = Math.round(p.y)
      const put = (x: number, y: number, v: number) => { if (x >= 0 && x < W && y >= 0 && room.sky[y * W + x] === 1) dot[y * W + x] = v }
      if (light.night) put(px, py, Math.floor(t / 3) % 2 === 0 ? P.beacon : P.plane)
      else {
        put(px, py, P.plane)
        put(px + 1, py, P.plane)
        for (let k = 3; k < p.trail; k++) if ((k + px) % 2 === 0) put(px + k, py, P.contrail)
      }
    }
    // the train
    if (this.trainAt >= 0) {
      const len = 46
      const k = t - this.trainAt
      const head = this.trainDir > 0 ? L.x0 - len + k : L.x1 + len - k
      const y0 = L.hY - 4
      for (let x = Math.round(head - (this.trainDir > 0 ? len : 0)); x < Math.round(head + (this.trainDir > 0 ? 0 : len)); x++) {
        if (x < L.x0 || x >= L.x1) continue
        if (room.struct.dot[y0 * W + x] !== 0) continue
        dot[y0 * W + x] = P.train
        dot[(y0 + 1) * W + x] = (x % 3 !== 0 && light.night) ? P.trainWin : 0
        dot[(y0 + 2) * W + x] = P.train
      }
    }
    // birds
    for (const b of this.birds) {
      const art = FLAP[b.flap]!
      this.stampClip(art, b.x, b.y, P.bird, true)
    }
    if (this.sparrow !== undefined) {
      const b = this.sparrow
      const art = b.perched >= 0 && b.leave < 0 ? SPARROW[Math.floor((t - b.perched) / 5) % 7 === 3 ? 1 : 0]! : FLAP[b.flap]!
      this.stampClip(art, b.x, b.y, P.sparrow, false, true)
    }
    // the beacons breathe at night, each on its own slow beat
    if (light.night || sky.dusk > 0.4) {
      for (let k = 0; k < room.beacons.length; k += 2) {
        const x = room.beacons[k]!, y = room.beacons[k + 1]!
        if (y >= 0 && Math.floor((t + k * 7) / 6) % 3 !== 0) dot[y * W + x] = P.beacon
      }
    }
    // the monitor's lines while Claude works, and its cursor
    if (room.screen !== undefined) {
      const [sx0, sy0, sx1, sy1] = room.screen
      // from the cell row under the creature's feet, so no line shares its cells
      let y = (((sy0 + 5) >> 2) + 1) << 2
      for (const len of this.lines) {
        for (let x = sx0 + 1; x < Math.min(sx1, sx0 + 1 + len); x++) if (x % 2 === 0 || len < 6) dot[y * W + x] = P.text
        y += 2
      }
      const cy = Math.min(sy1, y)
      if (input.mood === 'busy' || Math.floor(t / 4) % 2 === 0) { dot[cy * W + sx0 + 1] = P.text; dot[cy * W + sx0 + 2] = P.text }
    }
    // steam over the mug while Claude works
    if (room.mug !== undefined && input.mood === 'busy') {
      const [mx, my] = room.mug
      for (let k = 0; k < 6; k++) {
        const x = mx + Math.round(Math.sin((k + Math.floor(t / 3)) / 1.6) * 1.2)
        if (k % 2 === 0) dot[(my - k) * W + x] = P.steam
      }
    }
    // the string of lights twinkles at night: a bulb dims now and then, a change of color, never of a dot
    if (light.night || sky.dusk > 0.3) {
      for (let k = 0; k < room.bulbs.length; k += 2) {
        const i = room.bulbs[k + 1]! * W + room.bulbs[k]!
        if (dot[i] === P.fairyOn && hash(k, Math.floor((t + k * 13) / 24), 7) < 0.3) dot[i] = P.fairy
      }
    }
    // motes in the sunbeam
    for (const m of this.motes) {
      if (Math.abs(m.x - this.x) < 20 && m.y > this.y - 26) continue
      dot[m.y * W + m.x] = P.mote
    }
    // the ball of yarn
    {
      const bx = Math.round(this.ballX), by = L.catY - 4
      const roll = Math.floor(this.ballX / 2) % 2
      const art = roll === 0 ? ['.yyy.', 'yy.yy', 'y.y.y', 'yy.yy', '.yyy.'] : ['.yyy.', 'y.yyy', 'yy.yy', 'yyy.y', '.yyy.']
      this.stampClip(art, bx - 2, by, P.yarn, false)
    }

    this.drawCat(input)

    // the bubble, above the cat or beside it
    if (input.bubble !== undefined) {
      const pose = this.poseNow(input)
      const art = this.hero() ? LARGE[pose] : SMALL[pose]
      const w = art[0]!.length
      const [hx, hy] = (this.hero() ? HEAD_L : HEAD_S)[pose]
      const left = Math.round(this.x - w / 2)
      const top = this.y - art.length + 1
      const headX = this.face > 0 && pose !== 'back' && pose !== 'twitch' ? left + w - 1 - hx : left + hx
      const headY = this.y - hy
      drawBubble(d, input.bubble, { c: Math.floor(headX / 2), r: Math.max(0, Math.floor(headY / 4)) }, { c0: Math.floor(left / 2) - 1, r0: Math.max(0, Math.floor(top / 4)), c1: Math.ceil((left + w) / 2) + 1, r1: input.rows }, P.border, P.words, P.border, input.asciiBorders === true)
    }
  }

  private stampClip(art: Art, ox: number, oy: number, v: number, skyOnly: boolean, edge = false): void {
    const room = this.room!, W = room.L.W, H = room.L.H
    const dot = this.d.dot
    ox = Math.round(ox)
    oy = Math.round(oy)
    if (edge) {
      for (let y = -1; y <= art.length; y++) {
        for (let x = -1; x <= art[0]!.length; x++) {
          const px = ox + x, py = oy + y
          if (px >= 0 && py >= 0 && px < W && py < H) dot[py * W + px] = 0
        }
      }
    }
    for (let y = 0; y < art.length; y++) {
      for (let x = 0; x < art[y]!.length; x++) {
        if (art[y]![x] === '.') continue
        const px = ox + x, py = oy + y
        if (px < 0 || py < 0 || px >= W || py >= H) continue
        const i = py * W + px
        if (skyOnly ? room.sky[i] === 0 && !(px >= room.L.x0 && px < room.L.x1 && py < room.L.railY && room.struct.dot[i] === 0) : false) continue
        dot[i] = v
      }
    }
  }

  /** The pose for this tick, from the act and the clock. */
  private poseNow(input: SceneInput): Pose {
    const t = input.tick
    switch (this.act) {
      case 'sleep': {
        if (this.calmFor > this.dreamAt && this.calmFor < this.dreamAt + 14) return t % 4 < 2 ? 'dream' : 'sleep'
        if (this.calmFor > this.peekAt && this.calmFor < this.peekAt + 7) return 'peek'
        return Math.floor(t / 10) % 2 === 0 ? 'sleep' : 'sleepIn'
      }
      case 'wonder': return Math.floor(this.actFor / 3) % 4 === 1 ? 'wonderFlick' : 'wonder'
      case 'loaf': return 'loaf'
      case 'walk': return this.legs === 0 ? 'walk0' : 'walk1'
      case 'run': return this.legs === 0 ? 'run0' : 'run1'
      case 'bat': return this.actFor % 6 < 3 ? 'bat0' : 'bat1'
      case 'gaze': return this.showAt >= 0 && t % 4 < 2 ? 'twitch' : (this.actFor % 20 > 16 ? 'twitch' : 'back')
      case 'ask': return Math.floor(this.actFor / 4) % 3 === 1 ? 'askFlick' : 'ask'
      case 'meow': return this.actFor % 4 < 2 ? 'meow' : 'sit'
      default: return this.actFor % 23 === 20 ? 'blink' : 'sit'
    }
  }

  /** The cat, eased toward its pose a limited number of dots a tick, with a clear edge around it. */
  private drawCat(input: SceneInput): void {
    const room = this.room!, L = room.L
    const W = L.W, H = L.H
    if (this.calmFor > this.dreamAt + 20) this.dreamAt = this.calmFor + 480 + Math.floor(hash(input.tick, 31) * 240)
    if (this.calmFor > this.peekAt + 10) this.peekAt = this.calmFor + 700 + Math.floor(hash(input.tick, 32) * 400)
    if (this.calmFor === 0) { this.dreamAt = 360; this.peekAt = 600 }
    const pose = this.poseNow(input)
    const art = this.hero() ? LARGE[pose] : SMALL[pose]
    const flip = this.face > 0 && pose !== 'back' && pose !== 'twitch'
    // the canvas: the cat's feet on its bottom row, centered
    const ax = Math.round(this.x) - (CAT_W >> 1), ay = Math.round(this.y) - CAT_H + 1
    const want = this.want
    want.fill(0)
    const w = art[0]!.length
    const ox = (CAT_W >> 1) - Math.round(w / 2), oy = CAT_H - art.length
    for (let y = 0; y < art.length; y++) {
      const row = art[y]!
      for (let x = 0; x < w; x++) {
        const ch = row[flip ? w - 1 - x : x]!
        if (ch === '.') continue
        want[(oy + y) * CAT_W + ox + x] = ch === ',' ? 255 : FUR[ch] ?? 0
      }
    }
    // a clear edge, so the cat reads against the sun on the floor and the bed behind it
    for (let y = 0; y < CAT_H; y++) {
      for (let x = 0; x < CAT_W; x++) {
        const i = y * CAT_W + x
        if (want[i] !== 0) continue
        const n = (x > 0 && want[i - 1]! > 0 && want[i - 1]! < 255) || (x < CAT_W - 1 && want[i + 1]! > 0 && want[i + 1]! < 255) || (y > 0 && want[i - CAT_W]! > 0 && want[i - CAT_W]! < 255)
        if (n) want[i] = 254
      }
    }
    // the shown cat moves with it; then eases toward the pose
    const shown = this.shown
    if (this.shownAt[0] !== ax || this.shownAt[1] !== ay) {
      const dx = ax - this.shownAt[0], dy = ay - this.shownAt[1]
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) shown.set(want)
      else {
        const moved = this.moved
        moved.fill(0)
        for (let y = 0; y < CAT_H; y++) {
          for (let x = 0; x < CAT_W; x++) {
            const sx = x + dx, sy = y + dy
            if (sx >= 0 && sy >= 0 && sx < CAT_W && sy < CAT_H) moved[y * CAT_W + x] = shown[sy * CAT_W + sx]!
          }
        }
        shown.set(moved)
      }
      this.shownAt = [ax, ay]
    }
    const roomDots = W * H
    const cap = input.mood === 'busy' ? 0.016 : this.showAt >= 0 ? 0.03 : 0.009
    // A line landing redraws the band anyway: the cat turns to it on that very tick.
    // Any other change of words (the "...", the bubble going) takes the tick to itself.
    const wordsChanged = input.bubble !== this.lastWords
    const landed = wordsChanged && input.bubble !== undefined && input.bubble !== '...'
    this.lastWords = input.bubble
    let budget = landed ? 1 << 20 : wordsChanged ? 0 : Math.max(8, Math.floor(roomDots * cap))
    // getting up, the new pose rises from the floor; lying down, it settles from the head
    const rising = art.length >= this.shownH
    this.shownH = art.length
    // first the dots whose ink only changes (free), then the toggles in a dissolving order
    const order: number[] = []
    for (let i = 0; i < shown.length; i++) {
      const a = shown[i]!, b = want[i]!
      if (a === b) continue
      const aOn = a > 0 && a < 254, bOn = b > 0 && b < 254
      if (aOn && bOn) shown[i] = b
      else order.push(i)
    }
    order.sort((p, q) => (rising ? this.rank[p]! - this.rank[q]! : this.rank[q]! - this.rank[p]!))
    for (const i of order) {
      if (budget <= 0) break
      shown[i] = want[i]!
      budget--
    }
    // paint it
    const dot = this.d.dot
    for (let y = 0; y < CAT_H; y++) {
      const py = ay + y
      if (py < 0 || py >= H) continue
      for (let x = 0; x < CAT_W; x++) {
        const px = ax + x
        if (px < 0 || px >= W) continue
        const v = shown[y * CAT_W + x]!
        if (v === 0) continue
        dot[py * W + px] = v >= 254 ? 0 : v
      }
    }
    // its shadow in the sun: the patch goes out beside it, the way the light falls
    if (this.light!.spot !== undefined && this.y >= L.catY - 1) {
      const lean = this.light!.lean
      const half = Math.round(w * 0.42)
      const x0 = Math.round(this.x + lean * w * 0.3)
      for (let k = 1; k <= 3; k++) {
        const py = Math.round(this.y) + k - 1
        if (py < 0 || py >= H) continue
        for (let x = x0 - half + k * lean * 2; x <= x0 + half + k * lean * 2; x++) {
          if (x < 0 || x >= W) continue
          const v = dot[py * W + x]!
          if (v === P.patch || v === P.patchHot || v === P.patchGold) dot[py * W + x] = 0
        }
      }
    }
  }
}

export const tokyo: SceneDef = {
  id: 'tokyo-cat',
  name: 'Tokyo Cat',
  persona: 'a calico cat who follows the patch of sun across the floor of a small Tokyo apartment',
  bubbleInk: PALETTE[P.border]!,
  minCols: 40,
  minRows: 5,
  create: seed => new Tokyo(seed),
}
