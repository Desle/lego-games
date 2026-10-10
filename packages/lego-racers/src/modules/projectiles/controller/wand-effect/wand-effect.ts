import {
  EffectState,
  getEffect,
  getNextInCone,
  hitRacerWithProjectile,
  updatePowerUpEffect,
} from '../../../power-ups/index.ts'
import type {
  ConeQuery,
  ConeQueryWindow,
  PowerUpEffect,
  PowerUpStep,
} from '../../../power-ups/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { getWorldWithMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import type { BeamedStep, DrawnBeam } from './wand-effect.types.ts'
import { getRaySphereHit, getWandBeam } from '../../types/wand-beam/wand-beam.ts'
import type { WandBeam } from '../../types/wand-beam/wand-beam.types.ts'

// 0x004b157c, 0x004c7604 (200 squared, set by 0x004547e0 from 50 * 4) and 0x004b1580: the racers a beam can hit are
// 3 to 200 units away, within 60 degrees of the muzzle direction.
const WAND_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 9,
  maximumDistanceSquared: 40000,
  minimumCosine: 0.5,
})

// 0x00455350: every racer in the cone but the owner is tested against the four segments of the beam.
const getStepWithBeamHits = (
  step: PowerUpStep,
  context: ProjectileContext,
  effect: PowerUpEffect,
  beam: WandBeam,
  query: ConeQuery
): PowerUpStep => {
  const { arithmetic } = context.powerUps
  const getIsHit = (racer: number): boolean => {
    const bounds = context.racers[racer]
    if (bounds === undefined) return false
    return beam.points.some(
      (to, index) =>
        getRaySphereHit(arithmetic, beam.points[index - 1] ?? beam.origin, to, {
          center: bounds.boundingCenter,
          radius: bounds.boundingRadius,
        }) !== null
    )
  }
  let current = step
  for (
    let candidate = getNextInCone(arithmetic, query, -1);
    candidate !== -1;
    candidate = getNextInCone(arithmetic, query, candidate)
  ) {
    if (candidate !== effect.ownerRacer && getIsHit(candidate)) {
      current = hitRacerWithProjectile(
        current,
        context.powerUps,
        effect.id,
        candidate,
        ZERO_VECTOR3
      )
    }
  }
  return current
}

// 0x00454d70 (wand vtable slot 2) from 0x00455100 on: between the hold and the sparks the beam is drawn, and while
// it holds no racer it is tested against the racers in front of the muzzle.
const getStepWithBeam = (
  step: PowerUpStep,
  context: ProjectileContext,
  effectId: number
): BeamedStep => {
  const effect = getEffect(step, effectId)
  const owner = effect.ownerRacer === null ? undefined : context.racers[effect.ownerRacer]
  if (owner === undefined) return { step, beam: null }
  const struck = effect.targetRacer === null ? undefined : context.racers[effect.targetRacer]
  const beam = getWandBeam(context.powerUps.arithmetic, context.probe, {
    muzzlePosition: owner.muzzlePosition,
    muzzleDirection: owner.muzzleDirection,
    isStarting: effect.state === EffectState.STARTING,
    isEnding: effect.state === EffectState.ENDING,
    timerMilliseconds: effect.timerMilliseconds,
    struck: struck === undefined ? null : { center: struck.position, radius: struck.beamRadius },
  })
  if (effect.targetRacer !== null) return { step, beam }
  return {
    step: getStepWithBeamHits(step, context, effect, beam, {
      origin: beam.origin,
      direction: owner.muzzleDirection,
      window: WAND_WINDOW,
      targets: context.racers.map((racer) => ({ position: racer.position })),
    }),
    beam,
  }
}

export const updateWand = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  const drawn: DrawnBeam = { beam: null }
  const updated = updatePowerUpEffect(
    step,
    context.powerUps,
    before.id,
    stepMilliseconds,
    (held) => {
      const result = getStepWithBeam(held, context, before.id)
      drawn.beam = result.beam
      return result.step
    }
  )
  const { beam } = drawn
  return Object.freeze({
    step: updated,
    world:
      beam === null
        ? world
        : getWorldWithMotion(world, before.id, Object.freeze({ kind: 'wand', beam })),
  })
}
