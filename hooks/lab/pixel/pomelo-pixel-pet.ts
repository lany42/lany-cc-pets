// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Pomelo Pixel, a pixel pet: Pomelo the axolotl's art (pomelo-pixel.ts) and
// its director (pomelo-pixel-director.ts) tied together with who it is. It
// is also the band form of the rig look `pomelo` (rig-pets/pomelo-band.ts),
// which poses the same art from its rig. Its sheet is in the studio. Pure:
// imports nothing at run time but its own two files.
import type { Pose } from './pomelo-pixel'
import { COLUMNS, INK, paint, ROWS } from './pomelo-pixel'
import { FRAMES, PomeloPixelDirector } from './pomelo-pixel-director'
import type { PixelPet } from './pet'

export const POMELO_PIXEL: PixelPet<Pose> = {
  id: 'pomelo-pixel',
  name: 'Pomelo Pixel',
  persona: 'Pomelo in pixel art, a pink axolotl with feathery coral gills, whose bubbles swell in its mouth and rise until they pop',
  blurb: 'lets go a bubble a turn',
  // Its fallback and bubble, the same as its rig look's.
  fallback: 'axolotl',
  bubble: 'claude',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new PomeloPixelDirector(seed),
  // Its card lets go a bubble a second in, and again every quarter minute or so.
  demo: () => new PomeloPixelDirector(1, true),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
}
