// Peek: something shy that lives behind a ledge just above your prompt.
//
// You only ever see the top of its head, its two big eyes and its fingers
// hooked over the ledge. It watches you idle; when Claude gets busy it ducks
// out of sight and leaves only its fingers, then checks on the work now and
// then with a quick peep. When it has something to say it pulls itself up far
// enough for its mouth to clear the ledge. Every so often it drops down and
// comes up somewhere else along the ledge.
//
// Braille throughout: the ledge is a row of dots, the creature is clipped at a
// cell boundary so the ledge cells never take its colour (except under its
// hands, which is what hands on a ledge look like). It rises and sinks one
// dot at a time, which no character-cell sprite can do.
import { cellsOf, Dots, hash, runsOf } from './dots'
import type { Drawing, ExperimentalPet, Moment } from './pet'

const LEDGE = 1
const BODY = 2
const PALETTE = [{}, { color: 'inactive' }, { color: 'autoAccept' }]

/** The block: 3 rows of air above the ledge row; cells across. */
const ROWS = 4
const COLS = 24
/** Under this many band columns the ledge shrinks to NARROW cells and it stays in one spot, so a bubble still fits beside it. */
const NARROW_BELOW = 50
const NARROW = 18
/** The dot row the ledge sits on: the top of the last row. Everything of the creature below it is hidden. */
const WALL = (ROWS - 1) * 4

// The head, 16 dots wide, rows 0-11. '#' body, '_' a hole: two big eyes.
// Each eye's pupil (2x2) is drawn into its hole by the pose; a blink fills it.
const HEAD = [
  '....########....', // 0
  '..############..', // 1
  '.##############.', // 2
  '##____####____##', // 3  eyes, rows 3-7
  '#______##______#', // 4
  '#______##______#', // 5
  '#______##______#', // 6
  '##____####____##', // 7
  '################', // 8
  '################', // 9  mouth rows 9-10
  '################', // 10
  '################', // 11
]
/** Where the pupils look: dx -2..2 across the hole, dy -1..1 up and down. */
type Look = { dx: number; dy: number }
const LOOK = {
  ahead: { dx: 0, dy: 0 },
  left: { dx: -2, dy: 0 },
  right: { dx: 2, dy: 0 },
  up: { dx: 0, dy: -1 },
  upLeft: { dx: -2, dy: -1 },
  down: { dx: 0, dy: 1 },
  downLeft: { dx: -2, dy: 1 },
} satisfies Record<string, Look>

/** Its hands: two fingers' width each, hooked over the ledge (rows from WALL - 1). */
const HAND = [
  '##.##.##',
  '##.##.##',
  '##.##.##',
  '.#..#..#',
]

type Pose = {
  /** Where the head's left edge is, in dots. */
  x: number
  /** How many dots of the head clear the ledge. */
  up: number
  look: Look
  blink?: boolean
  /** 0 shut, 1 a slit, 2 open. */
  mouth?: 0 | 1 | 2
  /** Fingers on the ledge (false while it is down and gone). */
  hands?: boolean
}

function drawPeek(p: Pose, cols: number): Dots {
  const d = new Dots(cols, ROWS)
  const top = WALL - p.up
  if (p.up > 0) {
    d.stamp(HEAD, p.x, top, { '#': BODY, '_': 0 })
    for (const ex of [3, 11]) {
      if (p.blink) {
        // shut: the lid fills the hole but for a seam along its lower third
        for (let y = 3; y <= 7; y++) for (let x = ex - 2; x <= ex + 3; x++) if (y !== 6 || x === ex - 2 || x === ex + 3) d.set(p.x + x, top + y, BODY)
      } else {
        for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) d.set(p.x + ex + p.look.dx + x, top + 5 + p.look.dy + y, BODY)
      }
    }
    if (p.mouth !== undefined && p.mouth > 0) {
      for (let x = 6; x < 10; x++) d.erase(p.x + x, top + 9)
      if (p.mouth === 2) for (let x = 7; x < 9; x++) d.erase(p.x + x, top + 10)
    }
    // everything at or below the ledge is behind it
    d.clip((_x, y) => y < WALL)
  }
  // the ledge, fading at its ends
  for (let x = 0; x < cols * 2; x++) {
    const edge = Math.min(x, cols * 2 - 1 - x)
    if (edge >= 4 || x % 2 === 0) d.set(x, WALL, LEDGE)
    if (edge >= 6) d.set(x, WALL + 1, LEDGE)
  }
  if (p.hands !== false) {
    d.stamp(HAND, p.x - 9, WALL - 1, { '#': BODY, '.': 0 })
    d.stamp(HAND, p.x + 17, WALL - 1, { '#': BODY, '.': 0 }, true)
  }
  return d
}

/** Spots along the ledge where it surfaces, as the head's left edge in dots. */
const SPOTS = [9, 16, 23]
/** The one spot on the narrow ledge. */
const NARROW_SPOT = 10
const spotAt = (tick: number, narrow: boolean) => (narrow ? NARROW_SPOT : SPOTS[Math.floor(hash(Math.floor(tick / 96), 3) * SPOTS.length)]!)

function idle(m: Moment): Pose {
  // A 96-tick loop at one spot, then it may move: sink, gone a beat, rise at the next spot.
  const visit = Math.floor(m.tick / 96)
  const spot = spotAt(visit * 96, m.columns < NARROW_BELOW)
  const k = m.tick % 96
  const base = { x: spot, up: 8, look: LOOK.ahead, hands: true }
  // surfacing at the start of a visit (rise over 5 ticks), sinking at its end
  if (k < 5) return { ...base, up: [0, 2, 4, 6, 7][k]!, hands: k > 1 }
  if (k >= 92) return { ...base, up: [6, 3, 1, 0][k - 92]!, hands: k < 94 }
  if (k < 20) return base
  if (k < 21) return { ...base, blink: true }
  if (k < 30) return { ...base, look: LOOK.left }
  if (k < 34) return { ...base, look: LOOK.upLeft }
  if (k < 44) return base
  if (k < 52) return { ...base, look: LOOK.right }
  if (k < 53) return { ...base, look: LOOK.right, blink: true }
  if (k < 60) return { ...base, look: LOOK.right }
  // it sinks a little, as if settling its chin on the ledge
  if (k < 74) return { ...base, up: 7, look: LOOK.down }
  if (k < 75) return { ...base, up: 7, blink: true }
  if (k < 84) return base
  if (k < 85) return { ...base, blink: true }
  return base
}

function busy(m: Moment): Pose {
  const spot = spotAt(m.tick, m.columns < NARROW_BELOW)
  const s = m.since
  // duck: down over 4 ticks
  if (s < 4) return { x: spot, up: [6, 4, 2, 0][s]!, look: LOOK.down, hands: true }
  // every 24 ticks a peep: eyes just over the ledge, a look left (at the work), back down
  const k = (s - 4) % 24
  const peep = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 4, 6, 6, 6, 6, 4, 2, 0][k]!
  const look = k < 18 ? LOOK.ahead : LOOK.left
  return { x: spot, up: peep, look, hands: true }
}

function ponder(m: Moment): Pose {
  const spot = spotAt(m.tick, m.columns < NARROW_BELOW)
  const s = m.since
  return { x: spot, up: Math.min(8, 4 + s * 2), look: s % 8 < 4 ? LOOK.upLeft : LOOK.up, hands: true }
}

function talk(m: Moment): Pose {
  const spot = spotAt(m.tick, m.columns < NARROW_BELOW)
  const s = m.since
  const up = s < 2 ? 9 + s : 11
  const mouth = ([1, 2, 2, 1, 0, 2, 1, 2, 0, 1, 2, 0] as const)[s % 12]
  return { x: spot, up, look: s % 10 < 6 ? LOOK.left : LOOK.ahead, mouth, hands: true }
}

function draw(m: Moment): Drawing {
  const pose = m.mood === 'busy' ? busy(m) : m.mood === 'ponder' ? ponder(m) : m.mood === 'talk' ? talk(m) : idle(m)
  return { band: runsOf(cellsOf(drawPeek(pose, m.columns < NARROW_BELOW ? NARROW : COLS)), PALETTE) }
}

export const pet: ExperimentalPet = {
  id: 'peek',
  name: 'Peek',
  persona: 'a shy round creature that lives behind a ledge above the prompt and only shows its eyes and fingers',
  blurb: 'hides behind a ledge; ducks when Claude works',
  color: 'autoAccept',
  ownsBubble: false,
  rows: { rest: ROWS, most: ROWS },
  draw,
}
