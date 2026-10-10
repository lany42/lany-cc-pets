// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Sakura worn as a live look, `sakura`: her rig and drivers as
// data (authored in the studio, built into RIG_PETS) through the engine's
// adapter (rig/adapter.ts), her timeline written each frame by her own
// behavior (sakura-behavior.ts, on the rig kit). It wears the physics
// pipeline: her long hair swings on pendulums her head and the gust's wind
// drive, her gusts' petals fly as particles (rig/particle.ts) that land in
// her hair 1.9 s or on her nose 2.1 s after setting off, as her clips count
// them, her eyes follow the newest (rig/lookat.ts), and her spectacle's
// shower falls as particles too. Below 10 rows she wears her band form
// (sakura-band.ts), the Sakura Pixel pet posed by her rig. Pure.
import type { PaintedPet } from '../rig/kit/pet'
import type { RigPetIdentity } from '../rig/adapter'
import { lazyPaintedRigPet, rigPetById } from '../rig/adapter'
import { SAKURA_BAND } from './sakura-band'
import { sakuraBehavior } from './sakura-behavior'

/** Who she is: her id, name, persona and blurb; her framing, fallback and border; her band form. */
export const SAKURA_RIG_IDENTITY: RigPetIdentity = {
  id: 'sakura',
  name: 'Sakura',
  persona: 'Sakura, an anime girl with pastel pink hair in a spring kimono, whose eyes follow each cherry petal the wind blows by',
  blurb: 'petals flown by physics',
  fallback: 'love-slime',
  bubble: 'bashBorder',
  // Her words' border, in her colors: her hair's pink on a dark theme, her kimono's deep rose on a light.
  border: { dark: 0xf6bfd2, light: 0x9b4b6c },
  chibi: SAKURA_BAND,
  window: { crop: { top: 8, bottom: 88 }, faceLeft: 22, mouth: [46, 68] },
}

/** She as a painted pet, built from `RIG_PETS` when first posed or painted; at rest dreamy (lids a little lowered, a small smile) over the rig's defaults. */
export const SAKURA_RIG: PaintedPet = lazyPaintedRigPet(SAKURA_RIG_IDENTITY, () => rigPetById('sakura'), sakuraBehavior, { rest: { smile: 0.15, lid: 0.1 } })
