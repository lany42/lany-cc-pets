// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Pomelo's band form for a rig look: below 10 rows a rig look wears its
// pixel pet (hooks/lab/pixel/pomelo-pixel.ts) in place of its painted self,
// posed by the rig's own pose each frame, so the band shows the same blink,
// smile, gills and bubble as the window at the same moment. It is the
// `chibi` field a rig look wears (`BandForm`, rig/kit/pet.ts).
//
// The mapping from the rig's params to the pixel pet's picks is the rig
// side's, here: each pick a threshold on one or two params, with no
// hysteresis, at values the rig's acts pass quickly. Each gill's spread is
// its tier's fan, swung by its tier's sway the way the rig turns it (both
// sides the same way, so one side's spread is the other's fold), and the
// head leans a pixel with the tilt. Its bubble is the rig's `bub`, step by
// step along the pixel pet's own path (up the middle of the face, where its
// ring reads), its eyes on it; its chest's rise, under a sixth of a pixel
// here, never lifts it. It paints through the pixel pet onto a pixel
// surface, then lays each whole pixel onto the painted kit's canvas as its
// 4 x 4 samples, at the cell column and pixel row the kit gives, inside its
// clip; the kit encodes it, and a cell of two flat pixels encodes exactly.
// The pixel pet imports nothing of the rig: this file is the only one that
// joins them. Pure.
import type { Canvas } from '../rig/kit/canvas'
import { SX, SY } from '../rig/kit/canvas'
import type { BandForm, Channels } from '../rig/kit/pet'
import type { Fan, Gills, Lids, Mouth, Pose } from '../pixel/pomelo-pixel'
import { COLUMNS, MOUTH, ON_BUBBLE, POP, ROWS } from '../pixel/pomelo-pixel'
import { POMELO_PIXEL } from '../pixel/pomelo-pixel-pet'
import { Pixels } from '../pixel/pixels'

/** A channel of the rig's pose (every one the mapping reads is a param of its rig). */
const at = (pose: Channels, key: string): number => pose[key] ?? 0

/** A look in whole pixels: past 0.45 either way, a pixel that way. */
const lookOf = (value: number): number => (value > 0.45 ? 1 : value < -0.45 ? -1 : 0)

/** The bubble's step for its life `bub` (0 to 1.25): swelling in the mouth to 0.15, rising to 1, popping to 1.25, then gone. */
export function bubbleOf(pose: Channels): number {
  const bub = at(pose, 'bub')
  if (bub <= 0.01 || bub >= 1.25) return 0
  if (bub < 0.08) return 1
  if (bub < 0.15) return 2
  if (bub < 1) return 3 + Math.min(POP - 4, Math.floor(((bub - 0.15) / 0.85) * (POP - 3)))
  return bub < 1.12 ? POP : POP + 1
}

function lidsOf(pose: Channels): Lids {
  if (at(pose, 'blink') > 0.8) return 'shut'
  if (at(pose, 'blink') > 0.45) return 'half'
  if (at(pose, 'blink') > 0.15) return 'lidded'
  if (at(pose, 'squint') > 0.4) return 'happy'
  return 'open'
}

function mouthOf(pose: Channels, bubble: number): Mouth {
  if (bubble === 1 || bubble === 2) return 'oh'
  const open = at(pose, 'open')
  if (open > 0.45) return 'open'
  if (open > 0.15) return 'ajar'
  if (at(pose, 'smile') > 0.5) return 'smile'
  if (at(pose, 'smile') < -0.1) return 'flat'
  return 'rest'
}

/** A gill's spread for its fan, in the rig's fan units: folded under -0.12, perked from 0.275, wide from 0.75. */
const fanOf = (spread: number): Fan => (spread < -0.12 ? 'fold' : spread < 0.275 ? 'rest' : spread < 0.75 ? 'perk' : 'wide')
/** How far a unit of sway turns a gill, in its tier's fan units: the rig's sway over its fan (0.3/0.26, 0.34/0.1, 0.38/0.2 rad a unit), softened, so the mid tier's small fan isn't swung shut by a breath of sway. */
const SWAY = [0.6, 0.8, 0.9] as const
/** One side's gills: each tier's fan, swung by its sway. The sway turns both sides clockwise, so it spreads the left side's top and middle gills and folds its low one, and the right side's the other way. */
function gillsOf(pose: Channels, side: 1 | -1): Gills {
  const tier = (k: 0 | 1 | 2, fan: string, sway: string, up: 1 | -1): Fan => fanOf(at(pose, fan) + side * up * SWAY[k] * at(pose, sway))
  return [tier(0, 'fanT', 'swayT', 1), tier(1, 'fanM', 'swayM', 1), tier(2, 'fanL', 'swayL', -1)]
}

/** Its rosy cheeks, as the rig derives them: its blush and a little of its smile. */
const blushOf = (pose: Channels): number => (at(pose, 'blush') + 0.35 * at(pose, 'smile') > 0.5 ? 1 : 0)

/** Its head's lean with its tilt, a pixel past 0.05 rad either way (clockwise, right). */
const leanOf = (pose: Channels): number => (at(pose, 'tilt') > 0.05 ? 1 : at(pose, 'tilt') < -0.05 ? -1 : 0)

/** Its chest's rise in pixels (the rig's units to the band's, 24 pixels for its 100), to the nearest whole one: Pomelo's breath, 0.6 units, never lifts it. */
const breathOf = (pose: Channels): number => (-at(pose, 'chest') * (COLUMNS / 100) >= 0.5 ? 1 : 0)

/** The pixel pet's pose for a rig pose of Pomelo's: its picks. */
export function pomeloPixelPose(pose: Channels): Pose {
  const bubble = bubbleOf(pose)
  // While the bubble is out its eyes follow it up its face and over to where it pops; after the pop they stay up a while, as the rig's do.
  const onBubble = bubble > 0 ? ON_BUBBLE[bubble - 1]! : undefined
  const isOut = at(pose, 'bub') > 0.01
  return {
    lids: lidsOf(pose),
    lookX: onBubble !== undefined ? onBubble[0] : isOut ? 0 : lookOf(at(pose, 'lookX')),
    lookY: onBubble !== undefined ? onBubble[1] : lookOf(at(pose, 'lookY')),
    mouth: mouthOf(pose, bubble),
    blush: blushOf(pose),
    left: gillsOf(pose, 1),
    right: gillsOf(pose, -1),
    lean: leanOf(pose),
    breath: breathOf(pose),
    bubble,
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

/** Its pixels, made on its first paint (never as this module loads) and painted afresh each time. */
let pixels: Pixels | undefined

/** Its band form, as a rig look wears it: its pixel pet, posed from the rig's pose. */
export const POMELO_BAND: BandForm = {
  columns: COLUMNS,
  rows: ROWS,
  mouth: MOUTH,
  paint(canvas, pose, c0, top) {
    pixels ??= new Pixels(COLUMNS, ROWS, POMELO_PIXEL.palette)
    pixels.clear()
    POMELO_PIXEL.paint(pixels, pomeloPixelPose(pose), false)
    lay(pixels, canvas, c0, top)
  },
  // Its picks are all it shows: the same picks, the same pixels.
  key: pose => JSON.stringify(pomeloPixelPose(pose)),
}
