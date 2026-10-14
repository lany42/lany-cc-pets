// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The pet's voice: a tiny system prompt keyed on one personality word and the
// sprite's persona, and one short side call to Sonnet at low effort.
import type { ModelCompleteRequest, ModelCompleteResult } from 'claude-code'

import type { ChatLine } from '../types'

import { clip } from './observe'
import type { Due } from './observe'
import { TICK_MS } from './sprite'

export const DEFAULT_TRAIT = 'curious'

/**
 * One word: letters with their accents and vowel signs (`naïve`, `शांत`),
 * optionally hyphenated (`snarky`, `wide-eyed`, `tsundere-friend-who-secretly-loves-you`).
 */
export const TRAIT = /^\p{L}[\p{L}\p{M}-]*$/u
export const TRAIT_MAX = 48

/** Why `word` can't be a personality, or undefined when it can. */
export function traitProblem(word: string): string | undefined {
  if (!TRAIT.test(word)) return 'One word, please, like snarky or warm. Hyphens join words: wide-eyed.'
  if (word.length > TRAIT_MAX) return `That word is ${word.length} letters; your pet remembers up to ${TRAIT_MAX}.`
  return undefined
}

const MODEL = 'sonnet'

export const systemPrompt = (trait: string, persona: string) =>
  `You are ${persona}, the pet of the person at this terminal, keeping them company while Claude, their AI coding assistant, works for them. ` +
  `Your personality, in one word: ${trait}. ` +
  `Talk to your person, as "you", about how it is going for them: their progress, their wait, their wins and setbacks, their mood. ` +
  `They see every step Claude takes, so unless they ask, never narrate its commands, files or tools, nor repeat what it told them: leave the details to Claude. ` +
  `Shown a moment of their session, say one short sentence to them (at most 12 words), fully in character. ` +
  `Mostly remark rather than ask: they are busy and seldom answer. ` +
  `When your person talks to you directly, answer them in at most two short sentences, still in character. ` +
  `Plain text only: no quotes, no emoji, no markdown, no preamble.`

export const greetingPrompt = (trait: string) =>
  `Your person just gave you your personality: ${trait}. Say hello to them in one sentence.`

export const arrivalPrompt = () => `Your person just picked you as their pet. Say hello to them in one sentence.`

/** Over the remembered lines a prompt starts with, with chat memory on: the one line that frames them. */
export const MEMORY_HEADING = 'Your chat with your person so far, oldest first:'

/** The remembered lines (`chatMemory`) under their heading, to go first in a prompt; with none, nothing, so the prompt is as it was. */
const memoryBlock = (memory: readonly string[]): string[] => (memory.length > 0 ? [MEMORY_HEADING, ...memory] : [])

/**
 * What the side model reads for `/pet btw` and the pane's chat: the person's
 * words, with the session's latest stretch beside them, and with chat memory
 * on, `memory`: the chat so far (see `chatMemory`).
 */
export function btwPrompt(message: string, lines: readonly string[], memory: readonly string[] = []): string {
  return [
    ...memoryBlock(memory),
    `Your person says to you directly: ${message}`,
    ...(lines.length > 0 ? ['For context, the latest stretch of their session:', ...lines.map(line => `- ${line}`)] : []),
    'Your answer:',
  ].join('\n')
}

/** The longest line the bubble shows: an observed reaction, and a direct answer. */
export const LINE_CHARS = 160
export const ANSWER_CHARS = 240

/** With chat memory on, the most of the chat log the pet is shown, newest kept: 24 lines, 12 exchanges or more with lines it said on its own. */
export const MEMORY_LINES = 24
/** ...and the most characters of it, newest kept, so a few long messages can't crowd out the rest or run up the call. */
export const MEMORY_CHARS = 3000
/** The most of one message of yours the pet is shown again; its own answers are already at most ANSWER_CHARS. */
export const MEMORY_SAID_CHARS = 300

/** How what the pet remembers names a line it said on its own. */
const ASIDE = 'You (on your own): '

/**
 * What the pet remembers of the chat log for one request, as lines for its
 * prompt, oldest first: each message of yours it answered with its answer,
 * and each line it said on its own (a timed line, a hello), newest kept
 * within MEMORY_LINES and MEMORY_CHARS, an exchange whole, then thinned
 * (`thinMemory`), so it is never more than the caps allow. A message it never answered (the reply failed, a newer line
 * talked over it, or it is still out), the note saying so, and an answer
 * whose message the log has dropped are left out: no question hangs open.
 * `message`, the one being answered, is never in it: the prompt says it.
 * `said`, the lines the prompt quotes as its last, goes to `thinMemory`.
 */
export function chatMemory(log: readonly ChatLine[], said: readonly string[] = [], message?: string): string[] {
  // The message being answered is your last word in the log: out, so its line can't be remembered as well.
  const last = message === undefined ? -1 : log.findLastIndex(line => line.from === 'you')
  const heard = last >= 0 && log[last]?.text === message ? [...log.slice(0, last), ...log.slice(last + 1)] : log
  const remembered: string[][] = []
  for (let at = 0; at < heard.length; at++) {
    const line = heard[at]
    if (line?.from === 'pet' && line.isAside === true) {
      remembered.push([`${ASIDE}${line.text}`])
      continue
    }
    const answer = heard[at + 1]
    if (line?.from !== 'you' || answer?.from !== 'pet' || answer.isAside === true || answer.isFailed === true) continue
    remembered.push([`Your person: ${clip(line.text.replace(/\s+/g, ' ').trim(), MEMORY_SAID_CHARS)}`, `You: ${answer.text}`])
    at += 1
  }
  const kept: string[][] = []
  let room = MEMORY_CHARS
  let count = 0
  for (let at = remembered.length - 1; at >= 0; at--) {
    const lines = remembered[at] ?? []
    const size = lines.reduce((sum, one) => sum + one.length, 0)
    if (count + lines.length > MEMORY_LINES || size > room) break
    room -= size
    count += lines.length
    kept.unshift(lines)
  }
  return thinMemory(kept, said).flat()
}

/**
 * Keeps memory a light touch: of what the pet remembers (whole exchanges and
 * lines, oldest first), the same thing said twice is kept once, at its
 * latest, and a line it said on its own that `said` already quotes (a timed
 * prompt's "Your last lines") is left out, the prompt having it once.
 */
export function thinMemory(remembered: readonly (readonly string[])[], said: readonly string[] = []): string[][] {
  const quoted = new Set(said.map(line => `${ASIDE}${line}`))
  const seen = new Set<string>()
  const kept: string[][] = []
  for (let at = remembered.length - 1; at >= 0; at--) {
    const lines = remembered[at] ?? []
    const key = lines.join('\n')
    if (seen.has(key) || (lines.length === 1 && quoted.has(key))) continue
    seen.add(key)
    kept.unshift([...lines])
  }
  return kept
}

/** How long a line stays in the bubble before it fades. */
export const SPEECH_MIN_MS = 8000
export const SPEECH_MAX_MS = 12_000

/**
 * Ticks a line stays up: somewhere in 8-12 s, longer lines leaning long.
 * `roll` is a random draw in [0, 1), taken when the line lands.
 */
export function speechTicks(text: string, roll: number): number {
  const lean = Math.min(1, text.length / ANSWER_CHARS) / 2 + roll / 2
  return Math.round((SPEECH_MIN_MS + (SPEECH_MAX_MS - SPEECH_MIN_MS) * lean) / TICK_MS)
}

/** How many of the pet's latest lines its next prompt shows it, so it doesn't repeat itself. */
export const SAID_KEPT = 5
/** How long Claude must have worked before the prompt mentions it: a wait worth a word. */
export const LONG_WAIT_MS = 3 * 60_000

/**
 * What the pet knows of the moment beyond the slice: the person's ask when the
 * slice has scrolled past it, how long Claude has worked, and the pet's own
 * latest lines (at most SAID_KEPT), so the next one doesn't echo them.
 */
export type Moment = { ask?: string; workedMs: number; said: readonly string[] }

/**
 * What the side model reads: the slice's lines, framed by the person's
 * moment, and with chat memory on, `memory` first (see `chatMemory`).
 */
export function slicePrompt(lines: readonly string[], due: Due, moment: Moment, memory: readonly string[] = []): string {
  const took = moment.workedMs >= LONG_WAIT_MS ? `${Math.round(moment.workedMs / 60_000)} minutes` : undefined
  return [
    ...memoryBlock(memory),
    ...(moment.ask !== undefined ? [`Your person asked: ${moment.ask}`] : []),
    due === 'mid-turn'
      ? `Claude has been working${took === undefined ? '' : ` for ${took}`} and is still at it. The latest:`
      : `Claude just finished${took === undefined ? '' : `, after ${took}`}. What happened:`,
    ...lines.map(line => `- ${line}`),
    ...(moment.said.length > 0 ? [`Your last lines (don't repeat their words or their shape): ${moment.said.join(' / ')}`] : []),
    'Your line to them:',
  ].join('\n')
}

/** The pet's side call: its prompt and system prompt are always one string each, never blocks. */
export type PetRequest = ModelCompleteRequest & { prompt: string; system: string }

/** The side call for the pet's next line: Sonnet, low effort, a short reply. */
export const petRequest = (trait: string, persona: string, prompt: string): PetRequest => ({
  model: MODEL,
  system: systemPrompt(trait, persona),
  prompt,
  effort: 'low',
  maxTokens: 200,
  timeoutMs: 20_000,
})

export type PetLine = { text: string } | { error: string }

/** The reply as one tidy line, or why there is none. */
export function petLine(r: ModelCompleteResult, max = LINE_CHARS): PetLine {
  if (!r.isAnswered) {
    return { error: r.reason === 'api-error' ? `api-error ${r.status ?? ''}`.trim() : r.reason }
  }

  // A blank braille cell (U+2800) is a space's job, in a line as in art: it becomes one, and folds with the rest.
  const text = clip(unquote(r.text.replace(/\u2800/g, ' ').replace(/\s+/g, ' ').trim()), max)
  return text === '' ? { error: 'empty-reply' } : { text }
}

/** Why the pet went quiet, in plain words, from the error `petLine` gave. */
export function quietWhy(error: string): string {
  const status = /^api-error (\d+)$/.exec(error)?.[1]
  if (status === '429') return 'too many requests just now (429)'
  if (status === '529') return 'the model is overloaded (529)'
  if (status === '401' || status === '403') return `it couldn't sign in (${status})`
  if (status !== undefined) return `the model had a hiccup (${status})`
  if (error === 'api-error') return 'no connection'
  if (error === 'aborted') return 'it took too long'
  if (error === 'empty-reply') return 'it had nothing to say'
  return error
}

/** The line without the quotes the model wrapped all of it in; quotes within it stay. */
function unquote(text: string): string {
  const inner = /^["“'‘](.*)["”'’]$/s.exec(text)?.[1]
  return inner !== undefined && !/["“”]/.test(inner) ? inner.trim() : text
}
