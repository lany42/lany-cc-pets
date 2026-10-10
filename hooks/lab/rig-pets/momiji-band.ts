// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Momiji's band form for a rig look: below 10 rows a rig look wears her
// pixel pet (hooks/lab/pixel/momiji-pixel.ts) in place of her painted self,
// posed by the rig's own pose each frame, so the band shows the same blink,
// smile and toss as the window at the same moment. It is the `chibi` field
// a rig look wears (`BandForm`, rig/kit/pet.ts).
//
// The mapping from the rig's params to the pixel pet's picks is the rig
// side's, here: each pick (eyes, mouth, strand, breath, bob, lean) a
// threshold on one or two params, with no hysteresis. Her chest rises to
// the nearest whole pixel (half a pixel or more, a pixel), which for her
// breath is none. It paints through the pixel pet onto a pixel surface,
// then lays each whole pixel onto the painted kit's canvas as its 4 x 4
// samples, at the cell column and pixel row the kit gives, inside its clip;
// the kit encodes it, and a cell of two flat pixels encodes exactly. The
// pixel pet imports nothing of the rig: this file is the only one that joins
// them. Pure.
import type { Canvas } from '../rig/kit/canvas'
import { SX, SY } from '../rig/kit/canvas'
import type { BandForm, Channels } from '../rig/kit/pet'
import type { Eyes, Mouth, Pose, Strand } from '../pixel/momiji-pixel'
import { COLUMNS, MOUTH, ROWS } from '../pixel/momiji-pixel'
import { MOMIJI_PIXEL } from '../pixel/momiji-pixel-pet'
import { Pixels } from '../pixel/pixels'

/** A channel of the rig's pose (every one the mapping reads is a param of her rig). */
const at = (pose: Channels, key: string): number => pose[key] ?? 0

function eyesOf(pose: Channels): Eyes {
  if (at(pose, 'happy') > 0.5) return 'happy'
  if (at(pose, 'wink') > 0.5 && at(pose, 'blink') < 0.5) return 'wink'
  const shut = at(pose, 'blink') + at(pose, 'smirk') * 0.3
  if (shut > 0.75) return 'shut'
  if (shut > 0.35) return 'half'
  if (at(pose, 'gazeX') < -0.45) return 'left'
  if (at(pose, 'gazeX') > 0.45) return 'right'
  return 'open'
}

function mouthOf(pose: Channels): Mouth {
  const open = at(pose, 'open')
  if (open > 1.1 || (at(pose, 'happy') > 0.5 && open > 0.3)) return 'wide'
  if (open > 0.35) return 'open'
  if (at(pose, 'smirk') > 0.5) return 'smirk'
  if (at(pose, 'smile') > 0.45) return 'smile'
  return 'rest'
}

function strandOf(pose: Channels): Strand {
  const strand = at(pose, 'strand')
  return strand < 0.35 ? 'over' : strand < 0.75 ? 'half' : 'aside'
}

/** Her chest's rise in samples, to the nearest whole pixel: half a pixel (a quarter of a cell) or more rises one. */
function breathOf(pose: Channels): number {
  const samples = Math.round(at(pose, 'chest') * 1.6)
  return -samples >= SY / 4 ? 1 : 0
}

const bobOf = (pose: Channels): number => (at(pose, 'bob') < -0.9 ? -1 : at(pose, 'bob') > 1.2 ? 1 : 0)

function leanOf(pose: Channels): number {
  const shift = at(pose, 'shift')
  const tilt = at(pose, 'tilt')
  return shift > 1 || tilt > 0.05 ? 1 : shift < -1 || tilt < -0.05 ? -1 : 0
}

/** The pixel pet's pose for a rig pose of hers: its picks. */
export function momijiPixelPose(pose: Channels): Pose {
  return { eyes: eyesOf(pose), mouth: mouthOf(pose), strand: strandOf(pose), breath: breathOf(pose), bob: bobOf(pose), lean: leanOf(pose) }
}

/** Lays `pixels` onto `canvas`, its top left at cell column `c0` and pixel row `top`: each pixel its 4 x 4 samples, inside the canvas's clip. */
function lay(pixels: Pixels, canvas: Canvas, c0: number, top: number): void {
  const tall = SY / 2
  const { clip } = canvas
  for (let y = 0; y < pixels.h; y++) {
    for (let x = 0; x < pixels.w; x++) {
      const ink = pixels.inkAt(x, y)
      if (ink === undefined) continue
      const x0 = (c0 + x) * SX
      const y0 = (top + y) * tall
      for (let sy = Math.max(clip.y0, y0); sy < Math.min(clip.y1, y0 + tall); sy++) {
        for (let sx = Math.max(clip.x0, x0); sx < Math.min(clip.x1, x0 + SX); sx++) {
          const i = sy * canvas.w + sx
          canvas.r[i] = (ink >> 16) & 255
          canvas.g[i] = (ink >> 8) & 255
          canvas.b[i] = ink & 255
          canvas.cover[i] = 1
        }
      }
    }
  }
}

/** Her pixels, made on her first paint (never as this module loads) and painted afresh each time. */
let pixels: Pixels | undefined

/** Her band form, as a rig look wears it: her pixel pet, posed from the rig's pose. */
export const MOMIJI_BAND: BandForm = {
  columns: COLUMNS,
  rows: ROWS,
  mouth: MOUTH,
  paint(canvas, pose, c0, top) {
    pixels ??= new Pixels(COLUMNS, ROWS, MOMIJI_PIXEL.palette)
    pixels.clear()
    MOMIJI_PIXEL.paint(pixels, momijiPixelPose(pose), false)
    lay(pixels, canvas, c0, top)
  },
  // Her picks are all she shows: the same picks, the same pixels.
  key: pose => JSON.stringify(momijiPixelPose(pose)),
}
