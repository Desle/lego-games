import { NO_EMITTER_POOLS } from '../../../emitter/index.ts'
import { getIsBrickCollectable, getTouchedBrick } from '../../types/brick-base/brick-base.ts'
import {
  advanceEnhancementBrick,
  collectEnhancementBrick,
  createEnhancementBrick,
} from '../../types/enhancement-brick/enhancement-brick.ts'
import {
  advancePowerUpBrick,
  createPowerUpBrick,
  touchPowerUpBrick,
} from '../../types/power-up-brick/power-up-brick.ts'
import type { BrickContact } from '../../types/power-ups.types.ts'
import {
  createRacerPowerUps,
  getRacerWithEnhancement,
} from '../../types/racer-power-ups/racer-power-ups.ts'
import {
  getStepWithInitialWandDraws,
  updatePowerUpEffects,
} from '../power-up-effect-timeline/power-up-effect-timeline.ts'
import {
  createPowerUpEffects,
  recyclePowerUpEffects,
} from '../power-up-effects/power-up-effects.ts'
import {
  getRacer,
  getStepWithEnhancementBrick,
  getStepWithEvents,
  getStepWithRacer,
} from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import type { EffectsUpdater, PowerUpWorldDefinition } from './power-up-world.types.ts'

// 0x004b1874 and 0x004b1878 in 0x0045a490.
const SPIN_RADIANS_PER_MILLISECOND = Math.fround(0.004)
const FULL_TURN = Math.fround(2 * Math.PI)

// PowerUps_Load 0x00458810, the pools 0x00457cf0 and their set-up 0x00458940.
export const createPowerUpWorld = (definition: PowerUpWorldDefinition): PowerUpStep =>
  getStepWithInitialWandDraws(
    Object.freeze({
      world: Object.freeze({
        bricks: Object.freeze(
          definition.bricks.map((placement) =>
            createPowerUpBrick(placement, definition.raceModeFlags)
          )
        ),
        enhancementBricks: Object.freeze(definition.enhancementBricks.map(createEnhancementBrick)),
        racers: Object.freeze(
          definition.racers.map((racer) =>
            createRacerPowerUps(racer.voiceSoundBase, racer.voiceCooldownMilliseconds)
          )
        ),
        effects: createPowerUpEffects(definition.isSplitScreen),
        brickSpinAngle: 0,
        random: definition.random,
        emitters: NO_EMITTER_POOLS,
      }),
      events: Object.freeze([]),
    })
  )

// 0x0045b900 (race state 2) and 0x0045b950 (after loading): bricks play sounds only once the race is on.
export const setBrickSoundsEnabled = (step: PowerUpStep, isSoundEnabled: boolean): PowerUpStep =>
  Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      bricks: Object.freeze(
        step.world.bricks.map((brick) => Object.freeze({ ...brick, isSoundEnabled }))
      ),
      enhancementBricks: Object.freeze(
        step.world.enhancementBricks.map((brick) => Object.freeze({ ...brick, isSoundEnabled }))
      ),
    }),
  })

// PowerUps_Update 0x0045a490 with the frame's whole time step (not the 40 ms physics pieces).
export const updatePowerUps = (
  step: PowerUpStep,
  context: PowerUpContext,
  stepMilliseconds: number,
  updateEffects: EffectsUpdater = updatePowerUpEffects
): PowerUpStep => {
  const { add, subtract, multiply, storeFloat, getIsBelowOrEqual } = context.arithmetic
  const spin = add(
    multiply(stepMilliseconds | 0, SPIN_RADIANS_PER_MILLISECOND),
    step.world.brickSpinAngle
  )
  const brickSpinAngle = getIsBelowOrEqual(spin, FULL_TURN)
    ? storeFloat(spin)
    : storeFloat(subtract(spin, FULL_TURN))
  const bricksUpdated = Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      bricks: Object.freeze(
        step.world.bricks.map((brick) =>
          advancePowerUpBrick(context.arithmetic, brick, stepMilliseconds)
        )
      ),
      enhancementBricks: Object.freeze(
        step.world.enhancementBricks.map((brick) =>
          advanceEnhancementBrick(context.arithmetic, brick, stepMilliseconds)
        )
      ),
      brickSpinAngle,
    }),
  })
  return recyclePowerUpEffects(updateEffects(bricksUpdated, context, stepMilliseconds))
}

const getStatusIsWarping = (context: PowerUpContext, racer: number): boolean => {
  const status = context.racers[racer]
  if (status === undefined) throw new RangeError(`No racer status at index ${String(racer)}`)
  return status.isWarping
}

// 0x00453af0 → 0x00457820 for each racer touching a coloured brick, in the collision registry's order.
export const touchPowerUpBricks = (
  step: PowerUpStep,
  context: PowerUpContext,
  contacts: readonly BrickContact[]
): PowerUpStep =>
  contacts.reduce((current, contact) => {
    const brick = current.world.bricks[contact.brick]
    if (brick === undefined)
      throw new RangeError(`No power-up brick at index ${String(contact.brick)}`)
    const touch = touchPowerUpBrick(
      brick,
      getRacer(current, contact.racer),
      getStatusIsWarping(context, contact.racer)
    )
    const withRacer = getStepWithRacer(current, contact.racer, touch.racer)
    return Object.freeze({
      ...withRacer,
      world: Object.freeze({
        ...withRacer.world,
        bricks: Object.freeze(
          withRacer.world.bricks.map((candidate, index) =>
            index === contact.brick ? touch.brick : candidate
          )
        ),
      }),
    })
  }, step)

// 0x00453af0 → 0x00453750 → 0x00439420 for each racer touching an enhancement brick.
export const touchEnhancementBricks = (
  step: PowerUpStep,
  context: PowerUpContext,
  contacts: readonly BrickContact[]
): PowerUpStep =>
  contacts.reduce((current, contact) => {
    const brick = current.world.enhancementBricks[contact.brick]
    if (brick === undefined)
      throw new RangeError(`No enhancement brick at index ${String(contact.brick)}`)
    const racer = getRacer(current, contact.racer)
    const touched = getStepWithEnhancementBrick(current, contact.brick, getTouchedBrick(brick))
    const isCollectable = getIsBrickCollectable(
      brick,
      getStatusIsWarping(context, contact.racer),
      racer.heldBrickKind === null
    )
    if (!isCollectable) return touched
    const collect = getRacerWithEnhancement(racer, current.world.random, contact.brick)
    if (!collect.isAccepted) return touched
    const withRacer = getStepWithRacer(
      Object.freeze({
        ...touched,
        world: Object.freeze({ ...touched.world, random: collect.random }),
      }),
      contact.racer,
      collect.racer
    )
    const collected = getStepWithEnhancementBrick(
      withRacer,
      contact.brick,
      collectEnhancementBrick(getTouchedBrick(brick))
    )
    return collect.voiceSound === null
      ? collected
      : getStepWithEvents(collected, [
          { type: 'power_ups.voice', racer: contact.racer, sound: collect.voiceSound },
        ])
  }, step)
