// How a pet, and the speech bubble it talks through, are painted: one steady
// color, a rainbow, a shine, or (opt-in) regions of colors that hold still.
// Pure: turns a paint, a tick and some text into runs of one style each,
// which the render hooks draw as nested Text. It imports nothing at run time
// but runs.ts (pure too), so the Node preview loads it too.
import type { Color } from 'claude-code'

import { addCell } from './runs'
import type { Run } from './runs'

export type { Run }

/** A sprite's paint; the bubble always matches it. */
export type Paint =
  /** One color, steady: a theme key (`claude`, `success`...) or a raw color. */
  | Color
  /** Diagonal stripes of `colors` sliding across, one step every `ticks` (default 2). */
  | { kind: 'rainbow'; colors?: readonly Color[]; ticks?: number }
  /** `color`, with a glint of `shine` (default `text`, bold) sweeping across every `every` ticks (default 32). */
  | { kind: 'shiny'; color: Color; shine?: Color; every?: number }
  /**
   * Opt-in: a few colors that hold still, region by region. `map` is the
   * sprite's own size, a digit a cell: '1' paints it `colors[0]`, '2'
   * `colors[1]`, up to 9. The bubble's border and the emote by its head take
   * `border` (default `colors[0]`). `words` colors the bubble's words by
   * character, `[color, until, color, ...]` (`['ide', 18, 'warning']`: the
   * first 18 in `ide`, the rest in `warning`); left out, the words are the
   * theme's own text, as a steady paint's. Nothing moves: no color motion.
   */
  | Regions

/** A regions paint (see Paint). */
export type Regions = { kind: 'regions'; colors: readonly Color[]; map: readonly string[]; border?: Color; words?: readonly (Color | number)[] }

/** A rainbow of theme keys, so it follows the person's light or dark theme. */
export const RAINBOW: readonly Color[] = ['error', 'warning', 'success', 'planMode', 'suggestion', 'autoAccept']
export const DEFAULT_PAINT: Color = 'claude'

const RAINBOW_TICKS = 2
const SHINE: Color = 'text'
const SHINE_EVERY = 32
/** How many ticks a glint takes to cross a sprite; it moves two diagonals a tick. */
export const SWEEP_TICKS = 11

/** A paint with every default filled in: what each painter below draws from. */
type FullPaint =
  | { kind: 'steady'; color: Color }
  | { kind: 'rainbow'; colors: readonly Color[]; ticks: number }
  | { kind: 'shiny'; color: Color; shine: Color; every: number }
  | { kind: 'regions'; colors: readonly Color[]; map: readonly string[]; border: Color; words: readonly (Color | number)[] | undefined }

export function withDefaults(paint: Paint | undefined): FullPaint {
  if (paint === undefined || typeof paint === 'string') return { kind: 'steady', color: paint ?? DEFAULT_PAINT }
  if (paint.kind === 'rainbow') {
    const colors = paint.colors !== undefined && paint.colors.length > 0 ? paint.colors : RAINBOW
    return { kind: 'rainbow', colors, ticks: paint.ticks ?? RAINBOW_TICKS }
  }
  if (paint.kind === 'regions') return { kind: 'regions', colors: paint.colors, map: paint.map, border: paint.border ?? paint.colors[0] ?? DEFAULT_PAINT, words: paint.words }
  return { kind: 'shiny', color: paint.color, shine: paint.shine ?? SHINE, every: paint.every ?? SHINE_EVERY }
}

/** The one color that stands for a paint: a card's border, a preview's label. */
export function colorOf(paint: Paint | undefined): Color {
  const full = withDefaults(paint)
  if (full.kind === 'regions') return full.border
  return full.kind === 'rainbow' ? (full.colors[0] ?? DEFAULT_PAINT) : full.color
}

/** Where a shiny paint's glint is at `tick`: the diagonal it lights, or undefined between sweeps. */
function glintAt(shiny: Extract<FullPaint, { kind: 'shiny' }>, tick: number): number | undefined {
  const phase = tick % Math.max(SWEEP_TICKS + 1, shiny.every)
  return phase < SWEEP_TICKS ? phase * 2 : undefined
}

/** The style of a space that joins the run before it: never read. */
const BLANK: Style = {}

/** A painted character's style: its color, and bold for a glint. */
type Style = { color?: Color; bold?: true }

/**
 * Splits `line` into runs (runs.ts `addCell`), merging neighbours of one
 * style; spaces take whatever style they sit in. It walks characters, not
 * UTF-16 units, so no run ends halfway through an emoji.
 */
function runsOf(line: string, styleAt: (column: number) => Style): Run[] {
  const runs: Run[] = []
  let column = 0
  for (const char of line) {
    const isBlank = char === ' ' && runs.length > 0
    const style = isBlank ? BLANK : styleAt(column)
    addCell(runs, char, isBlank, style.color, undefined, undefined, style.bold)
    column += 1
  }
  return runs
}

/** A sprite frame's lines as runs, painted at `tick`. */
export function paintLines(paint: Paint | undefined, lines: readonly string[], tick: number): Run[][] {
  const full = withDefaults(paint)
  if (full.kind === 'steady') return lines.map(text => [{ text, color: full.color }])
  if (full.kind === 'rainbow') {
    const { colors } = full
    const shift = Math.floor(tick / full.ticks)
    return lines.map((line, row) =>
      runsOf(line, column => ({ color: colors[mod(Math.floor(column / 2) + row - shift, colors.length)] })),
    )
  }
  if (full.kind === 'regions') return regionLines(full, lines)
  const glint = glintAt(full, tick)
  return lines.map((line, row) =>
    runsOf(line, column =>
      glint !== undefined && (column + row === glint || column + row === glint + 1)
        ? { color: full.shine, bold: true }
        : { color: full.color },
    ),
  )
}

/** The bubble's words as runs: a rainbow paints them, a shine sweeps them, a steady paint leaves them be. */
export function paintText(paint: Paint | undefined, text: string, tick: number): Run[] {
  const full = withDefaults(paint)
  if (full.kind === 'steady') return [{ text }]
  if (full.kind === 'rainbow') {
    const { colors } = full
    const shift = Math.floor(tick / full.ticks)
    return runsOf(text, at => ({ color: colors[mod(Math.floor(at / 3) - shift, colors.length)] }))
  }
  if (full.kind === 'regions') {
    const { words } = full
    if (words === undefined) return [{ text }]
    return runsOf(text, at => {
      const color = wordColorAt(words, at)
      return color === undefined ? {} : { color }
    })
  }
  const glint = glintAt(full, tick)
  if (glint === undefined) return [{ text }]
  // The bubble's words are longer than a sprite is wide: the glint covers them in the same sweep.
  const from = Math.floor((glint / (SWEEP_TICKS * 2)) * [...text].length)
  return runsOf(text, at => (at >= from && at < from + 3 ? { color: full.shine, bold: true } : {}))
}

/** The bubble's border at `tick`: the paint's color, cycling for a rainbow, flashing with a shine's sweep. */
export function borderOf(paint: Paint | undefined, tick: number): Color {
  const full = withDefaults(paint)
  if (full.kind === 'steady') return full.color
  if (full.kind === 'rainbow') return full.colors[mod(Math.floor(tick / full.ticks), full.colors.length)] ?? DEFAULT_PAINT
  if (full.kind === 'regions') return full.border
  return glintAt(full, tick) === undefined ? full.color : full.shine
}

const mod = (n: number, by: number) => ((n % by) + by) % by

// Regions (opt-in): colors that hold still, cell by cell.

/** A frame under a regions paint: each cell its map digit's color. Lines that aren't a frame of the map's size (the emote by its head) take the border's. */
function regionLines(full: Extract<FullPaint, { kind: 'regions' }>, lines: readonly string[]): Run[][] {
  const isFrame = lines.length === full.map.length && lines.every((line, row) => [...line].length === [...(full.map[row] ?? '')].length)
  return lines.map((line, row) => {
    const digits = isFrame ? [...(full.map[row] ?? '')] : []
    return runsOf(line, column => ({ color: full.colors[Number(digits[column]) - 1] ?? full.border }))
  })
}

/** The color of the words' character `at` under `words`, `[color, until, color, ...]`. */
function wordColorAt(words: readonly (Color | number)[], at: number): Color | undefined {
  let color: Color | undefined
  for (const part of words) {
    if (typeof part !== 'number') color = part
    else if (at < part) return color
  }
  return color
}
