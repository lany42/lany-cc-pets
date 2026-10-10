// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Looks that break on purpose, for the tests alone. They are never listed and
// never picked (`/pet as` takes only LAB's), and a pet wears one only where the
// store names it, which no command does. One throws as it is born, one a few
// ticks on, so the tests can hold the pet to going on without them; and
// `test-raster-only` is Momiji whose runs throw when read, so the tests can
// hold the Raster path to never reading them. The studio walks none of them.
import type { LabLook, LabRun, Live } from './look'
import { RIG_LOOKS } from './rig-pets'

/** A row of braille while it lasts: what the band draws of it before it breaks. */
const ROWS: LabRun[][] = [[{ text: '⣿⣿⣿⣿', color: 'error' }], [{ text: '⠛⠛⠛⠛', color: 'error' }]]

/** A live look that draws `ROWS` for `steps` steps, then throws on every one after. */
function breaking(steps: number): Live {
  let left = steps
  return {
    step() {
      if (left <= 0) throw new Error('broke a few ticks on')
      left -= 1
    },
    runs: () => ROWS,
  }
}

/** `look` as `id`, each live one throwing if its runs are read: only its cells may be drawn. */
function cellsAlone(look: LabLook, id: string): LabLook {
  return {
    ...look,
    id,
    start(seed, memory) {
      const live = look.start(seed, memory)
      live.runs = () => {
        throw new Error(`${id}: its runs were read, though its cells are drawn`)
      }
      return live
    },
  }
}

const MOMIJI_LOOK = RIG_LOOKS.find(look => look.id === 'momiji')!

const broken = { name: 'Broken', persona: 'a look that breaks, for the tests', blurb: 'breaks on purpose', layout: 'pet', width: 4, height: 2, minColumns: 50, fallback: 'cat', bubble: 'error' } as const

export const BROKEN_LOOKS: readonly LabLook[] = [
  {
    ...broken,
    id: 'test-breaks-at-birth',
    start: () => {
      throw new Error('broke as it was born')
    },
    demo: () => breaking(0),
  },
  { ...broken, id: 'test-breaks-later', start: () => breaking(5), demo: () => breaking(5) },
  cellsAlone(MOMIJI_LOOK, 'test-raster-only'),
]
