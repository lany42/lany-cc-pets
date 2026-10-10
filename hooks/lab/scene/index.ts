// The scene kind: a creature living in a scene as wide as the band (a koi
// pond, an owl's night, the deep), from braille-ambient. The scene draws the
// pet's words into its own sky, steps itself as the clock tells it, and is
// drawn as Text runs in its artist's raw colors for the person's theme; a
// scene that opts into cell rendering (`cells`, scene/cells.ts) is drawn as
// Raster cells instead. Pure: this adapter makes each scene a lab look.
import type { Color } from 'claude-code'

import { addCell } from '../../runs'
import { runsOf, sameCells } from '../cells'
import type { LabCells, LabLook, LabRun, Live } from '../look'
import { isCellSafe } from '../look'
import { CellLayer } from './cells'
import type { SceneCells, SceneFrameInput } from './cells'
import { deep } from './deep'
import { dreamer } from './dreamer'
import { colorOf, hex } from './kit'
import type { Frame, SceneDef, Theme } from './kit'
import { night } from './night'
import { pond } from './pond'
import { prairie } from './prairie'
import { tokyo } from './tokyo'

/** A scene's rows in the band, and its gallery thumbnail's columns. */
const ROWS = 6
const THUMBNAIL_COLUMNS = 40

/** A palette's inks as hex, per theme: worked out once, not once a cell. */
const HEXES = new WeakMap<Frame['palette'], Partial<Record<Theme, string[]>>>()

/**
 * A frame's rows as runs, for Text (runs.ts `addCell`). Its dots take the
 * scene's tuned ink for the theme; its bubble's border takes the look's
 * theme key, and its words no color at all, so they are the theme's own
 * text. A frame that paints backgrounds (kit.ts `litFrame`) gives each cell
 * its background ink, 0 for the terminal's own, as part of its run's style,
 * so a space joins only a run on its own background; without them every
 * space joins the run before it.
 */
function sceneRuns(frame: Frame, theme: Theme, border: Color): LabRun[][] {
  const known: Partial<Record<Theme, string[]>> = HEXES.get(frame.palette) ?? {}
  const hexes = (known[theme] ??= frame.palette.map(ink => hex(colorOf(ink, theme))))
  HEXES.set(frame.palette, known)
  const bg = frame.bg
  const rows: LabRun[][] = []
  for (let r = 0; r < frame.rows; r++) {
    const runs: LabRun[] = []
    for (let c = 0; c < frame.cols; c++) {
      const at = r * frame.cols + c
      const cp = frame.cp[at] ?? 0x20
      const back = bg === undefined ? 0 : (bg[at] ?? 0)
      const inkAt = frame.ink[at] ?? 0
      const isDot = cp >= 0x2800 && cp < 0x2900
      const color = isDot ? (inkAt > 0 ? hexes[inkAt] : undefined) : cp >= 0x2500 && cp < 0x2580 ? border : undefined
      addCell(runs, String.fromCharCode(cp), cp === 0x20, color, back > 0 ? hexes[back] : undefined)
    }
    rows.push(runs)
  }
  return rows
}

/** One scene, alive: it steps to each tick it is given (and only those), drawing in the band's room. */
function stage(def: SceneDef, seed: number, border: Color): Live {
  const scene = def.create(seed)
  let spectacleAt: number | undefined
  let drawn: LabRun[][] = []
  return {
    step(input) {
      if (input.spectacle) spectacleAt = input.tick
      // Its "..." while the pet thinks, and the line while it shows: words it can't draw cell for cell, the band bubbles.
      const line = input.line !== undefined && isCellSafe(input.line.text) ? input.line.text : undefined
      const bubble = input.mood === 'ponder' ? '...' : line
      const theme = input.isLight ? 'light' : 'dark'
      const frame = scene.frame({
        tick: input.tick,
        mood: input.mood,
        cols: input.room.columns,
        rows: input.room.rows,
        ...(bubble !== undefined ? { bubble } : {}),
        ...(spectacleAt !== undefined ? { spectacle: spectacleAt } : {}),
        now: input.now,
        theme,
      })
      drawn = sceneRuns(frame, theme, border)
    },
    runs: () => drawn,
  }
}

/**
 * One scene that paints in cells (`cells` in sceneLook), alive: each step's
 * frame becomes Raster cells (scene/cells.ts), kept only if a cell changed
 * (`version`), and its Text runs are made from them when asked. With
 * `frames`, the frame clock steps it between ticks with the tick's input and
 * `frame`; the scene is told which (SceneFrameInput). Where ambiguous
 * characters are drawn wide (`isAmbiguousWide`) its bubble's border is ASCII,
 * its field keeps to the narrow blocks, and a line that isn't ASCII is left
 * to the band to bubble.
 */
function cellStage(def: SceneDef, seed: number, opts: SceneCells): Live {
  const scene = def.create(seed)
  const layer = new CellLayer()
  let spectacleAt: number | undefined
  let shown: LabCells = { columns: 0, rows: 0, data: new Uint32Array(0), version: 0 }
  let spare: Uint32Array = new Uint32Array(0)
  let runs: LabRun[][] | undefined
  let isLeft = false
  return {
    step(input) {
      if (input.spectacle) spectacleAt = input.tick
      const isWide = input.isAmbiguousWide === true
      const said = input.line !== undefined && isCellSafe(input.line.text) ? input.line.text : undefined
      // A line that isn't ASCII, where ambiguous characters are wide, goes to the band.
      const line = said !== undefined && isWide && !/^[\x20-\x7e]*$/.test(said) ? undefined : said
      isLeft = said !== undefined && line === undefined && input.mood !== 'ponder'
      const bubble = input.mood === 'ponder' ? '...' : line
      const theme = input.isLight ? 'light' : 'dark'
      const sceneInput: SceneFrameInput = {
        tick: input.tick,
        mood: input.mood,
        cols: input.room.columns,
        rows: input.room.rows,
        ...(bubble !== undefined ? { bubble } : {}),
        ...(spectacleAt !== undefined ? { spectacle: spectacleAt } : {}),
        now: input.now,
        theme,
        ...(isWide ? { asciiBorders: true } : {}),
        ...(opts.frames !== undefined ? { frame: input.frame ?? 0, frames: opts.frames } : {}),
      }
      const frame = scene.frame(sceneInput)
      const words = frame.cols * frame.rows * 3
      if (spare.length !== words) spare = new Uint32Array(words)
      layer.encode(frame, theme, spare, opts.blocks !== true ? 'flat' : isWide ? 'narrow' : 'blocks')
      // Only a changed frame is a new one: the clock blits nothing for the rest.
      if (shown.columns === frame.cols && shown.rows === frame.rows && sameCells(shown.data, spare)) return
      const data = spare
      spare = shown.data
      shown = { columns: frame.cols, rows: frame.rows, data, version: shown.version + 1 }
      runs = undefined
    },
    runs() {
      runs ??= runsOf(shown)
      return runs
    },
    cells: () => shown,
    leftWords: () => isLeft,
  }
}

/**
 * How a scene is registered. `fewest`: the rows a short band may crop it to,
 * sky first, once it is composed in its artist's least. `blurb`: its card's
 * own words, else its rows. `cells` (opt-in): it is drawn as Raster cells,
 * with `blocks` its field in block elements, with `frames` that many frames a
 * tick (see SceneCells); absent, it is drawn as Text runs, as ever.
 */
export function sceneLook(def: SceneDef, extra: { fallback: string; bubble: Color; fewest?: number; blurb?: string; cells?: SceneCells }): LabLook {
  const height = Math.max(ROWS, def.minRows)
  const cells = extra.cells
  return {
    id: def.id,
    name: def.name,
    persona: def.persona,
    // Its rows: the band's button keeps its corner and takes none.
    blurb: extra.blurb ?? `fills the band · ${height} rows`,
    layout: 'scene',
    width: THUMBNAIL_COLUMNS,
    height,
    ...(def.minRows < height ? { least: def.minRows } : {}),
    ...(extra.fewest !== undefined ? { fewest: extra.fewest } : {}),
    minColumns: Math.max(def.minCols, THUMBNAIL_COLUMNS),
    ownsBubble: true,
    fallback: extra.fallback,
    bubble: extra.bubble,
    ...(cells?.frames !== undefined ? { frames: cells.frames } : {}),
    ...(cells?.blocks === true ? { blocks: true as const } : {}),
    start: seed => (cells !== undefined ? cellStage(def, seed, cells) : stage(def, seed, extra.bubble)),
    demo: () => (cells !== undefined ? cellStage(def, 1, cells) : stage(def, 1, extra.bubble)),
  }
}

// The pond's top two rows at its fewest are sky and far shore: its water, reeds and koi are the three under them.
// The owl and its tree, and the deep's creature, take every row they are composed in: neither has sky to spare.
// The Tokyo cat's top row at its fewest is the skyline's tips: the floor, the cat and the city's foot stay.
const SCENES: readonly (readonly [SceneDef, Parameters<typeof sceneLook>[1]])[] = [
  [pond, { fallback: 'axolotl', bubble: 'claude', fewest: 3 }],
  [night, { fallback: 'fruit-bat', bubble: 'warning' }],
  [deep, { fallback: 'sea-angel', bubble: 'planMode' }],
  [tokyo, { fallback: 'cat', bubble: 'suggestion', fewest: 4, blurb: 'follows the sun across the floor' }],
  [dreamer, { fallback: 'many-eyes', bubble: 'merged', fewest: 4, blurb: 'storms as Claude works' }],
  [prairie, { fallback: 'yak', bubble: 'ide', blurb: 'digs while Claude works' }],
]

export const SCENE_LOOKS: readonly LabLook[] = SCENES.map(([def, extra]) => sceneLook(def, extra))
