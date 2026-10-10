// Looper: an inchworm that lives on the rim of its own speech bubble.
//
// There is no sprite beside the bubble: the bubble is the pet's home. At rest
// it is squashed flat into a one-row pod of dots, and the worm lies along its
// top, the same dotted texture as the rim, so you mostly notice it when it
// moves. It inches by looping its body up off the rim and down again.
// Busy, it does slow laps around the pod (a spinner that is alive). Pondering,
// the pod inflates around three bobbing dots and the worm rears up, thinking.
// When a line lands it measures it: it inches along the top edge from left to
// right, leaving ruler notches behind, and rears up at the far end.
//
// Everything is braille but the words. One canvas holds rim, notches, worm and
// thinking dots; each cell takes the colour of its highest ink.
import { wrap } from '../bubble'
import type { Run } from './dots'
import { cellsOf, Dots, hash, put, runsOf } from './dots'
import type { Drawing, ExperimentalPet, Moment } from './pet'

const RIM = 1
const NOTCH = 2
const THINK = 3
const WORM = 4
/** Ink order is priority: the worm wins a cell it shares with the rim. */
const PALETTE = [{}, { color: 'inactive' }, { color: 'inactive' }, { color: 'text', dim: true as const }, { color: 'success', bold: true as const }]

/** The worm's body, in dots. */
const BODY = 8
/** How far one inch moves it along the rim, in dots. */
const STRIDE = 4
/** Ticks per inch: pull the tail in (2), reach the head out (2). */
const STEP_TICKS = 4
/** Cells of margin left and right of the rim, for the worm to loop out into. */
const SIDE = 2
/** The pod's inner run of dots across, in cells. */
const POD_INNER = 9
const BUBBLE_MAX = 50

type Pt = { x: number; y: number; nx: number; ny: number }

/**
 * The rim as a closed path of dots, clockwise from the top-left, each with its
 * outward normal. Corners are cut on the diagonal (radius `r`).
 */
function rimPath(x0: number, y0: number, x1: number, y1: number, r: number): Pt[] {
  const p: Pt[] = []
  const d = Math.SQRT1_2
  for (let x = x0 + r; x <= x1 - r; x++) p.push({ x, y: y0, nx: 0, ny: -1 })
  for (let i = r - 1; i >= 1; i--) p.push({ x: x1 - i, y: y0 + r - i, nx: d, ny: -d })
  for (let y = y0 + r; y <= y1 - r; y++) p.push({ x: x1, y, nx: 1, ny: 0 })
  for (let i = 1; i <= r - 1; i++) p.push({ x: x1 - i, y: y1 - r + i, nx: d, ny: d })
  for (let x = x1 - r; x >= x0 + r; x--) p.push({ x, y: y1, nx: 0, ny: 1 })
  for (let i = r - 1; i >= 1; i--) p.push({ x: x0 + i, y: y1 - r + i, nx: -d, ny: d })
  for (let y = y1 - r; y >= y0 + r; y--) p.push({ x: x0, y, nx: -1, ny: 0 })
  for (let i = 1; i <= r - 1; i++) p.push({ x: x0 + i, y: y0 + r - i, nx: -d, ny: -d })
  return p
}

/** The path at arc position `s` (wrapping), interpolated between its dots. */
function at(path: readonly Pt[], s: number): Pt {
  const n = path.length
  const i = Math.floor(s)
  const f = s - i
  const a = path[((i % n) + n) % n]!
  const b = path[(((i + 1) % n) + n) % n]!
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, nx: a.nx + (b.nx - a.nx) * f, ny: a.ny + (b.ny - a.ny) * f }
}

/** The worm's pose: where its rear and front ends are on the path, which way it faces, how it rears. */
type Pose = { tail: number; head: number; dir: 1 | -1; rear?: number }

/** Where the worm is `t` ticks into an inch that starts with its rear at `s` (facing `dir`). */
function inching(s: number, t: number, dir: 1 | -1): Pose {
  const k = ((t % STEP_TICKS) + STEP_TICKS) % STEP_TICKS
  const steps = Math.floor(t / STEP_TICKS)
  const base = s + dir * steps * STRIDE
  // 0: flat; 1: rear half pulled in; 2: rear fully in (tall loop); 3: front reaching out
  const rearIn = [0, STRIDE / 2, STRIDE, STRIDE][k]!
  const frontOut = [0, 0, 0, STRIDE / 2][k]!
  const rear = base + dir * rearIn
  const front = base + dir * (BODY + frontOut)
  return { tail: rear, head: front, dir }
}

/** Draws the worm on `d`, along `path`, in `pose`. */
function drawWorm(d: Dots, path: readonly Pt[], pose: Pose): void {
  const { tail, head, dir } = pose
  const span = Math.abs(head - tail)
  if (pose.rear !== undefined) {
    // Rear half flat on the rim, front half raised at `rear` radians off it.
    const mid = tail + dir * BODY / 2
    for (let s = 0; s <= BODY / 2; s++) {
      const p = at(path, tail + dir * s)
      d.set(p.x + p.nx, p.y + p.ny, WORM)
    }
    const m = at(path, mid)
    const tx = -m.ny * dir, ty = m.nx * dir // tangent, in the facing direction (clockwise path)
    const cos = Math.cos(pose.rear), sin = Math.sin(pose.rear)
    const len = BODY / 2 + 0.5
    const ex = m.x + m.nx + len * (cos * tx + sin * m.nx)
    const ey = m.y + m.ny + len * (cos * ty + sin * m.ny)
    d.line(m.x + m.nx, m.y + m.ny, ex, ey, WORM)
    // the head: one dot more, forward
    d.set(ex + cos * tx * 1 + sin * m.nx * 1, ey + cos * ty + sin * m.ny, WORM)
    return
  }
  // A loop: half the length it has lost lifts the middle off the rim.
  const lift = span >= BODY ? 0 : Math.sqrt(Math.max(0, (BODY / 2) ** 2 - (span / 2) ** 2)) * 1.1
  const samples = Math.max(2, Math.ceil(span * 2) + 2)
  let last: { x: number; y: number } | undefined
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const p = at(path, tail + (head - tail) * u)
    const off = 1 + lift * Math.sin(Math.PI * u)
    const q = { x: Math.round(p.x + p.nx * off), y: Math.round(p.y + p.ny * off) }
    if (last !== undefined) d.line(last.x, last.y, q.x, q.y, WORM)
    else d.set(q.x, q.y, WORM)
    last = q
  }
  // the head end is a dot taller: it lifts its face off the rim
  const h = at(path, head)
  d.set(h.x + h.nx * 2, h.y + h.ny * 2, WORM)
}

/** The pod or the bubble: its canvas, rim path and where the words go. */
type Shell = { d: Dots; path: Pt[]; text: string[]; textRow: number; textCol: number }

function shell(lines: readonly string[], inner: number): Shell {
  const cols = inner + 2 * SIDE + 4
  if (lines.length === 0) {
    // the pod: one row of rim, a margin row above and below for the loops
    const d = new Dots(cols, 3)
    const x0 = SIDE * 2 + 1, x1 = (cols - SIDE) * 2 - 2
    const path = rimPath(x0, 4, x1, 7, 1)
    return { d, path, text: [], textRow: 0, textCol: 0 }
  }
  const rows = lines.length + 4
  const d = new Dots(cols, rows)
  const x0 = SIDE * 2 + 1, x1 = (cols - SIDE) * 2 - 2
  const y0 = 4 + 2, y1 = (rows - 2) * 4 + 1
  const path = rimPath(x0, y0, x1, y1, 2)
  return { d, path, text: [...lines], textRow: 2, textCol: SIDE + 2 }
}

function finish(s: Shell): Run[][] {
  for (const p of s.path) if (s.d.at(p.x, p.y) === 0) s.d.set(p.x, p.y, RIM)
  const cells = cellsOf(s.d)
  // words over the canvas; their spaces leave whatever dots are there (the thinking dots)
  s.text.forEach((line, i) => [...line].forEach((ch, j) => { if (ch !== ' ') put(cells, s.textRow + i, s.textCol + j, ch, 0) }))
  return runsOf(cells, PALETTE)
}

/** Idle on the pod: rests, rears up to look about, inches a little way and back. A 96-tick loop. */
function idlePose(t: number, top: [number, number]): Pose {
  const home = Math.round((top[0] + top[1] - BODY) / 2)
  const k = t % 96
  // two short walks per loop, one each way; never off the top run
  if (k < 20) return { tail: home, head: home + BODY, dir: 1 }
  if (k < 32) return { tail: home, head: home + BODY, dir: 1, rear: 0.5 + 0.45 * Math.sin((k - 20) * 0.7) }
  if (k < 40) return { tail: home, head: home + BODY, dir: 1 }
  if (k < 48) return inching(home, k - 40, 1) // two inches right
  const right = home + 2 * STRIDE
  if (k < 66) return { tail: right, head: right + BODY, dir: 1 }
  if (k < 74) {
    // turn round: rear the front up and over
    const u = (k - 66) / 8
    return { tail: right, head: right + BODY, dir: 1, rear: 0.3 + u * 2.6 }
  }
  // face left: its rear is now at the right end
  const back = right + BODY
  if (k < 82) {
    const p = inching(back, k - 74, -1)
    return p
  }
  return { tail: home + BODY, head: home, dir: -1 }
}

function draw(m: Moment): Drawing {
  // the words get what is left of the columns once the rim, its padding and the margins are paid for
  const room = Math.max(12, Math.min(BUBBLE_MAX, m.columns - 2 * SIDE - 4))

  if (m.line !== undefined || m.mood === 'ponder') {
    const thinking = m.line === undefined
    const lines = thinking ? [''] : wrap(m.line!.text, room)
    const inner = thinking ? POD_INNER - 4 : Math.max(POD_INNER - 4, ...lines.map(l => l.length))
    const s = shell(lines.map(l => l.padEnd(inner)), inner)
    const top = s.path.findIndex(p => p.ny === -1)
    const runEnd = s.path.filter(p => p.ny === -1).length - 1 + top

    if (thinking) {
      // three dots bobbing in a wave inside
      const t = m.since
      for (let i = 0; i < 3; i++) {
        const y = 8 + Math.round(1.5 + 1.5 * Math.sin((t - i * 1.3) * 0.9))
        s.d.set(s.textCol * 2 + 1 + i * 3, y, THINK)
      }
      drawWorm(s.d, s.path, { tail: top, head: top + BODY, dir: 1, rear: 1.0 + 0.35 * Math.sin(t * 0.5) })
      return { band: finish(s) }
    }

    // measuring: an inch every STEP_TICKS from the left end; done, it rears up at the right
    const age = m.line!.age
    const reach = runEnd - top - BODY
    const inches = Math.max(0, Math.floor(reach / STRIDE))
    const walking = age < inches * STEP_TICKS
    const pose = walking ? inching(top, age, 1) : { tail: top + inches * STRIDE, head: top + inches * STRIDE + BODY, dir: 1 as const, rear: age < inches * STEP_TICKS + 14 ? 1.2 + 0.3 * Math.sin(age * 0.9) : undefined }
    // ruler notches where it has measured: one per inch, just inside the rim
    const done = walking ? Math.floor(age / STEP_TICKS) : inches
    for (let i = 0; i <= done; i++) {
      const p = s.path[top + i * STRIDE]
      if (p !== undefined) s.d.set(p.x, p.y + 1, NOTCH)
    }
    drawWorm(s.d, s.path, pose)
    return { band: finish(s) }
  }

  // the pod
  const s = shell([], POD_INNER)
  const topRun: [number, number] = [0, s.path.filter(p => p.ny === -1).length - 1]
  if (m.mood === 'busy') {
    // slow laps, clockwise; it starts where idle left it
    const home = Math.round((topRun[0] + topRun[1] - BODY) / 2)
    drawWorm(s.d, s.path, inching(home, m.since, 1))
  } else {
    // idle: and every so often, a pause of a whole loop resting (so it isn't always busy)
    const lap = Math.floor(m.tick / 96)
    const lazy = hash(lap, 7) < 0.35
    const pose = lazy ? { tail: Math.round((topRun[0] + topRun[1] - BODY) / 2), head: Math.round((topRun[0] + topRun[1] + BODY) / 2), dir: 1 as const } : idlePose(m.tick, topRun)
    drawWorm(s.d, s.path, pose)
  }
  return { band: finish(s) }
}

export const pet: ExperimentalPet = {
  id: 'looper',
  name: 'Looper',
  persona: 'an inchworm that lives on the rim of its own speech bubble',
  blurb: 'lives in its own speech bubble',
  color: 'success',
  ownsBubble: true,
  rows: { rest: 3, most: 3 + 4 },
  draw,
}
