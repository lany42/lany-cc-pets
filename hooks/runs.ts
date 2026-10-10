// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Text runs: how every look's rows reach the screen off the Raster path, a
// nested Text per run of one style. One run type for every kind, classic
// and lab, and one rule for laying cells into runs, which each kind's loop
// calls cell by cell (its own glyphs and colors, the same merging). Pure:
// imports nothing at run time, so paint.ts and the Node tools load it too.
import type { Color } from 'claude-code'

/** A run of text in one style, named as TextProps names them, so the band spreads it straight onto a Text; a style left unset is the surface's own. */
export type Run = { text: string; color?: Color; backgroundColor?: Color; dimColor?: true; bold?: true }

/**
 * Lays one cell, `char` in its style, at the end of a row of runs. A run is
 * a change of style, not of dots: the cell joins the run before it when its
 * style is that run's, and a blank (`isBlank`: a space whose color shows
 * nothing) joins it whatever its color, unless their backgrounds differ.
 * Otherwise it starts a run: `{ text, color?, backgroundColor?, dimColor?,
 * bold? }`, a style it leaves unset left out.
 */
export function addCell(row: Run[], char: string, isBlank: boolean, color: Color | undefined, backgroundColor?: Color, dimColor?: true, bold?: true): void {
  const last = row[row.length - 1]
  if (last !== undefined && last.backgroundColor === backgroundColor && (isBlank || (last.color === color && last.dimColor === dimColor && last.bold === bold))) {
    last.text += char
    return
  }
  const run: Run = { text: char }
  if (color !== undefined) run.color = color
  if (backgroundColor !== undefined) run.backgroundColor = backgroundColor
  if (dimColor === true) run.dimColor = true
  if (bold === true) run.bold = true
  row.push(run)
}
