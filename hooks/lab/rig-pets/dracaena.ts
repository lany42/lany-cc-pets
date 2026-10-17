// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Dracaena worn as a live look, `dracaena`: her rig and drivers as data
// (authored in the studio, built into RIG_PETS) through the engine's adapter
// (rig/adapter.ts), her timeline written each frame by her own behavior
// (dracaena-behavior.ts, on the rig kit). It wears the physics pipeline: her
// long hair, fringe, tie, robe, sleeve, wand and earring swing on pendulums
// and bend on bone chains (rig/deform.ts), her head turns in depth, and her
// wand's sparks fly, gather into a heart and scatter (rig/sparks.ts). Below
// 10 rows the band shows Dracaena Pixel, a pixel pet of its own, played by
// its own director. Pure.
import type { RigPetIdentity } from '../rig/adapter'
import { lazyPaintedRigPet, rigPetById } from '../rig/adapter'
import type { PaintedPet } from '../rig/kit/pet'
import { MOUTH } from '../pixel/dracaena-pixel'
import { DRACAENA_PIXEL } from '../pixel/dracaena-pixel-pet'
import { dracaenaBehavior } from './dracaena-behavior'

/** Who she is: her id, name, persona and blurb; her framing, fallback and border; the pixel pet in her band. */
export const DRACAENA_RIG_IDENTITY: RigPetIdentity = {
  id: 'dracaena',
  name: 'Dracaena',
  persona: 'Dracaena in painted vectors, a platinum-blonde witch in green-lined robes who steals glances and looks away if caught',
  blurb: 'wand sparks, hair flips',
  fallback: 'iceberg',
  bubble: 'suggestion',
  // Her words' border, in her robe's green lining: its light step on a dark theme, its shade on a light.
  border: { dark: 0x4d9468, light: 0x1f4f3d },
  band: { pet: DRACAENA_PIXEL, mouth: MOUTH },
  window: { crop: { top: 14, bottom: 56 }, faceLeft: 22, mouth: [45, 45.5] },
}

/** She as a painted pet, built from `RIG_PETS` when first posed or painted; at rest composed (lids lowered, chin up, a small mouth tucked at one corner) over the rig's defaults. */
export const DRACAENA_RIG: PaintedPet = lazyPaintedRigPet(DRACAENA_RIG_IDENTITY, () => rigPetById('dracaena'), dracaenaBehavior, {
  rest: { lid: 0.4, smirk: 0.3, pout: 0.35, pitch: 0.2, tilt: 0.05, browL: 0.3 },
})
