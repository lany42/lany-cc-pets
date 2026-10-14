// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// Show prompts: each side call the pet makes, kept as it was sent and as it
// came back, and spliced into pet-control's chat log above the line it wrote.
// Nothing here is sent anywhere: it only shows what already was.
import type { ChatLine, DebugCall, DebugCalls, DebugRequest } from '../types'

/** The most calls Show prompts keeps, newest last: a dump is long, the chat log at most CHAT_LINES. */
export const DEBUG_CALLS = 20

/** Show prompts with nothing kept yet. */
export const NO_CALLS: DebugCalls = { next: 1, calls: [] }

/** `calls` with a record of `request` going out, which takes the next id; the newest DEBUG_CALLS kept. */
export const opened = (calls: DebugCalls, kind: DebugCall['kind'], request: DebugRequest): DebugCalls => ({
  next: calls.next + 1,
  calls: [...calls.calls, { id: calls.next, kind, request }].slice(-DEBUG_CALLS),
})

/** `calls` with record `id` finished as `end` says; one already let go stays gone. */
export const closed = (calls: DebugCalls, id: number, end: Pick<DebugCall, 'reply' | 'outcome' | 'shown'>): DebugCalls => ({
  ...calls,
  calls: calls.calls.map(one => (one.id === id ? { ...one, ...end } : one)),
})

/** A chat line, or a call kept for Show prompts, in the order the log draws them. */
export type Spliced = { kind: 'line'; line: ChatLine } | { kind: 'call'; call: DebugCall }

/**
 * The chat log with `calls` (oldest first) spliced in: each call just above
 * the line it wrote, and a call that wrote none (it came too late, or a timed
 * line failed) above the first line a later call wrote, or at the end. A
 * line of yours places none: a call is placed by the lines calls wrote.
 */
export function spliced(log: readonly ChatLine[], calls: readonly DebugCall[]): Spliced[] {
  const drawn: Spliced[] = []
  let at = 0
  const placeTo = (id: number) => {
    for (let call = calls[at]; call !== undefined && call.id <= id; call = calls[++at]) drawn.push({ kind: 'call', call })
  }
  for (const line of log) {
    if (line.call !== undefined) placeTo(line.call)
    drawn.push({ kind: 'line', line })
  }
  placeTo(Infinity)
  return drawn
}

/** One row of a call's dump: its heading, a section's label, the words sent or received, or a note on them. */
export type DebugRow = { text: string; tone: 'head' | 'label' | 'text' | 'note' }

/** What the engine puts first, which the dump can't show. */
export const IDENTITY_NOTE = "the engine sends Claude Code's own identity block first, then the system below; plugins can't read it"

/**
 * A call's dump, row by row: what it was and how it was asked, the system
 * prompt and the prompt as sent, the reply raw (before `petLine` tidies and
 * clips it), and what came of it where that isn't the reply as it stands.
 */
export function debugRows(call: DebugCall): DebugRow[] {
  const { request, reply } = call
  const how = [
    request.model,
    request.effort === undefined ? undefined : `effort ${request.effort}`,
    request.maxTokens === undefined ? undefined : `max ${request.maxTokens} tokens`,
    request.timeoutMs === undefined ? undefined : `${request.timeoutMs / 1000} s limit`,
  ].filter(part => part !== undefined)
  const rows: DebugRow[] = [
    { text: `#${call.id} ${call.kind} · ${how.join(' · ')}`, tone: 'head' },
    { text: IDENTITY_NOTE, tone: 'note' },
    { text: 'system:', tone: 'label' },
    ...textRows(request.system ?? '(none)'),
    { text: 'prompt:', tone: 'label' },
    ...textRows(request.prompt),
  ]
  if (reply !== undefined && !('thrown' in reply) && reply.isAnswered) {
    rows.push({ text: `reply (raw · ${reply.usage.input_tokens} in / ${reply.usage.output_tokens} out tokens):`, tone: 'label' }, ...textRows(reply.text))
  }
  const end = endOf(call)
  if (end !== undefined) rows.push({ text: end, tone: 'note' })
  return rows
}

/** `text` a row per line, as sent: a blank line keeps its row. */
const textRows = (text: string): DebugRow[] => text.split('\n').map(line => ({ text: line === '' ? ' ' : line, tone: 'text' }))

/** What came of a call, where the reply as it stands doesn't say: still out, dropped, refused, or tidied before it showed. */
function endOf(call: DebugCall): string | undefined {
  const { reply, outcome } = call
  if (reply === undefined) return 'waiting…'
  if ('thrown' in reply) return `no reply: the call threw ${reply.thrown}`
  // As the engine said it: a refusal with no words comes back an empty-reply.
  if (!reply.isAnswered) return `no reply: ${reply.reason === 'api-error' ? `api-error · status ${reply.status ?? 'none'} · ${reply.error}` : reply.reason}`
  if (outcome === 'stale') return 'dropped: a newer line superseded it, or the session moved on'
  if (outcome === 'failed') return 'no line: nothing was left of the reply once tidied'
  if (call.shown !== undefined && call.shown !== reply.text) return `shown as: ${call.shown}`
  return undefined
}
