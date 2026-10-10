import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import { PowerUpEffectKind } from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type {
  ComputerPowerUpPersonality,
  RacerPowerUpAbilities,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import { getRacerWithBrick } from '../../types/racer-power-ups/racer-power-ups.ts'
import { getStepWithRacer } from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import { createPowerUpWorld } from '../power-up-world/power-up-world.ts'
import {
  advanceComputerPowerUpUse,
  keepPermanentTurbo,
  rollComputerStartTurbo,
} from './computer-power-up-use.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_ABILITIES: RacerPowerUpAbilities = {
  isAlwaysGrapple: false,
  isAlwaysLevelThree: false,
  isPermanentTurbo: false,
}

const createPersonality = (chance: number): ComputerPowerUpPersonality => ({
  chances: { chances: [chance, chance, chance, chance], combinedChance: 0 },
  preferredKind: null,
  preferredLevel: 0,
})

const COMPUTER: RacerPowerUpStatus = {
  position: { x: 0, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  isComputer: true,
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
  racers: [COMPUTER],
  raceModeFlags: 0,
  getGroundPoint: () => null,
  trackTargets: [],
}

// Every table value is 100 (low byte 100).
const createStep = (): PowerUpStep => {
  const step = createPowerUpWorld({
    bricks: [],
    enhancementBricks: [],
    raceModeFlags: 0,
    isSplitScreen: true,
    racers: [{ voiceSoundBase: 0, voiceCooldownMilliseconds: 0 }],
    random: { table: createRandomTable(Array.from({ length: 1024 }, () => 100)), position: 0 },
  })
  const racer = step.world.racers[0]
  if (racer === undefined) throw new Error('no racer')
  return getStepWithRacer(step, 0, getRacerWithBrick(racer, BrickKind.SHIELD))
}

describe('advanceComputerPowerUpUse', () => {
  it('waits for the 300 ms set at pickup, then uses the brick when the draw is below the chance', () => {
    // Arrange
    const step = createStep()

    // Act
    const early = advanceComputerPowerUpUse(
      step,
      CONTEXT,
      0,
      createPersonality(101),
      NO_ABILITIES,
      300
    )
    const used = advanceComputerPowerUpUse(
      early,
      CONTEXT,
      0,
      createPersonality(101),
      NO_ABILITIES,
      1
    )

    // Assert
    expect(early.world.effects.activeEffectIds).toEqual([])
    expect(used.world.racers[0]?.heldBrickKind).toBeNull()
    expect(used.world.effects.effects[used.world.effects.activeEffectIds[0] ?? -1]?.kind).toBe(
      PowerUpEffectKind.SHIELD
    )
  })

  it('waits 1000 ms when the draw is not below the chance (racer-ai 0x00438f20)', () => {
    // Arrange
    const step = createStep()

    // Act
    const kept = advanceComputerPowerUpUse(
      step,
      CONTEXT,
      0,
      createPersonality(100),
      NO_ABILITIES,
      301
    )

    // Assert
    expect(kept.world.racers[0]?.useCheckIntervalMilliseconds).toBe(1000)
    expect(kept.world.racers[0]?.heldBrickKind).toBe(BrickKind.SHIELD)
  })
})

describe('rollComputerStartTurbo', () => {
  it('starts a level-0 turbo when the low byte is below the turbo chance (0x00439340)', () => {
    // Arrange
    const step = createStep()

    // Act
    const rolled = rollComputerStartTurbo(step, CONTEXT, 0, createPersonality(101))
    const missed = rollComputerStartTurbo(step, CONTEXT, 0, createPersonality(100))

    // Assert
    expect(rolled.events[0]).toMatchObject({ type: 'power_ups.racer_turbo_started', level: 0 })
    expect(missed.events).toEqual([])
    expect(missed.world.random.position).toBe(step.world.random.position + 1)
  })
})

describe('keepPermanentTurbo', () => {
  it('starts a level-2 turbo each step while the racer is not tumbling', () => {
    // Arrange
    const step = createStep()

    // Act
    const kept = keepPermanentTurbo(step, CONTEXT, 0, { ...NO_ABILITIES, isPermanentTurbo: true })

    // Assert
    expect(kept.events[0]).toMatchObject({ type: 'power_ups.racer_turbo_started', level: 2 })
  })
})
