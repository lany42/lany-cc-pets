# Privacy

lany-cc-pets draws a pet above Claude Code's prompt. To give it a voice,
it sends part of your session to Claude Sonnet. That is the only thing
it sends anywhere, and it collects nothing for anyone.

## What the pet sends, and where

- **One kind of request.** The pet asks Claude Sonnet for one short line
  through Claude Code's official plugin API (`$.model.complete`), at low
  effort. The request is text only: the model gets no tools, can't read
  files and can't run code. It goes over your session's own connection,
  on your account, to the model access Claude Code already has.
- **When.** Shortly after a turn ends, and now and then during a long
  turn (after 75 seconds, then 150, then 300), never closer than 30
  seconds apart. Also when you talk to the pet (`/pet btw` or the chat
  bar), and once to say hello when you give it a personality or pick a
  look.
- **What.** A short digest of the latest part of the session, at most
  2,400 characters, from up to its 16 newest messages:
  - your typed messages, each cut to 300 characters;
  - Claude's two newest replies, each cut to 240;
  - a count of the steps Claude took, and nothing else about them.

  Tool calls, commands, file paths, tool output, code blocks and Claude
  Code's own reminders are left out. Other text you typed into a prompt
  is not redacted. Beside the digest go your pet's personality word, its
  look's description, its own last few lines, how long Claude has been
  working, and, with memory on, your chat with the pet.
- **Nothing else.** The plugin has no other network access. It sends
  nothing to its author or to any other service: no analytics and no
  telemetry.

## What the pet keeps

- **Settings, between sessions:** the look you wear, its personality
  word, the quiet, hidden, memory and experimental switches, and a grown
  look's seed word and turn count. Claude Code keeps them in the
  plugin's own store, a file in your Claude Code configuration directory.
- **Your chat with the pet, for the session only:** what you say to it,
  its answers and its remarks, up to 40 lines. A new session, a restart,
  `/clear` or `/resume` empties it.
- **Memory** (`/pet remember`, off by default) lets the pet read that
  chat in its requests, up to 24 lines. It never outlasts the session,
  and turning memory on or off clears the chat.

A typed `/pet` command stays in your transcript, as every slash command
does, so Claude can read what you wrote after `/pet btw`. What you do in
the pet-control pane, chat included, stays out of your conversation with
Claude.

## Turning the requests down or off

- `/pet quiet`: the pet stops making remarks on its own and stays on
  screen. It still sends a request when you talk to it, give it a
  personality or pick a look. `/pet chatty` turns remarks back on.
- `/pet hide`: the pet stops entirely, sending nothing and drawing
  nothing, until `/pet show`.

No setting keeps the pet on screen with no requests at all. `/pet quiet`
comes closest, as long as you don't talk to it.

## Questions

Ask on the issue tracker: <https://github.com/lany42/lany-cc-pets/issues>.

## The requests, verbatim

These are the templates in `hooks/comment.ts` and `hooks/observe.ts`.
Text in `{braces}` is filled in, and a line marked `[if ...]` is sent only
in that case.

Every request: model `sonnet`, effort `low`, at most 200 tokens, a
20-second timeout.

The system prompt, after the short identity line Claude Code puts first:

```text
You are {the look's description}, the pet of the person at this terminal, keeping them company while Claude, their AI coding assistant, works for them. Your personality, in one word: {personality}. Talk to your person, as "you", about how it is going for them: their progress, their wait, their wins and setbacks, their mood. They see every step Claude takes, so unless they ask, never narrate its commands, files or tools, nor repeat what it told them: leave the details to Claude. Shown a moment of their session, say one short sentence to them (at most 12 words), fully in character. Mostly remark rather than ask: they are busy and seldom answer. When your person talks to you directly, answer them in at most two short sentences, still in character. Plain text only: no quotes, no emoji, no markdown, no preamble.
```

A remark of its own:

```text
[if memory is on] Your chat with your person so far, oldest first:
[if memory is on] {each remembered line}
[if your last message has scrolled out] Your person asked: {your last typed message, at most 200 characters}
Claude just finished{, after N minutes}. What happened:
- {each digest line}
[if it has spoken] Your last lines (don't repeat their words or their shape): {its last lines, joined by " / "}
Your line to them:
```

During a long turn, the third line reads instead:
`Claude has been working{ for N minutes} and is still at it. The latest:`.
The minutes appear only after three or more.

An answer, when you talk to it:

```text
[if memory is on] Your chat with your person so far, oldest first:
[if memory is on] {each remembered line}
Your person says to you directly: {your message}
[if the session has any] For context, the latest stretch of their session:
- {each digest line}
Your answer:
```

A hello:

```text
Your person just gave you your personality: {personality}. Say hello to them in one sentence.
Your person just picked you as their pet. Say hello to them in one sentence.
```

The digest's lines, newest kept:

```text
Your person: {what you typed, at most 300 characters}
Claude: {what Claude told you, at most 240 characters}
Your person turned down a step.
Your person stopped Claude.
A background job reported back.
(Claude took {n} step{s})
```

The remembered lines, with memory on:

```text
Your person: {what you said to it, at most 300 characters}
You: {its answer}
You (on your own): {a line it said on its own}
```
