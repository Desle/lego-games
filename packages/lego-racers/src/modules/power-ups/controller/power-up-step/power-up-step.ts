import type { PowerUpEvent } from '../../events/power-up.events.types.ts'
import {
  dropEnhancementBrick,
  releaseEnhancementBrick,
} from '../../types/enhancement-brick/enhancement-brick.ts'
import type { EnhancementBrick, PowerUpEffect, RacerPowerUps } from '../../types/power-ups.types.ts'
import {
  getRacerAfterDrop,
  getRacerAfterRelease,
  getRacerVoice,
} from '../../types/racer-power-ups/racer-power-ups.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import type { PowerUpContext, PowerUpStep, StepDraws } from './power-up-step.types.ts'

export class UnknownIndexError extends Error {
  constructor(what: string, index: number) {
    super(`No ${what} at index ${String(index)}`)
    this.name = 'UnknownIndexError'
  }
}

const getAt = <Item>(items: readonly Item[], index: number, what: string): Item => {
  const item = items[index]
  if (item === undefined) throw new UnknownIndexError(what, index)
  return item
}

const getReplaced = <Item>(items: readonly Item[], index: number, item: Item): readonly Item[] =>
  Object.freeze(items.map((current, currentIndex) => (currentIndex === index ? item : current)))

export const getEffect = (step: PowerUpStep, effectId: number): PowerUpEffect =>
  getAt(step.world.effects.effects, effectId, 'power-up effect')

export const getRacer = (step: PowerUpStep, racerIndex: number): RacerPowerUps =>
  getAt(step.world.racers, racerIndex, 'racer')

export const getStepWithEvents = (
  step: PowerUpStep,
  events: readonly PowerUpEvent[]
): PowerUpStep =>
  events.length === 0
    ? step
    : Object.freeze({ ...step, events: Object.freeze([...step.events, ...events]) })

export const getStepWithEffect = (step: PowerUpStep, effect: PowerUpEffect): PowerUpStep =>
  Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      effects: Object.freeze({
        ...step.world.effects,
        effects: getReplaced(step.world.effects.effects, effect.id, Object.freeze(effect)),
      }),
    }),
  })

export const getStepWithRacer = (
  step: PowerUpStep,
  racerIndex: number,
  racer: RacerPowerUps
): PowerUpStep =>
  Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      racers: getReplaced(step.world.racers, racerIndex, racer),
    }),
  })

export const getStepWithEnhancementBrick = (
  step: PowerUpStep,
  brickIndex: number,
  brick: EnhancementBrick
): PowerUpStep => {
  getAt(step.world.enhancementBricks, brickIndex, 'enhancement brick')
  return Object.freeze({
    ...step,
    world: Object.freeze({
      ...step.world,
      enhancementBricks: getReplaced(step.world.enhancementBricks, brickIndex, brick),
    }),
  })
}

// Plain table reads (0x004c6ee4 advanced before each read), returning the values in order.
export const getStepDraws = (step: PowerUpStep, count: number): StepDraws => {
  const values: number[] = []
  let position = step.world.random.position
  for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
    const draw = drawRandomValue(step.world.random.table, position)
    position = draw.position
    values.push(draw.value)
  }
  return Object.freeze({
    step: Object.freeze({
      ...step,
      world: Object.freeze({
        ...step.world,
        random: Object.freeze({ table: step.world.random.table, position }),
      }),
    }),
    values: Object.freeze(values),
  })
}

// 0x00439240 applied to the world: one random draw for the sound and one for the cooldown.
export const getStepWithVoice = (
  step: PowerUpStep,
  racerIndex: number,
  isTaunt: boolean
): PowerUpStep => {
  const voice = getRacerVoice(getRacer(step, racerIndex), step.world.random, isTaunt)
  const withRacer = getStepWithRacer(
    Object.freeze({ ...step, world: Object.freeze({ ...step.world, random: voice.random }) }),
    racerIndex,
    voice.racer
  )
  return voice.voiceSound === null
    ? withRacer
    : getStepWithEvents(withRacer, [
        { type: 'power_ups.voice', racer: racerIndex, sound: voice.voiceSound },
      ])
}

// 0x0043a270: sound 1, 0x46 or 0x47 by table % 3.
export const getStepWithShieldStruck = (step: PowerUpStep, racerIndex: number): PowerUpStep => {
  const draw = getStepDraws(step, 1)
  const remainder = (draw.values[0] ?? 0) % 3
  const sound = remainder === 1 ? 0x46 : remainder === 2 ? 0x47 : 1
  return getStepWithEvents(draw.step, [
    { type: 'power_ups.racer_shield_struck', racer: racerIndex, sound },
  ])
}

// 0x00439490: the hit racer drops its first enhancement brick where it is.
export const getStepWithDroppedEnhancement = (
  step: PowerUpStep,
  context: PowerUpContext,
  racerIndex: number
): PowerUpStep => {
  const drop = getRacerAfterDrop(getRacer(step, racerIndex))
  const withRacer = getStepWithRacer(step, racerIndex, drop.racer)
  if (drop.droppedBrickIndex === null) return withRacer
  const brick = getAt(step.world.enhancementBricks, drop.droppedBrickIndex, 'enhancement brick')
  const position = getAt(context.racers, racerIndex, 'racer status').position
  return getStepWithEnhancementBrick(
    withRacer,
    drop.droppedBrickIndex,
    dropEnhancementBrick(context.arithmetic, brick, position, context.getGroundPoint)
  )
}

// 0x00439520: every collected enhancement brick goes back to the track.
export const getStepWithReleasedEnhancements = (
  step: PowerUpStep,
  racerIndex: number
): PowerUpStep => {
  const release = getRacerAfterRelease(getRacer(step, racerIndex))
  return release.releasedBrickIndices.reduce(
    (current, brickIndex) =>
      getStepWithEnhancementBrick(
        current,
        brickIndex,
        releaseEnhancementBrick(
          getAt(current.world.enhancementBricks, brickIndex, 'enhancement brick')
        )
      ),
    getStepWithRacer(step, racerIndex, release.racer)
  )
}
