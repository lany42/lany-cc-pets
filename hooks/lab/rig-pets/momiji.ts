// Momiji worn as a live look, `momiji`: her rig and drivers as
// data (authored in the studio, built into RIG_PETS) through the engine's
// adapter (rig/adapter.ts), her timeline written each frame by her own
// behavior (momiji-behavior.ts, on the rig kit). It wears the physics
// pipeline: her bangs and side locks swing on pendulums her head drives,
// where the keyed pipeline keys them in her toss. Below 10 rows she wears
// her band form (momiji-band.ts), the Momiji Pixel pet posed by her rig.
// Pure.
import type { PaintedPet } from '../rig/kit/pet'
import type { RigPetIdentity } from '../rig/adapter'
import { lazyPaintedRigPet, rigPetById } from '../rig/adapter'
import { MOMIJI_BAND } from './momiji-band'
import { momijiBehavior } from './momiji-behavior'

/** Who she is: her id, name, persona and blurb; her framing, fallback and border; her band form. */
export const MOMIJI_RIG_IDENTITY: RigPetIdentity = {
  id: 'momiji',
  name: 'Momiji',
  persona: 'Momiji, an anime girl in an orange knit beanie and hoodie, whose bangs bounce and settle each time she tosses her head',
  blurb: 'hair swung by physics',
  fallback: 'rag-doll',
  bubble: 'claude',
  // Her words' border, in her colors: the hoodie's tangerine on a dark theme, the beanie's deep pumpkin on a light.
  border: { dark: 0xf39a3d, light: 0xb04a1c },
  chibi: MOMIJI_BAND,
  window: { crop: { top: 6, bottom: 86 }, faceLeft: 17, mouth: [44, 67] },
}

/** She as a painted pet, built from `RIG_PETS` when first posed or painted; at rest with a hint of a smile over the rig's defaults. */
export const MOMIJI_RIG: PaintedPet = lazyPaintedRigPet(MOMIJI_RIG_IDENTITY, () => rigPetById('momiji'), momijiBehavior, { rest: { smile: 0.1 } })
