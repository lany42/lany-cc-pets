// The rig's paints (registry.ts's `PaintType`): what a layer fills with. A
// paint resolves at a moment (its colors as numbers, its anchors where the
// layer's keyforms put them), then becomes the canvas's paint under the
// layer's full transform `M` (its space chain, then the room's `m`), so it
// can think in the layer's units.
//
//   solid    one palette color (a layer's `paint` as a bare name is this)
//   rows     `{ top, bottom, stops: [[fraction, color]...], steps? }`: a
//            gradient (or cel steps, with `steps`) by sample row, its stops
//            at `top + span * fraction` between the layer's two anchors'
//            projected heights (`vertical()` below): Momiji's iris
//   columns  `{ stops: [[x, color]...], else }`: by column, `u = (x - M[4]) /
//            M[0]` across the layer's units, the first stop whose `u < x`,
//            else `else`: her beanie's dome
//   ribs     `{ centre, half, freq, threshold, shadeFrom, colors: { rib,
//            ribShade, gap, gapShade } }`: a cylinder's ribs by column, `v =
//            clamp((u - centre) / half, -1, 1)`, a rib where `cos(asin(v) *
//            freq) > threshold`, shaded past `v > shadeFrom`: her cuff
//
// (`regions`, Sakura's eye, is regions.ts.) Registered in registry.ts. Pure:
// imports nothing at run time but the kit's pen (for `mixColor`).
import type { Paint } from './kit/canvas'
import { mixColor } from './kit/pen'
import type { PaintType } from './registry'
import type { PaintDef, Pt, ResolvedPaint } from './schema'

// ---------------------------------------------------------------- the paints

const solid: PaintType = {
  id: 'solid',
  resolve: (def, at) => ({ type: 'solid', color: at.color(def.color as string) }),
  canvas: paint => paint.color as number,
}

/** A gradient (or cel steps) by sample row through `[y in samples, color]` stops (the tests keep a copy as their oracle). */
function vertical(stops: readonly (readonly [number, number])[], steps: boolean): Paint {
  return {
    row: y => {
      let k = 0
      while (k < stops.length - 2 && y > stops[k + 1]![0]) k++
      const [ya, ca] = stops[k]!
      const [yb, cb] = stops[k + 1] ?? stops[k]!
      if (steps) return y < yb ? ca : cb
      return yb === ya ? ca : mixColor(ca, cb, Math.max(0, Math.min(1, (y - ya) / (yb - ya))))
    },
  }
}

/** A resolved `rows` paint: its anchors in the layer's units, its stops' colors as numbers. */
export type Rows = ResolvedPaint & { readonly top: Pt; readonly bottom: Pt; readonly stops: readonly (readonly [number, number])[]; readonly steps: boolean }

const rows: PaintType = {
  id: 'rows',
  resolve: (def, at): Rows => ({
    type: 'rows',
    top: at.anchor(def.top as string),
    bottom: at.anchor(def.bottom as string),
    stops: (def.stops as readonly (readonly [number, string])[]).map(([f, name]) => [f, at.color(name)] as const),
    steps: def.steps === true,
  }),
  canvas(paint, M) {
    const { top: a, bottom: b, stops, steps } = paint as Rows
    // A point's sample row under M.
    const top = M[1] * a[0] + M[3] * a[1] + M[5]
    const span = M[1] * b[0] + M[3] * b[1] + M[5] - top
    return vertical(
      stops.map(([f, color]) => [top + span * f, color] as const),
      steps,
    )
  },
}

/** A resolved `columns` paint. */
export type Columns = ResolvedPaint & { readonly stops: readonly (readonly [number, number])[]; readonly else: number }

const columns: PaintType = {
  id: 'columns',
  resolve: (def, at): Columns => ({
    type: 'columns',
    stops: (def.stops as readonly (readonly [number, string])[]).map(([x, name]) => [x, at.color(name)] as const),
    else: at.color(def.else as string),
  }),
  canvas(paint, M) {
    const { stops, else: otherwise } = paint as Columns
    const e = M[4]
    const a = M[0]
    return {
      column: x => {
        const u = (x - e) / a
        for (const [at, color] of stops) if (u < at) return color
        return otherwise
      },
    }
  },
}

/** A resolved `ribs` paint. */
export type Ribs = ResolvedPaint & {
  readonly centre: number
  readonly half: number
  readonly freq: number
  readonly threshold: number
  readonly shadeFrom: number
  readonly rib: number
  readonly ribShade: number
  readonly gap: number
  readonly gapShade: number
}

/** A ribs paint's color at `u` across the layer's units: her cuff's formula. */
export function ribAt(paint: Ribs, u: number): number {
  const v = Math.max(-1, Math.min(1, (u - paint.centre) / paint.half))
  const angle = Math.asin(v)
  const isRib = Math.cos(angle * paint.freq) > paint.threshold
  const isShade = v > paint.shadeFrom
  return isRib ? (isShade ? paint.ribShade : paint.rib) : isShade ? paint.gapShade : paint.gap
}

/** A ribs paint's palette colors, by name: its `colors`' fields. */
export const RIB_COLORS = ['rib', 'ribShade', 'gap', 'gapShade'] as const

const ribs: PaintType = {
  id: 'ribs',
  resolve(def, at): Ribs {
    const colors = def.colors as Readonly<Record<(typeof RIB_COLORS)[number], string>>
    return {
      type: 'ribs',
      centre: def.centre as number,
      half: def.half as number,
      freq: def.freq as number,
      threshold: def.threshold as number,
      shadeFrom: def.shadeFrom as number,
      rib: at.color(colors.rib),
      ribShade: at.color(colors.ribShade),
      gap: at.color(colors.gap),
      gapShade: at.color(colors.gapShade),
    }
  },
  canvas(paint, M) {
    const e = M[4]
    const a = M[0]
    return { column: x => ribAt(paint as Ribs, (x - e) / a) }
  },
}

/** The paints, by id: `solid`, `rows`, `columns`, `ribs` (regions.ts adds `regions`). */
export const PAINTS: readonly PaintType[] = [solid, rows, columns, ribs]

/** A layer's paint as written: a bare palette name is a `solid` paint of it. */
export const paintDefOf = (paint: string | PaintDef): PaintDef => (typeof paint === 'string' ? { type: 'solid', color: paint } : paint)
