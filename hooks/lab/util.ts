// Small helpers every kind of lab look shares: colors as Text takes them, a
// clamp and a mix, smoothstep, an ordered dither, tonight's moon, and which
// characters take one cell. Each was copied into several looks before; each
// here is the very arithmetic those copies did, so a look that takes it draws
// what it drew. Pure: imports nothing, so the scene kit, every kind's
// adapter and the studio's Node tools all load it.

/** A color, 0xRRGGBB, as Text takes it: '#rrggbb'. */
export const hex = (rgb: number): string => '#' + rgb.toString(16).padStart(6, '0')

/** `v` held to [lo, hi]; where they cross (lo > hi), lo. */
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** The number `t` of the way from `a` to `b`. */
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The color `t` of the way from `a` to `b` (0xRRGGBB), channel by channel as
 * `a * (1 - t) + b * t`, rounded: the scene kit's ramps and a field's wash.
 * (The painted kit's pen's `mixColor` lerps as `a + (b - a) * t`, which can round
 * a channel the other way: not the same function.)
 */
export function mixRgb(a: number, b: number, t: number): number {
  const u = 1 - t
  return (
    (Math.round(((a >> 16) & 0xff) * u + ((b >> 16) & 0xff) * t) << 16) |
    (Math.round(((a >> 8) & 0xff) * u + ((b >> 8) & 0xff) * t) << 8) |
    Math.round((a & 0xff) * u + (b & 0xff) * t)
  )
}

/** Smoothstep of `t`, held to [0, 1]: 0, easing up to 1. */
export const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

/** Smoothstep from `a` to `b` at `x`: 0 at `a`, 1 at `b` (a falling one when `a` > `b`). */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Ordered 4x4 Bayer threshold in [0, 1): stable shading that never boils. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
export const bayer = (x: number, y: number): number => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16

/**
 * Tonight's moon: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
 * Counted from the new moon of 2000-01-06 18:14 UTC, 29.530588853 days a
 * cycle. Every moon takes its phase from this and the clock's `now`.
 */
export function moonPhase(now: number): number {
  const days = (now - Date.UTC(2000, 0, 6, 18, 14)) / 86_400_000
  const p = (days / 29.530588853) % 1
  return p < 0 ? p + 1 : p
}

/**
 * Whether a code point is safe as one cell: printable ASCII, Latin-1, Latin
 * Extended-A, general punctuation (dashes, quotes, ellipsis), box drawing and
 * braille. Anything else (CJK, emoji, combining marks) could be wide. (Some of
 * these are ambiguous-width in East Asian terminals: see `isAmbiguousWide`.)
 */
export function isNarrow(cp: number): boolean {
  return (cp >= 0x20 && cp < 0x7f) || (cp >= 0xa0 && cp < 0x180) || (cp >= 0x2010 && cp <= 0x2027) || (cp >= 0x2030 && cp <= 0x205e) || (cp >= 0x2500 && cp < 0x2580) || (cp >= 0x2800 && cp < 0x2900)
}
