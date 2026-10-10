// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2026 Lany Atwood <lany@colorized.life>

// The rig's shape kinds (registry.ts's `ShapeKind`): what a layer fills. Each
// kind names its nodes (the points keyforms move, in order), its props (the
// numbers and tables keyforms may move) and makes its path commands, in its
// layer's own units, from where its nodes and props are at a moment.
//
//   path     `d` as is, every point of it a node (a cubic's three)
//   stroke   one cubic `M p0 C c1 c2 p3` (its 4 points), drawn as the kit's
//            tapered outline: at t = k / n the width `max(floor[k] *
//            hairline, width[k])`, times `scale` when it is not 1
//   ellipse  its centre `at`; `rx`, `ry` (each floored at `floor.rx` or
//            `floor.ry` hairlines when named), `angle`: the kit's n-gon
//   band     a polyline `points`, offset up by `split[0]` and down by
//            `split[1]` of `max(floor[k] * hairline, thick[k])`, out along
//            it and back: Sakura's lid line
//
// Exactness first: a stroke's and an ellipse's outlines come from the kit's
// own `stroke()` and `ellipse()` (pen.ts), called on a pen that records what
// they draw as `M` and `L` commands in local units instead of flattening it;
// raster.ts replays them through a real pen under the same transform, so
// they fill the very samples a direct call on that pen would. A width is
// handed to `stroke()` as a table read at `Math.round(t * n)`, and a band's
// top edge is `y - thick * 0.6` by default (`SPLIT`).
//
// A prop is listed (and so may take keyform blocks) only where the shape
// gives it: a stroke's `scale` and an ellipse's `angle` move only when
// written, even as their identity. Registered in registry.ts. Pure: imports
// nothing at run time but the kit's pen.
import { ellipse, IDENTITY, Pen, stroke } from './kit/pen'
import type { ShapeKind } from './registry'
import type { Command, Pt } from './schema'

/**
 * A pen that keeps what it is told as path commands in local units, instead
 * of flattening it into samples: the kit's `stroke` and `ellipse` draw into
 * it, and `take` hands back what they drew. Its `rings` is empty and closes
 * nothing; a replay's own `rings` closes the outline, as the kit's would.
 */
class Recorder extends Pen {
  private out: Command[] = []

  constructor() {
    super(IDENTITY)
  }

  move(x: number, y: number): this {
    this.out.push(['M', x, y])
    return this
  }

  line(x: number, y: number): this {
    this.out.push(['L', x, y])
    return this
  }

  curve(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    this.out.push(['C', c1x, c1y, c2x, c2y, x, y])
    return this
  }

  close(): this {
    this.out.push(['Z'])
    return this
  }

  rings(): number[][] {
    return []
  }

  /** What was drawn since the last `take`. */
  take(): Command[] {
    const out = this.out
    this.out = []
    return out
  }
}

/** The one recorder every stroke and ellipse draws into (evaluation is synchronous: each takes its commands before the next draws). */
const recorder = new Recorder()

const path: ShapeKind = {
  id: 'path',
  nodes(def) {
    const out: Pt[] = []
    for (const c of def.d ?? []) {
      if (c[0] === 'M' || c[0] === 'L') out.push([c[1], c[2]])
      else if (c[0] === 'C') out.push([c[1], c[2]], [c[3], c[4]], [c[5], c[6]])
    }
    return out
  },
  props: () => ({}),
  commands(def, nodes) {
    const out: Command[] = []
    let k = 0
    for (const c of def.d ?? []) {
      if (c[0] === 'Z') out.push(c)
      else if (c[0] === 'C') {
        const [a, b, e] = [nodes[k]!, nodes[k + 1]!, nodes[k + 2]!]
        out.push(['C', a[0], a[1], b[0], b[1], e[0], e[1]])
        k += 3
      } else {
        const [x, y] = nodes[k]!
        out.push(c[0] === 'M' ? ['M', x, y] : ['L', x, y])
        k++
      }
    }
    return out
  },
}

const strokeKind: ShapeKind = {
  id: 'stroke',
  nodes(def) {
    const m = def.d?.[0]
    const c = def.d?.[1]
    if (m === undefined || c === undefined || m[0] !== 'M' || c[0] !== 'C') return []
    return [
      [m[1], m[2]],
      [c[1], c[2]],
      [c[3], c[4]],
      [c[5], c[6]],
    ]
  },
  props: def => ({ width: (def.n ?? 16) + 1, ...(def.scale !== undefined ? { scale: 0 } : {}) }),
  commands(def, nodes, props, view) {
    const n = def.n ?? 16
    const width = props.width as readonly number[]
    const floor = Array.isArray(def.floor) ? (def.floor as readonly number[]) : undefined
    const by = typeof props.scale === 'number' ? props.scale : 1
    const table = new Array<number>(n + 1)
    for (let k = 0; k <= n; k++) {
      let w = floor !== undefined ? Math.max(floor[k]! * view.hairline, width[k]!) : width[k]!
      if (by !== 1) w *= by
      table[k] = w
    }
    stroke(recorder, nodes[0]!, nodes[1]!, nodes[2]!, nodes[3]!, t => table[Math.round(t * n)]!, n)
    return recorder.take()
  },
}

const ellipseKind: ShapeKind = {
  id: 'ellipse',
  nodes: def => (def.at !== undefined ? [def.at] : []),
  props: def => ({ rx: 0, ry: 0, ...(def.angle !== undefined ? { angle: 0 } : {}) }),
  commands(def, nodes, props, view) {
    const floor = def.floor !== undefined && !Array.isArray(def.floor) ? (def.floor as Readonly<Record<string, number>>) : undefined
    let rx = props.rx as number
    let ry = props.ry as number
    const floorX = floor?.rx
    const floorY = floor?.ry
    if (floorX !== undefined) rx = Math.max(floorX * view.hairline, rx)
    if (floorY !== undefined) ry = Math.max(floorY * view.hairline, ry)
    const angle = typeof props.angle === 'number' ? props.angle : 0
    ellipse(recorder, nodes[0]![0], nodes[0]![1], rx, ry, angle, def.n ?? 28)
    return recorder.take()
  },
}

/** A band's default split: up 0.6, down 0.4 of its thickness (Sakura's lid line). */
const SPLIT = [0.6, 0.4] as const

const band: ShapeKind = {
  id: 'band',
  nodes: def => def.points ?? [],
  props: def => ({ thick: (def.points ?? []).length }),
  commands(def, nodes, props, view) {
    const thick = props.thick as readonly number[]
    const floor = Array.isArray(def.floor) ? (def.floor as readonly number[]) : undefined
    const [up, down] = def.split ?? SPLIT
    const th = nodes.map((_, k) => (floor !== undefined ? Math.max(floor[k]! * view.hairline, thick[k]!) : thick[k]!))
    const out: Command[] = [['M', nodes[0]![0], nodes[0]![1] - th[0]! * up]]
    for (let k = 0; k < nodes.length; k++) out.push(['L', nodes[k]![0], nodes[k]![1] - th[k]! * up])
    for (let k = nodes.length - 1; k >= 0; k--) out.push(['L', nodes[k]![0], nodes[k]![1] + th[k]! * down])
    return out
  },
}

/** The shape kinds, by id: `path`, `stroke`, `ellipse`, `band`. */
export const SHAPES: readonly ShapeKind[] = [path, strokeKind, ellipseKind, band]
