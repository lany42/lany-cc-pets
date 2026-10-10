// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The grown kind: creatures computed, not drawn (a bonsai, a jellyfish, a
// flock), each born from a seed word and simulated a tick at a time. This
// adapter makes each a lab look; their own files keep their algorithms and
// tuning as braille-generative wrote them. Pure.
import type { Color } from 'claude-code'

import type { LabInput, LabLook, LabRun, Live } from '../look'
import { bonsai } from './bonsai'
import { newFrame, runs, seedOf } from './core'
import type { GenPet } from './core'
import { flock } from './flock'
import { jelly } from './jelly'

/** One grown pet, alive: its state, the frame its last tick drew, and that frame as runs. */
function grow<S>(pet: GenPet<S>, seed: number, memory?: unknown): Live {
  const state = pet.born(seed, memory)
  const frame = newFrame(pet.cols, pet.rows)
  let drawn: LabRun[][] = runs(frame, pet.inks)
  return {
    step(input: LabInput) {
      const month = new Date(input.now).getMonth()
      pet.tick(state, { tick: input.tick, mood: input.mood, turnsEnded: input.turnsEnded, spoke: input.spoke, month }, frame)
      drawn = runs(frame, pet.inks)
    },
    runs: () => drawn,
    describe: () => pet.describe(state),
  }
}

/** The seed every gallery card grows from, so a card looks the same each time. */
const DEMO_SEED = seedOf('moki')

function grownLook<S>(pet: GenPet<S>, extra: { blurb: string; fallback: string; bubble: Color; demoMemory?: unknown }): LabLook {
  return {
    id: pet.id,
    name: pet.name,
    persona: pet.persona,
    blurb: extra.blurb,
    layout: 'pet',
    width: pet.cols,
    height: pet.rows,
    minColumns: 50,
    fallback: extra.fallback,
    bubble: extra.bubble,
    isGrown: true,
    ...(pet.turned !== undefined ? { turned: pet.turned } : {}),
    start: (seed, memory) => grow(pet, seed, memory),
    demo: () => grow(pet, DEMO_SEED, extra.demoMemory),
  }
}

export const GROWN_LOOKS: readonly LabLook[] = [
  // Its card shows a tree some months along (a sprout says little), never the person's own.
  grownLook(bonsai, { blurb: 'grows with your turns', fallback: 'flytrap', bubble: 'success', demoMemory: { v: 1, seed: DEMO_SEED, turns: 160 } }),
  grownLook(jelly, { blurb: 'always drifting', fallback: 'love-slime', bubble: 'ide' }),
  grownLook(flock, { blurb: 'a face when it talks', fallback: 'glider', bubble: 'text' }),
]
