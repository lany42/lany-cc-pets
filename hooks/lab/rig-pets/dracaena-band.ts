// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Dracaena's band form for a rig look: below 10 rows a rig look wears her
// pixel pet (hooks/lab/pixel/dracaena-pixel.ts) in place of her painted
// self, posed by the rig's own pose each frame, so the band shows the same
// blink, smirk, blush, turn, wand and sparks as the window at the same
// moment. It is the `chibi` field a rig look wears (`BandForm`,
// rig/kit/pet.ts).
//
// The mapping from the rig's params to the pixel pet's picks is the rig
// side's, here: each pick a threshold on a param or two, with no hysteresis;
// her head's turn and chin, her chest's rise and the long lock's flip each a
// whole pixel or a stage; her arm by its hand's shape and place; her sparks
// in the air as pixels laid round the pixel pet's wand tip, as they lie round
// the rig's; and the heart they gather into, when enough of them hold near
// it. Brows and written marks are left out: at true size the pixel pet's
// brows read as dirt on her fringe, and its letters are not cells. It paints
// through the pixel pet onto a pixel surface, then lays each whole pixel onto
// the painted kit's canvas as its 4 x 4 samples, at the cell column and pixel
// row the kit gives, inside its clip; the kit encodes it, and a cell of two
// flat pixels encodes exactly. The pixel pet imports nothing of the rig: this
// file is the only one that joins them. Pure.
import type { Canvas } from '../rig/kit/canvas'
import { SX, SY } from '../rig/kit/canvas'
import type { BandForm, Channels } from '../rig/kit/pet'
import type { Arms, Gaze, Lids, Mouth, Pose, Spark } from '../pixel/dracaena-pixel'
import { COLUMNS, MOUTH, REST, ROWS } from '../pixel/dracaena-pixel'
import { DRACAENA_PIXEL } from '../pixel/dracaena-pixel-pet'
import { Pixels } from '../pixel/pixels'

/** A channel of the rig's pose (every one the mapping reads is a param of her rig). */
const at = (pose: Channels, key: string): number => pose[key] ?? 0

/** Her sparks: as many as her rig flies, the rig's wand tip at rest (their home), and the pixel pet's wand tip; units to pixels. */
const SPARKS = 14
const HOME = [11.5, 44] as const
const TIP = [3, 3] as const
const PER_UNIT = 0.22
/** Where the rig's sparks gather into a heart, and how many near it make one in the band. */
const HEART_AT = [15, 27] as const
const HEART_NEAR = 9
const HEART_COUNT = 8

function lidsOf(pose: Channels): Lids {
  if (at(pose, 'squeeze') > 0.5) return 'squeeze'
  if (at(pose, 'happy') > 0.5) return at(pose, 'pitch') > 0.45 ? 'proud' : 'happy'
  if (at(pose, 'wink') > 0.5) return 'wink'
  if (at(pose, 'blink') > 0.7) return at(pose, 'pitch') > 0.45 ? 'proud' : 'shut'
  if (at(pose, 'wide') > 0.5) return 'wide'
  if (at(pose, 'knit') > 0.5) return 'glare'
  if (at(pose, 'lid') > 0.42 || at(pose, 'blink') > 0.35 || at(pose, 'gazeY') > 0.45) return 'half'
  return 'open'
}

function gazeOf(pose: Channels): Gaze {
  // gazeX below 0 looks to the viewer's left: toward the bubble, the pixel pet's `left`.
  if (at(pose, 'gazeX') < -0.35) return 'left'
  if (at(pose, 'gazeX') > 0.35) return 'right'
  if (at(pose, 'gazeY') < -0.45) return 'up'
  if (at(pose, 'gazeY') > 0.45) return 'down'
  return 'front'
}

function mouthOf(pose: Channels): Mouth {
  const open = at(pose, 'open')
  const smile = at(pose, 'smile')
  if (open > 1.2) return 'yawn'
  if (open > 0.55) return smile > 0.6 ? 'laugh' : 'open'
  if (open > 0.3) return at(pose, 'pout') > 0.3 ? 'o' : smile > 0.5 ? 'grin' : 'open'
  if (at(pose, 'wave') > 0.5) return 'wobbly'
  if (at(pose, 'pout') > 0.6) return 'pout'
  if (at(pose, 'smirk') > 0.55) return smile < -0.2 ? 'scoff' : 'smirk'
  if (smile > 0.55) return 'smile'
  if (smile > 0.25) return 'soft'
  if (smile < -0.35) return 'frown'
  return 'rest'
}

const blushOf = (pose: Channels): number => {
  const blush = at(pose, 'blush')
  return blush > 0.75 ? 3 : blush > 0.45 ? 2 : blush > 0.15 ? 1 : 0
}

/** Her arm, by its hand's shape and where it is; down while it is lowered out of the box. */
function armsOf(pose: Channels): Arms {
  if (at(pose, 'arm') < 0.5 || at(pose, 'drop') > 0.6) return 'down'
  const grip = at(pose, 'grip')
  if (grip < 0.5) return at(pose, 'wand') > 0.5 ? 'wand' : 'down'
  if (grip < 1.5) return at(pose, 'handX') > 15 ? 'tie' : 'nails'
  if (grip < 2.5) return at(pose, 'handY') < -20 ? 'cover' : 'down'
  return at(pose, 'handY') < -25 ? 'twirl' : 'chin'
}

/** The long lock's flip in stages: lifting, flung out, behind her and settling. */
function hairOf(pose: Channels): number {
  if (at(pose, 'flip') >= 0.5) return 3
  const out = at(pose, 'lockR.0')
  return out > 0.25 ? 2 : out > 0.12 ? 1 : 0
}

/** Her sparks lit, as pixels round the pixel pet's wand tip; and whether enough of them hold in a heart. */
function sparksOf(pose: Channels): { readonly sparks: Spark[]; readonly heart: boolean } {
  const lit: (readonly [x: number, y: number, size: number])[] = []
  for (let k = 0; k < SPARKS; k++) {
    if (at(pose, `spark.${k}.on`) < 0.5) continue
    lit.push([HOME[0] + at(pose, `spark.${k}.x`), HOME[1] + at(pose, `spark.${k}.y`), at(pose, `spark.${k}.size`)])
  }
  const near = lit.filter(([x, y]) => Math.hypot(x - HEART_AT[0], y - HEART_AT[1]) <= HEART_NEAR).length
  if (near >= HEART_COUNT) return { sparks: [], heart: true }
  const sparks: Spark[] = []
  for (const [x, y, size] of lit) {
    const px = Math.round(TIP[0] + (x - HOME[0]) * PER_UNIT)
    const py = Math.round(TIP[1] + (y - HOME[1]) * PER_UNIT)
    if (px < 0 || px >= COLUMNS || py < 0 || py >= ROWS * 2) continue
    sparks.push([px, py, size > 0.8 ? 2 : size > 0.4 ? 1 : 0])
  }
  return { sparks, heart: false }
}

/** The pixel pet's pose for a rig pose of hers: its picks. */
export function dracaenaPixelPose(pose: Channels): Pose {
  const { sparks, heart } = sparksOf(pose)
  return {
    ...REST,
    lids: lidsOf(pose),
    gaze: gazeOf(pose),
    brows: 'none',
    mouth: mouthOf(pose),
    blush: blushOf(pose),
    turn: at(pose, 'yaw') < -0.3 ? -1 : at(pose, 'yaw') > 0.3 ? 1 : 0,
    tilt: at(pose, 'pitch') > 0.45 ? -1 : at(pose, 'pitch') < -0.35 ? 1 : 0,
    puff: at(pose, 'cheek') > 0.5 ? 1 : 0,
    tear: at(pose, 'tear') > 0.5 ? 1 : 0,
    glint: Math.abs(at(pose, 'hoop')) > 0.25 ? 1 : 0,
    arms: armsOf(pose),
    hair: hairOf(pose),
    breath: at(pose, 'chest') < -0.5 ? 1 : 0,
    sparks,
    heart: heart ? (at(pose, 'blush') > 0.7 ? 2 : 1) : 0,
    mark: 'none',
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
export const DRACAENA_BAND: BandForm = {
  columns: COLUMNS,
  rows: ROWS,
  mouth: MOUTH,
  paint(canvas, pose, c0, top) {
    pixels ??= new Pixels(COLUMNS, ROWS, DRACAENA_PIXEL.palette)
    pixels.clear()
    DRACAENA_PIXEL.paint(pixels, dracaenaPixelPose(pose), false)
    lay(pixels, canvas, c0, top)
  },
  // Her picks are all she shows: the same picks, the same pixels.
  key: pose => JSON.stringify(dracaenaPixelPose(pose)),
}
