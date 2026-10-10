// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The chameleon as a pixel pet: its art (chameleon.ts) and its director
// (chameleon-director.ts) tied together with who it is. Its sheet is in the
// studio. Pure: imports nothing at run time but its own two files.
import type { Pose } from './chameleon'
import { COLUMNS, INK, paint, ROWS } from './chameleon'
import { ChameleonDirector, FRAMES } from './chameleon-director'
import type { PixelPet } from './pet'

export const CHAMELEON: PixelPet<Pose> = {
  id: 'chameleon',
  name: 'Chameleon',
  persona: 'a panther chameleon gripping a twig, its tail rolled in a coil, that washes into a new color from snout to tail',
  blurb: 'a new color every turn',
  fallback: 'jumping-spider',
  bubble: 'planMode',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new ChameleonDirector(seed),
  demo: () => new ChameleonDirector(1, true),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
}
