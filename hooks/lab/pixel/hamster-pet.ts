// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The hamster as a pixel pet: its art (hamster.ts) and its director
// (hamster-director.ts) tied together with who it is. Its identity sheet is
// in the studio. Pure: imports nothing at run time but its own two files.
import type { Pose } from './hamster'
import { COLUMNS, INK, letters, paint, ROWS } from './hamster'
import { FRAMES, HamsterDirector } from './hamster-director'
import type { PixelPet } from './pet'

export const HAMSTER: PixelPet<Pose> = {
  id: 'hamster',
  name: 'Hamster',
  persona: 'a golden hamster that sits up on its haunches and keeps its cheek pouches stuffed with sunflower seeds',
  blurb: 'hoards a seed a turn',
  fallback: 'water-bear',
  bubble: 'warning',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new HamsterDirector(seed),
  // Its gallery card shows a hoard begun and a cheek already puffed.
  demo: () => new HamsterDirector(1, { cheeks: 1, pile: 5 }),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
  letters,
}
