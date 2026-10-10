// How a track writes the channel it names: the blend modes a clip's tracks
// use as they lay an act over a pose: `add` (a brow raised on top of the
// mood's), `max` (a smile that never lowers one already there), `min`, `set`
// (the strand, the breath) and `mix` (a glance pulled toward `to` by the
// track's value as a weight: Sakura's peek). Each is computed `current`
// first, as written below. Registered in registry.ts; the pendulum
// (physics.ts) writes its swing by one too. Pure: imports nothing at run
// time.
import type { BlendMode } from './registry'

export const BLENDS: readonly BlendMode[] = [
  { id: 'add', apply: (current, value) => current + value },
  { id: 'max', apply: (current, value) => Math.max(current, value) },
  { id: 'min', apply: (current, value) => Math.min(current, value) },
  { id: 'set', apply: (_current, value) => value },
  /** `value` of the way from `current` to `to` (util.ts's `mix`); without a `to` it leaves the channel be. */
  { id: 'mix', apply: (current, value, to) => (to === undefined ? current : current + (to - current) * value) },
]
