// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Pomelo worn as a live look, `pomelo`: its rig and drivers as data
// (authored in the studio, drawn as SVG and imported, built into
// RIG_PETS) through the engine's adapter (rig/adapter.ts), its timeline
// written each frame by its own behavior (pomelo-behavior.ts, on the rig
// kit). It wears the physics pipeline: its three tiers of gills swing on
// pendulums its head's tilt drives, where the keyed pipeline keys them in
// its curious tilt and its wiggle. Its bubble is a prop in a space of its
// own, keyed on one param. Below 10 rows the band shows Pomelo Pixel, a
// pixel pet of its own, played by its own director. Pure.
import type { PaintedPet } from '../rig/kit/pet'
import type { RigPetIdentity } from '../rig/adapter'
import { lazyPaintedRigPet, rigPetById } from '../rig/adapter'
import { MOUTH } from '../pixel/pomelo-pixel'
import { POMELO_PIXEL } from '../pixel/pomelo-pixel-pet'
import { pomeloBehavior } from './pomelo-behavior'

/** Who it is: its id, name, persona and blurb; its framing, fallback and border; the pixel pet in its band. */
export const POMELO_RIG_IDENTITY: RigPetIdentity = {
  id: 'pomelo',
  name: 'Pomelo',
  persona: 'Pomelo, a pink axolotl with feathery coral gills, who now and then lets go one bubble and watches it rise until it pops',
  blurb: 'watches its bubble rise',
  fallback: 'axolotl',
  bubble: 'claude',
  // Its words' border, in its colors: the gills' coral on a dark theme, their deep plum stalks on a light.
  border: { dark: 0xe56180, light: 0x84397d },
  band: { pet: POMELO_PIXEL, mouth: MOUTH },
  // The crop frames its head and every gill, fanned wide too (the wiggle lifts the top tips to about y 4.76); its words stay left of the gill tips, their tail at the middle of its mouth.
  window: { crop: { top: 4, bottom: 58 }, faceLeft: 6, mouth: [50, 50] },
}

/** It as a painted pet, built from `RIG_PETS` when first posed or painted; at rest with its idle smile over the rig's defaults. */
export const POMELO_RIG: PaintedPet = lazyPaintedRigPet(POMELO_RIG_IDENTITY, () => rigPetById('pomelo'), pomeloBehavior, { rest: { smile: 0.2 } })
