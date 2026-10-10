// The rig pets worn as live looks: `momiji`, `sakura` and `pomelo`, each its
// rig and drivers (as data, in the engine's RIG_PETS) through the adapter
// (rig/adapter.ts), its timeline written by its own behavior, as code on the
// rig kit (<id>-behavior.ts on rig/behavior.ts), made a lab look by the
// painted look's runtime (rig/kit/look.ts). This folder sits outside the
// engine (hooks/lab/rig/), which never imports it. Each look is built on
// first use, so one whose documents aren't built yet throws then, by name,
// never as this module loads. The one place a rig look is registered. Pure.
import type { LabLook } from '../look'
import { lookOf } from '../rig/kit/look'
import type { PaintedPet } from '../rig/kit/pet'
import { MOMIJI_RIG } from './momiji'
import { POMELO_RIG } from './pomelo'
import { SAKURA_RIG } from './sakura'

export { MOMIJI_RIG, MOMIJI_RIG_IDENTITY } from './momiji'
export { POMELO_RIG, POMELO_RIG_IDENTITY } from './pomelo'
export { SAKURA_RIG, SAKURA_RIG_IDENTITY } from './sakura'

/** Every rig pet as a painted pet, in the order the gallery lists them (after every other lab look, so their flavor comes last in hooks/flavor.ts too). */
export const PAINTED_RIG_PETS: readonly PaintedPet[] = [MOMIJI_RIG, SAKURA_RIG, POMELO_RIG]

/** Every rig pet as a lab look, in PAINTED_RIG_PETS order. */
export const RIG_LOOKS: readonly LabLook[] = PAINTED_RIG_PETS.map(lookOf)
