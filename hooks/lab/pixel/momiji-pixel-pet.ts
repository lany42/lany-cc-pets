// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Momiji Pixel as a pixel pet: her art (momiji-pixel.ts) and her director
// (momiji-pixel-director.ts) tied together with who she is: Momiji's chibi,
// a pet of her own, apart from her rig (it imports nothing of it).
// Her sheet is in the studio. Pure: imports nothing at run time but her own
// two files.
import type { Pose } from './momiji-pixel'
import { COLUMNS, INK, paint, ROWS } from './momiji-pixel'
import { FRAMES, MomijiPixelDirector } from './momiji-pixel-director'
import type { PixelPet } from './pet'

export const MOMIJI_PIXEL: PixelPet<Pose> = {
  id: 'momiji-pixel',
  name: 'Momiji Pixel',
  persona: 'Momiji in pixels, an anime girl in an orange beanie and hoodie who keeps tossing a stray strand of bangs from her eyes',
  blurb: 'drawn in whole pixels',
  // Her fallback and bubble, the same as her rig look's.
  fallback: 'rag-doll',
  bubble: 'claude',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new MomijiPixelDirector(seed),
  // Her gallery card shows her signature: the strand already over her eye, tossed aside within seconds.
  demo: () => new MomijiPixelDirector(1, { strand: 'over' }),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
}
