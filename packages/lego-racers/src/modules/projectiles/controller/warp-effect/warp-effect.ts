import {
  EffectState,
  getEffect,
  getStepWithEffect,
  updatePowerUpEffect,
} from '../../../power-ups/index.ts'
import type { PowerUpEffect, PowerUpStep, WarpDestination } from '../../../power-ups/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
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

// 0x0045d780: the carry starts at the node after the racer's checkpoint (`route[checkpoint + 0x20]`); a racer with no
// checkpoint starts at the first node.
const getNextRouteNodeIndex = (
  context: ProjectileContext,
  routeNodeIndex: number | null
): number | null =>
  routeNodeIndex === null ? null : (context.route[routeNodeIndex]?.nextIndex ?? null)

// 0x004b1aa8: 1 / 1500, the share of the carry a launcher's warp has left per millisecond.
const DESTINATION_RATE = getFloatFromBits(0x3a2ec33e)

// 0x0045d780's second branch: the racer moves from where it was towards the launcher's destination as the time runs
// out. The z of the carry subtracts from the destination's x, not its z (0x0045d7f0: `+0xc0` is read where `+0xc8`
// belongs).
export const getDestinationCarryPosition = (
  arithmetic: FloatArithmetic,
  warp: WarpDestination,
  timerMilliseconds: number
): Vector3 | null => {
  const { subtract, multiply, storeFloat } = arithmetic
  const { destination, start } = warp
  if (start === null) return null
  const share = multiply(timerMilliseconds, DESTINATION_RATE)
  return Object.freeze({
    x: storeFloat(subtract(destination.x, multiply(subtract(destination.x, start.x), share))),
    y: storeFloat(subtract(destination.y, multiply(subtract(destination.y, start.y), share))),
    z: storeFloat(subtract(destination.x, multiply(subtract(destination.z, start.z), share))),
  })
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
  const isCarried =
    before.state === EffectState.ACTIVE && before.ownerRacer !== null && racer?.isComputer !== true
  const isLauncherCarried =
    before.state === EffectState.ACTIVE &&
    before.ownerRacer !== null &&
    before.warpDestination !== null
  const carried: Vector3 | null = isLauncherCarried
    ? getDestinationCarryPosition(arithmetic, before.warpDestination, before.timerMilliseconds)
    : isCarried && racer !== undefined
      ? getPointMovedAlongRoute(
          arithmetic,
          context.route,
          racer.position,
          arithmetic.storeFloat(arithmetic.multiply(stepMilliseconds, WARP_UNITS_PER_MILLISECOND)),
          getNextRouteNodeIndex(context, racer.routeNodeIndex)
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
            // 0x0045e080 starts from the destination of a launcher's warp (+0xc0), else from where the racer is.
            position: getWarpLandingPosition(
              arithmetic,
              before.warpDestination?.destination ?? carried ?? racer.position,
              context.powerUps.getGroundPoint
            ),
            forward:
              before.warpDestination?.forward ?? getLandingForward(context, racer.routeNodeIndex),
            speed: LANDING_SPEED,
          },
        ]
      : []
  // 0x0045dc90 state 2 remembers where the racer was (+0xb4) when the carry to a launcher's destination begins.
  const started =
    before.state === EffectState.STARTING &&
    after.state === EffectState.ACTIVE &&
    before.warpDestination !== null &&
    racer !== undefined
      ? getStepWithEffect(counted, {
          ...after,
          warpDestination: Object.freeze({ ...before.warpDestination, start: racer.position }),
        })
      : counted
  return Object.freeze({
    step: started,
    world: getWorldWithEvents(world, [...movedEvents, ...landing]),
  })
}
