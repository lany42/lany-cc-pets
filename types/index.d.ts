/** What the pet last said, the animation tick it said it on, and for how many ticks it shows. */
export type Speech = { text: string; tick: number; ttl: number }
/**
 * One line of the chat log: what you said to the pet, its answer, or a line
 * it said on its own. Shown in pet-control; sent back only with chat memory
 * on (`isRemembering`), as `chatMemory` picks.
 */
export type ChatLine = {
  from: 'you' | 'pet'
  text: string
  /** A reply that never came: `text` says why, drawn as a note rather than the pet's words. */
  isFailed?: boolean
  /** Said on its own (a timed line, a hello), not in answer to you: drawn dim, and never taken for an answer. */
  isAside?: boolean
}
/** What the pet's pane shows: its settings, or its looks, laid over the settings when opened from them. */
export type PaneView = { page: 'settings' | 'looks'; isStacked: boolean }
/**
 * The main loop's turn, as turn.start and turn.complete leave it (clock ms),
 * and whether it ended on the person's Esc (absent in a mark an older load left).
 */
export type TurnMark = { isOpen: boolean; startedAt: number; endedAt: number; isAborted?: boolean }
/**
 * Where the observer last looked: the transcript tail it reacted to, how many
 * rows the transcript held then, and when the pet last spoke (0: never).
 */
export type SeenMark = { key: string | null; count?: number; spokeAt: number }
/** A reaction without words beside the pet's head (body.ts), and the animation tick it started on. */
export type EmoteMark = { kind: 'wake' | 'cheer' | 'love'; tick: number }

declare module 'claude-code' {
  interface PluginState {
    'lany-cc-pets': {
      /** Animation clock: bumped every frame while the pet or its pane shows. */
      tick: number
      /** The one-word personality set with `/pet <word>`. */
      personality: string
      /**
       * Enters in pet-control's personality field. A surface empties a field
       * its Enter reached, and keeps it so while its value is drawn unchanged:
       * the field is drawn fresh under each new count, holding `personality`.
       */
      traitSent: number
      /** The look picked with `/pet as <id>`: a Sprite's id, or a lab look's. */
      spriteId: string
      isHidden: boolean
      /** True while the side model is writing the pet's next line. */
      isPondering: boolean
      speech: Speech | null
      turn: TurnMark
      seen: SeenMark
      paneView: PaneView
      /**
       * The chat log, newest last: every line the pet says, pane open or not,
       * and what you say to it, for you to read in pet-control. Each request
       * reaches the pet on its own, unless `isRemembering`: then with what
       * `chatMemory` keeps of this log.
       */
      chat: ChatLine[]
      /** Messages sent from the chat bar; the bar is drawn fresh, empty, under each new count. */
      chatSent: number
      /** The emote playing beside the pet, if any: it plays once, from its tick. */
      emote: EmoteMark | null
      /** True once the person has been away SLEEP_MS: the pet dozes until they're back. */
      isAsleep: boolean
      /** Set with `/pet quiet`: the pet volunteers no lines, only answers when spoken to. */
      isQuiet: boolean
      /**
       * Set with `/pet remember` (or its box over the chat): each timed line
       * and each answer to you (`/pet btw` or the chat bar) is asked with what
       * the pet remembers of the chat log, pane open or not; hellos stay
       * one-shot. Off by default; each flip wipes the chat log, as a /clear or
       * /resume does.
       */
      isRemembering: boolean
      /**
       * Set with `/pet experimental` (or its box in pet-control): the person may
       * wear braille lab looks. Off, a lab pick wears its classic fallback.
       */
      isExperimental: boolean
      /**
       * The last classic look the person wore, kept apart from `spriteId`: a
       * lab pick wears it while experimental! is off. Null till one is known.
       */
      classicId: string | null
      /** True while the pet window (`/pet window`) is open: the pet lives there, and the band yields. */
      isWindowOpen: boolean
      /**
       * True while pet-control is open and placed (`session.isPaneOpen`,
       * mirrored for the band): on its settings page its chat shows the pet's
       * lines, and the band yields the pet and its bubble to it.
       */
      isPaneOpen: boolean
      /**
       * True once this session's state holds the settings `$.store` keeps
       * (`restore`); a /clear or /resume empties the state, this with it.
       */
      isRestored: boolean
    }
  }
}
