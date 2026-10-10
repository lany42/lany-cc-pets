// How the band and the pane fit words into the cells they have. Pure: the
// render hooks size the bubble and the chat log with these, and the tests
// check them without drawing.

/**
 * Rows `text` takes wrapped at `width` columns: broken at spaces as the
 * terminal breaks it, and inside a word too long for a row.
 */
export function wrapRows(text: string, width: number): number {
  if (width < 1) return text.length
  let rows = 1
  let used = 0
  for (const word of text.split(' ')) {
    let rest = word.length
    const gap = used === 0 ? 0 : 1
    if (used + gap + rest <= width) {
      used += gap + rest
      continue
    }
    if (used > 0) rows += 1
    while (rest > width) {
      rest -= width
      rows += 1
    }
    used = rest
  }
  return rows
}

/**
 * The most of `text` that wraps into `rows` rows of `width`, ended with an
 * ellipsis where it was cut: after its last whole word that fits, or inside
 * a word longer than a row. Whole characters only, never half an emoji.
 */
export function clipWords(text: string, width: number, rows: number): string {
  if (wrapRows(text, width) <= rows) return text
  const chars = [...text]
  const cut = (kept: number) => `${chars.slice(0, kept).join('').trimEnd()}…`
  const fits = (kept: number) => wrapRows(cut(kept), width) <= rows
  // The most characters that fit, then back to the space before them, if that loses under half.
  let kept = 0
  while (kept < chars.length && fits(kept + 1)) kept += 1
  const space = chars.lastIndexOf(' ', kept)
  return cut(space > kept / 2 && fits(space) ? space : kept)
}

/** Columns the bubble's border and padding take around its words. */
const BUBBLE_CHROME = 4
/** Rows its border takes above and below them. */
const BUBBLE_FRAME = 2
/** The narrowest bubble worth drawing; less room than this and the line goes unshown. */
export const BUBBLE_MIN = 12

/** A bubble's box, and the words it holds: the line, or as much of it as the band's rows hold. */
export type Bubble = { width: number; rows: number; isLevel: boolean; text: string }

/**
 * The bubble for `text` beside a pet `petColumns` across whose column is
 * `bandRows` tall, in a band of `columns` and `maxRows`: as wide as its
 * words, up to `max`. It sits level with the pet while it fits above the
 * pet's button, and drops beside the button otherwise, so a two-line remark
 * doesn't grow the band a row. A line taller than the band takes all the
 * width there is, and past that is cut short, so it never scrolls the band.
 * Undefined when there's no room.
 */
export function bubbleFor(text: string, columns: number, petColumns: number, bandRows: number, max: number, maxRows = Number.POSITIVE_INFINITY): Bubble | undefined {
  const widest = columns - petColumns - 1
  const room = Math.min(max, widest)
  if (room < BUBBLE_MIN || maxRows < BUBBLE_FRAME + 1) return undefined
  const rowsAt = (width: number) => wrapRows(text, width - BUBBLE_CHROME) + BUBBLE_FRAME
  let width = Math.min(text.length + BUBBLE_CHROME, room)
  if (rowsAt(width) > maxRows) width = Math.min(text.length + BUBBLE_CHROME, widest)
  const isCut = rowsAt(width) > maxRows
  const rows = isCut ? maxRows : rowsAt(width)
  return { width, rows, isLevel: rows < bandRows, text: isCut ? clipWords(text, width - BUBBLE_CHROME, maxRows - BUBBLE_FRAME) : text }
}

// How a look stands in the rows the band has. The engine gives the band what
// the bottom slot (half the terminal, the prompt's included) has left once
// its own lists are in (the tasks checklist, the agents under the prompt); a
// tree taller than that scrolls. Its button keeps a corner of its own and
// never takes a row, so the look takes every row there is: it draws itself
// smaller first, and only then is it swapped for its fallback; nothing the
// band draws is ever taller than its rows.

/** How a pet `artRows` tall stands in `rows`: how many of its rows show. */
export type PetFit = { shown: number }

/**
 * A pet takes every row it has. Only a pet taller than the whole band is
 * cropped, from the top, so it keeps its feet (or its floor) on the prompt.
 */
export function fitPet(artRows: number, rows: number): PetFit {
  return { shown: Math.max(0, Math.min(artRows, rows)) }
}

/**
 * A scene's rows: its `height`, the fewest its artist composes it in
 * (`least`), and the fewest it may be shown in once its sky is cropped
 * (`fewest`, its least when it has no sky to spare).
 */
export type SceneSizes = { height: number; least: number; fewest: number }

/** How a scene stands in `rows`: the rows it is composed in, and the rows of that shown. */
export type SceneFit = { composed: number; shown: number }

/**
 * A scene is drawn whole while it fits. Shorter, it is composed in the rows
 * there are, down to its least, and then cropped from the top, sky first,
 * down to its fewest. Undefined below that: the band wears its fallback.
 */
export function fitScene(scene: SceneSizes, rows: number): SceneFit | undefined {
  if (rows >= scene.least) return { composed: Math.min(rows, scene.height), shown: Math.min(rows, scene.height) }
  if (rows >= scene.fewest) return { composed: scene.least, shown: rows }
  return undefined
}

/**
 * The newest of `entries` that fit in `rows`, oldest first; the newest one
 * always, even taller than `rows`, so what was just said never goes missing.
 */
export function newestThatFit<T>(entries: readonly T[], rowsOf: (entry: T) => number, rows: number): T[] {
  const kept: T[] = []
  let used = 0
  for (let at = entries.length - 1; at >= 0; at--) {
    const entry = entries[at] as T
    const need = rowsOf(entry)
    if (kept.length > 0 && used + need > rows) break
    kept.unshift(entry)
    used += need
  }
  return kept
}
