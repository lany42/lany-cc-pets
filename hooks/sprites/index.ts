// Every look the pet can take, in the order `/pet as` lists them.
import type { Sprite } from '../sprite'
import { sprite as axolotl } from './axolotl'
import { sprite as blackHole } from './black-hole'
import { sprite as campfire } from './campfire'
import { sprite as cat } from './cat'
import { sprite as chatterTeeth } from './chatter-teeth'
import { sprite as clawd } from './clawd'
import { sprite as crab } from './crab'
import { sprite as eyeberry } from './eyeberry'
import { sprite as ferris } from './ferris'
import { sprite as flytrap } from './flytrap'
import { sprite as fruitBat } from './fruit-bat'
import { sprite as galaxy } from './galaxy'
import { sprite as glider } from './glider'
import { sprite as iceberg } from './iceberg'
import { sprite as jumpingSpider } from './jumping-spider'
import { sprite as lighthouse } from './lighthouse'
import { sprite as loveSlime } from './love-slime'
import { sprite as manyEyes } from './many-eyes'
import { sprite as mergeConflict } from './merge-conflict'
import { sprite as poodleMoth } from './poodle-moth'
import { sprite as python } from './python'
import { sprite as ragDoll } from './rag-doll'
import { sprite as reflogGhost } from './reflog-ghost'
import { sprite as replacementChar } from './replacement-char'
import { sprite as rubberDuck } from './rubber-duck'
import { sprite as seaAngel } from './sea-angel'
import { sprite as seaBunny } from './sea-bunny'
import { sprite as sourdough } from './sourdough'
import { sprite as titania } from './titania'
import { sprite as toaster } from './toaster'
import { sprite as typewriter } from './typewriter'
import { sprite as walkingHut } from './walking-hut'
import { sprite as waterBear } from './water-bear'
import { sprite as yak } from './yak'

export const SPRITES: readonly Sprite[] = [
  cat,
  // Objects, tools and machines with a soul
  toaster,
  chatterTeeth,
  typewriter,
  lighthouse,
  // Elements, weather and growing things
  flytrap,
  iceberg,
  titania,
  sourdough,
  campfire,
  // Mythic, cosmic and surreal
  blackHole,
  galaxy,
  walkingHut,
  manyEyes,
  // Abstract, typographic and mathematical
  mergeConflict,
  glider,
  replacementChar,
  // Developer folklore: the duck you explain the bug to, the yak you end up
  // shaving, and the ghost that keeps the commits you gave up on
  rubberDuck,
  yak,
  reflogGhost,
  // Mascots of the tools: Claude Code's Clawd, Rust's Ferris, Python's two snakes
  clawd,
  ferris,
  python,
  // So cute it's a little scary: pure sugar first, then scary-cute
  axolotl,
  waterBear,
  fruitBat,
  poodleMoth,
  seaBunny,
  crab,
  eyeberry,
  seaAngel,
  ragDoll,
  loveSlime,
  jumpingSpider,
]

export const DEFAULT_SPRITE: Sprite = cat

/** Looks since replaced, by the id a person may still have stored, and the look that took each one's place. */
const REPLACED: ReadonlyMap<string, string> = new Map([
  ['button-plush', 'rag-doll'],
])

/** The look `id` names, or the one that replaced it; an id that names neither wears the default. */
export const spriteById = (id: string): Sprite => {
  const current = REPLACED.get(id) ?? id
  return SPRITES.find(sprite => sprite.id === current) ?? DEFAULT_SPRITE
}
