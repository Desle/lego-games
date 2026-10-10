import {
  advancePowerUpEffect,
  EffectState,
  getEffect,
  getNextInCone,
  getStepWithEffect,
} from '../../../power-ups/index.ts'
import type {
  ConeQuery,
  ConeQueryWindow,
  PowerUpEffect,
  PowerUpStep,
} from '../../../power-ups/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import {
  createBallisticFlight,
  launchFlightAtPoint,
  launchFlightAtRacer,
} from '../../types/ballistic-flight/ballistic-flight.ts'
import type {
  BallisticFlight,
  BallisticLaunchParameters,
} from '../../types/ballistic-flight/ballistic-flight.types.ts'
import {
  advanceHomingFlight,
  createHomingFlight,
  getHomingVelocity,
  retargetHomingFlight,
} from '../../types/homing-flight/homing-flight.ts'
import type { HomingFlight, HomingTarget } from '../../types/homing-flight/homing-flight.types.ts'
import { getMotion, getWorldWithMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileStep,
  ProjectileWorld,
  RocketMotion,
} from '../../types/projectile-world/projectile-world.types.ts'
import type { LaunchedRocket } from './rocket-effect.types.ts'
import { resolveExplodingProjectile } from '../ballistic-effects/ballistic-effects.ts'

// 0x004b1684, 0x004b1688, 0x004b168c: the rocket looks for racers 10 to 400 units away, within 45 degrees.
const ROCKET_WINDOW: ConeQueryWindow = Object.freeze({
  minimumDistanceSquared: 100,
  maximumDistanceSquared: 160000,
  minimumCosine: Math.fround(0.7071),
})
// 0x00456681's parameter block: 0x004b1670, 0x004b166c, 0x157c, 0x004b1678.
const ROCKET_PARAMETERS: BallisticLaunchParameters = Object.freeze({
  gravity: Math.fround(-32.176),
  speed: 170,
  targetOffset: ZERO_VECTOR3,
  maximumDurationMilliseconds: 0x157c,
  heightOffset: 4,
})
// 0x004b1674 and 0x004b1654: without a target the rocket aims 500 units ahead and 5 up; 0x004b1680 moves it 150 to
// the side, to the left for rocket 0 and the right for rocket 2.
const AHEAD_DISTANCE = 500
const AHEAD_HEIGHT = 5
const SIDE_DISTANCE = 150
const LEFT_ROCKET = 0
const RIGHT_ROCKET = 2

const getTargets = (context: ProjectileContext): readonly HomingTarget[] =>
  context.racers.map((racer, index) => ({
    position: racer.position,
    isStruckByLightning: context.powerUps.racers[index]?.isStruckByLightning ?? false,
    isShieldedOrWarping:
      (context.powerUps.racers[index]?.isShielded ?? false) ||
      (context.powerUps.racers[index]?.isWarping ?? false),
  }))

// 0x00456680: the point a rocket without a target flies at: 500 ahead of its owner, 5 up, and 150 to the side.
const getRocketPoint = (
  context: ProjectileContext,
  owner: number,
  rocketIndex: number
): Vector3 => {
  const { add, multiply, storeFloat } = context.powerUps.arithmetic
  const status = context.powerUps.racers[owner]
  if (status === undefined) return ZERO_VECTOR3
  const { forward, position } = status
  const ahead = {
    x: storeFloat(add(position.x, multiply(forward.x, AHEAD_DISTANCE))),
    y: storeFloat(add(position.y, storeFloat(multiply(forward.y, AHEAD_DISTANCE)))),
    z: storeFloat(
      add(add(position.z, storeFloat(multiply(forward.z, AHEAD_DISTANCE))), AHEAD_HEIGHT)
    ),
  }
  if (rocketIndex === LEFT_ROCKET) {
    return Object.freeze({
      x: storeFloat(add(multiply(forward.y, SIDE_DISTANCE), ahead.x)),
      y: storeFloat(add(multiply(-forward.x, SIDE_DISTANCE), ahead.y)),
      z: ahead.z,
    })
  }
  if (rocketIndex === RIGHT_ROCKET) {
    return Object.freeze({
      x: storeFloat(add(multiply(-forward.y, SIDE_DISTANCE), ahead.x)),
      y: storeFloat(add(multiply(forward.x, SIDE_DISTANCE), ahead.y)),
      z: ahead.z,
    })
  }
  return Object.freeze(ahead)
}

// 0x00456680: rocket k takes the k-th racer of the cone (0x0043c6e0, then 0x0043c7f0 k times), else a point ahead.
const getRocketTarget = (
  context: ProjectileContext,
  owner: number,
  rocketIndex: number
): number | null => {
  const status = context.powerUps.racers[owner]
  if (status === undefined) return null
  const query: ConeQuery = {
    origin: status.position,
    direction: status.forward,
    window: ROCKET_WINDOW,
    targets: context.racers.map((racer) => ({ position: racer.position })),
  }
  let target = getNextInCone(context.powerUps.arithmetic, query, -1)
  for (let skipped = 0; skipped < rocketIndex && target !== -1; skipped += 1) {
    target = getNextInCone(context.powerUps.arithmetic, query, target)
  }
  return target === -1 ? null : target
}

const getRocketMotion = (world: ProjectileWorld, effectId: number): RocketMotion | null => {
  const motion = getMotion(world, effectId)
  return motion !== null && motion.kind === 'rocket' ? motion : null
}

const getWorldWithRocket = (
  world: ProjectileWorld,
  effectId: number,
  motion: RocketMotion
): ProjectileStep['world'] => getWorldWithMotion(world, effectId, motion)

// 0x00456db0 state 2 (the animation is over): the rocket leaves its owner at the target or the point ahead and starts
// to home (0x00423980).
const getLaunchedRocket = (
  context: ProjectileContext,
  effect: PowerUpEffect,
  owner: number,
  framePosition: Vector3
): LaunchedRocket => {
  const { arithmetic } = context.powerUps
  const ownerRacer = context.racers[owner]
  if (ownerRacer === undefined) throw new RangeError(`No racer at index ${String(owner)}`)
  const targetRacer = getRocketTarget(context, owner, effect.rocketIndex)
  const target = targetRacer === null ? undefined : context.racers[targetRacer]
  const resting: BallisticFlight = Object.freeze({
    ...createBallisticFlight(),
    framePosition,
  })
  const flight =
    targetRacer === null || target === undefined
      ? launchFlightAtPoint(arithmetic, resting, ROCKET_PARAMETERS, {
          shooter: owner,
          shooterRacer: ownerRacer,
          point: getRocketPoint(context, owner, effect.rocketIndex),
          pointVelocity: ZERO_VECTOR3,
          isFromShooter: false,
        })
      : launchFlightAtRacer(arithmetic, resting, ROCKET_PARAMETERS, {
          shooter: owner,
          shooterRacer: ownerRacer,
          target: targetRacer,
          targetRacer: target,
          isFromShooter: false,
          isLeadLimited: false,
        })
  return {
    homing: createHomingFlight(
      arithmetic,
      flight,
      ownerRacer.rocketHeading,
      ownerRacer.routeNodeIndex,
      context.route
    ),
    targetRacer,
  }
}

// The flight of state 3 (0x004568f0): the target is chosen again, the rocket steers and moves, and the result is
// handled like a cannonball's.
const getFlownRocket = (
  current: ProjectileStep,
  context: ProjectileContext,
  effectId: number,
  motion: RocketMotion,
  homing: HomingFlight,
  stepMilliseconds: number
): ProjectileStep => {
  const { arithmetic } = context.powerUps
  const retargeted = retargetHomingFlight(arithmetic, context.probe, homing, stepMilliseconds, {
    targets: getTargets(context),
    route: context.route,
    window: ROCKET_WINDOW,
  })
  const targetRacer = retargeted.flight.targetRacer
  const advance = advanceHomingFlight(
    arithmetic,
    context.probe,
    retargeted,
    stepMilliseconds,
    targetRacer === null ? null : (context.racers[targetRacer]?.position ?? null)
  )
  const resolved = resolveExplodingProjectile(
    current.step,
    context,
    effectId,
    advance.homing.flight,
    advance.result,
    () => getHomingVelocity(advance.homing)
  )
  return Object.freeze({
    step: resolved.step,
    world: getWorldWithRocket(current.world, effectId, {
      ...motion,
      homing: Object.freeze({ ...advance.homing, flight: resolved.flight }),
    }),
  })
}

// 0x004568f0 (rocket vtable slot 2): the launch animation (state 2) follows the owner; when it is over the rocket
// launches and flies in the same update. Rockets do not count down.
export const updateRocket = (
  step: PowerUpStep,
  world: ProjectileWorld,
  context: ProjectileContext,
  before: PowerUpEffect,
  stepMilliseconds: number
): ProjectileStep => {
  if (before.state === EffectState.FINISHED || before.ownerRacer === null) {
    return Object.freeze({ step, world })
  }
  const owner = before.ownerRacer
  const status = context.powerUps.racers[owner]
  const existing = getRocketMotion(world, before.id)
  if (status === undefined) return Object.freeze({ step, world })
  let current: ProjectileStep = Object.freeze({ step, world })
  let motion: RocketMotion = existing ?? {
    kind: 'rocket',
    launchElapsedMilliseconds: 0,
    framePosition: status.position,
    homing: null,
  }
  if (before.state === EffectState.STARTING) {
    const launchElapsedMilliseconds = motion.launchElapsedMilliseconds + stepMilliseconds
    const isAnimationOver =
      launchElapsedMilliseconds >= (context.rocketLaunchMilliseconds[before.rocketIndex] ?? 0)
    motion = {
      ...motion,
      launchElapsedMilliseconds,
      framePosition: isAnimationOver ? motion.framePosition : status.position,
    }
    if (!isAnimationOver) {
      return Object.freeze({ step, world: getWorldWithRocket(world, before.id, motion) })
    }
    const launched = getLaunchedRocket(context, before, owner, motion.framePosition)
    const advanced = advancePowerUpEffect(step, context.powerUps, before.id)
    const withTarget = getStepWithEffect(advanced, {
      ...getEffect(advanced, before.id),
      targetRacer: launched.targetRacer,
    })
    motion = { ...motion, homing: launched.homing }
    current = Object.freeze({
      step: withTarget,
      world: getWorldWithRocket(world, before.id, motion),
    })
  }
  const effect = getEffect(current.step, before.id)
  if (effect.state !== EffectState.ACTIVE || motion.homing === null) return current
  return getFlownRocket(current, context, before.id, motion, motion.homing, stepMilliseconds)
}
