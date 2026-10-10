// A pocket spiral galaxy, black-hole's companion: two arms wound round a
// bright core, the core an @ because an @ is a spiral too. Where the black
// hole pulls stray characters in, the galaxy sends starlight out along its
// arms while Claude works; while it thinks, a new star spins itself together
// between the arms, then shines as it talks.
import type { Sprite } from '../sprite'

// cols:  0123456789012345
const TOP = '  _.-~~~~~-.    '
const MID = ",'   /'@-._/  . "
const BOT = "  . `-.____.-'  "

export const sprite: Sprite = {
  id: 'galaxy',
  name: 'Spiral Galaxy',
  persona: 'a pocket-sized spiral galaxy, slowly turning, where new stars are always being born',
  // the shimmer: a glint of starlight sweeps it once every 22 s, the length
  // of its idle loop, rarer than the default 8 s so it stays calm at rest
  color: { kind: 'shiny', color: 'suggestion', shine: 'text', every: 88 },
  width: 16,
  height: 3,
  frames: {
    rest: [TOP, MID, BOT],
    // idle: the stars round the rim twinkle, each on its own time
    twinkleRight: [TOP, ",'   /'@-._/  + ", BOT],
    twinkleLeft: [TOP, MID, "  + `-.____.-'  "],
    farStar: ['  _.-~~~~~-.  . ', MID, BOT],
    // busy: the galaxy turns, a knot of starlight streaming out along each
    // arm; the top knot steps first (lead), the bottom one a tick behind
    out1: ['  _.-~~~~~*.    ', MID, "  . `*.____.-'  "],
    lead1: ['  _.-~~~~*-.    ', MID, "  . `*.____.-'  "],
    out2: ['  _.-~~~~*-.    ', MID, "  . `-*____.-'  "],
    lead2: ['  _.-~~~*~-.    ', MID, "  . `-*____.-'  "],
    out3: ['  _.-~~~*~-.    ', MID, "  . `-.*___.-'  "],
    lead3: ['  _.-~~*~~-.    ', MID, "  . `-.*___.-'  "],
    out4: ['  _.-~~*~~-.    ', MID, "  . `-._*__.-'  "],
    lead4: ['  _.-~*~~~-.    ', MID, "  . `-._*__.-'  "],
    out5: ['  _.-~*~~~-.    ', MID, "  . `-.__*_.-'  "],
    lead5: ['  _.-*~~~~-.    ', MID, "  . `-.__*_.-'  "],
    out6: ['  _.-*~~~~-.    ', MID, "  . `-.___*.-'  "],
    lead6: ['  _.*~~~~~-.    ', MID, "  . `-.___*.-'  "],
    out7: ['  _.*~~~~~-.    ', MID, "  . `-.____*-'  "],
    lead7: ['  _*-~~~~~-.    ', MID, "  . `-.____*-'  "],
    out8: ['  _*-~~~~~-.    ', MID, "  . `-.____.*'  "],
    lead8: ['  _.-~~~~~*.    ', MID, "  . `-.____.*'  "],
    // ponder: a new star spins itself together between the arms
    spin1: [TOP, ",' - /'@-._/  . ", BOT],
    spin2: [TOP, ",' \\ /'@-._/  . ", BOT],
    spin3: [TOP, ",' | /'@-._/  . ", BOT],
    spin4: [TOP, ",' / /'@-._/  . ", BOT],
    // talk: the new star lights up and shines, then settles
    lit: [TOP, ",' * /'@-._/  . ", BOT],
    glow: [TOP, ",' + /'@-._/  . ", BOT],
    ember: [TOP, ",' . /'@-._/  . ", BOT],
    // sleep: the rim goes dark and the core breathes
    dim: [TOP, ",'   /'@-._/    ", "    `-.____.-'  "],
    dimmer: [TOP, ",'   /'o-._/    ", "    `-.____.-'  "],
    // cheer: every star in the rim flares at once
    flareA: ['  _.-~~~~~-.  + ', ",'   /'@-._/  * ", "  + `-.____.-'  "],
    flareB: ['  _.-~~~~~-.  . ', ",'   /'@-._/  + ", "  * `-.____.-'  "],
  },
  loops: {
    idle: [
      ['rest', 22], ['twinkleRight', 2], ['rest', 30], 'twinkleLeft', ['rest', 14], ['farStar', 2], ['rest', 17],
    ],
    busy: [
      ['out1', 2], 'lead1', ['out2', 2], 'lead2', ['out3', 2], 'lead3', ['out4', 2], 'lead4',
      ['out5', 2], 'lead5', ['out6', 2], 'lead6', ['out7', 2], 'lead7', ['out8', 2], 'lead8',
    ],
    ponder: ['spin1', 'spin2', 'spin3', 'spin4'],
    talk: [['lit', 2], 'glow', ['lit', 2], 'glow', ['lit', 2], 'glow', ['ember', 2], 'rest'],
    sleep: [['dim', 10], ['dimmer', 10]],
    cheer: [['flareA', 2], 'flareB', 'flareA', ['flareB', 2]],
  },
}
