import { drawRandomLowByte } from '../../../random-table/index.ts'
import {
  findNearestRacerInCone,
  POWER_UP_TARGET_MAXIMUM_DISTANCE_SQUARED,
  POWER_UP_TARGET_MINIMUM_COSINE,
  POWER_UP_TARGET_MINIMUM_DISTANCE_SQUARED,
  PowerUpUseDecision,
  updatePowerUpUse,
} from '../../../racer-ai/index.ts'
import { BrickKind, getBrickKindCode } from '../../types/brick-kind/brick-kind.ts'
import type {
  ComputerPowerUpPersonality,
  RacerPowerUpAbilities,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import { activatePowerUp } from '../activate-power-up/activate-power-up.ts'
import { getRacer, getStepWithRacer } from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import { usePowerUp } from '../use-power-up/use-power-up.ts'

const TURBO_LEVEL_TWO = 2
// Racer +0xd04 0x1000 and car body +0x6c0 0x2, as racer-ai's decision reads them.
const WARP_WITHHELD_FLAG = 0x1000
const AIRBORNE_FLAG = 0x2
// Personality index of the turbo chance (racer +0xd1e), as racer-ai's ComputerPersonality orders them.
const TURBO_CHANCE_INDEX = 2

const getStatus = (context: PowerUpContext, racer: number): RacerPowerUpStatus => {
  const status = context.racers[racer]
  if (status === undefined) throw new RangeError(`No racer status at index ${String(racer)}`)
  return status
}

// 0x004377f0's use check and the decision 0x00438f20 (both ported by racer-ai), then 0x00439100 on a use.
export const advanceComputerPowerUpUse = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number,
  personality: ComputerPowerUpPersonality,
  abilities: RacerPowerUpAbilities,
  stepMilliseconds: number
): PowerUpStep => {
  const racer = getRacer(step, racerIndex)
  const status = getStatus(context, racerIndex)
  const isTargetAhead =
    findNearestRacerInCone(context.arithmetic, {
      racerPositions: context.racers.map((candidate) => candidate.position),
      origin: status.position,
      direction: status.forward,
      minimumDistanceSquared: POWER_UP_TARGET_MINIMUM_DISTANCE_SQUARED,
      maximumDistanceSquared: POWER_UP_TARGET_MAXIMUM_DISTANCE_SQUARED,
      minimumCosine: POWER_UP_TARGET_MINIMUM_COSINE,
    }) !== null
  const update = updatePowerUpUse(
    step.world.random.table,
    step.world.random.position,
    {
      elapsedMilliseconds: racer.useCheckElapsedMilliseconds,
      intervalMilliseconds: racer.useCheckIntervalMilliseconds,
    },
    stepMilliseconds,
    status.isComputer,
    {
      heldPowerUp: racer.heldBrickKind === null ? 0 : getBrickKindCode(racer.heldBrickKind),
      preferredPowerUp:
        personality.preferredKind === null ? 0 : getBrickKindCode(personality.preferredKind),
      preferredLevel: personality.preferredLevel,
      powerUpLevel: racer.enhancementLevel,
      personality: personality.chances,
      activePowerUpCount: step.world.effects.attachmentSlots.usedCount,
      racerFlags: status.isWarpWithheld ? WARP_WITHHELD_FLAG : 0,
      carBodyFlags: status.isAirborne ? AIRBORNE_FLAG : 0,
      isTargetAhead,
    }
  )
  const scheduled = getStepWithRacer(
    Object.freeze({
      ...step,
      world: Object.freeze({
        ...step.world,
        random: Object.freeze({ table: step.world.random.table, position: update.position }),
      }),
    }),
    racerIndex,
    {
      ...racer,
      useCheckElapsedMilliseconds: update.schedule.elapsedMilliseconds,
      useCheckIntervalMilliseconds: update.schedule.intervalMilliseconds,
    }
  )
  return update.decision === PowerUpUseDecision.USE
    ? usePowerUp(scheduled, context, racerIndex, abilities)
    : scheduled
}

// 0x00439340 (a computer racer's start, from 0x0043ccb0): one low-byte draw below the turbo chance starts a level-0 turbo.
export const rollComputerStartTurbo = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number,
  personality: ComputerPowerUpPersonality
): PowerUpStep => {
  if (!getStatus(context, racerIndex).isComputer) return step
  const draw = drawRandomLowByte(step.world.random.table, step.world.random.position)
  const drawn = Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      random: Object.freeze({ table: step.world.random.table, position: draw.position }),
    }),
  })
  const turboChance = personality.chances.chances[TURBO_CHANCE_INDEX] ?? 0
  return draw.value < turboChance
    ? activatePowerUp(drawn, context, racerIndex, { category: BrickKind.TURBO, level: 0 })
    : drawn
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
