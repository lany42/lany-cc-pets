// Looks for the tests alone, as broken.ts's are: never listed and never
// picked, and a pet wears one only where the store names it. `test-window` is
// a baked pet with a window picture: a 6 x 2 eye in the band and a 30 x 10
// one in the pet window, drawn here by one function at two sizes, so the
// tests (and the dev tools' stats of its window) can hold the window
// canvas to its rules without any real pet's art. `test-cells` is a scene
// opted into cell rendering (scene/fixture.ts). `test-pet-cells` and
// `test-window-cells` are the eye painting in cells, without and with its
// window picture: its palette's raw colors, and its runs made from those
// cells, as checkLab holds them. `test-frame-clock` is the eye with a frame
// clock of its own, writing on itself what each frame was told. Every look
// here draws whole, so the studio
// takes each one by id and `golden` keeps them all; a look that throws on
// purpose belongs in broken.ts.
import { bakedLook, packWindow } from './baked/pet'
import type { Baked, BakedPet, Ink, Step } from './baked/pet'
import { runsOf, sameCells, TERMINAL } from './cells'
import { cellsOf, Dots } from './drawn/dots'
import { widthOf } from './look'
import type { LabCells, LabLook, LabMood, LabRun, Live } from './look'
import { CELL_FIXTURE } from './scene/fixture'

const RIM = 1
const PUPIL = 2
const MOUTH = 3

type Pose = { look: number; isShut?: boolean; isTalking?: boolean }

/** The eye in a `cols` x `rows` box: a rim, its pupil `look` eighths of a turn round (-1 at the centre), a mouth under it. */
function eye(cols: number, rows: number, pose: Pose): Baked {
  const dots = new Dots(cols, rows)
  const cx = cols - 0.5
  const cy = rows * 2 - 0.5
  const r = rows * 2 - 1.5
  for (let a = 0; a < 64; a++) dots.set(cx + Math.cos((a * Math.PI) / 32) * r * 1.4, cy + Math.sin((a * Math.PI) / 32) * r * 0.9, RIM)
  if (pose.isShut === true) dots.line(cx - r, cy, cx + r, cy, RIM)
  else {
    const turn = (pose.look * Math.PI) / 4
    const reach = pose.look < 0 ? 0 : r * 0.45
    const px = cx + Math.cos(turn) * reach * 1.4
    const py = cy + Math.sin(turn) * reach * 0.9
    const size = Math.max(1, Math.round(r / 5))
    for (let dy = -size; dy <= size; dy++) for (let dx = -size; dx <= size; dx++) dots.set(px + dx, py + dy, PUPIL)
  }
  if (pose.isTalking === true) dots.line(cx - r * 0.5, rows * 4 - 1, cx + r * 0.5, rows * 4 - 1, MOUTH)
  const cells = cellsOf(dots)
  return { lines: cells.map(row => row.map(cell => cell.ch).join('')), ink: cells.map(row => row.map(cell => (cell.ink === 0 ? ' ' : String(cell.ink))).join('')) }
}

const POSES: Readonly<Record<string, Pose>> = {
  open: { look: -1 },
  blink: { look: -1, isShut: true },
  east: { look: 0 },
  south: { look: 2 },
  west: { look: 4 },
  north: { look: 6 },
  up: { look: 7 },
  say: { look: -1, isTalking: true },
}

const LOOPS: Readonly<Record<LabMood, readonly Step[]>> = {
  idle: [['open', 12], 'blink', ['open', 7]],
  busy: [['east', 2], ['south', 2], ['west', 2], ['north', 2]],
  ponder: [['up', 7], 'north'],
  talk: ['say', 'open'],
}

const framesAt = (cols: number, rows: number): Record<string, Baked> => Object.fromEntries(Object.entries(POSES).map(([name, pose]) => [name, eye(cols, rows, pose)]))

const PET: BakedPet = {
  id: 'test-window',
  name: 'Window Test',
  persona: 'a test eye with a bigger picture for the pet window',
  width: 6,
  height: 2,
  palette: [
    { name: 'rim', key: 'suggestion', dark: '#8fb8de', light: '#2f5f8f' },
    { name: 'pupil', key: 'text', dark: '#f4f1e8', light: '#2a2a2a' },
    { name: 'mouth', key: 'warning', dark: '#f2c14e', light: '#b07b00' },
  ],
  fallback: 'many-eyes',
  frames: framesAt(6, 2),
  loops: LOOPS,
  window: packWindow({ width: 30, height: 10, frames: framesAt(30, 10), loops: LOOPS }),
}

/**
 * A frame of the eye's theme-key runs painted as a Raster's cells: each ink
 * the raw color its palette tuned for the theme (a Raster names no theme
 * key), a blank in the terminal's own colors.
 */
function painted(rows: readonly (readonly LabRun[])[], palette: readonly Ink[], isLight: boolean): { columns: number; rows: number; data: Uint32Array } {
  const columns = Math.max(1, ...rows.map(widthOf))
  const data = new Uint32Array(columns * rows.length * 3)
  for (let at = 0; at < data.length; at += 3) data.set([0x20, TERMINAL, TERMINAL], at)
  rows.forEach((row, r) => {
    let c = 0
    for (const run of row) {
      const ink = palette.find(one => one.key === run.color)
      const rgb = ink === undefined ? TERMINAL : parseInt((isLight ? ink.light : ink.dark).slice(1), 16)
      for (const char of run.text) {
        const at = (r * columns + c++) * 3
        data[at] = char.codePointAt(0) ?? 0x20
        if (char !== ' ') data[at + 1] = rgb
      }
    }
  })
  return { columns, rows: rows.length, data }
}

/**
 * `look` as `id`, each live one painting in cells, as a pet that paints in
 * cells does: its frame in its palette's raw colors (`painted`), and its runs,
 * and its band self's, made from those cells (`runsOf`), so its cells and
 * its runs are one frame, as checkLab holds them. Its card draws as the
 * eye's own.
 */
function offeringCells(look: LabLook, id: string, palette: readonly Ink[]): LabLook {
  return {
    ...look,
    id,
    start(seed, memory) {
      const eye = look.start(seed, memory)
      let isLight = false
      let cells: LabCells = { columns: 1, rows: 0, data: new Uint32Array(0), version: 0 }
      let runs: LabRun[][] = []
      const live: Live = {
        step(input) {
          eye.step(input)
          isLight = input.isLight
          const next = painted(eye.runs(), palette, isLight)
          // A frame drawn already keeps its version and its runs.
          if (next.columns === cells.columns && next.rows === cells.rows && sameCells(next.data, cells.data)) return
          cells = { ...next, version: cells.version + 1 }
          runs = runsOf(cells)
        },
        runs: () => runs,
        cells: () => cells,
      }
      const band = eye.bandRuns
      if (band !== undefined) live.bandRuns = () => runsOf({ ...painted(band(), palette, isLight), version: 0 })
      return live
    },
  }
}

/**
 * `look` as `id` with a frame clock of its own (`frames` a tick, so the band
 * steps it between ticks and blits its cells), and a row over it saying what
 * its last step was told: the frame (0, the tick itself), then `s` for a line
 * spoken, `x` for a spectacle and `t` for turns ended, a dot for each not
 * told. So each frame differs from the one before, and each blit says which
 * frame it is and what news reached it, for the tests to read. It paints
 * in cells as `offeringCells` does, its runs made from them; its cells are
 * new only when a cell is.
 */
function tellingFrames(look: LabLook, id: string, frames: number, palette: readonly Ink[]): LabLook {
  const telling = (live: Live): Live => {
    let told = ''
    let shown: LabCells = { columns: 0, rows: 0, data: new Uint32Array(0), version: 0 }
    let runs: LabRun[][] = []
    return {
      step(input) {
        live.step(input)
        told = `${input.frame ?? 0}${input.spoke ? 's' : '.'}${input.spectacle ? 'x' : '.'}${input.turnsEnded > 0 ? 't' : '.'}`
        const next = painted([[{ text: told.padEnd(look.width) }], ...live.runs()], palette, input.isLight)
        if (next.columns === shown.columns && next.rows === shown.rows && sameCells(next.data, shown.data)) return
        shown = { ...next, version: shown.version + 1 }
        runs = runsOf(shown)
      },
      runs: () => runs,
      cells: () => shown,
    }
  }
  return {
    ...look,
    id,
    name: 'Frame Clock Test',
    persona: 'a test eye that writes on itself what each of its frames was told',
    height: look.height + 1,
    frames,
    start: (seed, memory) => telling(look.start(seed, memory)),
    demo: () => telling(look.demo()),
  }
}

const { window: _picture, ...BAND_ONLY } = PET

/** The eye at three frames a tick: its clock beats every 83 ms, the third beat at 249, so a frame stepped past a tick's last would land just before the next tick. */
export const FRAME_FIXTURE = tellingFrames(bakedLook(BAND_ONLY, 'a test of frames'), 'test-frame-clock', 3, PET.palette)

export const FIXTURE_LOOKS: readonly LabLook[] = [
  bakedLook(PET, 'a window of its own'),
  CELL_FIXTURE,
  offeringCells(bakedLook(BAND_ONLY, 'cells, no window'), 'test-pet-cells', PET.palette),
  offeringCells(bakedLook(PET, 'cells and a window'), 'test-window-cells', PET.palette),
  FRAME_FIXTURE,
]
