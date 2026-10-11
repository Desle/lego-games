import { getBoundingInterval } from '../../../racer-collision/index.ts'
import type { BoundingSphere } from '../../../racer-collision/index.ts'
import type { RegistryEntry } from '../../../projectiles/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { TriggerList } from '../../../trigger/index.ts'
import { getProjectileRegistrySphere } from '../projectile-registry/projectile-registry.ts'
import type { RegistryObject, RegistrySource } from '../../types/race.types.ts'

// 0x004653f0: the flags a trigger registers with (1, or 9 when its flag 0x4 skips computer racers).
const TRIGGER_KEEPS_FLAG = 0x1
const TRIGGER_SKIPS_COMPUTERS_FLAG = 0x8
// 0x0045a340: the bricks register with 4, 1, 0, 0.
const BRICK_FLAGS = 0x1

// Race_LoadTrackContent registers, in this order, the main triggers (0x00463dc0, those without the flag 0x1000, which
// register with type 2 and are not touched by racers), the environment triggers (0x00464ff0) and then the power-up
// bricks and the enhancement bricks (0x0045a340). Every registration is prepended (0x0043d1b0), so the list starts
// with the last one.
export const createRegistryObjects = (
  mainTriggers: TriggerList | null,
  environmentTriggers: TriggerList | null,
  powerUpBrickCount: number,
  enhancementBrickCount: number
): readonly RegistryObject[] => {
  const main = (mainTriggers?.triggers ?? []).flatMap((trigger, index): RegistryObject[] =>
    trigger.isFlag1000Set ? [] : [{ type: 'main_trigger', index }]
  )
  const environment = (environmentTriggers?.triggers ?? []).map(
    (_trigger, index): RegistryObject => ({ type: 'environment_trigger', index })
  )
  const bricks = Array.from({ length: powerUpBrickCount }, (_, index): RegistryObject => ({
    type: 'power_up_brick',
    index,
  }))
  const enhancements = Array.from(
    { length: enhancementBrickCount },
    (_, index): RegistryObject => ({ type: 'enhancement_brick', index })
  )
  return Object.freeze([...main, ...environment, ...bricks, ...enhancements])
}

const getRegistryFlags = (source: RegistrySource, object: RegistryObject): number => {
  if (object.type === 'main_trigger' || object.type === 'environment_trigger') {
    const { triggers } = source.trackLogic
    const trigger = (object.type === 'main_trigger' ? triggers.main : triggers.environment)[
      object.index
    ]
    return trigger?.definition.isFlag4Set === true
      ? TRIGGER_KEEPS_FLAG | TRIGGER_SKIPS_COMPUTERS_FLAG
      : TRIGGER_KEEPS_FLAG
  }
  return BRICK_FLAGS
}

// The volume of a registered object: a trigger's sphere (0x00464e80 and 0x00463b60 give its radius), or a brick, a
// sphere of radius 0 at its position (0x004539b0).
export const getRegistrySphere = (
  source: RegistrySource,
  object: RegistryObject
): BoundingSphere => {
  const origin = Object.freeze({ x: 0, y: 0, z: 0 })
  if (object.type === 'main_trigger' || object.type === 'environment_trigger') {
    const { triggers } = source.trackLogic
    const trigger = (object.type === 'main_trigger' ? triggers.main : triggers.environment)[
      object.index
    ]
    if (trigger === undefined) return { centre: origin, radius: 0 }
    const [x, y, z] = trigger.definition.position
    return { centre: Object.freeze({ x, y, z }), radius: trigger.definition.radius }
  }
  if (
    object.type === 'effect_flight' ||
    object.type === 'effect_hazard' ||
    object.type === 'explosion'
  ) {
    return getProjectileRegistrySphere(source, object)
  }
  const { world } = source.powerUpStep
  const brick = (object.type === 'power_up_brick' ? world.bricks : world.enhancementBricks)[
    object.index
  ]
  return { centre: brick?.position ?? origin, radius: 0 }
}

// The registry's entries for the objects, in list order, with the extents along x that the sort and the walk read.
// A call keeps its counts between passes; only the extents are read again (a dropped enhancement brick moves).
export const getRegistryEntries = (
  arithmetic: FloatArithmetic,
  source: RegistrySource,
  previous: readonly RegistryEntry[]
): readonly RegistryEntry[] => {
  const entryOf = (id: number): RegistryEntry => {
    const object = source.registryObjects[id]
    if (object === undefined) throw new RangeError(`No registry object ${String(id)}`)
    const interval = getBoundingInterval(arithmetic, getRegistrySphere(source, object))
    const known = previous.find((entry) => entry.id === id)
    return Object.freeze({
      id,
      flags: getRegistryFlags(source, object),
      maximumCalls: 0,
      interval: 0,
      calls: known?.calls ?? 0,
      ticks: known?.ticks ?? 0,
      isActive: known?.isActive ?? true,
      minimumExtent: interval.minimum,
      maximumExtent: interval.maximum,
    })
  }
  const ids =
    previous.length === 0
      ? source.registryObjects.map((_object, id) => id).reverse()
      : previous.map((entry) => entry.id)
  return Object.freeze(ids.map(entryOf))
}
