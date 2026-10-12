import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import {
  BrickState,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type {
  BrickKind as BrickKindValue,
  RacerPowerUpAbilities,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import { getRacerWithBrick } from '../../types/racer-power-ups/racer-power-ups.ts'
import { getStepWithRacer } from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import {
  createPowerUpWorld,
  touchEnhancementBricks,
  updatePowerUps,
} from '../power-up-world/power-up-world.ts'
import { usePowerUp } from './use-power-up.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_ABILITIES: RacerPowerUpAbilities = {
  isAlwaysGrapple: false,
  isAlwaysLevelThree: false,
  isPermanentTurbo: false,
}

const STATUS: RacerPowerUpStatus = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  isComputer: false,
  isShielded: false,
  shieldLevel: 0,
  isTumbling: false,
  isWarping: false,
  isCursed: false,
  isWarpWithheld: false,
  isWarpPending: false,
  isAirborne: false,
  isStruckByLightning: false,
  isInTurbo: false,
}

const CONTEXT: PowerUpContext = {
  arithmetic: SINGLE,
  racers: [STATUS],
  raceModeFlags: 0,
  getGroundPoint: () => null,
  trackTargets: [],
}

// One racer holding the given brick, with two enhancement bricks collected.
const createHolding = (kind: BrickKindValue | null): PowerUpStep => {
  const loaded = updatePowerUps(
    createPowerUpWorld({
      bricks: [],
      enhancementBricks: [{ position: [0, 0, 0] }, { position: [5, 0, 0] }],
      raceModeFlags: 0,
      isSplitScreen: false,
      racers: [{ voiceSoundBase: 0, voiceCooldownMilliseconds: 0 }],
      random: { table: createRandomTable(Array.from({ length: 1024 }, () => 0)), position: 0 },
    }),
    CONTEXT,
    1
  )
  const enhanced = touchEnhancementBricks(loaded, CONTEXT, [
    { racer: 0, brick: 0 },
    { racer: 0, brick: 1 },
  ])
  const racer = enhanced.world.racers[0]
  if (racer === undefined || kind === null) return enhanced
  return getStepWithRacer(enhanced, 0, getRacerWithBrick(racer, kind))
}

const getHeadKind = (step: PowerUpStep): string | undefined => {
  const id = step.world.effects.activeEffectIds[0]
  return id === undefined ? undefined : step.world.effects.effects[id]?.kind
}

describe('usePowerUp', () => {
  it('taunts when nothing is held (0x00439c90)', () => {
    // Arrange
    const step = createHolding(null)

    // Act
    const used = usePowerUp(step, CONTEXT, 0, NO_ABILITIES)

    // Assert
    expect(used.events.at(-1)).toMatchObject({ type: 'power_ups.racer_taunted', racer: 0 })
  })

  it('uses the brick at the enhancement level, then releases the enhancement bricks (0x00439100)', () => {
    // Arrange
    const step = createHolding(BrickKind.PROJECTILE)

    // Act
    const used = usePowerUp(step, CONTEXT, 0, NO_ABILITIES)

    // Assert
    expect(getHeadKind(used)).toBe(PowerUpEffectKind.WAND)
    expect(used.world.racers[0]).toMatchObject({ heldBrickKind: null, enhancementLevel: 0 })
    expect(used.world.enhancementBricks.map((brick) => brick.state)).toEqual([
      BrickState.APPEARING,
      BrickState.APPEARING,
    ])
  })

  it('always fires a grapple for a racer with that ability (+0xd04 0x1000000)', () => {
    // Arrange
    const step = createHolding(BrickKind.HAZARD)

    // Act
    const used = usePowerUp(step, CONTEXT, 0, { ...NO_ABILITIES, isAlwaysGrapple: true })

    // Assert
    expect(getHeadKind(used)).toBe(PowerUpEffectKind.GRAPPLE)
  })

  it('spends a turbo brick below level 3 without effect for a permanent-turbo racer (+0xd04 0x8000000)', () => {
    // Arrange
    const step = createHolding(BrickKind.TURBO)

    // Act
    const used = usePowerUp(step, CONTEXT, 0, { ...NO_ABILITIES, isPermanentTurbo: true })

    // Assert
    expect(used.world.effects.activeEffectIds).toEqual([])
    expect(used.world.racers[0]?.heldBrickKind).toBeNull()
  })

  it('taunts before a shield or hazard and uses level 3 for that ability (+0xd04 0x2000000)', () => {
    // Arrange
    const step = createHolding(BrickKind.HAZARD)

    // Act
    const used = usePowerUp(step, CONTEXT, 0, { ...NO_ABILITIES, isAlwaysLevelThree: true })

    // Assert
    expect(getHeadKind(used)).toBe(PowerUpEffectKind.CURSE)
    expect(used.events.at(-1)).toEqual({ type: 'power_ups.voice', racer: 0, sound: 6 })
  })
})
