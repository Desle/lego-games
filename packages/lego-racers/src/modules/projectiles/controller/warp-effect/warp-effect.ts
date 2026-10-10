import { EffectState, getEffect, updatePowerUpEffect } from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep } from '../../../power-ups/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { ProjectileEvent } from '../../types/projectile-event/projectile-event.types.ts'
import { getWorldWithEvents } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import {
  getPointMovedAlongRoute,
  getWarpLandingPosition,
  LANDING_SPEED,
  WARP_UNITS_PER_MILLISECOND,
} from '../../types/route-movement/route-movement.ts'

// 0x0045dc90 state 3: the racer faces along the route; without a route node it faces +x.
const FORWARD_WITHOUT_ROUTE: Vector3 = Object.freeze({ x: 1, y: 0, z: 0 })

const getLandingForward = (context: ProjectileContext, routeNodeIndex: number | null): Vector3 => {
  const node = routeNodeIndex === null ? undefined : context.route[routeNodeIndex]
  const next = node === undefined ? undefined : context.route[node.nextIndex]
  return next === undefined
    ? FORWARD_WITHOUT_ROUTE
    : Object.freeze({ x: -next.normal.x, y: -next.normal.y, z: -next.normal.z })
}

// 0x0045d780 (warp vtable slot 2): while the racer is off the track (state 3) it is carried 0.6 units per
// millisecond along the route, before the countdown; when the countdown ends the warp (0x0045dc90 state 3) the racer
// is put down 5 above the ground and sent along the route at speed 700.
export const updateWarp = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  if (before.state === EffectState.FINISHED) return Object.freeze({ step, world })
  const racer = before.ownerRacer === null ? undefined : context.racers[before.ownerRacer]
  const { arithmetic } = context.powerUps
  const isCarried = before.state === EffectState.ACTIVE && before.ownerRacer !== null
  const carried: Vector3 | null =
    isCarried && racer !== undefined
      ? getPointMovedAlongRoute(
          arithmetic,
          context.route,
          racer.position,
          arithmetic.storeFloat(arithmetic.multiply(stepMilliseconds, WARP_UNITS_PER_MILLISECOND)),
          racer.routeNodeIndex
        )
      : null
  const movedEvents: readonly ProjectileEvent[] =
    carried === null || before.ownerRacer === null
      ? []
      : [{ type: 'projectiles.racer_moved', racer: before.ownerRacer, position: carried }]
  const counted = updatePowerUpEffect(step, context.powerUps, before.id, stepMilliseconds)
  const after = getEffect(counted, before.id)
  const landing: readonly ProjectileEvent[] =
    before.state === EffectState.ACTIVE &&
    after.state === EffectState.FINISHED &&
    before.ownerRacer !== null &&
    racer !== undefined
      ? [
          {
            type: 'projectiles.racer_landed',
            racer: before.ownerRacer,
            position: getWarpLandingPosition(
              arithmetic,
              carried ?? racer.position,
              context.powerUps.getGroundPoint
            ),
            forward: getLandingForward(context, racer.routeNodeIndex),
            speed: LANDING_SPEED,
          },
        ]
      : []
  return Object.freeze({
    step: counted,
    world: getWorldWithEvents(world, [...movedEvents, ...landing]),
  })
}
