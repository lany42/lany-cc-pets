// The tree frog as a pixel pet: its art (tree-frog.ts) and its director
// (tree-frog-director.ts) tied together with who it is. Its sheet is in the
// studio. Pure: imports nothing at run time but its own two files.
import type { Pose } from './tree-frog'
import { COLUMNS, INK, paint, ROWS } from './tree-frog'
import { FRAMES, FrogDirector } from './tree-frog-director'
import type { PixelPet } from './pet'

export const TREE_FROG: PixelPet<Pose> = {
  id: 'tree-frog',
  name: 'Tree Frog',
  persona: 'a red-eyed tree frog that sits on a twig and snaps flies out of the air with its long sticky tongue',
  blurb: 'a fly for every turn',
  fallback: 'axolotl',
  bubble: 'success',
  columns: COLUMNS,
  rows: ROWS,
  frames: FRAMES,
  director: seed => new FrogDirector(seed),
  demo: () => new FrogDirector(1),
  palette: INK,
  paint: (pixels, pose) => paint(pixels, pose),
}
