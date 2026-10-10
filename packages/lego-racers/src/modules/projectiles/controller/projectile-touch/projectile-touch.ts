import { EffectState, getEffect, touchHazardEffect } from '../../../power-ups/index.ts'
import type { PowerUpStep } from '../../../power-ups/index.ts'
import { touchBallisticFlight } from '../../types/ballistic-flight/ballistic-flight.ts'
import { getIsWithinMagnetCaptureRange } from '../../types/magnet-pull/magnet-pull.ts'
import { getMotion, getWorldWithMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContact,
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'

// 0x00431660 for each racer the collision registry (0x0043d270) pairs with a flying projectile.
export const touchProjectileFlights = (
  world: ProjectileWorld,
  context: ProjectileContext,
  contacts: readonly ProjectileContact[]
): ProjectileWorld =>
  contacts.reduce((current, contact) => {
    const motion = getMotion(current, contact.effect)
    const racer = context.racers[contact.racer]
    if (motion === null || racer === undefined) return current
    if (motion.kind === 'ballistic') {
      return getWorldWithMotion(
        current,
        contact.effect,
        Object.freeze({
          kind: 'ballistic',
          flight: touchBallisticFlight(motion.flight, contact.racer, racer.position),
        })
      )
    }
    if (motion.kind === 'grapple') {
      return getWorldWithMotion(
        current,
        contact.effect,
        Object.freeze({
          kind: 'grapple',
          hook: Object.freeze({
            ...motion.hook,
            flight: touchBallisticFlight(motion.hook.flight, contact.racer, racer.position),
          }),
        })
      )
    }
    if (motion.kind === 'rocket' && motion.homing !== null) {
      return getWorldWithMotion(
        current,
        contact.effect,
        Object.freeze({
          ...motion,
          homing: Object.freeze({
            ...motion.homing,
            flight: touchBallisticFlight(motion.homing.flight, contact.racer, racer.position),
          }),
        })
      )
    }
    return current
  }, world)

// 0x00456320 for each racer touching a hazard, with the magnet's capture range and its candidate racer (0x00455fb0):
// a racer outside the 9 unit range becomes the candidate when there is none; one inside the range clears it when
// the magnet captures it.
export const touchProjectileHazards = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  contacts: readonly ProjectileContact[]
): ProjectileStep =>
  contacts.reduce<ProjectileStep>(
    (current, contact) => {
      const effect = getEffect(current.step, contact.effect)
      const motion = getMotion(current.world, contact.effect)
      const racer = context.racers[contact.racer]
      const status = context.powerUps.racers[contact.racer]
      const magnet = motion !== null && motion.kind === 'magnet' ? motion : null
      const isWithinRange =
        magnet !== null && racer !== undefined
          ? getIsWithinMagnetCaptureRange(context.powerUps.arithmetic, magnet, racer.position)
          : false
      const touched = touchHazardEffect(
        current.step,
        context.powerUps,
        contact.effect,
        contact.racer,
        isWithinRange
      )
      const isReachingMagnetHit =
        contact.racer !== effect.ownerRacer &&
        status !== undefined &&
        !status.isShielded &&
        effect.state !== EffectState.ENDING
      if (magnet === null || !isReachingMagnetHit) {
        return Object.freeze({ step: touched, world: current.world })
      }
      const isCaptured = effect.targetRacer !== null
      const candidateRacer = isWithinRange
        ? isCaptured
          ? magnet.candidateRacer
          : null
        : (magnet.candidateRacer ?? contact.racer)
      return Object.freeze({
        step: touched,
        world: getWorldWithMotion(
          current.world,
          contact.effect,
          Object.freeze({ ...magnet, candidateRacer })
        ),
      })
    },
    Object.freeze({ step, world })
  )
