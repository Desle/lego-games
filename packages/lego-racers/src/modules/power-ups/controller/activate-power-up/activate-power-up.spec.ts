import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import {
  EffectState,
  PowerUpEffectKind,
} from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type { PowerUpEffect, RacerPowerUpStatus } from '../../types/power-ups.types.ts'
import { createPowerUpWorld } from '../power-up-world/power-up-world.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import {
  activateLauncherCurse,
  activateLauncherWand,
  activateLauncherWarp,
  activatePowerUp,
} from './activate-power-up.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const createStatus = (
  x: number,
  overrides: Partial<RacerPowerUpStatus> = {}
): RacerPowerUpStatus => ({
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

const createContext = (racers: readonly RacerPowerUpStatus[]): PowerUpContext => ({
  arithmetic: SINGLE,
  racers,
  raceModeFlags: 0,
  getGroundPoint: () => null,
  trackTargets: [],
  eventStart: 0,
})

const createStep = (racerCount: number): PowerUpStep =>
  createPowerUpWorld({
    bricks: [],
    enhancementBricks: [],
    raceModeFlags: 0,
    isSplitScreen: false,
    racers: Array.from({ length: racerCount }, () => ({
      voiceSoundBase: 0,
      voiceCooldownMilliseconds: 0,
    })),
    random: {
      table: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
      position: 0,
    },
  })

const getActive = (step: PowerUpStep): readonly PowerUpEffect[] =>
  step.world.effects.activeEffectIds.map((id) => step.world.effects.effects[id] as PowerUpEffect)

describe('activatePowerUp', () => {
  it('aims a cannon at the nearest racer in the 0.9 cone (0x0045aa30)', () => {
    // Arrange
    const context = createContext([createStatus(0), createStatus(300), createStatus(150)])

    // Act
    const step = activatePowerUp(createStep(3), context, 0, {
      category: BrickKind.PROJECTILE,
      level: 0,
    })

    // Assert
    expect(getActive(step)[0]).toMatchObject({
      kind: PowerUpEffectKind.CANNON,
      state: EffectState.STARTING,
      timerMilliseconds: 0,
      ownerRacer: 0,
      targetRacer: 2,
    })
  })

  it('aims a grapple at the farthest racer in the narrow cone first (0x0045ab50)', () => {
    // Arrange
    const context = createContext([createStatus(0), createStatus(100), createStatus(240)])

    // Act
    const step = activatePowerUp(createStep(3), context, 0, {
      category: BrickKind.PROJECTILE,
      level: 1,
    })

    // Assert
    expect(getActive(step)[0]?.targetRacer).toBe(2)
  })

  it('fires three rockets numbered 2, 1, 0 from the head of the active list (0x0045af80)', () => {
    // Arrange
    const context = createContext([createStatus(0)])

    // Act
    const step = activatePowerUp(createStep(1), context, 0, {
      category: BrickKind.PROJECTILE,
      level: 3,
    })

    // Assert
    expect(
      getActive(step).map((effect) => [effect.kind, effect.rocketIndex, effect.timerMilliseconds])
    ).toEqual([
      [PowerUpEffectKind.ROCKET, 2, 3000],
      [PowerUpEffectKind.ROCKET, 1, 3000],
      [PowerUpEffectKind.ROCKET, 0, 3000],
    ])
  })

  it('raises a shield for 4000, 6000, 8000 or 10000 ms by level and takes 2 attachment slots (0x0045bd30)', () => {
    // Arrange
    const context = createContext([createStatus(0, { isCursed: true })])

    // Act
    const steps = [0, 3].map((level) =>
      activatePowerUp(createStep(1), context, 0, { category: BrickKind.SHIELD, level })
    )

    // Assert
    expect(steps.map((step) => getActive(step)[0]?.timerMilliseconds)).toEqual([4000, 10000])
    expect(steps[1]?.world.effects.attachmentSlots.usedCount).toBe(2)
    expect(steps[1]?.events).toEqual([
      { type: 'power_ups.racer_shield_raised', racer: 0, level: 3 },
      { type: 'power_ups.racer_curse_lifted', racer: 0 },
    ])
  })

  it('finishes a shielded racer’s earlier shield (0x0045b640)', () => {
    // Arrange
    const first = activatePowerUp(createStep(1), createContext([createStatus(0)]), 0, {
      category: BrickKind.SHIELD,
      level: 0,
    })

    // Act
    const second = activatePowerUp(
      first,
      createContext([createStatus(0, { isShielded: true })]),
      0,
      {
        category: BrickKind.SHIELD,
        level: 1,
      }
    )

    // Assert
    expect(getActive(second).map((effect) => effect.state)).toEqual([
      EffectState.ACTIVE,
      EffectState.FINISHED,
    ])
  })

  it('does nothing for a shield when fewer than 2 attachment slots are free', () => {
    // Arrange
    const step = createStep(1)
    const crowded = {
      ...step,
      world: {
        ...step.world,
        effects: { ...step.world.effects, attachmentSlots: { usedMask: 0xffffff, usedCount: 24 } },
      },
    }

    // Act
    const activated = activatePowerUp(crowded, createContext([createStatus(0)]), 0, {
      category: BrickKind.SHIELD,
      level: 0,
    })

    // Assert
    expect(activated).toBe(crowded)
  })

  it('starts a turbo in 400 ms with the car body boost (0x0045c8f0, 0x0045cd70)', () => {
    // Arrange
    const context = createContext([createStatus(0)])

    // Act
    const step = activatePowerUp(createStep(1), context, 0, { category: BrickKind.TURBO, level: 1 })

    // Assert
    expect(getActive(step)[0]).toMatchObject({
      kind: PowerUpEffectKind.TURBO,
      timerMilliseconds: 400,
    })
    expect(step.events).toEqual([
      { type: 'power_ups.racer_turbo_started', racer: 0, level: 1, boostMilliseconds: 250 },
    ])
  })

  it('makes a level-3 turbo a warp, refused while one is pending (0x0045d560)', () => {
    // Arrange
    const idle = createContext([createStatus(0)])
    const pending = createContext([createStatus(0, { isWarpPending: true })])

    // Act
    const started = activatePowerUp(createStep(1), idle, 0, { category: BrickKind.TURBO, level: 3 })
    const refused = activatePowerUp(createStep(1), pending, 0, {
      category: BrickKind.TURBO,
      level: 3,
    })

    // Assert
    expect(getActive(started)[0]).toMatchObject({
      kind: PowerUpEffectKind.WARP,
      timerMilliseconds: 500,
    })
    expect(started.events).toEqual([{ type: 'power_ups.racer_warp_pending', racer: 0 }])
    expect(getActive(refused)[0]?.state).toBe(EffectState.FINISHED)
  })

  it('gives a launcher warp no wait and its destination (0x0045d560, 0x0048af80)', () => {
    // Arrange
    const context = createContext([createStatus(0)])

    // Act
    const started = activateLauncherWarp(
      createStep(1),
      context,
      0,
      { x: 1, y: 2, z: 3 },
      { x: 0, y: 1, z: 0 }
    )

    // Assert
    expect(getActive(started)[0]).toMatchObject({
      kind: PowerUpEffectKind.WARP,
      state: EffectState.STARTING,
      timerMilliseconds: 0,
      warpDestination: {
        destination: { x: 1, y: 2, z: 3 },
        forward: { x: 0, y: 1, z: 0 },
        start: null,
      },
    })
  })

  it("drops a curse that belongs to no racer at the dropper's place (0x0045a9b0 case 3, 0x0048b3c0)", () => {
    // Arrange
    const position = { x: 1, y: 2, z: 3 }

    // Act
    const started = activateLauncherCurse(createStep(1), position)

    // Assert
    expect(getActive(started)[0]).toMatchObject({
      kind: PowerUpEffectKind.CURSE,
      state: EffectState.STARTING,
      level: 3,
      ownerRacer: null,
      launcherPosition: position,
    })
    expect(started.world.effects.attachmentSlots.usedCount).toBe(3)
  })

  it("fires a wand that belongs to no racer along the turret's muzzle (0x0045ac80, 0x00454cb0)", () => {
    // Arrange
    const muzzle = {
      position: { x: 1, y: 2, z: 3 },
      direction: { x: 0, y: 1, z: 0 },
    }

    // Act
    const started = activateLauncherWand(createStep(1), muzzle, 4)

    // Assert
    expect(getActive(started)[0]).toMatchObject({
      kind: PowerUpEffectKind.WAND,
      state: EffectState.STARTING,
      timerMilliseconds: 500,
      level: 2,
      ownerRacer: null,
      launcherMuzzle: muzzle,
      launcherHazardIndex: 4,
    })
  })

  it('lays a magnet for 20000 ms with three attachment slots', () => {
    // Arrange
    const context = createContext([createStatus(0)])

    // Act
    const step = activatePowerUp(createStep(1), context, 0, {
      category: BrickKind.HAZARD,
      level: 2,
    })

    // Assert
    expect(getActive(step)[0]).toMatchObject({
      kind: PowerUpEffectKind.MAGNET,
      timerMilliseconds: 20000,
    })
    expect(step.world.effects.attachmentSlots.usedCount).toBe(3)
  })
})
