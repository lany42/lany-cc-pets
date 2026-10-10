// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The pet's body: what it does without a word. It dozes off once the person
// has been away a while and wakes with a start when they're back, sparkles
// when their work comes good, and shows a heart when petted. Pure:
// register.tsx keeps the marks, and the band draws what these say.
import type { ToolCallResult } from 'claude-code'

import type { EmoteMark, TurnMark } from '../types'
import { ticksOf } from './sprite'
import type { Step } from './sprite'

/** How long without a turn or a word to the pet before it dozes off. */
export const SLEEP_MS = 10 * 60_000

/** Whether the pet dozes at `now`: no turn running, and nothing from the person for SLEEP_MS. */
export function isDrowsy(turn: TurnMark, touchedAt: number, now: number): boolean {
  return !turn.isOpen && now - Math.max(turn.startedAt, turn.endedAt, touchedAt) >= SLEEP_MS
}

/** A reaction without words, played once beside the pet's head. */
export type EmoteKind = EmoteMark['kind']

/** Cells an emote takes beside the pet: every frame of one is this wide. */
export const EMOTE_WIDTH = 3

/** Printable ASCII, like the sprites. A sleeping pet's z's loop; the rest play once. */
const EMOTES: Readonly<Record<EmoteKind | 'sleep', readonly Step[]>> = {
  sleep: [['  z', 4], [' zZ', 4], ['zZz', 4], ['   ', 4]],
  wake: [['  !', 6]],
  cheer: [[' * ', 2], ['*.*', 2], ['. .', 2], [' * ', 2], ['*.*', 2], ['. .', 2]],
  love: [[' <3', 3], ['<3 ', 3], [' <3', 3], ['<3 ', 3]],
}

/**
 * What the body shows at `tick`: the emote beside the head (a played-out one
 * gives way to the z's of a sleeping pet), and whether it is glad, which
 * plays its `cheer` mood.
 */
export function bodyAt(emote: EmoteMark | null, isAsleep: boolean, tick: number): { glyph?: string; isGlad: boolean } {
  if (emote !== null) {
    const names = ticksOf(EMOTES[emote.kind])
    const glyph = names[tick - emote.tick]
    if (glyph !== undefined) return { glyph, isGlad: emote.kind !== 'wake' }
  }
  if (!isAsleep) return { isGlad: false }
  const z = ticksOf(EMOTES.sleep)
  return { glyph: z[tick % z.length], isGlad: false }
}

/**
 * One command that runs a test suite: a runner at the start, after any
 * `VAR=x` and a launcher (`npx`, `uv run`...).
 */
const RUNNER = new RegExp(
  '^(?:[A-Za-z_][A-Za-z0-9_]*=\\S*\\s+)*(?:(?:npx|bunx|pnpx|uv\\s+run|poetry\\s+run|bundle\\s+exec)\\s+)?' +
    '(?:(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?test|jest|vitest|mocha|playwright\\s+test|pytest|python3?\\s+-m\\s+(?:pytest|unittest)' +
    '|rspec|phpunit|go\\s+test|cargo\\s+(?:test|nextest)|make\\s+(?:test|check)|\\.?\\/?gradlew\\s+test|gradle\\s+test|mvn\\s+test' +
    '|dotnet\\s+test|deno\\s+test|mix\\s+test|ctest|tox|claude\\s+plugin\\s+test)\\b',
)

/**
 * Whether `command` runs a test suite whose exit status is the suite's: a
 * pipe, `;` or a second line would let another command's status stand in.
 */
export function isTestRun(command: string): boolean {
  if (/[|;\n]/.test(command)) return false
  return command.split('&&').some(part => RUNNER.test(part.trim()))
}

/**
 * What a finished Bash call means to the person: whether their suite is red
 * now, and whether it was a win (a red suite gone green; a commit made, a PR
 * opened or merged, a branch merged, as the engine reads the call itself).
 * A call sent to the background has no outcome yet.
 */
export function judgeRun(command: string, ran: ToolCallResult<'Bash'>, wasRed: boolean): { isRed: boolean; isWin: boolean } {
  if (ran.deny !== undefined) return { isRed: wasRed, isWin: false }
  if (ran.isError === true) return { isRed: wasRed || isTestRun(command), isWin: false }
  if (ran.result.backgroundTaskId !== undefined) return { isRed: wasRed, isWin: false }

  const git = ran.result.gitOperation
  const isShipped =
    git?.commit?.kind === 'committed' ||
    git?.pr?.action === 'created' ||
    git?.pr?.action === 'merged' ||
    git?.branch?.action === 'merged'
  if (!isTestRun(command)) return { isRed: wasRed, isWin: isShipped }
  return { isRed: false, isWin: wasRed || isShipped }
}
