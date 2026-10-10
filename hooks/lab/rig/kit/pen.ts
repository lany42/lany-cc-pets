// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The painted look's pen: outlines drawn in a pet's own units with lines
// and cubic curves, flattened through an affine transform into the canvas's
// samples, and tapered strokes made into outlines. A transform per part (the
// head turning on its neck, the chest rising) is how a painted pet moves. Pure:
// imports nothing but the lab's shared helpers (util.ts, pure too). It
// exports a function named `then`, so `await import()` of this module alone
// treats it as a promise and fails: a script imports it statically, or
// through a module that re-exports it.
import { mix } from '../../util'

/** x' = a x + c y + e, y' = b x + d y + f. */
export type Affine = readonly [a: number, b: number, c: number, d: number, e: number, f: number]

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

/** `outer` applied after `inner`. */
export function then(inner: Affine, outer: Affine): Affine {
  const [a, b, c, d, e, f] = inner
  const [A, B, C, D, E, F] = outer
  return [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F]
}

export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y]
export const scale = (sx: number, sy = sx): Affine => [sx, 0, 0, sy, 0, 0]

/** A turn of `angle` radians (clockwise on screen, y down) about (x, y). */
export function rotateAbout(angle: number, x: number, y: number): Affine {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return [cos, sin, -sin, cos, x - cos * x + sin * y, y - sin * x - cos * y]
}

/** Where (x, y) lands under `m`. */
export const apply = (m: Affine, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** A point in a pet's units. */
export type P = readonly [number, number]

/**
 * Draws outlines in a pet's units and hands them back in samples:
 * `move`, `line`, `curve` (cubic), `close`, then `rings()`. Curves are cut
 * into segments about `step` samples long.
 */
export class Pen {
  private m: Affine
  private readonly step: number
  private ring: number[] = []
  private done: number[][] = []
  private x = 0
  private y = 0

  constructor(m: Affine, step = 1.5) {
    this.m = m
    this.step = step
  }

  /** Starts again under another transform. */
  reset(m: Affine): this {
    this.m = m
    this.ring = []
    this.done = []
    return this
  }

  private emit(x: number, y: number): void {
    const m = this.m
    this.ring.push(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
    this.x = x
    this.y = y
  }

  move(x: number, y: number): this {
    if (this.ring.length > 0) this.done.push(this.ring)
    this.ring = []
    this.emit(x, y)
    return this
  }

  line(x: number, y: number): this {
    this.emit(x, y)
    return this
  }

  curve(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    const m = this.m
    const x0 = this.x
    const y0 = this.y
    // The control polygon's length in samples bounds the curve's.
    const span = (ax: number, ay: number, bx: number, by: number) => Math.hypot(m[0] * (bx - ax) + m[2] * (by - ay), m[1] * (bx - ax) + m[3] * (by - ay))
    const length = span(x0, y0, c1x, c1y) + span(c1x, c1y, c2x, c2y) + span(c2x, c2y, x, y)
    const n = Math.max(2, Math.min(48, Math.ceil(length / this.step)))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      const a = u * u * u
      const b = 3 * u * u * t
      const c = 3 * u * t * t
      const d = t * t * t
      this.emit(a * x0 + b * c1x + c * c2x + d * x, a * y0 + b * c1y + c * c2y + d * y)
    }
    return this
  }

  close(): this {
    if (this.ring.length > 0) this.done.push(this.ring)
    this.ring = []
    return this
  }

  rings(): number[][] {
    this.close()
    const rings = this.done
    this.done = []
    return rings
  }
}

/** A point on the cubic p0 c1 c2 p3 at t. */
function bezier(p0: P, c1: P, c2: P, p3: P, t: number): [number, number] {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [a * p0[0] + b * c1[0] + c * c2[0] + d * p3[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p3[1]]
}

/**
 * A stroke along the cubic p0 c1 c2 p3 as an outline, `width(t)` across at
 * each point (in the pet's units): a lash line thick in the middle, a
 * strand tapering to its tip. `n` segments.
 */
export function stroke(pen: Pen, p0: P, c1: P, c2: P, p3: P, width: (t: number) => number, n = 16): number[][] {
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const [x, y] = bezier(p0, c1, c2, p3, t)
    const [ax, ay] = bezier(p0, c1, c2, p3, Math.max(0, t - 0.01))
    const [bx, by] = bezier(p0, c1, c2, p3, Math.min(1, t + 0.01))
    const len = Math.hypot(bx - ax, by - ay) || 1
    const half = width(t) / 2
    const nx = (-(by - ay) / len) * half
    const ny = ((bx - ax) / len) * half
    left.push([x + nx, y + ny])
    right.push([x - nx, y - ny])
  }
  const [first, ...rest] = left
  pen.move(first![0], first![1])
  for (const [x, y] of rest) pen.line(x, y)
  for (let k = right.length - 1; k >= 0; k--) pen.line(right[k]![0], right[k]![1])
  return pen.rings()
}

/** An ellipse at (cx, cy), radii rx and ry, turned `angle` radians. */
export function ellipse(pen: Pen, cx: number, cy: number, rx: number, ry: number, angle = 0, n = 28): number[][] {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2
    const x = Math.cos(t) * rx
    const y = Math.sin(t) * ry
    if (k === 0) pen.move(cx + x * cos - y * sin, cy + x * sin + y * cos)
    else pen.line(cx + x * cos - y * sin, cy + x * sin + y * cos)
  }
  return pen.rings()
}

/** A color between two, 0xRRGGBB (as `a + (b - a) * t`; util.ts's `mixRgb` lerps the other way round). */
export function mixColor(a: number, b: number, t: number): number {
  const r = Math.round(mix((a >> 16) & 255, (b >> 16) & 255, t))
  const g = Math.round(mix((a >> 8) & 255, (b >> 8) & 255, t))
  const bl = Math.round(mix(a & 255, b & 255, t))
  return (r << 16) | (g << 8) | bl
}
