import type { PowerUpEffectCase } from './power-up-effect-sweep.types.ts'

const RACE_FOLDER = 'RACEC0R0'
// The player accelerates from frame 175 (trace-scenarios.ts); the brick is handed over at 300 and fired at 305, as in the pixel
// trace's power-up cases.
const GRANT_FRAME = 300
const USE_FRAME = 305
// From the first frames of the effect to 2.8 seconds after it was fired: a turbo's flames show once it has started (400 ms), the
// rockets launch, the magnet and the curse land, the wand's beam and the shields hold, the warp carries the player away.
export const EFFECT_SWEEP_RECORD_FRAMES: readonly number[] = [
  307, 310, 315, 322, 330, 345, 365, 390,
]
const FRAME_COUNT = 391

// The effect of each brick colour and level (power-ups.md): the brick kinds 1 to 4 and the levels 0 to 3 (white enhancement
// bricks), so every effect the race can fire is fired once.
const EFFECT_NAMES: Readonly<Record<number, readonly string[]>> = Object.freeze({
  1: ['cannon', 'grapple', 'wand', 'rockets'],
  2: ['shield', 'shield', 'shield', 'shield'],
  3: ['turbo', 'turbo', 'twin turbo', 'warp'],
  4: ['oil slick', 'barrel', 'magnet', 'curse'],
})
const COLOR_NAMES: Readonly<Record<number, string>> = Object.freeze({
  1: 'red',
  2: 'blue',
  3: 'green',
  4: 'yellow',
})
const KINDS: readonly number[] = [1, 2, 3, 4]
const LEVELS: readonly number[] = [0, 1, 2, 3]

const getCaseName = (kind: number, level: number): string =>
  `${COLOR_NAMES[kind] ?? String(kind)} ${String(level)} ${EFFECT_NAMES[kind]?.[level] ?? ''}`

export const getEffectSweepCase = (kind: number, level: number): PowerUpEffectCase => {
  const name = getCaseName(kind, level)
  return {
    name,
    kind,
    level,
    request: {
      name: `Effect sweep, ${name}`,
      raceFolder: RACE_FOLDER,
      powerUp: {
        kind,
        level,
        grantFrame: GRANT_FRAME,
        useFrame: USE_FRAME,
        frameCount: FRAME_COUNT,
      },
      recordFrames: EFFECT_SWEEP_RECORD_FRAMES,
    },
  }
}

// The control of a case: the same race with the brick handed over but never fired. A picture the original paints in the fired
// race and not in the control is the effect's.
export const getHeldCase = (sweepCase: PowerUpEffectCase): PowerUpEffectCase => ({
  ...sweepCase,
  request: {
    ...sweepCase.request,
    name: `${sweepCase.request.name}, held`,
    powerUp: {
      kind: sweepCase.kind,
      level: sweepCase.level,
      grantFrame: GRANT_FRAME,
      useFrame: FRAME_COUNT,
      frameCount: FRAME_COUNT,
    },
  },
})

export const EFFECT_SWEEP_CASES: readonly PowerUpEffectCase[] = KINDS.flatMap((kind) =>
  LEVELS.map((level) => getEffectSweepCase(kind, level))
)
