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
import { createProjectileWorld, getMotion } from '../../types/projectile-world/projectile-world.ts'
import type {
  ProjectileContext,
  ProjectileWorld,
} from '../../types/projectile-world/projectile-world.types.ts'
import type { FlightRacer, LineProbe } from '../../types/projectiles.types.ts'
import {
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
  hasVehicle: false,
  speed: 0,
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
