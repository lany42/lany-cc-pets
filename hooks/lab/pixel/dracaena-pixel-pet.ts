// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Dracaena Pixel as a pixel pet: her art (dracaena-pixel.ts) and her director
// (dracaena-pixel-director.ts) tied together with who she is. Pure: imports
// nothing at run time but her own two files.
import type { Pose } from './dracaena-pixel'
import { COLUMNS, INK, letters, paint, ROWS } from './dracaena-pixel'
import { DracaenaDirector, FRAMES } from './dracaena-pixel-director'
import type { PixelPet } from './pet'

export const DRACAENA_PIXEL: PixelPet<Pose> = {
  id: 'dracaena-pixel',
  name: 'Dracaena Pixel',
  persona: 'Dracaena in pixel art, a young witch in green-lined robes with long blonde hair, whose every hmph leaves a deeper blush',
  blurb: 'a hmph, then a blush',
  fallback: 'iceberg',
  bubble: 'suggestion',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new DracaenaDirector(seed),
  demo: () => new DracaenaDirector(1, true),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
  letters: (pose, isLight) => letters(pose, isLight),
}
