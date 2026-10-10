// How a pet, and the speech bubble it talks through, are painted: one steady
// color, a rainbow, a shine, or (opt-in) regions of colors that hold still.
// Pure: turns a paint, a tick and some text into runs of one style each,
// which the render hooks draw as nested Text. It imports nothing at run time
// but runs.ts (pure too), so sprite.ts and the Node preview load it too.
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

/** The most colors a regions paint takes: one digit a cell. */
export const REGIONS_MOST = 9

/** A rainbow of theme keys, so it follows the person's light or dark theme. */
export const RAINBOW: readonly Color[] = ['error', 'warning', 'success', 'planMode', 'suggestion', 'autoAccept']
export const DEFAULT_PAINT: Color = 'claude'

const RAINBOW_TICKS = 2
const SHINE: Color = 'text'
const SHINE_EVERY = 32
/** How many ticks a glint takes to cross a sprite; it moves two diagonals a tick. */
const SWEEP_TICKS = 11

/** A paint with every default filled in: what each painter below draws from. */
type FullPaint =
  | { kind: 'steady'; color: Color }
  | { kind: 'rainbow'; colors: readonly Color[]; ticks: number }
  | { kind: 'shiny'; color: Color; shine: Color; every: number }
  | { kind: 'regions'; colors: readonly Color[]; map: readonly string[]; border: Color; words: readonly (Color | number)[] | undefined }

function withDefaults(paint: Paint | undefined): FullPaint {
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

/** What's wrong with a paint, if anything; `checkSprite` reports these. */
export function paintProblems(paint: Paint | undefined): string[] {
  if (paint === undefined) return []
  if (typeof paint === 'string') return paint.trim() === '' ? ['color is empty'] : []
  const problems: string[] = []
  const isTicks = (n: number | undefined, least: number) => n === undefined || (Number.isInteger(n) && n >= least)
  if (paint.kind === 'rainbow') {
    if (paint.colors !== undefined && paint.colors.length < 2) problems.push('a rainbow needs 2 or more colors')
    if (paint.colors?.some(color => color.trim() === '')) problems.push('a rainbow color is empty')
    if (!isTicks(paint.ticks, 1)) problems.push('a rainbow steps every 1 or more ticks')
  } else if (paint.kind === 'shiny') {
    if (paint.color.trim() === '') problems.push('a shiny paint needs a color')
    if (paint.shine?.trim() === '') problems.push('a shine color is empty')
    if (!isTicks(paint.every, SWEEP_TICKS + 1)) problems.push(`a shine sweeps every ${SWEEP_TICKS + 1} or more ticks`)
  } else if (paint.kind === 'regions') {
    problems.push(...regionsProblems(paint))
  } else {
    problems.push('paint is a color, { kind: "rainbow" }, { kind: "shiny" } or { kind: "regions" }')
  }
  return problems
}

/** A paint in a few words, for the preview. */
export function describePaint(paint: Paint | undefined): string {
  const full = withDefaults(paint)
  if (full.kind === 'steady') return full.color
  if (full.kind === 'regions') return `regions (${full.colors.join(', ')}; border ${full.border}${full.words !== undefined ? `; words ${full.words.join(' ')}` : ''})`
  return full.kind === 'rainbow' ? `rainbow (${full.colors.join(', ')})` : `shiny ${full.color} with ${full.shine} glints`
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

/** What's wrong with a regions paint's own fields; its map's size against the sprite is `paintFitProblems`'. */
function regionsProblems(paint: Regions): string[] {
  const problems: string[] = []
  const { colors, map, border, words } = paint
  if (colors.length < 1 || colors.length > REGIONS_MOST) problems.push(`a regions paint takes 1 to ${REGIONS_MOST} colors, not ${colors.length}`)
  if (colors.some(color => color.trim() === '')) problems.push('a regions color is empty')
  if (map.length === 0) problems.push('a regions paint needs a map: a digit a cell')
  const used = new Set<string>()
  map.forEach((line, row) => {
    for (const digit of line) {
      const at = Number(digit)
      if (!/^[1-9]$/.test(digit) || at > colors.length) {
        problems.push(`regions map row ${row + 1} has "${digit}", not a digit 1-${colors.length}`)
        break
      }
      used.add(digit)
    }
  })
  colors.forEach((color, at) => {
    if (!used.has(String(at + 1))) problems.push(`regions color ${at + 1} (${color}) paints no cell of the map`)
  })
  if (border?.trim() === '') problems.push('a regions border is empty')
  if (words !== undefined) {
    const isShaped = words.length % 2 === 1 && words.every((part, at) => (at % 2 === 0 ? typeof part === 'string' && part.trim() !== '' : typeof part === 'number'))
    const untils = words.filter((part): part is number => typeof part === 'number')
    const isRising = untils.every((until, at) => Number.isInteger(until) && until >= 1 && (at === 0 || until > (untils[at - 1] ?? 0)))
    if (!isShaped || !isRising) problems.push('regions words are [color, until, color, ...]: colors between characters counts that rise from 1')
  }
  return problems
}

/** What's wrong with a paint on a sprite of `width` x `height`: a regions map must be that size, a digit for every cell. Empty for the other paints. */
export function paintFitProblems(paint: Paint | undefined, width: number, height: number): string[] {
  if (paint === undefined || typeof paint === 'string' || paint.kind !== 'regions') return []
  const problems: string[] = []
  if (paint.map.length !== height) problems.push(`its regions map has ${paint.map.length} rows, not ${height}`)
  paint.map.forEach((line, row) => {
    const cells = [...line].length
    if (cells !== width) problems.push(`its regions map row ${row + 1} is ${cells} cells, not ${width}`)
  })
  return problems
}
