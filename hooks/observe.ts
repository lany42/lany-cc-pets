// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The pet's eyes: when a line is due, and what slice of the transcript it
// reacts to. Pure: register.tsx's observer timer reads the state and the
// transcript, and asks these.
import type { SessionMessage } from 'claude-code'

import type { SeenMark, TurnMark } from '../types'

/** How often the observer looks. */
export const OBSERVE_MS = 2000
/** How long after a turn ends before reading it, so its last rows have landed. */
export const SETTLE_MS = 1500
/** The least time between two observed lines: quick exchanges share one. */
export const MIN_GAP_MS = 30_000
/** In a long turn, when the pet first chimes in while Claude is still working; each later line waits twice as long. */
export const MID_TURN_MS = 75_000
/** The most messages one slice reads, newest kept. */
export const SLICE_MESSAGES = 16
/** The most characters a slice hands the side model, newest kept. */
export const SLICE_CHARS = 2400
/** The most of Claude's own words a slice keeps, newest: where things stand, not every step that got there. */
export const CLAUDE_LINES = 2

export type Due = 'turn-end' | 'mid-turn'

/** Whether a line is due at `now`, and why. */
export function dueNow(turn: TurnMark, seen: SeenMark, now: number): Due | undefined {
  if (seen.spokeAt > 0 && now - seen.spokeAt < MIN_GAP_MS) return undefined
  if (!turn.isOpen) {
    // A turn the person stopped with Esc gets no remark: they are likely
    // irritated, and silence is kind. The cursor stays, so the next line covers it.
    if (turn.isAborted === true) return undefined
    return turn.endedAt > seen.spokeAt && now - turn.endedAt >= SETTLE_MS ? 'turn-end' : undefined
  }
  // Each line waits as long as the turn had run when the last one came (75 s,
  // 150 s, 300 s...): the longer the wait, the less there is to say about it.
  const wait = Math.max(MID_TURN_MS, seen.spokeAt - turn.startedAt)
  return now - Math.max(seen.spokeAt, turn.startedAt) >= wait ? 'mid-turn' : undefined
}

function messageKey(message: SessionMessage | undefined): string {
  if (message === undefined) return ''
  const ids = [
    ...message.toolUses.map(use => use.tool_use_id),
    ...(message.toolResults ?? []).map(result => result.tool_use_id),
  ].join(',')
  return `${message.role}|${ids}|${message.text.length}|${message.text.slice(0, 80)}`
}

/** How many rows a tail key spans: two exchanges. */
const TAIL_ROWS = 4

/** A message's place in the transcript, told by it and the rows before it. */
const tailKey = (messages: readonly SessionMessage[], at: number) =>
  Array.from({ length: TAIL_ROWS }, (_, back) => messageKey(messages[at - TAIL_ROWS + 1 + back])).join('\n')

/**
 * The messages after the tail last seen (`key`, taken when the transcript held
 * `count` rows), at most SLICE_MESSAGES of the newest; all of the newest when
 * that tail is gone (a /clear, a compaction).
 *
 * Rows only append between looks, so the seen tail sits at `count - 1`, or
 * lower once the newest-4096 window slides; never later. The search starts
 * there, so the same exchange repeated since ("continue" / "Done.") is not
 * mistaken for it. A full window slides by an amount it can't tell, so the
 * search starts at the newest row there: the key spans two exchanges, so one
 * repeated exchange still can't pass for the tail.
 */
export function sliceSince(
  messages: readonly SessionMessage[],
  key: string | null,
  count = messages.length,
): { fresh: readonly SessionMessage[]; key: string | null; count: number } {
  const last = messages.length - 1
  if (last < 0) return { fresh: [], key: null, count: 0 }

  let from = 0
  if (key !== null) {
    for (let at = Math.min(count > 0 ? count - 1 : last, last); at >= 0; at--) {
      if (tailKey(messages, at) === key) {
        from = at + 1
        break
      }
    }
  }
  return {
    fresh: messages.slice(Math.max(from, messages.length - SLICE_MESSAGES)),
    key: tailKey(messages, last),
    count: messages.length,
  }
}

/**
 * A slice as short lines for the side model, oldest first, newest kept within
 * SLICE_CHARS: what the person said, the newest of what Claude told them, and
 * one closing count of Claude's tool calls. The person watched those calls go
 * by; handed their command strings, or even a count of the failed ones, the pet
 * only reads them back. A setback that matters is in Claude's own words.
 */
export function digest(messages: readonly SessionMessage[]): string[] {
  const lines: string[] = []
  let steps = 0
  for (const message of messages) {
    if (message.role === 'user') {
      const isRefused = (message.toolResults ?? []).some(result => result.text.startsWith(REFUSED))
      const said = isRefused ? 'Your person turned down a step.' : personSaid(message.text)
      if (said !== undefined) lines.push(said)
    } else {
      const text = clean(message.text)
      if (text !== '') lines.push(`Claude: ${clip(text, 240)}`)
      steps += message.toolUses.length
    }
  }
  if (steps > 0) lines.push(`(Claude took ${steps} ${steps === 1 ? 'step' : 'steps'})`)

  const kept: string[] = []
  let room = SLICE_CHARS
  let told = 0
  for (let at = lines.length - 1; at >= 0; at--) {
    const line = lines[at] ?? ''
    if (line.startsWith('Claude: ') && ++told > CLAUDE_LINES) continue
    if (line.length > room) break
    room -= line.length
    kept.unshift(line)
  }
  return kept
}

/** What the person last typed, or undefined when `messages` holds nothing they typed. */
export function lastAsk(messages: readonly SessionMessage[]): string | undefined {
  for (let at = messages.length - 1; at >= 0; at--) {
    const message = messages[at]
    if (message === undefined || message.role !== 'user' || (message.toolResults ?? []).length > 0) continue
    if (rowOf(message.text) !== undefined) continue
    const text = clean(message.text)
    if (text !== '') return clip(text, 200)
  }
  return undefined
}

/** How a tool result starts when the person turned the call down. */
const REFUSED = "The user doesn't want to proceed"

/**
 * User rows the person never typed, as what they mean to them: a background
 * job's report, their own Esc, and the summary a compaction leaves ('' drops it).
 */
function rowOf(text: string): string | undefined {
  if (text.startsWith('<task-notification>')) return 'A background job reported back.'
  if (text.startsWith('[Request interrupted by user')) return 'Your person stopped Claude.'
  if (text.startsWith('This session is being continued from a previous conversation')) return ''
  return undefined
}

/** A user row as a line: the person's words, what a row they never typed means, or nothing. */
function personSaid(raw: string): string | undefined {
  const row = rowOf(raw)
  if (row !== undefined) return row === '' ? undefined : row
  const text = clean(raw)
  return text === '' ? undefined : `Your person: ${clip(text, 300)}`
}

/**
 * Drops the engine's reminders, markup and code blocks, leaving what a person
 * wrote or read. The engine's tags have a hyphen or underscore in the name
 * (`<command-name>`, `<ide_selection>`), so `Map<string>` and `x<y && y>z` are
 * left alone.
 */
function clean(text: string): string {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<\/?[a-z][a-z\d]*[-_][\w-]*(?:\s[^<>]*)?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** At most `max` characters, never cutting an emoji's surrogate pair in half. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${/[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut}…`
}
