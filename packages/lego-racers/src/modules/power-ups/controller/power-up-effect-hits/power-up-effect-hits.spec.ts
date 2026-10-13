import { createRandomTable } from '../../../random-table/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind } from '../../types/brick-kind/brick-kind.ts'
import { EffectState } from '../../types/power-up-effect-kind/power-up-effect-kind.ts'
import type {
  ActivationRequest,
  PowerUpEffect,
  RacerPowerUpStatus,
} from '../../types/power-ups.types.ts'
import { activatePowerUp } from '../activate-power-up/activate-power-up.ts'
import { createPowerUpWorld } from '../power-up-world/power-up-world.ts'
import { getStepWithEffect } from '../power-up-step/power-up-step.ts'
import type { PowerUpContext, PowerUpStep } from '../power-up-step/power-up-step.types.ts'
import {
  endProjectileFlight,
  hitRacerWithProjectile,
  touchHazardEffect,
} from './power-up-effect-hits.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const DIRECTION = { x: 1, y: 0, z: 0 }

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

const createContext = (victim: Partial<RacerPowerUpStatus> = {}): PowerUpContext => ({
  arithmetic: SINGLE,
  racers: [createStatus(0), createStatus(100, victim)],
  raceModeFlags: 0,
  getGroundPoint: () => null,
  trackTargets: [],
  eventStart: 0,
})

// Every table value is 0; split-screen wands made 40 draws.
const createFlying = (
  request: ActivationRequest,
  state: PowerUpEffect['state'] = EffectState.ACTIVE
): PowerUpStep => {
  const activated = activatePowerUp(
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
    createContext(),
    0,
    request
  )
  return getStepWithEffect(activated, { ...getHead(activated), state })
}

const getHead = (step: PowerUpStep): PowerUpEffect => {
  const id = step.world.effects.activeEffectIds[0]
  const effect = id === undefined ? undefined : step.world.effects.effects[id]
  if (effect === undefined) throw new Error('no active effect')
  return effect
}

describe('hitRacerWithProjectile', () => {
  it('a cannon hit: voices, a hit, an explosion, one debris piece, and the end (0x00452370, 0x00451b50)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.PROJECTILE, level: 0 })

    // Act
    const hit = hitRacerWithProjectile(step, createContext(), getHead(step).id, 1, DIRECTION)

    // Assert
    expect(hit.events.map((event) => event.type)).toEqual([
      'power_ups.voice',
      'power_ups.voice',
      'power_ups.racer_hit',
      'power_ups.sound_played',
      'power_ups.explosion',
      'power_ups.debris_thrown',
    ])
    expect(hit.events[1]).toEqual({ type: 'power_ups.voice', racer: 1, sound: 20 })
    expect(hit.events[3]).toEqual({
      type: 'power_ups.sound_played',
      soundId: 5,
      address: '0x0045241a',
    })
    expect(getHead(hit).state).toBe(EffectState.FINISHED)
    expect(hit.world.random.position).toBe(40 + 4 + 1 + 2)
  })

  it('a shield of level 2 sends a cannonball back to the attacker (0x00431310)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.PROJECTILE, level: 0 })

    // Act
    const hit = hitRacerWithProjectile(
      step,
      createContext({ isShielded: true, shieldLevel: 2 }),
      getHead(step).id,
      1,
      DIRECTION
    )

    // Assert
    expect(getHead(hit)).toMatchObject({
      state: EffectState.ACTIVE,
      ownerRacer: 1,
      timerMilliseconds: 3000,
    })
    expect(hit.events.at(-1)).toEqual({
      type: 'power_ups.projectile_reflected',
      effect: getHead(hit).id,
      owner: 1,
    })
  })

  it('a reflected rocket keeps its timer: only the cannon (0x00451b50) sets 3000 ms (0x004568f0)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.PROJECTILE, level: 3 })
    const flying = getStepWithEffect(step, { ...getHead(step), timerMilliseconds: 0x157c })

    // Act
    const hit = hitRacerWithProjectile(
      flying,
      createContext({ isShielded: true, shieldLevel: 2 }),
      getHead(flying).id,
      1,
      DIRECTION
    )

    // Assert
    expect(getHead(hit)).toMatchObject({
      state: EffectState.ACTIVE,
      ownerRacer: 1,
      timerMilliseconds: 0x157c,
    })
  })

  it('a rocket spins the victim out with strength 2 (0x00456fa0)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.PROJECTILE, level: 3 })

    // Act
    const hit = hitRacerWithProjectile(step, createContext(), getHead(step).id, 1, DIRECTION)

    // Assert
    expect(hit.events).toContainEqual({
      type: 'power_ups.racer_spun_out',
      racer: 1,
      strength: 2,
      spinTime: 0,
    })
  })

  it('a racer a wand struck earlier in the same update is not struck again (0x00455440, car body +0xaa8 0x80)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.PROJECTILE, level: 2 })
    const context = createContext()
    const first = hitRacerWithProjectile(step, context, getHead(step).id, 1, DIRECTION)

    // Act
    const second = hitRacerWithProjectile(first, context, getHead(step).id, 1, DIRECTION)

    // Assert
    expect(
      first.events.filter((event) => event.type === 'power_ups.racer_struck_by_lightning')
    ).toHaveLength(1)
    expect(second).toBe(first)
  })

  it('a grapple latches on for 4000 ms (0x004545d0)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.PROJECTILE, level: 1 })

    // Act
    const hit = hitRacerWithProjectile(step, createContext(), getHead(step).id, 1, DIRECTION)

    // Assert
    expect(getHead(hit)).toMatchObject({
      state: EffectState.ENDING,
      timerMilliseconds: 4000,
      targetRacer: 1,
    })
    expect(hit.events.at(-1)).toEqual({ type: 'power_ups.racer_grappled', racer: 1, owner: 0 })
  })
})

describe('touchHazardEffect', () => {
  it('an oil slick spins the racer out and is used up (0x004575b0)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.HAZARD, level: 0 })

    // Act
    const touched = touchHazardEffect(step, createContext(), getHead(step).id, 1, false)

    // Assert
    expect(getHead(touched).state).toBe(EffectState.FINISHED)
    expect(touched.events[0]).toEqual({
      type: 'power_ups.racer_spun_out',
      racer: 1,
      strength: 1,
      spinTime: 1,
    })
  })

  it('never affects its owner', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.HAZARD, level: 0 })

    // Act
    const touched = touchHazardEffect(step, createContext(), getHead(step).id, 0, false)

    // Assert
    expect(touched).toBe(step)
  })

  it('a shield destroys hazards below level 3 but not a curse (0x00456320)', () => {
    // Arrange
    const oil = createFlying({ category: BrickKind.HAZARD, level: 0 })
    const curse = createFlying({ category: BrickKind.HAZARD, level: 3 })
    const shielded = createContext({ isShielded: true })

    // Act
    const touchedOil = touchHazardEffect(oil, shielded, getHead(oil).id, 1, false)
    const touchedCurse = touchHazardEffect(curse, shielded, getHead(curse).id, 1, false)

    // Assert
    expect(getHead(touchedOil).state).toBe(EffectState.FINISHED)
    expect(getHead(touchedCurse).state).toBe(EffectState.ACTIVE)
    expect(touchedCurse.events[0]?.type).toBe('power_ups.racer_shield_struck')
  })

  it('a curse curses for 10000 ms unless already cursed (0x00452da0)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.HAZARD, level: 3 })

    // Act
    const figureFrame = {
      position: { x: 1, y: 2, z: 3 },
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1] as const,
    }
    const cursed = touchHazardEffect(step, createContext(), getHead(step).id, 1, false, figureFrame)
    const already = touchHazardEffect(
      step,
      createContext({ isCursed: true }),
      getHead(step).id,
      1,
      false
    )

    // Assert
    expect(cursed.events).toEqual([
      { type: 'power_ups.racer_cursed', racer: 1, durationMilliseconds: 10000, figureFrame },
    ])
    expect(already.events).toEqual([])
  })

  it('a magnet arms on the first touch and captures a racer in range (0x00455fb0)', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.HAZARD, level: 2 }, EffectState.STARTING)

    // Act
    const captured = touchHazardEffect(step, createContext(), getHead(step).id, 1, true)

    // Assert
    expect(getHead(captured)).toMatchObject({
      state: EffectState.ACTIVE,
      timerMilliseconds: 4000,
      targetRacer: 1,
    })
    expect(captured.events).toContainEqual({ type: 'power_ups.racer_magnetized', racer: 1 })
  })
})

describe('endProjectileFlight', () => {
  it('a landed barrel explodes and waits 500 ms for the next blast', () => {
    // Arrange
    const step = createFlying({ category: BrickKind.HAZARD, level: 1 })

    // Act
    const landed = endProjectileFlight(step, createContext(), getHead(step).id, false)

    // Assert
    expect(getHead(landed)).toMatchObject({ state: EffectState.ENDING, timerMilliseconds: 500 })
    expect(landed.events).toContainEqual(
      expect.objectContaining({ type: 'power_ups.explosion', isSpiked: true })
    )
    expect(landed.events).toContainEqual({
      type: 'power_ups.sound_played',
      soundId: 5,
      address: '0x004530ad',
    })
  })
})
