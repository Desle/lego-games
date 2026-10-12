import {
  activatePowerUp,
  BrickKind,
  createPowerUpWorld,
  EffectState,
  getEffect,
  getStepWithEffect,
} from '../../../power-ups/index.ts'
import type {
  ActivationRequest,
  PowerUpContext,
  PowerUpStep,
  RacerPowerUpStatus,
} from '../../../power-ups/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { BallisticFlightState } from '../../types/ballistic-flight/ballistic-flight.ts'
import { ROPE_START_HEIGHT } from '../../types/grapple-hook/grapple-hook.ts'
import { createProjectileWorld, getMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import type { FlightRacer, LineProbe } from '../../types/projectiles.types.ts'
import {
  touchProjectileExplosions,
  touchProjectileFlights,
  touchProjectileHazards,
} from '../projectile-touch/projectile-touch.ts'
import { updatePowerUpsWithProjectiles } from './projectile-update.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const ZERO: Vector3 = { x: 0, y: 0, z: 0 }

const getStatus = (x: number, overrides: Partial<RacerPowerUpStatus> = {}): RacerPowerUpStatus => ({
  position: { x, y: 0, z: 0 },
  forward: { x: 1, y: 0, z: 0 },
  isComputer: false,
  isShielded: false,
  shieldLevel: 0,
  isTumbling: false,
  isWarping: false,
  isCursed: false,
  isWarpWithheld: false,
  isWarpPending: false,
  isAirborne: false,
  isStruckByLightning: false,
  isInTurbo: false,
  ...overrides,
})

const getFlightRacer = (x: number, overrides: Partial<FlightRacer> = {}): FlightRacer => ({
  position: { x, y: 0, z: 0 },
  velocity: ZERO,
  heading: ZERO,
  headingSpeed: 0,
  sideAxis: ZERO,
  isVehiclePresent: false,
  speed: 0,
  muzzlePosition: { x, y: 0, z: 0 },
  muzzleDirection: { x: 1, y: 0, z: 0 },
  boundingCenter: { x, y: 0, z: 0 },
  boundingRadius: 2,
  beamRadius: 2,
  routeNodeIndex: null,
  displayRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  isComputer: false,
  ...overrides,
})

const MISS: LineProbe = () => null

const getContexts = (
  probe: LineProbe,
  statusOverrides: Partial<RacerPowerUpStatus> = {},
  flightOverrides: Partial<FlightRacer> = {}
): { readonly powerUps: PowerUpContext; readonly projectiles: ProjectileContext } => {
  const powerUps: PowerUpContext = {
    arithmetic: SINGLE,
    racers: [getStatus(0), getStatus(360, statusOverrides)],
    raceModeFlags: 0,
    getGroundPoint: () => ({ x: 0, y: 0, z: -10 }),
    trackTargets: [],
  }
  return {
    powerUps,
    projectiles: {
      powerUps,
      racers: [getFlightRacer(0), getFlightRacer(360, flightOverrides)],
      route: [],
      rocketLaunchMilliseconds: [100, 100, 100],
      rocketLaunchBones: [0, 1, 2].map(() => ({
        position: { x: 0, y: 0, z: 0 },
        firstAxis: { x: 1, y: 0, z: 0 },
        thirdAxis: { x: 0, y: 0, z: 1 },
      })),
      rocketModelScale: 1,
      getTableCosine: () => 0,
      debrisAnimations: [[200], [200], [200], [200]],
      probe,
    },
  }
}

// Every table value is 0.
const getWorldAfterUse = (
  request: ActivationRequest,
  powerUps: PowerUpContext
): { readonly step: PowerUpStep; readonly world: ProjectileWorld } => {
  const step = activatePowerUp(
    createPowerUpWorld({
      bricks: [],
      enhancementBricks: [],
      raceModeFlags: 0,
      isSplitScreen: true,
      racers: [
        { voiceSoundBase: 0, voiceCooldownMilliseconds: 0 },
        { voiceSoundBase: 20, voiceCooldownMilliseconds: 0 },
      ],
      random: { table: createRandomTable(Array.from({ length: 1024 }, () => 0)), position: 0 },
    }),
    powerUps,
    0,
    request
  )
  return { step, world: createProjectileWorld(step) }
}

const getHeadId = (step: PowerUpStep): number => {
  const id = step.world.effects.activeEffectIds[0]
  if (id === undefined) throw new Error('no active effect')
  return id
}

describe('updatePowerUpsWithProjectiles: the cannon', () => {
  it('launches at the racer ahead when it leaves state 2 and flies in the same frame (0x00451f50, 0x00451b50)', () => {
    // Arrange
    const { powerUps, projectiles } = getContexts(MISS)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 0 }, powerUps)

    // Act
    const updated = updatePowerUpsWithProjectiles(used.step, used.world, projectiles, 16)

    // Assert: 360 units at 180 per second is 2 seconds; the target is 5 up.
    const effectId = getHeadId(updated.step)
    const motion = getMotion(updated.world, effectId)
    expect(getEffect(updated.step, effectId).state).toBe(EffectState.ACTIVE)
    expect(motion?.kind === 'ballistic' ? motion.flight.durationMilliseconds : 0).toBe(2000)
    expect(motion?.kind === 'ballistic' ? motion.flight.elapsedMilliseconds : 0).toBe(16)
    expect(motion?.kind === 'ballistic' ? motion.flight.state : '').toBe(
      BallisticFlightState.FLYING
    )
  })

  it('explodes where the probe hits, as a ground burst on a flat surface (0x00451b50)', () => {
    // Arrange
    const hitProbe: LineProbe = () => ({
      point: { x: 3, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    })
    const { powerUps, projectiles } = getContexts(hitProbe)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 0 }, powerUps)

    // Act
    const effectId = getHeadId(used.step)
    const updated = updatePowerUpsWithProjectiles(used.step, used.world, projectiles, 16)

    // Assert
    const explosion = updated.step.events.find((event) => event.type === 'power_ups.explosion')
    expect(explosion).toMatchObject({ isSpiked: false, isGroundHit: true })
    expect(updated.step.world.effects.activeEffectIds).toEqual([])
    expect(getEffect(updated.step, effectId).state).toBe(EffectState.IDLE)
  })

  it('hits the racer that touched it (0x00431660, 0x00452370)', () => {
    // Arrange
    const { powerUps, projectiles } = getContexts(MISS)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 0 }, powerUps)
    const flying = updatePowerUpsWithProjectiles(used.step, used.world, projectiles, 16)
    const effectId = getHeadId(flying.step)

    // Act
    const touched = touchProjectileFlights(flying.world, projectiles, [
      { effect: effectId, racer: 1 },
    ])
    const updated = updatePowerUpsWithProjectiles(flying.step, touched, projectiles, 16)

    // Assert
    expect(updated.step.events.some((event) => event.type === 'power_ups.racer_hit')).toBe(true)
    expect(getEffect(updated.step, effectId).state).toBe(EffectState.IDLE)
  })

  it('sends the ball back from a shield above level 1 (0x00431310)', () => {
    // Arrange
    const reflecting = getContexts(MISS, { isShielded: true, shieldLevel: 2 })
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 0 }, reflecting.powerUps)
    const flying = updatePowerUpsWithProjectiles(used.step, used.world, reflecting.projectiles, 16)
    const effectId = getHeadId(flying.step)
    const touched = touchProjectileFlights(flying.world, reflecting.projectiles, [
      { effect: effectId, racer: 1 },
    ])

    // Act
    const updated = updatePowerUpsWithProjectiles(flying.step, touched, reflecting.projectiles, 16)

    // Assert: the shielded racer owns it and it flies at the old shooter again.
    const motion = getMotion(updated.world, effectId)
    expect(getEffect(updated.step, effectId).ownerRacer).toBe(1)
    expect(motion?.kind === 'ballistic' ? motion.flight.shooterRacer : -1).toBe(1)
    expect(motion?.kind === 'ballistic' ? motion.flight.targetRacer : -1).toBe(0)
    expect(motion?.kind === 'ballistic' ? motion.flight.state : '').toBe(
      BallisticFlightState.FLYING
    )
  })
})

describe('updatePowerUpsWithProjectiles: the barrel', () => {
  it('launches on the first frame without flying, then flies before the countdown (0x00452ff0, 0x00453240)', () => {
    // Arrange
    const { powerUps, projectiles } = getContexts(MISS)
    const used = getWorldAfterUse({ category: BrickKind.HAZARD, level: 1 }, powerUps)

    // Act
    const first = updatePowerUpsWithProjectiles(used.step, used.world, projectiles, 16)
    const second = updatePowerUpsWithProjectiles(first.step, first.world, projectiles, 16)

    // Assert
    const effectId = getHeadId(first.step)
    const firstMotion = getMotion(first.world, effectId)
    const secondMotion = getMotion(second.world, effectId)
    expect(firstMotion?.kind === 'ballistic' ? firstMotion.flight.elapsedMilliseconds : -1).toBe(0)
    expect(secondMotion?.kind === 'ballistic' ? secondMotion.flight.elapsedMilliseconds : -1).toBe(
      16
    )
  })

  it('lands with an explosion and a 500 ms last stage that the same frame counts down (0x00452ff0)', () => {
    // Arrange
    const hitProbe: LineProbe = () => ({
      point: { x: 3, y: 0, z: 0 },
      normal: { x: 0, y: 0, z: 1 },
    })
    const { powerUps, projectiles } = getContexts(hitProbe)
    const used = getWorldAfterUse({ category: BrickKind.HAZARD, level: 1 }, powerUps)
    const first = updatePowerUpsWithProjectiles(used.step, used.world, projectiles, 16)

    // Act
    const second = updatePowerUpsWithProjectiles(first.step, first.world, projectiles, 16)

    // Assert
    const effect = getEffect(second.step, getHeadId(second.step))
    expect(effect.state).toBe(EffectState.ENDING)
    expect(effect.timerMilliseconds).toBe(500 - 16)
    expect(second.step.events.some((event) => event.type === 'power_ups.explosion')).toBe(true)
  })
})

describe('updatePowerUpsWithProjectiles: the magnet', () => {
  const getArmedMagnet = (
    statusOverrides: Partial<RacerPowerUpStatus> = {},
    flightOverrides: Partial<FlightRacer> = {}
  ) => {
    const contexts = getContexts(MISS, statusOverrides, flightOverrides)
    const used = getWorldAfterUse({ category: BrickKind.HAZARD, level: 2 }, contexts.powerUps)
    const placed = updatePowerUpsWithProjectiles(used.step, used.world, contexts.projectiles, 16)
    return { contexts, placed, effectId: getHeadId(placed.step) }
  }

  it('is placed 1 above the ground under its owner, 30 up, and boosts the owner (0x004560b0)', () => {
    // Arrange / Act
    const { placed, effectId } = getArmedMagnet()

    // Assert
    const motion = getMotion(placed.world, effectId)
    expect(motion?.kind === 'magnet' ? motion.position : null).toEqual({ x: 0, y: 0, z: 21 })
    expect(placed.world.events).toEqual([
      {
        type: 'projectiles.racer_boosted',
        racer: 0,
        factor: Math.fround(0.0015),
        milliseconds: 150,
      },
    ])
  })

  it('captures a racer within 9 units and tows a stopped one (0x00455fb0, 0x00455b40)', () => {
    // Arrange: racer 1 is standing at the ground point under the magnet.
    const { contexts, placed, effectId } = getArmedMagnet()
    const nearby = {
      ...contexts.projectiles,
      racers: [getFlightRacer(0), getFlightRacer(0, { position: { x: 5, y: 0, z: -9 } })],
    }

    // Act
    const touched = touchProjectileHazards(placed.step, placed.world, nearby, [
      { effect: effectId, racer: 1 },
    ])
    const pulled = updatePowerUpsWithProjectiles(
      touched.step,
      { ...touched.world, events: [] },
      nearby,
      16
    )

    // Assert
    expect(getEffect(touched.step, effectId).targetRacer).toBe(1)
    const pull = pulled.world.events.find((event) => event.type === 'projectiles.racer_pulled')
    expect(pull).toMatchObject({ racer: 1, strength: 16 })
    expect(pulled.world.events[0]).toEqual({ type: 'projectiles.racer_tumbling_started', racer: 1 })
  })

  it('remembers a racer that touched it from outside the range and pulls it once', () => {
    // Arrange
    const { contexts, placed, effectId } = getArmedMagnet()

    // Act
    const touched = touchProjectileHazards(placed.step, placed.world, contexts.projectiles, [
      { effect: effectId, racer: 1 },
    ])
    const armed = getStepWithEffect(touched.step, getEffect(touched.step, effectId))
    const pulled = updatePowerUpsWithProjectiles(
      armed,
      { ...touched.world, events: [] },
      contexts.projectiles,
      16
    )

    // Assert
    const motion = getMotion(touched.world, effectId)
    expect(motion?.kind === 'magnet' ? motion.candidateRacer : -1).toBe(1)
    expect(pulled.world.events.map((event) => event.type)).toEqual(['projectiles.racer_pulled'])
    const afterPull = getMotion(pulled.world, effectId)
    expect(afterPull?.kind === 'magnet' ? afterPull.candidateRacer : -1).toBeNull()
  })
})

describe('updatePowerUpsWithProjectiles: the turbo', () => {
  it('ends early when a tumbling racer has stopped (0x0045ce20, 0x0042a7f0)', () => {
    // Arrange: a level 2 turbo, 4000 ms left, a racer that tumbles and does not move.
    const contexts = getContexts(MISS)
    const tumbling = {
      ...contexts.powerUps,
      racers: [getStatus(0, { isTumbling: true }), getStatus(360)],
    }
    const used = getWorldAfterUse({ category: BrickKind.TURBO, level: 2 }, tumbling)
    const effectId = getHeadId(used.step)
    const active = getStepWithEffect(used.step, {
      ...getEffect(used.step, effectId),
      state: EffectState.ACTIVE,
      timerMilliseconds: 4000,
    })
    const context = { ...contexts.projectiles, powerUps: tumbling }

    // Act
    const updated = updatePowerUpsWithProjectiles(active, used.world, context, 16)

    // Assert: the countdown left 3984 ms, then the early end moved it to its ending stage.
    expect(getEffect(updated.step, effectId).state).toBe(EffectState.ENDING)
    expect(getEffect(updated.step, effectId).timerMilliseconds).toBe(700)
  })

  it('keeps going while the racer moves', () => {
    // Arrange
    const contexts = getContexts(MISS)
    const tumbling = {
      ...contexts.powerUps,
      racers: [getStatus(0, { isTumbling: true }), getStatus(360)],
    }
    const used = getWorldAfterUse({ category: BrickKind.TURBO, level: 2 }, tumbling)
    const effectId = getHeadId(used.step)
    const active = getStepWithEffect(used.step, {
      ...getEffect(used.step, effectId),
      state: EffectState.ACTIVE,
      timerMilliseconds: 4000,
    })
    const context = {
      ...contexts.projectiles,
      powerUps: tumbling,
      racers: [getFlightRacer(0, { speed: 0.5 }), getFlightRacer(360)],
    }

    // Act
    const updated = updatePowerUpsWithProjectiles(active, used.world, context, 16)

    // Assert
    expect(getEffect(updated.step, effectId).state).toBe(EffectState.ACTIVE)
    expect(getEffect(updated.step, effectId).timerMilliseconds).toBe(3984)
  })
})

describe('updatePowerUpsWithProjectiles: the grapple', () => {
  const getLatched = (
    statusOverrides: Partial<RacerPowerUpStatus> = {},
    probe: LineProbe = MISS
  ) => {
    const contexts = getContexts(probe, statusOverrides)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 1 }, contexts.powerUps)
    const effectId = getHeadId(used.step)
    const flying = updatePowerUpsWithProjectiles(used.step, used.world, contexts.projectiles, 16)
    const touched = touchProjectileFlights(flying.world, contexts.projectiles, [
      { effect: effectId, racer: 1 },
    ])
    const hit = updatePowerUpsWithProjectiles(flying.step, touched, contexts.projectiles, 16)
    return { contexts, effectId, flying, hit }
  }

  it('launches at the racer, latches on it and tows both racers together (0x00454360, 0x00453ef0)', () => {
    // Arrange / Act
    const { effectId, flying, hit } = getLatched()

    // Assert
    const launched = getMotion(flying.world, effectId)
    expect(launched?.kind === 'grapple' ? launched.hook.flight.state : '').toBe(
      BallisticFlightState.FLYING
    )
    expect(getEffect(hit.step, effectId)).toMatchObject({
      state: EffectState.ENDING,
      timerMilliseconds: 4000,
      targetRacer: 1,
    })
    expect(hit.step.events.filter((event) => event.type === 'power_ups.racer_towed')).toMatchObject(
      [
        { type: 'power_ups.racer_towed', racer: 0, vector: { x: 180 }, isOwner: true },
        { type: 'power_ups.racer_towed', racer: 1, vector: { x: -180 }, isOwner: false },
      ]
    )
  })

  it('brings the hook back when the victim is shielded (0x004545d0)', () => {
    // Arrange / Act
    const { effectId, hit } = getLatched({ isShielded: true, shieldLevel: 1 })

    // Assert
    expect(getEffect(hit.step, effectId)).toMatchObject({
      state: EffectState.FINAL_STAGE,
      timerMilliseconds: 500,
    })
    const motion = getMotion(hit.world, effectId)
    expect(motion?.kind === 'grapple' ? motion.hook.isRetracting : false).toBe(true)
    expect(hit.world.events).toEqual([])
  })

  it('lets go when the rope meets the track after a second (0x00444938)', () => {
    // Arrange: the track blocks the rope between the owner and the hook; the rope starts 3 above the owner (0x00453cd0).
    const blocked: LineProbe = (start) =>
      start.x === 0 && start.y === 0 && start.z === ROPE_START_HEIGHT
        ? { point: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 0, z: 1 } }
        : null
    const contexts = getContexts(blocked)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 1 }, contexts.powerUps)
    const effectId = getHeadId(used.step)
    const flying = updatePowerUpsWithProjectiles(
      used.step,
      used.world,
      getContexts(MISS).projectiles,
      16
    )
    const touched = touchProjectileFlights(flying.world, contexts.projectiles, [
      { effect: effectId, racer: 1 },
    ])
    const hit = updatePowerUpsWithProjectiles(
      flying.step,
      touched,
      getContexts(MISS).projectiles,
      16
    )

    // Act
    const later = updatePowerUpsWithProjectiles(hit.step, hit.world, contexts.projectiles, 1000)

    // Assert: the 1 second step reached full tension, the probe hit, the effect retracts.
    expect(getEffect(later.step, effectId).state).toBe(EffectState.FINAL_STAGE)
    expect(later.step.events.some((event) => event.type === 'power_ups.grapple_released')).toBe(
      true
    )
  })
})

describe('updatePowerUpsWithProjectiles: the wand', () => {
  const getActiveWand = (flightOverrides: Partial<FlightRacer> = {}) => {
    const contexts = getContexts(MISS, {}, flightOverrides)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 2 }, contexts.powerUps)
    const effectId = getHeadId(used.step)
    const active = getStepWithEffect(used.step, {
      ...getEffect(used.step, effectId),
      state: EffectState.ACTIVE,
      timerMilliseconds: 7000,
    })
    return { contexts, effectId, used, active }
  }

  it('strikes a racer whose sphere the beam passes through (0x00455350, 0x00455440)', () => {
    // Arrange: racer 1 is 360 away, so the beam (200 long) is moved to meet it by a closer racer.
    const { contexts, effectId, used, active } = getActiveWand({
      position: { x: 100, y: 0, z: 0 },
      boundingCenter: { x: 100, y: 0, z: 3 },
    })

    // Act
    const updated = updatePowerUpsWithProjectiles(active, used.world, contexts.projectiles, 16)

    // Assert
    expect(
      updated.step.events.some((event) => event.type === 'power_ups.racer_struck_by_lightning')
    ).toBe(true)
    expect(getEffect(updated.step, effectId).targetRacer).toBe(1)
    const motion = getMotion(updated.world, effectId)
    expect(motion?.kind === 'wand' ? motion.beam.points.length : 0).toBe(4)
  })

  it('does not test the beam against a racer outside the cone or out of reach', () => {
    // Arrange: the sphere is on the line but 360 units away, beyond the 200 unit window.
    const { contexts, effectId, used, active } = getActiveWand({
      boundingCenter: { x: 100, y: 0, z: 3 },
    })

    // Act
    const updated = updatePowerUpsWithProjectiles(active, used.world, contexts.projectiles, 16)

    // Assert
    expect(getEffect(updated.step, effectId).targetRacer).toBeNull()
  })
})

describe('updatePowerUpsWithProjectiles: the rockets', () => {
  const getRockets = (
    statusOverrides: Partial<RacerPowerUpStatus> = {},
    probe: LineProbe = MISS
  ) => {
    const contexts = getContexts(probe, statusOverrides)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 3 }, contexts.powerUps)
    return { contexts, used, ids: used.step.world.effects.activeEffectIds }
  }

  it('follow the owner during the launch animation, and do not count down (0x004568f0 state 2)', () => {
    // Arrange
    const { contexts, used, ids } = getRockets()

    // Act
    const updated = updatePowerUpsWithProjectiles(used.step, used.world, contexts.projectiles, 60)

    // Assert
    expect(ids).toHaveLength(3)
    expect(getEffect(updated.step, ids[0] ?? -1)).toMatchObject({
      state: EffectState.STARTING,
      timerMilliseconds: 3000,
    })
    const motion = getMotion(updated.world, ids[0] ?? -1)
    expect(motion?.kind === 'rocket' ? motion.launchElapsedMilliseconds : -1).toBe(60)
  })

  it('launch when the animation is over and fly in the same update, choosing racer 1 (0x00456db0, 0x00423640)', () => {
    // Arrange: only racer 1 is in the cone; rockets 1 and 2 launch at a point but choose racer 1 on their first step.
    const { contexts, used, ids } = getRockets()

    // Act
    const updated = updatePowerUpsWithProjectiles(used.step, used.world, contexts.projectiles, 100)

    // Assert
    const targets = ids.map((id) => {
      const motion = getMotion(updated.world, id)
      return motion?.kind === 'rocket' && motion.homing !== null
        ? motion.homing.flight.targetRacer
        : -1
    })
    expect(targets).toEqual([1, 1, 1])
    ids.forEach((id) => {
      const effect = getEffect(updated.step, id)
      expect(effect.state).toBe(EffectState.ACTIVE)
      expect(effect.timerMilliseconds).toBe(0x157c)
      const motion = getMotion(updated.world, id)
      expect(motion?.kind === 'rocket' && motion.homing?.flight.elapsedMilliseconds).toBe(100)
    })
  })

  it('explode on the racer they touch (0x00431660, 0x00456fa0)', () => {
    // Arrange
    const { contexts, used, ids } = getRockets()
    const flying = updatePowerUpsWithProjectiles(used.step, used.world, contexts.projectiles, 100)
    const touched = touchProjectileFlights(flying.world, contexts.projectiles, [
      { effect: ids[0] ?? -1, racer: 1 },
    ])

    // Act
    const updated = updatePowerUpsWithProjectiles(flying.step, touched, contexts.projectiles, 16)

    // Assert
    expect(updated.step.events.some((event) => event.type === 'power_ups.explosion')).toBe(true)
    expect(updated.step.events.some((event) => event.type === 'power_ups.racer_spun_out')).toBe(
      true
    )
  })
})

describe('updatePowerUpsWithProjectiles: explosions and debris', () => {
  const getHitCannon = () => {
    const contexts = getContexts(MISS)
    const used = getWorldAfterUse({ category: BrickKind.PROJECTILE, level: 0 }, contexts.powerUps)
    const effectId = getHeadId(used.step)
    const flying = updatePowerUpsWithProjectiles(used.step, used.world, contexts.projectiles, 16)
    const touched = touchProjectileFlights(flying.world, contexts.projectiles, [
      { effect: effectId, racer: 1 },
    ])
    return {
      contexts,
      effectId,
      hit: updatePowerUpsWithProjectiles(flying.step, touched, contexts.projectiles, 16),
    }
  }

  it('start an explosion at the racer a cannonball hit, owned by the shooter, and grow it in the same update', () => {
    // Arrange / Act
    const { hit } = getHitCannon()

    // Assert: the update's 16 ms were spent growing.
    const explosion = hit.world.explosions.explosions[hit.world.explosions.activeIndices[0] ?? 0]
    expect(hit.world.explosions.activeIndices).toHaveLength(1)
    expect(explosion).toMatchObject({
      state: 'growing',
      owner: 0,
      position: { x: 360, y: 0, z: 0 },
      remainingMilliseconds: 984,
    })
  })

  it('throw debris from the hit racer onto attachment slots, and free them when the animation ends', () => {
    // Arrange: every table value is 0, so one piece is thrown.
    const { contexts, hit } = getHitCannon()

    // Act
    const later = updatePowerUpsWithProjectiles(hit.step, hit.world, contexts.projectiles, 300)

    // Assert
    expect(hit.world.debris.pieces.filter((piece) => piece.state === 'playing')).toHaveLength(1)
    expect(hit.step.world.effects.attachmentSlots.usedCount).toBe(1)
    expect(later.world.debris.pieces.every((piece) => piece.state === 'idle')).toBe(true)
    expect(later.step.world.effects.attachmentSlots.usedCount).toBe(0)
  })

  it('blast a racer that touches the explosion (0x00421c00)', () => {
    // Arrange
    const { contexts, hit } = getHitCannon()
    const index = hit.world.explosions.activeIndices[0] ?? 0

    // Act
    const touched = touchProjectileExplosions(hit.world, contexts.projectiles, [
      { isSpiked: false, explosion: index, racer: 1 },
      { isSpiked: false, explosion: index, racer: 0 },
    ])

    // Assert: racer 0 fired the cannonball, so only racer 1 is thrown (its axis is zero in this fixture).
    expect(touched.events).toEqual([
      { type: 'projectiles.racer_blasted', racer: 1, impulse: { x: 0, y: 0, z: 200 } },
    ])
  })
})
