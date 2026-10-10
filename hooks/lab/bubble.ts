// The words and border of a bubble a look draws itself (the scenes'
// `drawBubble` in scene/kit.ts, the rig looks' in rig/kit/look.ts, the inchworm
// that is its own bubble in drawn/looper.ts): one wrap, counting code points,
// and one set of border glyphs. Where the bubble goes and how its lines are
// balanced stay each look's. Pure: imports nothing.

/** A bubble border's glyphs: its corners, its sides, and the tees its tail leaves from. */
export type BorderGlyphs = { tl: number; tr: number; bl: number; br: number; h: number; v: number; down: number; right: number; left: number }

/** Rounded box drawing: ╭╮╰╯ ─ │, and ┬ ├ ┤ where the tail leaves. */
export const ROUND: BorderGlyphs = { tl: 0x256d, tr: 0x256e, bl: 0x2570, br: 0x256f, h: 0x2500, v: 0x2502, down: 0x252c, right: 0x251c, left: 0x2524 }
/** ASCII (`.-'|`), for terminals that draw East Asian ambiguous-width characters two columns wide. */
export const ASCII: BorderGlyphs = { tl: 0x2e, tr: 0x2e, bl: 0x27, br: 0x27, h: 0x2d, v: 0x7c, down: 0x2d, right: 0x7c, left: 0x7c }

const SURROGATE = /[\ud800-\udfff]/

/** Code points in `s`: its length, unless it holds a surrogate pair. */
const lengthOf = (s: string): number => (SURROGATE.test(s) ? [...s].length : s.length)

/** The last text wrapped, its words and their lengths: a bubble balancing its lines wraps one text at many widths. */
let known: { text: string; words: string[]; lengths: number[] } | undefined

/**
 * Words wrapped to `width` cells, at most `maxLines` lines, the last cut
 * with an ellipsis if it overflows (as much of it as fits in `width - 1`).
 * Runs of whitespace are one space; a word too long for a line is broken
 * inside, its first part on a line of its own. Counts code points, so an
 * emoji is never cut in half (the looks give it only cell-safe text, where
 * a code point is a cell).
 */
export function wrap(text: string, width: number, maxLines = Number.POSITIVE_INFINITY): string[] {
  if (known?.text !== text) {
    const words = text.replace(/\s+/g, ' ').trim().split(' ')
    known = { text, words, lengths: words.map(lengthOf) }
  }
  const { words, lengths } = known
  const lines: string[] = []
  let line = ''
  let used = 0
  for (let k = 0; k < words.length; k++) {
    let word = words[k]!
    let n = lengths[k]!
    if (n > width) {
      if (line !== '') {
        lines.push(line)
        line = ''
        used = 0
      }
      const chars = [...word]
      while (chars.length > width) lines.push(chars.splice(0, width).join(''))
      word = chars.join('')
      n = chars.length
    }
    if (line === '') {
      line = word
      used = n
    } else if (used + 1 + n <= width) {
      line += ' ' + word
      used += 1 + n
    } else {
      lines.push(line)
      line = word
      used = n
    }
  }
  if (line !== '') lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  const last = kept[maxLines - 1]!
  kept[maxLines - 1] = (lengthOf(last) >= width ? [...last].slice(0, width - 1).join('') : last) + '…'
  return kept
}
