// The baked kind's looks, in the order the gallery lists them.
import type { LabLook } from '../look'
import { bakedLook } from './pet'
import { MINIATURES } from './pets'

/** What each does, for its gallery card. */
const BLURBS: Readonly<Record<string, string>> = {
  'luna-moth': 'flutters as Claude works',
  'clockwork-scarab': 'walks while Claude works',
  'hoard-dragon': 'wakes while Claude works',
  hummingbird: 'sips while Claude works',
  cuttlefish: 'hunts while Claude works',
}

export const BAKED_LOOKS: readonly LabLook[] = MINIATURES.map(pet => bakedLook(pet, BLURBS[pet.id] ?? 'a miniature'))
