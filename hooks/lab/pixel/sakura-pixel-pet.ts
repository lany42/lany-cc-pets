// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura Pixel as a pixel pet: her art (sakura-pixel.ts) and her director
// (sakura-pixel-director.ts) tied together with who she is: Sakura's chibi,
// a pet of her own, apart from her rig (it imports nothing of it).
// Her sheet is in the studio. Pure: imports nothing at run time but her own
// two files.
import type { Pose } from './sakura-pixel'
import { COLUMNS, INK, paint, ROWS } from './sakura-pixel'
import { FRAMES, SakuraPixelDirector } from './sakura-pixel-director'
import type { PixelPet } from './pet'

export const SAKURA_PIXEL: PixelPet<Pose> = {
  id: 'sakura-pixel',
  name: 'Sakura Pixel',
  persona: 'Sakura in pixel art, an anime girl with pastel pink hair in a spring kimono, who blows the cherry petal off her nose',
  blurb: 'petals one pixel each',
  // Her fallback and bubble, the same as her rig look's.
  fallback: 'love-slime',
  bubble: 'bashBorder',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new SakuraPixelDirector(seed),
  // Her gallery card starts with two petals in her hair; its seed's first gust, at 11 s, lands one on her nose, and she blows all three off.
  demo: () => new SakuraPixelDirector(16, { petals: 2 }),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
}
