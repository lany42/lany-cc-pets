// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The raster output stage: a rig's geometry painted into the painted kit's
// own canvas through its own pen, so equal commands under an equal transform
// give equal samples. Each drawable's commands are replayed in its own units
// through a pen under `M = then(transform, m)` (`M L C Z` as `move line
// curve close`), so the pen cuts its curves by their length in samples
// under M; then `canvas.fill(pen.rings(), paint, alpha, clip === 'figure')`,
// the paint made by its type for M. A drawable in the root's units is drawn
// under `m` itself, never composed with an identity. `encode` (the kit's)
// turns the samples into cells. Pure: imports nothing at run time but the
// kit's pen and the registry.
import type { Canvas, Paint } from './kit/canvas'
import type { Affine } from './kit/pen'
import { Pen, then } from './kit/pen'
import type { PaintType } from './registry'
import { REGISTRY } from './registry'
import type { Command, Geometry, ResolvedPaint } from './schema'

/** Whether a transform is the identity, by value. */
const isIdentity = (t: Affine): boolean => t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1 && t[4] === 0 && t[5] === 0

/** A drawable's transform to samples: its chain, then the room's `m` (`m` alone for the root's units). */
export const placeOf = (transform: Affine, m: Affine): Affine => (isIdentity(transform) ? m : then(transform, m))

/** Replays commands through `pen` (in their own units; it flattens them under its transform). */
export function replay(pen: Pen, d: readonly Command[]): void {
  for (const c of d) {
    if (c[0] === 'M') pen.move(c[1], c[2])
    else if (c[0] === 'L') pen.line(c[1], c[2])
    else if (c[0] === 'C') pen.curve(c[1], c[2], c[3], c[4], c[5], c[6])
    else pen.close()
  }
}

/** A resolved paint as the canvas's, under `M`: a solid's color as is, any other by its type. */
function paintOf(paint: ResolvedPaint, M: Affine, last: { id: string; type: PaintType | undefined }): Paint {
  if (paint.type === 'solid') return paint.color as number
  if (last.id !== paint.type) {
    last.id = paint.type
    last.type = REGISTRY.paints.get(paint.type)
  }
  if (last.type === undefined) throw new Error(`rig: no paint "${paint.type}" is registered`)
  return last.type.canvas(paint, M)
}

/** Paints `geometry` into `canvas` under `m` (root units to samples); a clipped canvas paints only its clip. */
export function raster(geometry: Geometry, canvas: Canvas, m: Affine): void {
  const pen = new Pen(m)
  const last: { id: string; type: PaintType | undefined } = { id: '', type: undefined }
  for (const one of geometry) {
    const M = placeOf(one.transform, m)
    pen.reset(M)
    replay(pen, one.d)
    canvas.fill(pen.rings(), paintOf(one.paint, M, last), one.alpha, one.clip === 'figure')
  }
}
