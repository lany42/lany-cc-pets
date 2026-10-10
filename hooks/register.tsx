import { atom, read, update } from 'claude-code'
import type { BoxProps, ElementConstructor, Elements, EngineInterface, PaneCloseOrigin, Register, RenderNode, RenderSurface, TextProps, Timer } from 'claude-code'

import type { ChatLine, PaneView, SeenMark } from '../types'

import { aboveWidth, BAND_BUTTON, bandColumnsOf, bandInput, BUBBLE_MAX, birthInput, drawsWindowOnly, GUTTER_COLUMNS, labMoodAt, petFits, poseOf, sceneInBand, showsWindow, stepRoom, windowBubbleFor, wordsAt } from './band'
import type { Pose } from './band'
import { EMOTE_WIDTH, isDrowsy, judgeRun } from './body'
import type { EmoteKind } from './body'
import { ANSWER_CHARS, arrivalPrompt, btwPrompt, chatMemory, DEFAULT_TRAIT, greetingPrompt, LINE_CHARS, MEMORY_LINES, petLine, petRequest, quietWhy, SAID_KEPT, slicePrompt, speechTicks, traitProblem } from './comment'
import type { PetLine } from './comment'
import { FLAVOR } from './flavor'
import { bubbleFor, fitPet, newestThatFit, wrapRows } from './layout'
import { digest, dueNow, lastAsk, OBSERVE_MS, sliceSince } from './observe'
import { borderOf, colorOf, paintLines, paintText } from './paint'
import type { Paint, Run } from './paint'
import { frame, TICK_MS } from './sprite'
import { DEFAULT_SPRITE, SPRITES, spriteById } from './sprites'
import { aboutOf, blankTop, cardInput, cardWidth, cropRight, earnsSpectacle, inputOf, isLightTheme, LAB, labById, lookFor, memoryKey, newSeedWord, seedKey, seedOf, seedProblem, stepCard, UNSEEN } from './lab'
import type { Card, Look, Seen } from './lab'
import { runsOf } from './lab/cells'
import { cellsBase64, isCellSafe, widthOf } from './lab/look'
import type { LabCells, LabInput, LabLook, LabRun, Live, Room } from './lab/look'

const tick = atom({ plugin: 'lany-cc-pets', key: 'tick' } as const, 0)
const personality = atom({ plugin: 'lany-cc-pets', key: 'personality' } as const, DEFAULT_TRAIT)
const traitSent = atom({ plugin: 'lany-cc-pets', key: 'traitSent' } as const, 0)
const spriteId = atom({ plugin: 'lany-cc-pets', key: 'spriteId' } as const, DEFAULT_SPRITE.id)
const isHidden = atom({ plugin: 'lany-cc-pets', key: 'isHidden' } as const, false)
const isPondering = atom({ plugin: 'lany-cc-pets', key: 'isPondering' } as const, false)
const speech = atom({ plugin: 'lany-cc-pets', key: 'speech' } as const, null)
const turn = atom({ plugin: 'lany-cc-pets', key: 'turn' } as const, { isOpen: false, startedAt: 0, endedAt: 0, isAborted: false })
const seen = atom({ plugin: 'lany-cc-pets', key: 'seen' } as const, { key: null, count: 0, spokeAt: 0 })
const paneView = atom({ plugin: 'lany-cc-pets', key: 'paneView' } as const, { page: 'settings', isStacked: false })
const chat = atom({ plugin: 'lany-cc-pets', key: 'chat' } as const, [])
const chatSent = atom({ plugin: 'lany-cc-pets', key: 'chatSent' } as const, 0)
const emote = atom({ plugin: 'lany-cc-pets', key: 'emote' } as const, null)
const isAsleep = atom({ plugin: 'lany-cc-pets', key: 'isAsleep' } as const, false)
const isQuiet = atom({ plugin: 'lany-cc-pets', key: 'isQuiet' } as const, false)
const isRemembering = atom({ plugin: 'lany-cc-pets', key: 'isRemembering' } as const, false)
const isExperimental = atom({ plugin: 'lany-cc-pets', key: 'isExperimental' } as const, false)
const classicId = atom({ plugin: 'lany-cc-pets', key: 'classicId' } as const, null)
const isWindowOpen = atom({ plugin: 'lany-cc-pets', key: 'isWindowOpen' } as const, false)
const isPaneOpen = atom({ plugin: 'lany-cc-pets', key: 'isPaneOpen' } as const, false)
const isRestored = atom({ plugin: 'lany-cc-pets', key: 'isRestored' } as const, false)

/** How long a pick's flavor stays up: one sentence, read at leisure. */
const FLAVOR_MS = 8000

/**
 * The pet's one pane, `/pet` (or the band's button) opens on its settings and
 * `/pet list` on its looks. Looks opened from the settings lie over them, as a
 * page of the same pane: a second pane opened from a press in the first would
 * wait behind it as a tab.
 */
export const SETTINGS_PANE = 'pet-control'
// The band's sizes (its button, the gutter, the bubble's widest) and its
// rules (poseOf, the rooms, the birth step) are in band.ts, where the dev
// tools load them too.
const SETTINGS_ROWS = 22
const LOOKS_ROWS = 24
/** How many lines of the chat log it keeps, newest last: enough to fill a tall dock; the pane shows the newest that fit. */
const CHAT_LINES = 40
/** The fewest rows the pane's chat log keeps for itself, however little room the pane has. */
const CHAT_MIN_ROWS = 2
/** Cells pet-control's buttons row and switches row take on one line; with less room beside the pet, each wraps to two. */
const BUTTONS_ROW_CELLS = 37
const SWITCHES_ROW_CELLS = 36
/** The pane's widest layout; wider docks leave the rest empty rather than stretch the fields. */
const PANE_MAX_WIDTH = 76
/** Columns the pane's plain text sits in from its edge: off the frame, in line with the bordered fields and cards. */
const INSET = 1
/** Wide enough for the widest sprite, inside a card's border and padding. */
const CARD_WIDTH = Math.max(16, ...SPRITES.map(sprite => sprite.width)) + 4
/** As tall as the tallest sprite: every card's name and key sit on one line across the gallery. */
const CARD_ART_ROWS = Math.max(...SPRITES.map(sprite => sprite.height))
/** As tall as the tallest lab look's card. */
const LAB_CARD_ROWS = Math.max(...LAB.map(look => look.height))
const HOTKEYS = '123456789abcdefghijklmnopqrstuvwxyz'
/** How far apart, in ticks, the gallery's cards start their idle loops, so they don't blink in step. */
export const CARD_STAGGER = 7
/** The widest a lab look's preview beside pet-control's buttons gets: a scene shows its right-hand end. */
const PREVIEW_COLUMNS = 24
/**
 * The pet window: a pane of its own with the worn look at its full size, a
 * scene in the window's whole room. It asks for this many rows inline and
 * this many columns docked; the person's own size wins.
 */
export const WINDOW_PANE = 'pet-window'
const WINDOW_ROWS = 12
const WINDOW_COLUMNS = 64
/** The rows the chat bar takes, pet-control's and the pet window's: its field inside a round border. */
const CHAT_BAR_ROWS = 3
/** Shown under the experimental! switch, as plain text, so the person sees what their font does with braille. */
export const FONT_TEST = '⣿⣀⠉⢸⡇ these should be dots; boxes or hollow rings mean untick this'
/** The same glyphs in the toast that turns it on, for a check by eye wherever it was turned on from. */
const FONT_TOAST = '⣿⣀⠉⢸⡇ should be dots; boxes or hollow rings mean /pet classic.'

/**
 * This load's bookkeeping. A reload starts it over and drops the old load's
 * timers and any side call in flight; `$.state` keeps the rest, so the next
 * load's observer picks up whatever the last one never got to say.
 */
const session = {
  /**
   * True while a surface can draw the pet: the REPL, or a client attached (the
   * desktop app). A session whose last client lets go stops its clocks till the next.
   */
  isLive: false,
  /** `isHidden`, mirrored so the animation clock stands still while nothing shows it. */
  isHidden: false,
  /**
   * True while the pet's pane is open and placed (`isPaneOpen`, kept for the
   * band): the gallery's cards animate even while the pet is hidden.
   */
  isPaneOpen: false,
  /** `isWindowOpen`, mirrored for the clock: while the pet window is open the pet lives there, and steps in its room. */
  isWindowOpen: false,
  /** The pet window's body above its chat bar on the terminal when it last drew (`windowBodyOf`): the room the worn look steps in while it is open. */
  windowRoom: undefined as Room | undefined,
  /** The animation and observer timers while they run; see `keepTime`. */
  ticker: undefined as Timer | undefined,
  observer: undefined as Timer | undefined,
  /** True while the observer is finding or writing a line: one at a time. */
  isBusy: false,
  /** Lines the person asked for (a `btw`, a greeting) still in flight; the observer waits them out. */
  answering: 0,
  /**
   * The voice each side call in flight was asked in. The pet ponders while one
   * of the current voice is out: a call a newer line has superseded can't be
   * shown, so it doesn't hold "..." over the line that superseded it.
   */
  pending: [] as number[],
  /** Bumped when the person asks for a line: any line asked for before it is stale once it lands. */
  voice: 0,
  /**
   * Your latest message and the voice its answer was asked in, while that
   * answer may still land under it: a line the pet says on its own meanwhile
   * goes in above the message (see `logAside`). A newer line asked for
   * supersedes it, as it does the answer.
   */
  replying: undefined as { message: string; voice: number } | undefined,
  /** The pet's latest lines, newest last (at most SAID_KEPT): the next observed line is shown them, so it doesn't repeat itself. A flip of chat memory forgets them with the log, as a /clear or a /resume does (see `settle`). */
  said: [] as string[],
  lastError: undefined as string | undefined,
  /** When the person last did something the pet saw (a prompt, a word to it, its pane); 0 until its first look. */
  touchedAt: 0,
  /** True while the person's last test run failed: the next that passes is a win. */
  isRed: false,
  /** `isExperimental`, mirrored so the clock and the spinner tell without a read. */
  isExperimental: false,
  /** The lab look the person wears, alive, while experimental! is on; see `wear`. */
  worn: undefined as Worn | undefined,
  /** Bumped by each `wear`, so one a newer one overtook while it read the store lets it be. */
  wearing: 0,
  /** The gallery's lab cards, alive: they step only while the gallery shows (see `advance`). */
  cards: new Map<string, Card>(),
  /** Lab looks that threw this load: taken off and logged once each, their fallbacks standing in till a reload. */
  broken: new Set<string>(),
  /** When a long turn last earned a scene its spectacle (clock ms; 0, never): one in a while, whatever is worn. */
  spectacleAt: 0,
  /**
   * Whether the band (or the pet window, while open) last drew the worn lab
   * look as itself, or its classic stand-in (the desktop, too little room, a
   * look that broke); undefined till one draws it. The clock steps only a
   * look that is drawn, and pet-control and the pet's voice follow it.
   */
  isLabDrawn: undefined as boolean | undefined,
  /**
   * The room the band gave the worn lab look on the terminal when it last
   * drew: the columns it fills or fits, and the rows it may take of what the
   * engine left the band (undefined until it draws), which a scene is
   * composed in and a pet that draws its own bubble talks in. The clock
   * steps the look in them.
   */
  bandColumns: 80,
  bandRows: undefined as number | undefined,
  /** Whether the person's theme is light; unread until a lab look first needs it (see `lightness`). */
  isLight: undefined as boolean | undefined,
  /** The tick from which the theme may be read (again): never while a read is out, a minute on after one failed. */
  themeAfter: 0,
  /** True while a tick is still at work: the next one due meanwhile is let go, so slow state calls never queue ticks up. */
  isTicking: false,
  /**
   * The frame clock of a worn look with frames of its own (`LabLook.frames`):
   * it steps the look between ticks and blits its cells, only while it is
   * drawn as a Raster; see `keepFrames`. Undefined for every other look.
   */
  framer: undefined as Timer | undefined,
  /** When the worn look's tick was last stepped (clock ms): its frames count from it. */
  tickAt: 0,
  /** True while a frame is still at work: one due meanwhile is let go. */
  isFraming: false,
  /** Where the worn look is drawn as a Raster (the band or the pet window, rows top to top + rows of its cells), and the version of them it shows. */
  raster: undefined as { requestId: string; key: string; columns: number; top: number; rows: number; version: number } | undefined,
  /** The settings on their way back from the store after `$.state` was emptied; see `settle`. */
  restoring: undefined as Promise<void> | undefined,
}

/**
 * A lab look the person wears, alive: the word it grew from, what its clock
 * last saw, the news since its last step (turns finished, a spectacle
 * earned), for a grown one `top`: how many of its empty top rows it has left
 * empty all along, which the band leaves out, and `rest`: the last frame of
 * its band self with no words to say, which pet-control previews while it
 * talks. `self` is what drew that band self on its last step (itself, else
 * `twin`: see `keepBandSelf`), undefined while nothing did.
 */
type Worn = { look: LabLook; seed: string; live: Live; seen: Seen; turns: number; spectacle: boolean; top?: number; rest?: readonly (readonly LabRun[])[]; restCells?: LabCells; input?: LabInput; frame?: number; self?: Live; twin?: Live }

/** What came of a line: shown, and what it said; too late to show; or never written. */
type Spoken = { kind: 'landed'; text: string } | { kind: 'stale' } | { kind: 'failed' }

/** Whether anything can show the pet now: the band, or its pane while the band hides it. */
function isShowable(): boolean {
  return session.isLive && (!session.isHidden || session.isPaneOpen || session.isWindowOpen)
}

/** Shows "..." while a call that could still be shown is out. */
async function ponder($: EngineInterface): Promise<void> {
  const isOut = session.pending.includes(session.voice)
  await update($, isPondering, () => isOut)
}

/**
 * Asks the side model for a line on `prompt`, in the voice `voice`, and shows
 * it unless `isStale` says it came too late.
 */
async function speak(
  $: EngineInterface,
  prompt: string,
  voice: number,
  isStale: () => Promise<boolean>,
  max = LINE_CHARS,
): Promise<Spoken> {
  session.pending.push(voice)
  await ponder($)
  try {
    const trait = await read($, personality)
    // A lab look speaks as itself wherever it is drawn: its fallback only stands in for its looks.
    // The look the pet shows speaks: its stand-in, where that is what was drawn.
    const { persona } = aboutOf(shownLook(lookFor(await read($, spriteId), await read($, isExperimental), undefined, await read($, classicId))))
    const line: PetLine = await $.model
      .complete(petRequest(trait, persona, prompt))
      .then(reply => petLine(reply, max), (error: unknown) => ({ error: String(error) }))
    // A call a newer one has superseded says nothing either way, not even that it failed.
    if (await isStale()) return { kind: 'stale' }
    if ('error' in line) {
      session.lastError = line.error
      return { kind: 'failed' }
    }
    session.lastError = undefined

    const now = await read($, tick)
    await update($, speech, () => ({ text: line.text, tick: now, ttl: speechTicks(line.text, Math.random()) }))
    session.said = [...session.said, line.text].slice(-SAID_KEPT)
    return { kind: 'landed', text: line.text }
  } finally {
    session.pending.splice(session.pending.indexOf(voice), 1)
    await ponder($)
  }
}

/** One look at the session: when a line is due, react to the transcript since the last one. */
async function observe($: EngineInterface): Promise<void> {
  if (session.isBusy || session.answering > 0) return
  session.isBusy = true
  try {
    if (await read($, isHidden)) return
    const now = await $.clock.now()
    const mark = await read($, turn)
    const last = await read($, seen)
    const due = dueNow(mark, last, now)
    if (due === undefined) return

    const messages = await $.session.messages()
    const { fresh, key, count } = sliceSince(messages, last.key, last.count)
    // Kept quiet, the pet lets the moment pass without a call: the cursor moves
    // on, so going chatty again starts from here rather than from a backlog.
    const lines = (await read($, isQuiet)) ? [] : digest(fresh)
    if (lines.length === 0) {
      await markSpoken($, now, { key, count })
      return
    }

    // Drop a reply the person has talked over (a `btw`, a greeting), and one
    // the session has moved past: a turn-end line once a newer turn has ended
    // too, a mid-turn line once its turn is over. The cursor stays, so the next
    // line covers this slice as well.
    const voice = session.voice
    const isStale = async () => {
      if (session.voice !== voice || (await read($, isQuiet))) return true
      const latest = await read($, turn)
      return due === 'turn-end' ? latest.endedAt !== mark.endedAt : !latest.isOpen || latest.startedAt !== mark.startedAt
    }
    // What the slice can't say: the ask a long turn has scrolled out of it, how long the person has waited.
    const moment = {
      ask: lastAsk(fresh) === undefined ? lastAsk(messages) : undefined,
      workedMs: mark.startedAt > 0 ? Math.max(0, (due === 'turn-end' ? mark.endedAt : now) - mark.startedAt) : 0,
      said: session.said,
    }
    const spoken = await speak($, slicePrompt(lines, due, moment, await remembered($, moment.said)), voice, isStale)
    if (spoken.kind === 'landed') {
      await markSpoken($, now, { key, count })
      await logAside($, spoken.text)
    }
    if (spoken.kind === 'failed' && session.voice === voice) await markSpoken($, now)
  } finally {
    session.isBusy = false
  }
}

/**
 * Counts `now` as the pet's turn, so the observer holds its next line back
 * from there; never moves `spokeAt` back over a line that landed meanwhile.
 * `cursor` also moves where the observer reads from next.
 */
async function markSpoken($: EngineInterface, now: number, cursor?: Pick<SeenMark, 'key' | 'count'>): Promise<void> {
  await update($, seen, last => ({ ...last, ...cursor, spokeAt: Math.max(last.spokeAt, now) }))
}

/** Speaks a line the person asked for; resolves what came of it. */
type Say = (prompt: string, max?: number) => Promise<Spoken>

/**
 * Runs `line`, a line the person asked for, off the dispatch that asked: it
 * supersedes every line asked before it, the observer waits until it is done,
 * and once it lands it counts as the pet's turn. Counted here, when asked, so
 * no observer can slip in before the timer runs it. Returns the voice it is
 * asked in.
 */
function ask($: EngineInterface, line: (say: Say) => Promise<void>): number {
  session.answering += 1
  const mine = ++session.voice
  const say: Say = async (prompt, max) => {
    const spoken = await speak($, prompt, mine, async () => session.voice !== mine, max)
    if (spoken.kind === 'landed') await markSpoken($, await $.clock.now())
    return spoken
  }
  $.clock.after(1, async () => {
    try {
      await line(say)
    } finally {
      session.answering -= 1
    }
  })
  return mine
}

/**
 * With chat memory on, what the pet remembers of the chat log for the prompt
 * it is asked next (`chatMemory`: never `message`, the one it answers, nor a
 * remark of its own `said` quotes); off, or with nothing left to remember,
 * nothing, and the prompt is byte for byte as it was.
 */
async function remembered($: EngineInterface, said: readonly string[] = [], message?: string): Promise<string[]> {
  return (await read($, isRemembering)) ? chatMemory(await read($, chat), said, message) : []
}

/**
 * Writes a line the pet said on its own (a timed line, a hello) into the chat
 * log, which keeps every line it says, pane open or not. While your latest
 * message still waits for its answer, the line goes in above that message,
 * so the answer lands right under it and "..." stays under it meanwhile.
 */
async function logAside($: EngineInterface, text: string): Promise<void> {
  const aside: ChatLine = { from: 'pet', text, isAside: true }
  await update($, chat, lines => {
    const last = lines.at(-1)
    const waiting = session.replying
    const isAwaited = last?.from === 'you' && waiting?.voice === session.voice && waiting.message === last.text
    return (isAwaited ? [...lines.slice(0, -1), aside, last] : [...lines, aside]).slice(-CHAT_LINES)
  })
}

/**
 * Puts the developer's words to the pet: it answers in its bubble (or in
 * pet-control's chat, while that is up), with the latest of the session in
 * mind and no earlier message to it, or with chat memory on, what it
 * remembers of the chat log (never the message itself). The message is
 * logged as it is asked; the answer goes under it, or a note saying why
 * there is none.
 */
function btw($: EngineInterface, message: string): void {
  const voice = ask($, async say => {
    try {
      const context = digest(sliceSince(await $.session.messages(), null).fresh)
      const spoken = await say(btwPrompt(message, context, await remembered($, [], message)), ANSWER_CHARS)
      if (spoken.kind === 'stale') return
      const line: ChatLine =
        spoken.kind === 'landed'
          ? { from: 'pet', text: spoken.text }
          : { from: 'pet', text: `didn't answer: ${quietWhy(session.lastError ?? 'it went quiet')}`, isFailed: true }
      // Only under its own message: once a newer one is in (or the log was wiped), it stays
      // out, so no line in the log answers another and the pet never remembers it so.
      await update($, chat, lines => (lines.findLast(one => one.from === 'you')?.text === message ? [...lines, line].slice(-CHAT_LINES) : lines))
    } finally {
      if (session.replying?.voice === voice) session.replying = undefined
    }
  })
  session.replying = { message, voice }
}

/**
 * Has the pet say hello in its own time, off the command's dispatch; a newer
 * hello or `btw` supersedes it. Asked one-shot, memory or not; the chat log
 * keeps it as a line said on its own.
 */
function greet($: EngineInterface, prompt: string): void {
  if (!session.isLive) return
  ask($, async say => {
    if (await read($, isHidden)) return
    const spoken = await say(prompt)
    if (spoken.kind === 'landed') await logAside($, spoken.text)
  })
}

/** Plays an emote beside the pet from this tick; none while nothing could show it, so none waits behind a frozen clock. */
async function emoteNow($: EngineInterface, kind: EmoteKind): Promise<void> {
  if (!isShowable()) return
  const t = await read($, tick)
  await update($, emote, () => ({ kind, tick: t }))
}

/** The person did something: the doze clock starts over, and a sleeping pet wakes with a start. */
async function touch($: EngineInterface): Promise<void> {
  await settle($)
  session.touchedAt = await $.clock.now()
  if (!(await read($, isAsleep))) return
  await update($, isAsleep, () => false)
  await emoteNow($, 'wake')
}

/** One look at the person: once they have been away SLEEP_MS, the pet dozes off. */
async function doze($: EngineInterface): Promise<void> {
  if (session.isHidden || (await read($, isAsleep))) return
  const now = await $.clock.now()
  // The first look starts the clock: a fresh load has seen nothing yet.
  if (session.touchedAt === 0) session.touchedAt = now
  if (isDrowsy(await read($, turn), session.touchedAt, now)) await update($, isAsleep, () => true)
}

/** A pat from the pane: a heart and a happy wiggle, and not a word. */
async function petIt($: EngineInterface): Promise<void> {
  await touch($)
  await emoteNow($, 'love')
}

// The pet's settings. Each returns what to tell the person; the pane and the
// command both call them, and neither leaves a row in the transcript the model
// reads beyond what a typed command itself does.

/** Sets the personality from what the person typed, or says why it can't be one. */
async function setTrait($: EngineInterface, raw: string): Promise<string> {
  await settle($)
  const word = raw.trim().toLowerCase()
  const problem = traitProblem(word)
  if (problem !== undefined) return problem

  await update($, personality, () => word)
  await $.store.set('personality', word)
  greet($, greetingPrompt(word))
  return `Your pet is now ${word}.`
}

/** Switches the pet's look, keeps it for later sessions, and has it say hello; a lab look only with experimental! on. */
async function pick($: EngineInterface, id: string): Promise<Told> {
  await settle($)
  const lab = LAB.find(one => one.id === id)
  if (lab !== undefined && !(await read($, isExperimental))) return 'Turn on experimental! first: /pet experimental.'
  const look = lab ?? SPRITES.find(one => one.id === id)
  if (look === undefined) return `No look called ${id}. /pet list shows them all.`

  // The classic look worn last waits for experimental! off: the one picked now, or the one a lab pick takes over from.
  const worn = SPRITES.some(one => one.id === look.id) ? look.id : await read($, spriteId)
  if (SPRITES.some(one => one.id === worn) && (await read($, classicId)) !== worn) {
    await update($, classicId, () => worn)
    await $.store.set('classicId', worn)
  }
  await update($, spriteId, () => look.id)
  await $.store.set('spriteId', look.id)
  await wear($)
  greet($, arrivalPrompt())
  // Its one sentence, long enough to read; a grown look says what it was born from.
  const alive = session.worn
  const born = lab?.isGrown === true && alive?.look === lab ? ` Born from ${alive.seed}.` : ''
  return { text: `${FLAVOR[look.id] ?? `Meet your ${look.name.toLowerCase()}.`}${born}`, timeoutMs: FLAVOR_MS }
}

/** Lets the person wear braille looks, or puts the classic ones back: a lab pick waits in its fallback meanwhile. */
async function setExperimental($: EngineInterface, on: boolean): Promise<string> {
  await settle($)
  if ((await read($, isExperimental)) === on) return on ? 'experimental! is already on.' : 'experimental! is already off.'
  session.isExperimental = on
  await update($, isExperimental, () => on)
  await $.store.set('experimental', on)
  if (!on) session.cards.clear()
  await wear($)
  const id = await read($, spriteId)
  const lab = labById(id)
  if (lab === undefined) return on ? `experimental! is on: braille looks wait at the end of /pet list. ${FONT_TOAST}` : 'experimental! is off.'
  const name = lab.name.toLowerCase()
  if (on) return `experimental! is on: your ${name} is back. ${FONT_TOAST}`
  const { name: classic } = aboutOf(lookFor(id, false, undefined, await read($, classicId)))
  return `experimental! is off: you wear the ${classic.toLowerCase()} again, and your ${name} waits for /pet experimental.`
}

/** The grown looks by id, as a list says them: "bonsai, jelly or flock". */
const GROWN_IDS = ((ids: readonly string[]) => (ids.length < 2 ? ids.join('') : `${ids.slice(0, -1).join(', ')} or ${ids.at(-1)}`))(
  LAB.filter(one => one.isGrown === true).map(one => one.id),
)

/**
 * `/pet seed`: alone, says what the worn grown look grew from; with a word
 * (or `new`, for a pronounceable one), grows it from that, and the pet from
 * the old word waits in the store under it.
 */
async function reseed($: EngineInterface, raw: string | undefined): Promise<string> {
  await settle($)
  if (!session.isExperimental) return `Seeds are for grown looks (${GROWN_IDS}), which need experimental! on.`
  const look = labById(await read($, spriteId))
  if (look?.isGrown !== true) return `Seeds are for grown looks: wear the ${GROWN_IDS} first.`
  const old = await seedWordOf($, look.id)
  const name = look.name.toLowerCase()
  if (raw === undefined) return `Your ${name} is born from ${old}. /pet seed <word> plants another; ${old} stays saved.`
  const word = raw === 'new' ? newSeedWord(Math.random()) : raw
  const problem = seedProblem(word)
  if (problem !== undefined) return problem
  if (old === word) return `Your ${name} already grows from ${word}.`
  await $.store.set(seedKey(look.id), word)
  await wear($)
  return `Your ${name} is born from ${word} now. /pet seed ${old} brings the last one back.`
}

/** The word lab look `id` grows from: the person's, or on its first wear a new one, kept. */
async function seedWordOf($: EngineInterface, id: string): Promise<string> {
  const kept = await $.store.get(seedKey(id))
  if (typeof kept === 'string' && seedProblem(kept) === undefined) return kept
  const word = newSeedWord(Math.random())
  await $.store.set(seedKey(id), word)
  return word
}

/**
 * Puts on the lab look the person picked, born from its seed word and what
 * the store kept under it, or takes it off (experimental! off, a classic
 * look picked). The one already on stays as it is.
 */
async function wear($: EngineInterface): Promise<void> {
  const mine = ++session.wearing
  const look = session.isExperimental ? labById(await read($, spriteId)) : undefined
  // One that broke this load stays off: its fallback stands in till a reload.
  if (look === undefined || session.broken.has(look.id)) {
    session.worn = undefined
    return
  }
  const seed = look.isGrown === true ? await seedWordOf($, look.id) : ''
  if (session.worn?.look === look && session.worn.seed === seed) return
  const memory = look.isGrown === true ? await $.store.get(memoryKey(look.id, seed)) : undefined
  if (mine !== session.wearing) return
  try {
    const worn: Worn = { look, seed, live: look.start(seedOf(seed), memory ?? undefined), seen: UNSEEN, turns: 0, spectacle: false }
    session.worn = worn
    // Its first frame now, so nothing draws it blank till the clock comes round.
    const t = await read($, tick)
    await stepWorn($, worn, t, lightness($, t), true)
  } catch (error) {
    broke($, look, error)
  }
}

/**
 * Takes off a lab look that threw, born or stepping, for the rest of the
 * load: its fallback stands in, and one log line says so (once a look).
 */
function broke($: EngineInterface, look: LabLook, error: unknown): void {
  if (session.worn?.look === look) session.worn = undefined
  if (session.broken.has(look.id)) return
  session.broken.add(look.id)
  const stand = spriteById(look.fallback).name.toLowerCase()
  $.ui.log(`lany-cc-pets: the ${look.name} look broke (${String(error)}); the ${stand} stands in for it until the next load.`)
}

/** Ticks a failed theme read waits before the next try: a minute. */
const THEME_RETRY_TICKS = Math.round(60_000 / TICK_MS)

/**
 * Whether the person's theme is light, as far as is known at tick `t`: dark
 * until /config has answered. The read runs on its own, never awaited, so a
 * slow one holds nothing up; one that fails is not kept, and is tried again
 * a minute on. config.set keeps it fresh after.
 */
function lightness($: EngineInterface, t: number): boolean {
  if (session.isLight === undefined && t >= session.themeAfter) {
    session.themeAfter = Number.POSITIVE_INFINITY
    void $.config.list().then(
      rows => {
        session.isLight = isLightTheme(rows.find(row => row.key === 'theme')?.value)
      },
      () => {
        session.themeAfter = t + THEME_RETRY_TICKS
      },
    )
  }
  return session.isLight ?? false
}

/**
 * Steps the worn lab look to tick `t`, with what the pet's marks say now.
 * Its birth step rests (no line, no "..."), so it always has a resting frame
 * for pet-control; the next tick hands it whatever is being said.
 */
async function stepWorn($: EngineInterface, worn: Worn, t: number, isLight: boolean, isBirth = false): Promise<void> {
  const pondering = await read($, isPondering)
  const said = await read($, speech)
  const mark = await read($, turn)
  // The band's mood, the open turn standing in for its isWorking, which no clock sees.
  const mood = labMoodAt(pondering, said, t, mark.isOpen)
  // In the pet window while it is open, at its full room (a pet's window picture where that holds it); else in the band's.
  const window = session.isWindowOpen ? session.windowRoom : undefined
  const band = { columns: session.bandColumns, rows: session.bandRows }
  const room = stepRoom(worn.look, band, window)
  const isWindow = window !== undefined && showsWindow(worn.look, room)
  const news = { turnsEnded: worn.turns, spectacle: worn.spectacle }
  worn.turns = 0
  worn.spectacle = false
  const now = await $.clock.now()
  const next = inputOf(worn.seen, { tick: t, mood, said, now, room, isLight, isWindow, ...news })
  const input = isBirth ? birthInput(next.input) : next.input
  worn.seen = next.seen
  worn.live.step(input)
  // A look with frames of its own: the frames until the next tick count from this one, with its input.
  if (worn.look.frames !== undefined) {
    worn.input = input
    worn.frame = 0
    session.tickAt = now
  }
  // pet-control's preview: its band self, in the band's room even while it steps in the window's.
  keepBandSelf(worn, input, window === undefined ? undefined : stepRoom(worn.look, band, undefined), isBirth)
  // A grown look's box is as tall as it has grown: a sprout's empty sky is left out, but a row it has
  // once reached stays in, so the box grows with it and never jumps as it sways.
  if (worn.look.isGrown === true) worn.top = Math.min(worn.top ?? Number.POSITIVE_INFINITY, blankTop(worn.live.runs()))
}

/**
 * Keeps what pet-control's preview draws of the worn look, its band self,
 * after a step with `input`: the look itself, but while it steps in the pet
 * window's room (`band` is then the band's) one that draws only the window's
 * picture there (`drawsWindowOnly`: a scene, a rig look painted tall) has a
 * twin, born at rest from the same seed (a grown look, which would need its
 * memory, is a pet and never needs one), stepped in the band's room with the
 * same input. Only while pet-control is open, and on the step that puts the
 * look on, so it has a small resting frame from birth; else nothing draws
 * its band self, the twin goes, and its last rest stands. Its resting frame
 * is kept from whichever drew it.
 */
function keepBandSelf(worn: Worn, input: LabInput, band: Room | undefined, isBirth: boolean): void {
  let step = input
  if (band === undefined || !drawsWindowOnly(worn.look, worn.live)) {
    worn.twin = undefined
    worn.self = worn.live
  } else if (session.isPaneOpen || isBirth) {
    step = worn.twin === undefined ? birthInput(bandInput(input, band)) : bandInput(input, band)
    worn.twin ??= worn.look.start(seedOf(worn.seed))
    worn.twin.step(step)
    worn.self = worn.twin
  } else {
    worn.twin = undefined
    worn.self = undefined
  }
  if (worn.self !== undefined && step.line === undefined && step.mood !== 'ponder') keepRest(worn, worn.self)
}

/**
 * Keeps the worn look's resting frame, for pet-control's preview, from
 * `live`, what drew its band self: its runs; for a look that paints in
 * cells, a copy of the cells, made runs only if the preview asks (`restOf`),
 * as the band and the window draw the cells themselves and make no Text of
 * them.
 */
function keepRest(worn: Worn, live: Live): void {
  const cells = live.bandRuns === undefined ? live.cells?.() : undefined
  if (cells === undefined) {
    worn.rest = live.bandRuns?.() ?? live.runs()
    worn.restCells = undefined
    return
  }
  const data = worn.restCells?.data.length === cells.data.length ? worn.restCells.data : new Uint32Array(cells.data.length)
  data.set(cells.data)
  worn.restCells = { columns: cells.columns, rows: cells.rows, data, version: cells.version }
  worn.rest = undefined
}

/** The worn look's resting frame as runs (`keepRest`); undefined before it has rested. */
function restOf(worn: Worn): readonly (readonly LabRun[])[] | undefined {
  if (worn.rest === undefined && worn.restCells !== undefined) worn.rest = runsOf(worn.restCells)
  return worn.rest
}

/** Steps the gallery's lab cards to tick `t`, born on their first; each idles CARD_STAGGER ticks on from the last. */
async function stepCards($: EngineInterface, t: number, isLight: boolean): Promise<void> {
  const now = await $.clock.now()
  LAB.forEach((look, at) => {
    const since = t - (session.cards.get(look.id)?.bornAt ?? t)
    stepCard(session.cards, look, t, cardInput(t + (SPRITES.length + at) * CARD_STAGGER, since, look, now, isLight))
  })
}

/**
 * A main turn finished, not on an Esc, with experimental! on. The worn look
 * hears of it on its next step (a long one may earn a scene its spectacle),
 * and every grown look that counts turns keeps it in its memory, worn or not,
 * hidden or not: one store write each, and none for a memory it doesn't know.
 */
async function turned($: EngineInterface, durationMs: number, now: number): Promise<void> {
  const worn = session.worn
  if (worn !== undefined) {
    worn.turns += 1
    if (earnsSpectacle(durationMs, now, session.spectacleAt)) {
      session.spectacleAt = now
      worn.spectacle = true
    }
  }
  for (const look of LAB) {
    if (look.turned === undefined) continue
    // Never planted (no seed word yet), it has no tree to grow.
    const word = worn?.look === look ? worn.seed : await $.store.get(seedKey(look.id))
    if (typeof word !== 'string' || seedProblem(word) !== undefined) continue
    const key = memoryKey(look.id, word)
    const memory = look.turned((await $.store.get(key)) ?? undefined, seedOf(word))
    if (memory !== undefined) await $.store.set(key, memory)
  }
}

/**
 * One tick of the animation clock. A worn lab look, and the gallery's lab
 * cards while they show, step first, here and nowhere else (a render only
 * reads what they drew); then the tick moves on and every drawing follows.
 */
async function advance($: EngineInterface): Promise<void> {
  // Only a look something draws: not one whose stand-in the band last drew, with pet-control shut.
  // Its news waits for it (turns are counted as they finish), and it steps again once it is drawn.
  const worn = session.worn !== undefined && (session.isLabDrawn !== false || session.isPaneOpen) ? session.worn : undefined
  const isGallery = session.isExperimental && session.isPaneOpen && (await read($, paneView)).page === 'looks'
  if (worn === undefined && !isGallery) {
    await update($, tick, n => n + 1)
    keepFrames($)
    return
  }
  const t = (await read($, tick)) + 1
  const isLight = lightness($, t)
  if (worn !== undefined) {
    try {
      await stepWorn($, worn, t, isLight)
    } catch (error) {
      // A look that throws is taken off, its fallback standing in: the tick, and every line's time with it, goes on.
      broke($, worn.look, error)
    }
  }
  if (isGallery) await stepCards($, t, isLight)
  // Never back: a tick moved on meanwhile stays where it is.
  await update($, tick, n => Math.max(n, t))
  // Its frames, in step with the tick just taken.
  keepFrames($, worn !== undefined)
}

/**
 * Runs the frame clock while the worn look has frames of its own and is
 * drawn as a Raster where something shows it; otherwise it stops. `isTick`
 * starts it over in step with the tick just taken, so frame k lands k frames
 * after it. Every other look never starts it.
 */
function keepFrames($: EngineInterface, isTick = false): void {
  const frames = session.worn?.look.frames ?? 0
  const isWanted = frames > 1 && session.isExperimental && isShowable() && session.isLabDrawn !== false && session.raster !== undefined
  if (isWanted && isTick) {
    session.framer?.cancel()
    session.framer = undefined
  }
  session.framer = timer(session.framer, isWanted, () =>
    $.clock.every(Math.round(TICK_MS / frames), () => {
      if (session.isFraming) return
      session.isFraming = true
      void frameWorn($)
        .catch(() => undefined)
        .finally(() => {
          session.isFraming = false
        })
    }),
  )
}

/**
 * One frame between ticks: the worn look stepped to the frame its clock is
 * at (the tick's input, its news told once), and its cells blitted where it
 * is drawn. A blit refused (the Raster unmounted, another size) stops the
 * clock until a render draws it again.
 */
async function frameWorn($: EngineInterface): Promise<void> {
  const worn = session.worn
  const frames = worn?.look.frames
  if (worn === undefined || frames === undefined || worn.input === undefined || session.raster === undefined) return
  const at = Math.round((((await $.clock.now()) - session.tickAt) * frames) / TICK_MS)
  if (at <= (worn.frame ?? 0) || at >= frames || session.worn !== worn) return
  worn.frame = at
  try {
    worn.live.step({ ...worn.input, frame: at, spoke: false, spectacle: false, turnsEnded: 0 })
  } catch (error) {
    broke($, worn.look, error)
    return
  }
  const shown = session.raster
  const cells = worn.live.cells?.()
  if (shown === undefined || cells === undefined || cells.version === shown.version) return
  // The room changed under it: the next render draws it afresh.
  if (cells.columns !== shown.columns || shown.top + shown.rows > cells.rows) return
  shown.version = cells.version
  const sent = await $.ui.blit({ requestId: shown.requestId, key: shown.key, cells: cellsBase64(cells, shown.top, shown.rows) }).catch((error: unknown) => ({ deny: String(error) }))
  if (sent.deny !== undefined && session.raster === shown) {
    session.raster = undefined
    keepFrames($)
  }
}

/** The worn look's cells, where `look` is worn and offers them. */
const cellsOf = (look: LabLook): LabCells | undefined => (session.worn?.look === look ? session.worn.live.cells?.() : undefined)

/**
 * The worn lab look as one Raster, the bottom `shown` rows of its cells (all
 * of them unless given), where it paints in cells and the surface draws
 * Rasters, whatever its layout; noted so the frame clock blits its frames
 * there. Undefined for every other look.
 */
function rasterOf(ui: Elements[RenderSurface], requestId: string, look: LabLook, shown?: number): JSX.Element | undefined {
  const cells = cellsOf(look)
  if (cells === undefined || !('Raster' in ui)) return undefined
  const rows = shown ?? cells.rows
  if (rows < 1 || rows > cells.rows) return undefined
  const top = cells.rows - rows
  const { Raster } = ui
  session.raster = { requestId, key: 'lab-cells', columns: cells.columns, top, rows, version: cells.version }
  return <Raster key="lab-cells" columns={cells.columns} rows={rows} cells={cellsBase64(cells, top, rows)} />
}

/** A Raster drawn at `requestId` last time is gone unless this render draws it again. */
function forgetRaster(requestId: string): void {
  if (session.raster?.requestId === requestId) session.raster = undefined
}

async function setHidden($: EngineInterface, hidden: boolean): Promise<string> {
  await settle($)
  if ((await read($, isHidden)) === hidden) return hidden ? 'Your pet is already napping.' : 'Your pet is right here.'
  session.isHidden = hidden
  // A napping pet is out of sight in its window too.
  if (hidden && session.isWindowOpen) await closeWindow($)
  keepTime($)
  await update($, isHidden, () => hidden)
  // The clock stands still while hidden, so a line or emote left up, or one that
  // landed out of sight, would come back on show: either way it starts empty.
  await update($, speech, () => null)
  await update($, emote, () => null)
  await $.store.set('isHidden', hidden)
  return hidden ? 'Your pet is napping out of sight.' : 'Your pet is back.'
}

/** Keeps the pet's thoughts to itself, or lets it chime in again; its body, and its answers when spoken to, go on either way. */
async function setQuiet($: EngineInterface, quiet: boolean): Promise<string> {
  await settle($)
  if ((await read($, isQuiet)) === quiet) return quiet ? 'Your pet is already keeping quiet.' : 'Your pet already chimes in.'
  await update($, isQuiet, () => quiet)
  await $.store.set('isQuiet', quiet)
  return quiet ? 'Your pet will keep quiet unless you talk to it.' : 'Your pet will chime in again.'
}

/**
 * Lets the pet remember the pane's chat, or has it forget: either way the log
 * starts over, and its own last lines with it (every timed line is shown
 * them, its answers among them), so it only ever remembers what was said
 * since the last flip.
 */
async function setRemembering($: EngineInterface, on: boolean): Promise<string> {
  await settle($)
  if ((await read($, isRemembering)) === on) return on ? 'Your pet already remembers what you two say.' : 'Your pet already hears each message on its own.'
  await update($, isRemembering, () => on)
  await $.store.set('isRemembering', on)
  await update($, chat, () => [])
  session.said = []
  return on ? `Your pet will remember what you two say, up to ${MEMORY_LINES / 2} exchanges back.` : 'Your pet forgot what you two said.'
}

/**
 * Puts the person's words to the pet (`/pet btw` or the chat bar alike), or
 * says why it can't hear them; the chat log keeps them, its answer under them.
 */
async function talkTo($: EngineInterface, raw: string): Promise<string | undefined> {
  const message = raw.trim()
  if (message === '') return 'Say something to it.'
  if (!session.isLive) return 'Your pet only lives in an interactive session.'
  if (await read($, isHidden)) return 'Your pet is napping. Show it first.'
  await touch($)
  // Asked before it is logged, so a line the pet says on its own meanwhile goes in above it, never between it and its answer.
  btw($, message)
  await update($, chat, lines => [...lines, { from: 'you' as const, text: message }].slice(-CHAT_LINES))
  return undefined
}

/**
 * A chat bar's message, pet-control's or the pet window's (the pane
 * `requestId`): sends it, then draws the bars fresh and empty and keeps
 * typing in the one it came from.
 */
async function sendChat($: EngineInterface, raw: string, requestId: string): Promise<void> {
  if (raw.trim() === '') return
  const problem = await talkTo($, raw)
  if (problem !== undefined) {
    $.ui.toast(problem)
    return
  }
  const sent = await update($, chatSent, n => n + 1)
  // Back into the fresh bar it was typed in; if that pane has lost the keys meanwhile, it stays where it is.
  await $.ui.focus({ requestId, key: `chat-${sent}` }).catch(() => undefined)
}

/**
 * The pane's personality field: sets what was typed, or says why not, then
 * draws the field fresh, holding the personality kept, and keeps the keys in
 * it. The surface empties the field Enter reached, and drawing it again with
 * the same value would never fill it back.
 */
async function sendTrait($: EngineInterface, raw: string): Promise<void> {
  await tell($, setTrait($, raw))
  const sent = await update($, traitSent, n => n + 1)
  await $.ui.focus({ requestId: SETTINGS_PANE, key: `trait-${sent}` }).catch(() => undefined)
}

/** Shows what a setting came to as a toast: no transcript row, no model turn. */
async function tell($: EngineInterface, said: Promise<Told | undefined>): Promise<void> {
  const told = await said
  if (told !== undefined) toast($, told)
}

/** What a setting came to: its words, or words to read for longer (a pick's flavor). */
type Told = string | { text: string; timeoutMs: number }

/** Toasts what a setting came to, for as long as it asks. */
function toast($: EngineInterface, told: Told): void {
  if (typeof told === 'string') $.ui.toast(told)
  else $.ui.toast(told.text, { timeoutMs: told.timeoutMs })
}

/** Whether a close of the pet's pane steps back from looks laid over the settings, rather than closing it. */
export function stepsBack(view: PaneView, origin: PaneCloseOrigin['kind']): boolean {
  return origin === 'person' && view.page === 'looks' && view.isStacked
}

/** Opens the pet's pane on `page`, or turns an open one to it; `isStacked` lays the looks over the settings. */
async function openPane($: EngineInterface, page: 'settings' | 'looks', isStacked = false): Promise<boolean> {
  await touch($)
  // Turned from its chat to the looks, the band comes back: without the line the chat showed.
  if (page !== 'settings' && (await isChatUp($))) await chatGone($)
  await update($, paneView, () => ({ page, isStacked }))
  const opened = await $.ui.open({
    id: SETTINGS_PANE,
    title: 'pet-control',
    focus: true,
    closeOnEscape: true,
    rows: page === 'looks' ? LOOKS_ROWS : SETTINGS_ROWS,
  })
  session.isPaneOpen = session.isPaneOpen || opened.isPlaced
  const isOpen = session.isPaneOpen
  await update($, isPaneOpen, () => isOpen)
  keepTime($)
  // The lab cards' first frames, so the gallery never opens on blank ones.
  if (page === 'looks' && session.isExperimental) {
    const t = await read($, tick)
    await stepCards($, t, lightness($, t))
  }
  return opened.isPlaced
}

/**
 * Closes the pet's pane from its own Close button. A plugin's own close never
 * reaches its `ui.close` hook, so the pane's bookkeeping is let go here too.
 */
async function closePane($: EngineInterface): Promise<void> {
  await paneClosed($)
  await $.ui.close({ id: SETTINGS_PANE })
}

/**
 * Opens the pet window, or closes it while it is open: the pet at its full
 * size in a pane of its own, the band yielding meanwhile. Docked where the
 * surface docks panes; not kept for the next session (an unasked pane would
 * only seat on a wide terminal), though one left up across a reload stays.
 */
async function toggleWindow($: EngineInterface): Promise<string | undefined> {
  if (session.isWindowOpen) {
    await closeWindow($)
    return undefined
  }
  if (!session.isLive) return 'Your pet only lives in an interactive session.'
  if (await read($, isHidden)) return 'Your pet is napping. /pet show first.'
  await touch($)
  const opened = await $.ui.open({ id: WINDOW_PANE, title: 'pet', closeOnEscape: true, rows: WINDOW_ROWS, columns: WINDOW_COLUMNS })
  await windowShown($, opened.isPlaced)
  return opened.isPlaced ? undefined : 'Your pet window waits for a wider terminal.'
}

/** Closes the pet window from the plugin's side: a plugin's own close never reaches its `ui.close` hook. */
async function closeWindow($: EngineInterface): Promise<void> {
  await windowShown($, false)
  await $.ui.close({ id: WINDOW_PANE })
}

/** The window opened or closed: the band yields or takes the pet back, and a worn lab look steps in the room it is drawn in next. */
async function windowShown($: EngineInterface, isOpen: boolean): Promise<void> {
  session.isWindowOpen = isOpen
  session.isLabDrawn = undefined
  // Its Raster goes with it, and its frames stop till the band draws one.
  if (session.raster?.requestId === WINDOW_PANE) session.raster = undefined
  await update($, isWindowOpen, () => isOpen)
  keepTime($)
}

/**
 * The pane is gone: the clock it kept running for a hidden pet's gallery
 * stops with it, and the band takes the pet back, without the line the chat
 * showed if the chat was up.
 */
async function paneClosed($: EngineInterface): Promise<void> {
  session.isPaneOpen = false
  keepTime($)
  if (await isChatUp($)) await chatGone($)
  await update($, isPaneOpen, () => false)
}

/** Whether pet-control shows its chat now (open and placed, on its settings page): the band then yields the pet and its lines to it. */
async function isChatUp($: EngineInterface): Promise<boolean> {
  return (await read($, isPaneOpen)) && (await read($, paneView)).page === 'settings'
}

/**
 * pet-control's chat went out of view (closed, or turned to the looks): the
 * line up was read there, so the band comes back without it. The pet window
 * keeps its bubble: open too, it was the tab beside the chat.
 */
async function chatGone($: EngineInterface): Promise<void> {
  if (!session.isWindowOpen) await update($, speech, () => null)
}

/**
 * Puts the person's settings back from `$.store`, which every setter writes
 * and every session shares, into this session's `$.state`, which a /clear or
 * a /resume empties: the personality, the look and the switches, then the
 * panes still up. Marks the state restored last.
 *
 * A setting kept between sessions is read here under its store key and put
 * back below, with a line of its own (the scan wants each atom by name); its
 * setter calls `settle` first and writes both the atom and the store.
 */
async function restore($: EngineInterface): Promise<void> {
  const [savedTrait, savedHidden, savedSprite, savedQuiet, savedExperimental, savedClassic, savedRemembering] = await Promise.all([
    $.store.get('personality'),
    $.store.get('isHidden'),
    $.store.get('spriteId'),
    $.store.get('isQuiet'),
    $.store.get('experimental'),
    $.store.get('classicId'),
    $.store.get('isRemembering'),
  ])
  if (typeof savedTrait === 'string') await update($, personality, () => savedTrait)
  if (typeof savedHidden === 'boolean') await update($, isHidden, () => savedHidden)
  session.isHidden = await read($, isHidden)
  if (typeof savedSprite === 'string') await update($, spriteId, () => savedSprite)
  if (typeof savedQuiet === 'boolean') await update($, isQuiet, () => savedQuiet)
  if (typeof savedExperimental === 'boolean') await update($, isExperimental, () => savedExperimental)
  if (typeof savedClassic === 'string') await update($, classicId, () => savedClassic)
  if (typeof savedRemembering === 'boolean') await update($, isRemembering, () => savedRemembering)
  session.isExperimental = await read($, isExperimental)
  // A side call the last load had in flight died with it; a pane it had up stays.
  await update($, isPondering, () => false)
  const panes = await $.ui.panes().catch(() => [])
  const isPane = panes.some(pane => pane.id === SETTINGS_PANE && pane.isPlaced)
  session.isPaneOpen = isPane
  await update($, isPaneOpen, () => isPane)
  const isWindow = panes.some(pane => pane.id === WINDOW_PANE && pane.isPlaced)
  session.isWindowOpen = isWindow
  await update($, isWindowOpen, () => isWindow)
  await update($, isRestored, () => true)
}

/**
 * Makes sure this session's state holds the person's settings before one is
 * read or written: a /clear or /resume empties `$.state` and fires no
 * session.start, so the first hook after it (classic.SessionStart, a turn, a
 * command, a press) brings them back. One read once restored; one restore at
 * a time, which every caller meanwhile waits for.
 */
function settle($: EngineInterface): Promise<void> {
  session.restoring ??= (async () => {
    if (await read($, isRestored)) return
    // The tick started over with the state: the worn look and the gallery's cards are born again on it.
    session.worn = undefined
    session.cards.clear()
    // The chat went with it, and the pet's own last lines go too, as a flip of chat memory forgets them.
    session.said = []
    await restore($)
    keepTime($)
    await wear($)
  })()
    // A store it can't read leaves the defaults up, to be tried again at the next hook: nothing settle guards fails for it.
    .catch(() => undefined)
    .finally(() => {
      session.restoring = undefined
    })
  return session.restoring
}

/**
 * Starts the pet's clocks as soon as a surface can draw it: the REPL at start,
 * or a client attaching (a session the desktop app hosts starts with nothing
 * drawing). A `-p` run never attaches and stays quiet.
 */
function wake($: EngineInterface): void {
  session.isLive = true
  keepTime($)
}

/** Stops the pet's clocks when no surface is left to draw it on. */
async function rest($: EngineInterface): Promise<void> {
  if ((await $.session.surfaces()).length > 0) return
  session.isLive = false
  keepTime($)
}

/**
 * Runs each timer only while it has something to do: the animation clock
 * while the pet or its pane can be seen, the observer while the pet can. A
 * hidden pet, or a session nothing draws on, wakes no timer and asks no model.
 */
function keepTime($: EngineInterface): void {
  session.ticker = timer(session.ticker, isShowable(), () =>
    $.clock.every(TICK_MS, () => {
      if (session.isTicking) return
      session.isTicking = true
      void advance($)
        .catch(() => undefined)
        .finally(() => {
          session.isTicking = false
        })
    }),
  )
  session.observer = timer(session.observer, session.isLive && !session.isHidden, () =>
    $.clock.every(OBSERVE_MS, () => {
      void doze($)
      void observe($)
    }),
  )
  keepFrames($)
}

/** `running`, kept, started or stopped as `isWanted` says. */
function timer(running: Timer | undefined, isWanted: boolean, start: () => Timer): Timer | undefined {
  if (isWanted) return running ?? start()
  running?.cancel()
  return undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pet',
      description: "Open your pet's settings, or talk to it (btw), give it a one-word personality, browse its looks (list), pick one (as <look>), give it a window of its own (window), hide or show it, keep it quiet or let it chime in (chatty), let it remember your chat or forget it, try braille looks (experimental) or go back (classic), re-seed a grown one (seed)",
      argumentHint: '[<personality> | btw <message> | list | as <look> | window | hide | show | quiet | chatty | remember | forget | experimental | classic | seed [<word>]]',
      immediate: true,
    })

    await restore($)

    // The clocks first: whatever a lab look does as it is born, the pet goes on.
    if (e.isInteractive || e.surface !== null) wake($)
    await wear($)

    return next(e)
  })

  on('session.attach', ($, e, next) => {
    wake($)
    return next(e)
  })

  // Once the last client has let go (the desktop app moved on), nobody can see
  // the pet: it neither animates nor comments until one attaches again. Looked
  // at once the roster has settled, so the leaving client is surely gone from it.
  on('session.detach', ($, e, next) => {
    $.clock.after(1, () => void rest($))
    return next(e)
  })

  // A /clear or /resume (or a fork) empties $.state, with no session.start
  // after it; the SessionStart settings event runs right after, on the
  // emptied state, so the person's settings come back from the store here.
  // What the settings hooks decide always goes on untouched.
  on('classic.SessionStart', async ($, e, next) => {
    await settle($)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Esc (or the close mark) on looks laid over the settings steps back to the
  // settings, as a sheet does; anywhere else it closes the pane. Our own
  // bookkeeping never stands in a close's way: it is caught, and a close it
  // can't step back from goes ahead untouched.
  on('ui.close', async ($, e, next) => {
    // The person closed the pet window (its close mark, Esc): the band takes the pet back.
    if (e.id === WINDOW_PANE) {
      if (session.isWindowOpen) await windowShown($, false).catch(() => undefined)
      return next(e)
    }
    if (e.id !== SETTINGS_PANE) return next(e)
    try {
      if (stepsBack(await read($, paneView), e.origin.kind)) {
        await update($, paneView, () => ({ page: 'settings', isStacked: false }))
        return { value: undefined }
      }
      await paneClosed($)
    } catch {
      // A view we can't read or step back in is closed as asked.
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // A typed `/pet ...` always leaves its own record in the transcript; its
  // answer goes to a toast, so it adds no output row on top. Without a live
  // surface to toast on (a `-p` run), it answers as text.
  on('command.run', { command: 'pet' }, async ($, e) => {
    const reply = (told: Told | undefined) => {
      if (told === undefined) return {}
      if (!session.isLive) return { text: typeof told === 'string' ? told : told.text }
      toast($, told)
      return {}
    }
    await touch($)
    const [word = '', ...rest] = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const isAlone = rest.length === 0

    if (word === 'btw') return reply(await talkTo($, e.args.trim().slice(word.length)))
    if (word === '') {
      if (session.isLive && (await openPane($, 'settings'))) return {}
      const [trait, hidden, id, experimental, classic] = await Promise.all([read($, personality), read($, isHidden), read($, spriteId), read($, isExperimental), read($, classicId)])
      return { text: `Your ${aboutOf(lookFor(id, experimental, undefined, classic)).name.toLowerCase()} is ${trait}${hidden ? ' (hidden)' : ''}.` }
    }
    if (isAlone && (word === 'list' || word === 'looks' || word === 'as')) {
      if (session.isLive && (await openPane($, 'looks'))) return {}
      const ids = [...SPRITES, ...((await read($, isExperimental)) ? LAB : [])].map(look => look.id)
      return { text: `Looks: ${ids.join(', ')}. Pick one with /pet as <id>.` }
    }
    if (word === 'as') return reply(await pick($, rest[0] ?? ''))
    if (isAlone && (word === 'experimental' || word === 'classic')) return reply(await setExperimental($, word === 'experimental'))
    if (isAlone && word === 'window') return reply(await toggleWindow($))
    if (word === 'seed') return reply(await reseed($, rest.length > 0 ? rest.join(' ') : undefined))
    if (isAlone && (word === 'hide' || word === 'show')) return reply(await setHidden($, word === 'hide'))
    if (isAlone && (word === 'quiet' || word === 'chatty')) return reply(await setQuiet($, word === 'quiet'))
    if (isAlone && (word === 'remember' || word === 'forget')) return reply(await setRemembering($, word === 'remember'))
    // Anything else is a personality; more than one word is turned away there.
    return reply(await setTrait($, e.args))
  })

  // The loop's only part in the pet: marking when the main turn opens and
  // closes. The observer decides on its own clock what to say and when.
  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    // The bubble is left alone: a line fades on its own time, and one about the
    // last turn may still be landing as this one starts.
    await update($, turn, mark => ({ ...mark, isOpen: true, startedAt: now }))
    await touch($)

    return next(e)
  })

  // The body's one look at the work: a test suite gone green after red, a
  // commit or a merged PR. The call runs as it would and its result goes back
  // untouched: nothing the pet does after it can throw into it or change it,
  // and a hook that fails anyway (over its budget) hands the call's own
  // result through its .catch, never a deny of ours.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    try {
      const judged = judgeRun(e.command, ran, session.isRed)
      session.isRed = judged.isRed
      if (judged.isWin) await emoteNow($, 'cheer')
    } catch {
      // A missed sparkle is all a failure here may cost.
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, turn, mark => ({ ...mark, isOpen: false, endedAt: now, isAborted: e.isAborted }))
      // Counted here, as it finishes, so no turn is lost to a hidden pet or a quiet clock; only for those who opted in.
      if (!e.isAborted && session.isExperimental) void turned($, e.durationMs, now).catch(() => undefined)
    }

    return next(e)
  })

  // The theme, for the lab looks drawn in raw colors: kept fresh once one has
  // asked for it. The setting's own result always goes back untouched.
  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const done = await next(e)
    try {
      if (done.deny === undefined && session.isLight !== undefined) session.isLight = isLightTheme(done.value)
    } catch {
      // A theme we can't read is read again on the clock's next try.
    }
    return done
  }).catch(($, e, next) => next(e))

  // The band gets the rows the engine's bottom slot has left it, in fullscreen half the terminal less
  // the prompt and the engine's own lists (the tasks checklist, the agents under the prompt); a taller
  // tree would scroll there. So it fits the look in them: the button gives up its row first, then the
  // look draws itself smaller, and only then does its fallback stand in, cropped as a last resort.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // A Raster drawn here last time is gone unless drawn again below: a band that yields draws none, and gets no frames.
    forgetRaster(e.requestId)
    // Not a row left (the slot's lists reach the prompt): the band stays the engine's, empty.
    // The pet lives in its window while that is open, and in pet-control while its chat is up,
    // its lines in the chat: never twice, and the bottom slot is freed.
    if (e.props.hasSurvey || e.props.maxRows < 1 || (await read($, isHidden)) || (await read($, isWindowOpen)) || (await isChatUp($))) {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const t = await read($, tick)
    const said = await read($, speech)
    const pondering = await read($, isPondering)
    const { maxRows: rows } = e.props
    // The look and its words have the band less the button's gutter.
    const columns = bandColumnsOf(e.props.bodyColumns)
    const id = await read($, spriteId)
    const experimental = await read($, isExperimental)
    const worn = lookFor(id, experimental, { surface: e.surface, columns }, await read($, classicId))
    const isTerminal = e.surface === 'terminal'
    // Whether it drew a lab pick as itself or by its stand-in: the clock steps only one that is drawn.
    const isLabPick = lookFor(id, experimental).kind === 'lab'
    const drew = (shown: Art) => {
      if (isLabPick) session.isLabDrawn = shown.isLab
    }
    const pose = poseOf(pondering, said, t, e.props.isWorking, await read($, emote), await read($, isAsleep))
    // A line fades once its time is up.
    const words = wordsAt(pondering, said, t)
    const button = <Button key="settings" label={BAND_BUTTON} plain dimColor onPress={() => void openPane($, 'settings')} />
    /** The band: what it draws, and its button in the bottom-right corner. */
    const band = (drawn: RenderNode, emote?: readonly RenderNode[]) => (
      <Box flexDirection="row" alignItems="flex-end" width={e.props.bodyColumns}>
        <Box flexDirection="column" alignItems="flex-end" width={columns} flexShrink={0}>
          {drawn}
        </Box>
        <Box flexDirection="column" alignItems="flex-end" width={GUTTER_COLUMNS} flexShrink={0}>
          {emote}
          {button}
        </Box>
      </Box>
    )
    const emoteOf = (shown: Art) => (pose.glyph === undefined ? undefined : drawLines(Text, shown.paint, [pose.glyph], t))
    // What stands in for a lab look the band has no rows for: its own fallback, as on any surface that can't draw it.
    const fallback = (lab: LabLook) => artOf(Text, { kind: 'sprite', sprite: spriteById(lab.fallback) }, pose, t)
    let art = artOf(Text, worn, pose, t)

    // A scene is the band: its words above it only when it couldn't draw them, its emote by the button.
    if (worn.kind === 'lab' && art.layout === 'scene') {
      // A bubble above it never takes the scene's fewest rows; with no room for one the line goes unshown, as beside a pet.
      const { bubble, rows: room, fit } = sceneInBand(worn.lab, bubbledWords(art, words), columns, rows)
      if (isTerminal) {
        session.bandColumns = columns
        session.bandRows = room
      }
      if (fit !== undefined) {
        drew(art)
        // A look that paints in cells is one Raster on the terminal, its frames blitted between ticks (and no Text is made of it).
        const painted = isTerminal ? rasterOf(ui, e.requestId, worn.lab, fit.shown) : undefined
        // Its emote sits over the button, in the corner.
        return band(
          <Box flexDirection="column" alignItems="flex-end">
            {bubble !== undefined && bubbleBox(Box, Text, art, t, bubble.text, bubble.width, undefined, true)}
            {/* Composed shorter, or cropped from the top, its sky first. */}
            <Box flexDirection="column" width={columns}>
              {painted ?? art.lines.slice(art.lines.length - fit.shown)}
            </Box>
          </Box>,
          emoteOf(art),
        )
      }
      // Fewer rows than even its cropped sky: its fallback stands in, its words beside it.
      art = fallback(worn.lab)
    }

    if (worn.kind === 'lab' && art.layout === 'pet') {
      if (isTerminal) {
        session.bandColumns = columns
        session.bandRows = rows
      }
      // One that grows round its words needs only its rest: past the band's rows it leaves its words to the band.
      if (!petFits(worn.lab, art.height, rows)) art = fallback(worn.lab)
    }

    const bandWords = bubbledWords(art, words)
    const fit = fitPet(art.height, rows)
    const bubble = bandWords === undefined ? undefined : bubbleFor(bandWords, columns, art.width, fit.shown, BUBBLE_MAX, rows)
    // A pet that paints in cells is one Raster too, but for one with a window picture, whose cells may be that picture's.
    const painted = isTerminal && art.isLab && worn.kind === 'lab' && worn.lab.window === undefined ? rasterOf(ui, e.requestId, worn.lab, fit.shown) : undefined
    // Its feet (or its floor) on the prompt: a pet taller than the band loses its top.
    const lines = painted ?? art.lines.slice(art.lines.length - fit.shown)
    const emoteLine = emoteOf(art)
    drew(art)
    return band(
      <Box flexDirection="row" justifyContent="flex-end" alignItems="flex-end">
        {bubble !== undefined && bubbleBox(Box, Text, art, t, bubble.text, bubble.width, 1)}
        {/* An emote sits by the head where a bubble would be: words win, and nothing moves. */}
        {bubble === undefined && emoteLine !== undefined && (
          <Box alignSelf="flex-start" flexShrink={0}>
            {emoteLine}
          </Box>
        )}
        <Box flexDirection="column" alignItems="flex-end" flexShrink={0}>
          {lines}
        </Box>
      </Box>,
    )
  })

  // A worn lab look that rides the spinner line (the stray) runs after the
  // engine's own suffix while Claude works, on the terminal; the word, the
  // time and the tokens are the engine's and stay so. Any other spinner, or
  // with experimental! off, passes through untouched.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const worn = session.worn
    // Not while the band draws its stand-in: the cat that rides is the one out of its hole.
    const isOut = session.isExperimental && session.isLabDrawn !== false && e.surface === 'terminal'
    if (!isOut || worn?.live.spinner === undefined) return next(e)
    // Read so the rider moves on the pet's clock.
    await read($, tick)
    const rider = worn.live.spinner()
    if (rider === undefined) return next(e)
    // After the engine's own suffix, but never a second ellipsis after a message that ends in one.
    const text = e.props.message ?? e.props.word
    const suffix = text.endsWith('…') ? e.props.suffix.replace(/^…/, '') : e.props.suffix
    return next({ ...e, props: { ...e.props, suffix: `${suffix} ${rider}` } })
  })

  // The pet window: the pet at its full size, a scene composed in the window's whole body (more sky and
  // water, never stretched), a pet (its window picture where the room holds one) with its line whole
  // beside or above it, and under it all pet-control's chat bar, alone. Nothing is cut or swapped for
  // want of rows here; only a surface that can't draw braille gets the stand-in. No pet-ctrl button:
  // pet-control is the tab beside it at the window's top.
  on('ui.render', { component: 'Pane', requestId: WINDOW_PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    // The chat bar where the surface draws a field: mobile draws none.
    const Input = 'Input' in ui ? ui.Input : undefined
    forgetRaster(e.requestId)
    const t = await read($, tick)
    const said = await read($, speech)
    const pondering = await read($, isPondering)
    const mark = await read($, turn)
    const identity = lookFor(await read($, spriteId), await read($, isExperimental), undefined, await read($, classicId))
    const columns = e.props.bodyColumns
    const { bodyRows } = e.props.scroll
    // The look and its words have the body above the chat bar.
    const rows = bodyRows - (Input === undefined ? 0 : CHAT_BAR_ROWS)
    const isTerminal = e.surface === 'terminal'
    // As itself on the terminal, in any rows; columns enough for it (a scene its narrowest, a pet its width, its bubble going above).
    const isRoomy = identity.kind === 'lab' && columns >= (identity.lab.layout === 'scene' ? identity.lab.minColumns : identity.lab.width)
    const isLab = identity.kind === 'lab' && isTerminal && isRoomy && session.worn?.look === identity.lab
    const look: Look = identity.kind === 'lab' && !isLab ? { kind: 'sprite', sprite: spriteById(identity.lab.fallback) } : identity
    if (identity.kind === 'lab') {
      session.isLabDrawn = isLab
      if (isLab) session.windowRoom = windowBodyOf(identity.lab, columns, rows)
    }
    // No band props here: the open turn says whether Claude works.
    const pose = poseOf(pondering, said, t, mark.isOpen, await read($, emote), await read($, isAsleep))
    const words = wordsAt(pondering, said, t)
    const art = artOf(Text, look, pose, t, undefined, true)
    const ownWords = bubbledWords(art, words)
    const emoteLine = pose.glyph === undefined ? undefined : drawLines(Text, art.paint, [pose.glyph], t)
    /** A bubble of the band's kind, `width` across, the line whole. */
    const bubble = (text: string, width: number, marginRight = 0) => bubbleBox(Box, Text, art, t, text, width, marginRight)
    const above = (text: string) => bubble(text, aboveWidth(text, columns))
    // A look that paints in cells is one Raster here, whatever its layout, its frames blitted between ticks (and no Text is made of it).
    const painted = isLab && identity.kind === 'lab' ? rasterOf(ui, e.requestId, identity.lab) : undefined
    const bar = Input !== undefined && chatBar($, Box, Input, WINDOW_PANE, colorOf(art.paint), await read($, isHidden), await read($, chatSent))
    /**
     * The window: the look and its words at the top, at its right, and the
     * chat bar at its foot; docked, on the floor, and inline right under the
     * look, as the frame fits the tree there.
     */
    const inWindow = (...drawn: JSX.Children[]) => (
      <Box flexDirection="column" width={columns} {...(e.props.placement === 'dock' ? { minHeight: bodyRows } : {})}>
        <Box flexDirection="column" alignItems="flex-end" flexGrow={1}>
          {drawn}
        </Box>
        {bar}
      </Box>
    )

    if (art.layout === 'scene') {
      return inWindow(
        ownWords !== undefined && above(ownWords),
        painted ?? art.lines,
        // Its emote in the corner under it, on a row that stays, so a heart moves nothing.
        <Box height={1}>{emoteLine}</Box>,
      )
    }
    // A pet: its line beside it or above it, whichever fits the window's rows in fewer (a big picture leaves few columns beside it); never cut.
    const placed = ownWords === undefined ? undefined : windowBubbleFor(ownWords, { columns, rows }, art)
    return inWindow(
      ownWords !== undefined && placed?.place === 'above' && bubble(ownWords, placed.width),
      <Box flexDirection="row" justifyContent="flex-end" alignItems="flex-end">
        {ownWords !== undefined && placed?.place === 'beside' && bubble(ownWords, placed.width, 1)}
        {ownWords === undefined && emoteLine !== undefined && (
          <Box alignSelf="flex-start" flexShrink={0}>
            {emoteLine}
          </Box>
        )}
        <Box flexDirection="column" alignItems="flex-end" flexShrink={0}>
          {painted ?? art.lines}
        </Box>
      </Box>,
    )
  })

  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Button, Text } = table
    const view = await read($, paneView)
    const t = await read($, tick)
    const close = <Button key="close" label="Close" role="dismiss" plain onPress={() => void closePane($)} />

    if (view.page === 'looks') {
      const experimental = await read($, isExperimental)
      // The card of the look the pet wears: a lab pick, or with experimental! off its fallback.
      const current = aboutOf(lookFor(await read($, spriteId), experimental, undefined, await read($, classicId))).id
      return (
        <Box flexDirection="column" width={e.props.bodyColumns}>
          <Box flexDirection="row" justifyContent="space-between" paddingLeft={INSET}>
            <Text>
              <Text bold>Pick a look</Text>
              {/* Past the last hotkey, the lab cards are a command away. */}
              <Text dimColor>{experimental ? ' · press its key, or /pet as <id>' : ' · press its key'}</Text>
            </Text>
            <Box flexShrink={0}>
              {view.isStacked ? <Button key="back" label="< pet-control" plain onPress={() => void openPane($, 'settings')} /> : close}
            </Box>
          </Box>
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            {SPRITES.map((sprite, at) => {
              const isCurrent = sprite.id === current
              const start = t + at * CARD_STAGGER
              return (
                <Box key={`card-${sprite.id}`} flexDirection="column" alignItems="center" width={CARD_WIDTH} paddingX={1} borderStyle="round" borderColor={isCurrent ? colorOf(sprite.color) : 'subtle'}>
                  {/* Every look stands on the same line, short ones with room above. */}
                  <Box flexDirection="column" justifyContent="flex-end" alignItems="center" height={CARD_ART_ROWS}>
                    {drawLines(Text, sprite.color, frame(sprite, 'idle', start), start)}
                  </Box>
                  <Text bold={isCurrent} wrap="truncate-end">{sprite.name}</Text>
                  <Text dimColor wrap="truncate-end">{sprite.id}</Text>
                  <Button
                    key={`pick-${sprite.id}`}
                    label={isCurrent ? 'current' : 'pick'}
                    hotkey={HOTKEYS[at]}
                    plain
                    variant={isCurrent ? 'primary' : 'secondary'}
                    onPress={() => void tell($, pick($, sprite.id))}
                  />
                </Box>
              )
            })}
          </Box>
          {experimental && (
            <Box flexDirection="column" marginTop={1}>
              <Box paddingLeft={INSET}>
                <Text>
                  <Text bold>experimental! braille</Text>
                  {/* Elsewhere a classic stand-in is drawn till the Svg phase; a pick still sticks. */}
                  <Text dimColor>{e.surface === 'terminal' ? ' · needs a font with braille' : ' · terminal only for now'}</Text>
                </Text>
              </Box>
              <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                {LAB.map((look, at) => {
                  const isCurrent = look.id === current
                  // Classic looks take the hotkeys first; past the last, Tab and Enter still reach a card.
                  const hotkey = HOTKEYS[SPRITES.length + at]
                  const rows = session.cards.get(look.id)?.live.runs() ?? []
                  return (
                    <Box key={`card-${look.id}`} flexDirection="column" alignItems="center" width={cardWidth(look)} paddingX={1} borderStyle="round" borderColor={isCurrent ? look.bubble : 'subtle'}>
                      <Box flexDirection="column" justifyContent="flex-end" alignItems="center" height={LAB_CARD_ROWS}>
                        {rows.map(row => <Text>{drawRuns(Text, row)}</Text>)}
                      </Box>
                      <Text bold={isCurrent} wrap="truncate-end">{look.name}</Text>
                      <Text dimColor wrap="truncate-end">{look.id}</Text>
                      <Text dimColor wrap="truncate-end">{look.blurb}</Text>
                      <Button
                        key={`pick-${look.id}`}
                        label={isCurrent ? 'current' : 'pick'}
                        {...(hotkey !== undefined ? { hotkey } : {})}
                        plain
                        variant={isCurrent ? 'primary' : 'secondary'}
                        onPress={() => void tell($, pick($, look.id))}
                      />
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}
        </Box>
      )
    }

    // The control page. Mobile draws no Input: it gets the pet, its buttons and the log.
    const Input = 'Input' in table ? table.Input : undefined
    const trait = await read($, personality)
    const hidden = await read($, isHidden)
    const quiet = await read($, isQuiet)
    const remembering = await read($, isRemembering)
    const experimental = await read($, isExperimental)
    const windowOpen = await read($, isWindowOpen)
    // The pet as the band last showed it (or the surface alone allows): never resolved by this pane's own width.
    const identity = lookFor(await read($, spriteId), experimental, undefined, await read($, classicId))
    const look = shownLook(identity, e.surface)
    const said = await read($, speech)
    const pondering = await read($, isPondering)
    const log = await read($, chat)
    const sent = await read($, chatSent)
    const traitsSent = await read($, traitSent)
    const width = Math.min(e.props.bodyColumns, PANE_MAX_WIDTH)
    const about = hidden ? `${trait}, napping out of sight` : quiet ? `${trait}, keeping quiet` : trait
    // The preview is never asleep: opening the pane woke it.
    const pose = poseOf(pondering, said, t, false, await read($, emote), false)
    const art = artOf(Text, look, pose, t, PREVIEW_COLUMNS)
    const color = colorOf(art.paint)
    // Its own name, and what stands in for it where it can't be drawn: no silent change of species.
    const { name } = aboutOf(identity)
    const standing = identity.kind === 'lab' && look.kind === 'sprite' ? `${look.sprite.name} stands in here` : undefined
    const petName = name.toLowerCase()
    // The log's names sit in a column of their own, so a long line wraps under its words.
    const gutter = Math.max('you'.length, petName.length) + 2
    // "..." under your message while its answer is out (not while the observer thinks or a hello is written).
    const isWaiting = pondering && session.replying?.voice === session.voice && log.at(-1)?.from === 'you'
    // Why the pet's gone quiet, unless the log's last line already says so.
    const why = session.lastError !== undefined && log.at(-1)?.isFailed !== true ? quietWhy(session.lastError) : undefined
    const isTerminal = e.surface === 'terminal'
    // The emote's slot beside the preview stays put, so a heart moves nothing; the column is at least as wide as its buttons.
    const previewColumns = Math.max(art.width + EMOTE_WIDTH, 'Close window'.length)
    // A grown pet says which seed it came from and how it is coming along.
    const worn = session.worn
    const born = look.kind === 'lab' && worn?.look === look.lab && worn.look.isGrown === true ? `born from ${worn.seed} · ${worn.live.describe?.() ?? ''}` : undefined

    // The rows the page takes besides the log, as drawn below, so the log keeps
    // to the newest lines that fit and never pushes the chat bar out of view.
    // The page is at least the body's rows tall and the chat takes what is left,
    // anchored to the bottom: its bar over the footer, the newest line just
    // above the bar, older ones rising toward the fields. A body too short for
    // it all still scrolls, as before.
    // Beside the pet: its name, the stand-in, born and about lines, a gap, its
    // buttons and its switches (a row each, two where they wrap), and the font
    // test while experimental! is on.
    const besideColumns = width - INSET - previewColumns - 3 - 'Close'.length
    const controlRows = (besideColumns < BUTTONS_ROW_CELLS ? 2 : 1) + (besideColumns < SWITCHES_ROW_CELLS ? 2 : 1)
    const besideRows = [standing, about, born, experimental && isTerminal ? FONT_TEST : undefined].reduce((rows, line) => rows + (line === undefined ? 0 : wrapRows(line, besideColumns)), 2 + controlRows)
    // Under the pet, its two buttons: Pet it, and the window.
    const headerRows = Math.max(art.height + 2, besideRows)
    const fieldRows = Input !== undefined ? 5 : 0
    const chatRows = 1 + (Input !== undefined ? 4 : 0) + (isWaiting ? 1 : 0)
    const footRows = (isTerminal ? 1 : 0) + (why !== undefined ? 1 : 0)
    const logRows = Math.max(CHAT_MIN_ROWS, e.props.scroll.bodyRows - headerRows - fieldRows - chatRows - footRows)
    const shown = newestThatFit(log, line => wrapRows(line.text, width - INSET - gutter), logRows)
    // A line of the log: who said it, in the names' column, then the words.
    const logLine = (from: ChatLine['from'], words: JSX.Element) => (
      <Box flexDirection="row" paddingLeft={INSET}>
        <Box width={gutter} flexShrink={0}>
          {from === 'you' ? <Text bold dimColor>you</Text> : <Text bold color={color}>{petName}</Text>}
        </Box>
        {words}
      </Box>
    )

    return (
      <Box flexDirection="column" width={width} minHeight={e.props.scroll.bodyRows}>
        {/* The pet itself, who it is, and what to do with it. */}
        <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start" paddingLeft={INSET}>
          <Box flexDirection="row" columnGap={3} alignItems="center">
            {/* Pet it where it stands: a heart and a wiggle, never a word. */}
            <Box flexDirection="column" alignItems="center" flexShrink={0}>
              <Box flexDirection="row">
                {drawLines(Text, art.paint, [(pose.glyph ?? '').padEnd(EMOTE_WIDTH)], t)}
                <Box flexDirection="column">{art.lines}</Box>
              </Box>
              <Button key="pat" label="Pet it" plain onPress={() => void petIt($)} />
              {/* A window of its own: the pet at its full size, out of the crowded bottom slot. */}
              <Button key="window" label={windowOpen ? 'Close window' : 'Pet window'} plain onPress={() => void tell($, toggleWindow($))} />
            </Box>
            <Box flexDirection="column">
              <Text bold color={color}>{name}</Text>
              {standing !== undefined && <Text dimColor>{standing}</Text>}
              {born !== undefined && <Text dimColor>{born}</Text>}
              <Text dimColor>{about}</Text>
              <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginTop={1}>
                <Button key="look" label="Change its look" variant="primary" onPress={() => void openPane($, 'looks', true)} />
                <Button key="visibility" label={hidden ? 'Show your pet' : 'Hide your pet'} onPress={() => void tell($, setHidden($, !hidden))} />
              </Box>
              {/* Switches, one row of them while they fit: each a box you tick. */}
              <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
                <Button key="quiet" label={`${quiet ? '[x]' : '[ ]'} Keep it quiet`} plain onPress={() => void tell($, setQuiet($, !quiet))} />
                <Button key="experimental" label={`${experimental ? '[x]' : '[ ]'} experimental!`} plain onPress={() => void tell($, setExperimental($, !experimental))} />
              </Box>
              {/* Plain text on purpose: it shows what this font does with braille. Elsewhere it would test another font. */}
              {experimental && isTerminal && <Text dimColor>{FONT_TEST}</Text>}
            </Box>
          </Box>
          <Box flexShrink={0}>{close}</Box>
        </Box>

        {/* Its personality: a field you can see is a field, drawn fresh after each Enter so it shows the one kept. */}
        {Input !== undefined && (
          <Box flexDirection="column" marginTop={1}>
            <Box paddingLeft={INSET}>
              <Text dimColor>Give it a personality</Text>
            </Box>
            <Box borderStyle="round" borderColor="subtle" paddingX={1}>
              <Input key={`trait-${traitsSent}`} value={trait} placeholder="one word, like snarky or warm" submitLabel="set" onSubmit={value => void sendTrait($, value)} />
            </Box>
          </Box>
        )}

        {/* The chat: every line the pet says, dim when it spoke on its own, and what you two say. It fills the rest, from the bottom up. */}
        <Box flexDirection="column" flexGrow={1} justifyContent="flex-end" marginTop={1}>
          {Input !== undefined && (
            <Box flexDirection="row" justifyContent="space-between" columnGap={1} paddingLeft={INSET}>
              <Text dimColor wrap="truncate-end">Just between you two</Text>
              {/* Its one switch sits on the chat it is about, in the heading's row: no row of its own. */}
              <Box flexShrink={0}>
                <Button key="remember" label={`${remembering ? '[x]' : '[ ]'} Let it remember`} plain onPress={() => void tell($, setRemembering($, !remembering))} />
              </Box>
            </Box>
          )}
          {shown.map(line =>
            logLine(line.from, line.isFailed === true ? <Text dimColor italic>{line.text}</Text> : line.isAside === true ? <Text dimColor>{line.text}</Text> : <Text>{line.text}</Text>),
          )}
          {isWaiting && logLine('pet', <Text dimColor>...</Text>)}
          {Input !== undefined && chatBar($, Box, Input, SETTINGS_PANE, color, hidden, sent)}
        </Box>

        {why !== undefined && (
          <Box paddingLeft={INSET}>
            <Text color="warning">Your pet went quiet: {why}.</Text>
          </Box>
        )}
        {isTerminal && (
          <Box paddingLeft={INSET}>
            <Text dimColor>Tab to move · Enter to send · Esc to close</Text>
          </Box>
        )}
      </Box>
    )
  })
}

type TextElement = ElementConstructor<TextProps>
type BoxElement = ElementConstructor<BoxProps>
type InputElement = Elements['terminal']['Input']

/**
 * The chat bar, pet-control's and the pet window's alike: a field in a round
 * border of the pet's `color`, drawn fresh after each message (`sent`), that
 * sends what is typed from the pane `requestId`. Its ring starts on it when
 * the pane takes the keys (`autoFocus`), which never takes them for it.
 */
function chatBar($: EngineInterface, Box: BoxElement, Input: InputElement, requestId: string, color: BoxProps['borderColor'], hidden: boolean, sent: number): JSX.Element {
  return (
    <Box borderStyle="round" borderColor={color} paddingX={1}>
      <Input
        key={`chat-${sent}`}
        placeholder={hidden ? 'Your pet is napping. Show it to talk.' : 'Talk to your pet!'}
        submitLabel="send"
        autoFocus
        onSubmit={value => void sendChat($, value, requestId)}
      />
    </Box>
  )
}

/**
 * What the pet window hands lab's `windowRoom` for `look`, which takes a row
 * off for the one under the look: its `rows` above the chat bar. A scene's
 * emote keeps that row; a pet's sits by its head, so a pet has them all.
 */
const windowBodyOf = (look: LabLook, columns: number, rows: number): Room => ({ columns, rows: look.layout === 'scene' ? rows : rows + 1 })

/** The words the band (or the window) bubbles beside `art`: none for a look that says them itself, but for any it can't draw cell for cell or had no rows for. */
const bubbledWords = (art: Art, words: string | undefined): string | undefined => (art.ownsBubble && (words === undefined || isCellSafe(words)) ? undefined : words)

/**
 * A bubble of the band's kind, `width` across: its words as `art`'s paint
 * paints them (`isPlain`: as they are, a scene's above it), with a margin
 * on its right where one is given.
 */
function bubbleBox(Box: BoxElement, Text: TextElement, art: Art, t: number, text: string, width: number, marginRight?: number, isPlain = false): JSX.Element {
  return (
    <Box borderStyle="round" borderColor={borderOf(art.paint, t)} paddingX={1} {...(marginRight !== undefined ? { marginRight } : {})} width={width}>
      <Text wrap="wrap">{isPlain ? text : drawRuns(Text, paintText(art.paint, text, t))}</Text>
    </Box>
  )
}

/** Painted runs (a sprite's, or a lab look's) as nested Text; a style a run leaves unset stays the surface's own. */
function drawRuns(Text: TextElement, runs: readonly Run[]): JSX.Element[] {
  return runs.map(({ text, ...style }) => <Text {...style}>{text}</Text>)
}

/**
 * What the band or the pane draws of a look: its lines, its size, its paint,
 * and how it sits in the band: whether it says its words itself just now,
 * and whether it grows round them (its button then keeps to its right). A
 * lab look's lines and size are made only when read, so a look drawn as a
 * Raster makes no Text.
 */
type Art = {
  name: string
  /** Drawn from the worn lab look itself, not its classic stand-in. */
  isLab: boolean
  lines: JSX.Element[]
  width: number
  height: number
  paint: Paint | undefined
  layout: LabLook['layout']
  ownsBubble: boolean
  hasFloor: boolean
  grows: boolean
}

/**
 * The look the pet shows, as `identity` (what it is) is drawn: a lab pick
 * as itself where the band (or the window) last drew it so, else its own
 * stand-in: where that is what was last drawn (a band too narrow or short, a
 * look that broke), and on a `surface` that can't draw braille. Its voice and
 * pet-control follow it, never a width of their own.
 */
function shownLook(identity: Look, surface?: RenderSurface | null): Look {
  if (identity.kind !== 'lab') return identity
  const isStandIn = (surface !== undefined && surface !== 'terminal') || session.isLabDrawn === false || session.worn?.look !== identity.lab
  return isStandIn ? { kind: 'sprite', sprite: spriteById(identity.lab.fallback) } : identity
}

/**
 * A look's art at `pose`: a sprite's frame, or what the worn lab look last
 * drew (stepped by the clock, never here) less a grown one's empty top. With
 * `crop`, pet-control's preview: its rightmost `crop` cells of its band
 * self, the small picture the band shows, never the pet window's (see
 * `keepBandSelf`), and for a look that talks in its own bubble or a scene,
 * its last resting frame. A pet's window picture shows only `isWindow`, in
 * the pet window. A lab look not on yet, a moment after a pick, draws its
 * fallback.
 */
function artOf(Text: TextElement, look: Look, pose: Pose, t: number, crop?: number, isWindow = false): Art {
  const worn = session.worn
  if (look.kind === 'lab' && worn?.look === look.lab) {
    const { lab } = look
    // A preview of one that talks in its own bubble, or a scene, rests: its words are the band's to show.
    const isResting = crop !== undefined && (lab.ownsBubble === true || lab.layout === 'scene')
    // Its rows, and their Text, are made once something asks for them: never while it is drawn as a Raster instead.
    let rows: readonly (readonly LabRun[])[] | undefined
    let lines: JSX.Element[] | undefined
    let width: number | undefined
    const rowsOf = (): readonly (readonly LabRun[])[] => {
      if (rows !== undefined) return rows
      // Elsewhere a pet is its band self, even the tick after the window shuts, before the clock steps it in the band;
      // the preview's comes from what drew it last (a scene's twin while it steps in the window), or is none.
      const self = crop === undefined ? worn.live : worn.self
      const runs = () => (isWindow ? worn.live.runs() : self === undefined ? [] : (self.bandRuns?.() ?? self.runs()))
      const drawn = (isResting ? (restOf(worn) ?? runs()) : runs()).slice(worn.top ?? 0)
      rows = crop === undefined ? drawn : cropRight(drawn, crop)
      return rows
    }
    return {
      name: lab.name,
      isLab: true,
      get lines() {
        return (lines ??= rowsOf().map(row => <Text wrap="truncate-end">{drawRuns(Text, row)}</Text>))
      },
      get width() {
        return (width ??= Math.max(0, ...rowsOf().map(widthOf)))
      },
      get height() {
        return rowsOf().length
      },
      paint: lab.bubble,
      layout: crop === undefined ? lab.layout : 'pet',
      // Words it had no rows for, it left to the band.
      ownsBubble: lab.ownsBubble === true && worn.live.leftWords?.() !== true,
      hasFloor: lab.hasFloor === true,
      grows: lab.most !== undefined,
    }
  }
  const sprite = look.kind === 'sprite' ? look.sprite : spriteById(look.lab.fallback)
  const lines = drawLines(Text, sprite.color, frame(sprite, pose.mood, pose.at), t)
  return { name: sprite.name, isLab: false, lines, width: sprite.width, height: sprite.height, paint: sprite.color, layout: 'pet', ownsBubble: false, hasFloor: false, grows: false }
}

/** Lines of the pet (a frame, an emote) in its paint at animation tick `t`: one Text a line. */
function drawLines(Text: TextElement, paint: Paint | undefined, lines: readonly string[], t: number): JSX.Element[] {
  return paintLines(paint, lines, t).map(line => <Text>{drawRuns(Text, line)}</Text>)
}
