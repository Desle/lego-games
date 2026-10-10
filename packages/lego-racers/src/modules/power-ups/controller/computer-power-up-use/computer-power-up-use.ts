import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import { COMPUTER_PROJECTILE_WINDOW, getNearestInCone } from '../../types/cone-query/cone-query.ts'
import type {
  BrickKind as BrickKindValue,
  ComputerPowerUpPersonality,
  RacerPowerUpAbilities,
  RacerPowerUps,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import { activatePowerUp } from '../activate-power-up/activate-power-up.ts'
import { getRacer, getStepWithRacer } from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import { usePowerUp } from '../use-power-up/use-power-up.ts'

// 0x96 in 0x004377f0 and 0x3e8 in 0x00438f20.
const USE_CHECK_INTERVAL_MILLISECONDS = 150
const USE_CHECK_DELAY_MILLISECONDS = 1000
// 0x14 in 0x00438f20: with 20 or more attachment slots used the computer waits.
const MAXIMUM_ATTACHMENTS_FOR_USE = 20
const TURBO_LEVEL_TWO = 2

const getStatus = (context: PowerUpContext, racer: number): RacerPowerUpStatus => {
  const status = context.racers[racer]
  if (status === undefined) throw new RangeError(`No racer status at index ${String(racer)}`)
  return status
}

const getUseChance = (personality: ComputerPowerUpPersonality, kind: BrickKindValue): number => {
  if (kind === BrickKind.PROJECTILE) return personality.projectileUseChance
  if (kind === BrickKind.SHIELD) return personality.shieldUseChance
  if (kind === BrickKind.TURBO) return personality.turboUseChance
  return personality.hazardUseChance
}

const getDelayed = (step: PowerUpStep, racerIndex: number, racer: RacerPowerUps): PowerUpStep =>
  getStepWithRacer(step, racerIndex, {
    ...racer,
    useCheckIntervalMilliseconds: USE_CHECK_DELAY_MILLISECONDS,
  })

// 0x00438f20: the computer's decision for the brick it holds.
const decideComputerPowerUpUse = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number,
  personality: ComputerPowerUpPersonality,
  abilities: RacerPowerUpAbilities
): PowerUpStep => {
  const racer = getRacer(step, racerIndex)
  const kind = racer.heldBrickKind
  if (kind === null) return step
  if (step.world.effects.attachmentSlots.usedCount >= MAXIMUM_ATTACHMENTS_FOR_USE) {
    return getDelayed(step, racerIndex, racer)
  }
  if (personality.preferredKind === kind && racer.enhancementLevel < personality.preferredLevel) {
    return getDelayed(step, racerIndex, racer)
  }
  const status = getStatus(context, racerIndex)
  if (kind === BrickKind.PROJECTILE) {
    const target = getNearestInCone(context.arithmetic, {
      origin: status.position,
      direction: status.forward,
      window: COMPUTER_PROJECTILE_WINDOW,
      targets: context.racers,
    })
    if (target < 0) return step
  }
  // MOV AL, byte ptr [table]; CMP AX, chance: only the low byte of the table value counts.
  const draw = step.world.random.drawNext()
  const drawn = Object.freeze({
    ...step,
    world: Object.freeze({ ...step.world, random: draw.random }),
  })
  if ((draw.value & 0xff) >= getUseChance(personality, kind))
    return getDelayed(drawn, racerIndex, racer)
  if (kind === BrickKind.TURBO) {
    if (status.isWarpWithheld && racer.enhancementLevel === 3) return drawn
    if (status.isAirborne) return drawn
  }
  return usePowerUp(drawn, context, racerIndex, abilities)
}

// The use check in the racer step 0x004377f0: every 150 ms (or the delay set above) a computer racer decides.
export const advanceComputerPowerUpUse = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number,
  personality: ComputerPowerUpPersonality,
  abilities: RacerPowerUpAbilities,
  stepMilliseconds: number
): PowerUpStep => {
  const racer = getRacer(step, racerIndex)
  const elapsedMilliseconds = (racer.useCheckElapsedMilliseconds + stepMilliseconds) >>> 0
  if (racer.useCheckIntervalMilliseconds >= elapsedMilliseconds) {
    return getStepWithRacer(step, racerIndex, {
      ...racer,
      useCheckElapsedMilliseconds: elapsedMilliseconds,
    })
  }
  const reset = getStepWithRacer(step, racerIndex, {
    ...racer,
    useCheckElapsedMilliseconds: 0,
    useCheckIntervalMilliseconds: USE_CHECK_INTERVAL_MILLISECONDS,
  })
  if (!getStatus(context, racerIndex).isComputer || racer.heldBrickKind === null) return reset
  return decideComputerPowerUpUse(reset, context, racerIndex, personality, abilities)
}

// The end of 0x004377f0: a racer with the permanent turbo (+0xd04 0x8000000) starts a level-2 turbo while not tumbling.
export const keepPermanentTurbo = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number,
  abilities: RacerPowerUpAbilities
): PowerUpStep =>
  abilities.isPermanentTurbo && !getStatus(context, racerIndex).isTumbling
    ? activatePowerUp(step, context, racerIndex, {
        category: BrickKind.TURBO,
        level: TURBO_LEVEL_TWO,
      })
    : step
