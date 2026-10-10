// The shape of a drawn pet (from braille-uncanny): a pure function from "this
// moment" to what it draws. drawn/index.ts makes each a lab look, and draws
// its rows (the band's, or its window picture in the pet window) and, for a
// look made to ride it, its words on the spinner line; nothing else it
// returns is drawn.
import type { Run } from './dots'

export type Mood = 'idle' | 'busy' | 'ponder' | 'talk'

/** Everything a pet may look at to draw one tick: the adapter builds it from what the clock last told the look (LabInput). */
export type Moment = {
  /** The pet's animation tick (250 ms each), as the band's `tick` atom. */
  tick: number
  mood: Mood
  /** Ticks since `mood` began: lets a pet play an entrance (rise, duck, inflate). */
  since: number
  /**
   * The bubble's line while one shows, and its age in ticks. A pet that
   * `ownsBubble` is given only a line `isCellSafe` passes (the band bubbles
   * any other itself), and none when the adapter draws it again without
   * its words (`Drawing.band`).
   */
  line?: { text: string; age: number }
  /** The columns of its room, the most its rows may take: the band's body less the button's gutter, or the pet window's room. */
  columns: number
  /** The rows of its room: the band's, or the pet window's less its button's row. */
  rows: number
  /**
   * True when it draws for the pet window and the room holds its `window`
   * box with a bubble beside or above: it may draw up to that box, composed
   * for `columns` and `rows`. Absent, it draws its band self, as ever.
   */
  isWindow?: boolean
  /** Whether the person's theme is a light one (from `$.config.list()`'s `theme` row): the adapter always says; absent, dark. */
  isLight?: boolean
  /** The wall clock, ms, as the band's clock gives it (the studio's fixed moment in its tools): tonight's moon. The adapter always gives it. */
  now?: number
}

/** What a pet draws for one moment. */
export type Drawing = {
  /**
   * Its rows, every row the same width: the band's, right-aligned by the
   * band, or its window picture when `isWindow`. A pet that `ownsBubble`
   * draws its line here too; grown round it past its room's rows, it is
   * drawn again without the line (idle, or busy while busy) and the band
   * bubbles the words beside it. Otherwise the band draws its usual bubble
   * to the left of these rows.
   */
  band: Run[][]
  /**
   * Words to ride the spinner line while Claude works, for a look made with
   * `ridesSpinner` (drawnLook): the adapter joins its runs' text (their
   * styles are lost) and drops a leading `…`, and the band puts it after
   * the engine's own suffix, never in its place.
   */
  spinner?: Run[]
  /** For after a turn's closing line (TurnDuration render slot; `id` its requestId): never drawn, since it would redraw onto every past turn in the scrollback. */
  turnMark?: (id: string) => Run[] | undefined
  /** For the prompt hint's `tail` (PromptHint render slot): never drawn. */
  hint?: string
}

export type ExperimentalPet = {
  id: string
  name: string
  persona: string
  /** Its artist's line about it; the gallery card shows `drawnLook`'s `blurb` (at most 24 characters) instead. */
  blurb: string
  /** Its accent, a theme key: the look's `bubble`, so the band's bubble border when the band draws the bubble, and its name and card in pet-control. */
  color: string
  /** True when the pet draws its own speech bubble inside `band`. */
  ownsBubble: boolean
  /** Rows the band takes at rest and at most. The adapter reads `rest` alone, the look's `height`; how far it grows round its words is `drawnLook`'s `most`. */
  rows: { rest: number; most: number }
  /** The largest picture it draws in the pet window (`isWindow`), at most 120 x 39; none, it is its band self there too. */
  window?: { width: number; height: number }
  draw(moment: Moment): Drawing
}
