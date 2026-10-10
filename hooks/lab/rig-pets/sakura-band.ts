// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura's band form for a rig look: below 10 rows a rig look wears her
// pixel pet (hooks/lab/pixel/sakura-pixel.ts) in place of her painted self,
// posed by the rig's own pose each frame, so the band shows the same blink,
// smile, petal and shower as the window at the same moment. It is the
// `chibi` field a rig look wears (`BandForm`, rig/kit/pet.ts).
//
// The mapping from the rig's params to the pixel pet's picks is the rig
// side's, here: each pick (eyes, mouth, brows, the puff, breath, bob, lean)
// a threshold on one or two params, with no hysteresis, and her petals in
// the air as pixels. It reads her own `shower` param for the spectacle's
// petals in the band. Her chest rises to the nearest whole pixel (half a
// pixel or more, a pixel): her every fifth breath, a sigh, and her
// giggle's shoulders. It paints through the pixel pet onto a pixel surface,
// then lays each whole pixel onto the painted kit's canvas as its 4 x 4
// samples, at the cell column and pixel row the kit gives, inside its clip;
// the kit encodes it, and a cell of two flat pixels encodes exactly. The
// pixel pet imports nothing of the rig: this file is the only one that joins
// them. Pure.
import type { Canvas } from '../rig/kit/canvas'
import { SX, SY } from '../rig/kit/canvas'
import type { BandForm, Channels } from '../rig/kit/pet'
import type { Brows, Eyes, Mouth, Pose, Spot } from '../pixel/sakura-pixel'
import { COLUMNS, MOUTH, NOSE, ROWS, SHOWER, SLOTS } from '../pixel/sakura-pixel'
import { SAKURA_PIXEL } from '../pixel/sakura-pixel-pet'
import { Pixels } from '../pixel/pixels'

/** A channel of the rig's pose (every one the mapping reads is a param of her rig). */
const at = (pose: Channels, key: string): number => pose[key] ?? 0

function eyesOf(pose: Channels): Eyes {
  if (at(pose, 'squeeze') > 0.5) return 'squeeze'
  if (at(pose, 'cross') > 0.5) return 'cross'
  if (at(pose, 'blink') > 0.7) return 'shut'
  if (at(pose, 'blink') + at(pose, 'lid') * 0.9 > 0.4) return at(pose, 'gazeY') > 0.45 ? 'lowered' : 'half'
  if (at(pose, 'brow') > 0.55) return 'wide'
  if (at(pose, 'sparkle') > 0.5) return 'sparkle'
  if (at(pose, 'gazeX') < -0.4) return 'left'
  if (at(pose, 'gazeX') > 0.4) return 'right'
  if (at(pose, 'gazeY') < -0.45) return 'up'
  if (at(pose, 'gazeY') > 0.45) return 'down'
  return 'open'
}

function mouthOf(pose: Channels): Mouth {
  if (at(pose, 'open') > 0.3) return at(pose, 'smile') > 0.6 ? 'laugh' : 'open'
  if (at(pose, 'purse') > 0.5) return 'purse'
  if (at(pose, 'smile') > 0.5) return 'smile'
  return 'rest'
}

const browsOf = (pose: Channels): Brows => (at(pose, 'brow') > 0.45 ? 'up' : at(pose, 'brow') < -0.25 ? 'knit' : 'rest')

/** Whether a petal's pixel is inside her band form: her 16 columns, and 13 pixel rows (the last below her box). */
const inside = ([x, y]: Spot): boolean => x >= 0 && x < COLUMNS && y >= 0 && y < 13

/** A petal in the air's pixel, from its place in her rig's units, if it is aloft. */
function flyer(aloft: number, x: number, y: number): Spot | undefined {
  if (aloft < 0.5) return undefined
  return [Math.floor((x - 2) / 6), Math.floor((y - 10) / 8.5)]
}

/** How far her hair's petals and the one on her nose have flown, in whole steps (0 still there, 6 gone). */
const flightOf = (pose: Channels): number => (at(pose, 'nose') >= 1 ? Math.min(6, Math.floor((at(pose, 'nose') - 1) * 6)) : 0)

/** The petals on her: caught in her hair, on her nose, and flying off when she blows; pixels of her head. */
function wornOf(pose: Channels): Spot[] {
  const out: Spot[] = []
  const step = flightOf(pose)
  if (step >= 6) return out
  SLOTS.forEach(([x, y], k) => {
    if (at(pose, 'petals') > k + 0.5) out.push([x + [-1, 1, -1][k]! * step, y + Math.floor(step * step * 0.4)])
  })
  if (at(pose, 'nose') >= 1) out.push([NOSE[0] - 2 * step, NOSE[1] - step])
  return out.filter(inside)
}

/** The petals in the air round her: the gust's two, and the spectacle's shower; pixels of her box. */
function airOf(pose: Channels): Spot[] {
  const out: Spot[] = []
  for (const petal of [flyer(at(pose, 'aOn'), at(pose, 'aX'), at(pose, 'aY')), flyer(at(pose, 'bOn'), at(pose, 'bX'), at(pose, 'bY'))]) if (petal !== undefined) out.push(petal)
  const shower = at(pose, 'shower')
  if (shower > 0 && shower < 1) {
    for (const [x, delay] of SHOWER) {
      const u = (shower - delay) / 0.5
      if (u > 0 && u < 1) out.push([x, Math.floor(u * 14) - 1])
    }
  }
  return out.filter(inside)
}

/** Her chest's rise in samples, to the nearest whole pixel: half a pixel (a quarter of a cell) or more rises one. */
function breathOf(pose: Channels): number {
  const samples = Math.round(at(pose, 'chest') * 1.8)
  return -samples >= SY / 4 ? 1 : 0
}

const bobOf = (pose: Channels): number => (at(pose, 'bob') < -1 ? -1 : at(pose, 'bob') > 1.2 ? 1 : 0)

function leanOf(pose: Channels): number {
  const shift = at(pose, 'shift')
  const tilt = at(pose, 'tilt')
  return shift > 1 || tilt > 0.035 ? 1 : shift < -1 || tilt < -0.035 ? -1 : 0
}

/** The pixel pet's pose for a rig pose of hers: its picks. */
export function sakuraPixelPose(pose: Channels): Pose {
  return {
    eyes: eyesOf(pose),
    mouth: mouthOf(pose),
    brows: browsOf(pose),
    puff: at(pose, 'puff') > 0.5 ? 1 : 0,
    worn: wornOf(pose),
    air: airOf(pose),
    breath: breathOf(pose),
    bob: bobOf(pose),
    lean: leanOf(pose),
  }
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
export const SAKURA_BAND: BandForm = {
  columns: COLUMNS,
  rows: ROWS,
  mouth: MOUTH,
  paint(canvas, pose, c0, top) {
    pixels ??= new Pixels(COLUMNS, ROWS, SAKURA_PIXEL.palette)
    pixels.clear()
    SAKURA_PIXEL.paint(pixels, sakuraPixelPose(pose), false)
    lay(pixels, canvas, c0, top)
  },
  // Her picks are all she shows: the same picks, the same pixels.
  key: pose => JSON.stringify(sakuraPixelPose(pose)),
}
