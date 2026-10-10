// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The easings a key may name for the segment it starts: how far from one
// key's value to the next a segment has come at `s` (0 at its start, 1 at its
// end). The `keys` source (sources.ts) reads a segment as `va + (vb - va) *
// E(s)`: `smooth` is motion.ts's smoothstep (as its `keys` eases), `inQuad`
// and `outCubic` Momiji's blink's close and open, `inOutSine` her breath.
// Registered in registry.ts; a new one is an entry here. Pure: imports
// nothing at run time.
import type { Easing } from './registry'

export const EASINGS: readonly Easing[] = [
  /** The straight line. */
  { id: 'linear', ease: s => s },
  /** Smoothstep, as motion.ts's `keys` eases. */
  { id: 'smooth', ease: s => s * s * (3 - 2 * s) },
  /** Slow out of the first key (a blink closing). */
  { id: 'inQuad', ease: s => s * s },
  { id: 'outQuad', ease: s => 1 - (1 - s) * (1 - s) },
  /** Quick out, slow into the next key (a blink opening). */
  { id: 'outCubic', ease: s => 1 - (1 - s) ** 3 },
  /** Half a cosine: a breath. */
  { id: 'inOutSine', ease: s => 0.5 - 0.5 * Math.cos(Math.PI * s) },
  /** A step: the first key's value until the next key's own time, then the next's (a syllable, a hop). */
  { id: 'hold', ease: s => (s >= 1 ? 1 : 0) },
]
