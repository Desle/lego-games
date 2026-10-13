import { EffectState, PowerUpEffectKind, getStepWithEffect } from '../../../power-ups/index.ts'
import { createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import { getRaceRacerSet, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import type { RaceRacerSet } from '../../types/race.types.ts'
import {
  getProjectileRegistrySphere,
  getRacerSetWithProjectileRegistry,
} from './projectile-registry.ts'

describe('getRacerSetWithProjectileRegistry', () => {
  it('registers nothing while no effect or explosion is live', () => {
    // Arrange
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)

    // Act
    const registered = getRacerSetWithProjectileRegistry(race.context.arithmetic, racerSet)

    // Assert
    expect(registered).toBe(racerSet)
  })
})

describe('getProjectileRegistrySphere', () => {
  it('answers the origin for an effect that has no body', () => {
    // Arrange
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)

    // Act
    const sphere = getProjectileRegistrySphere(racerSet, { type: 'effect_flight', effectId: 0 })

    // Assert
    expect(sphere.radius).toBe(0)
  })
})

describe('the registry entry of an oil slick (0x004573a0, 0x0045a490)', () => {
  const getRacerSetWithSlick = (
    state: (typeof EffectState)[keyof typeof EffectState]
  ): RaceRacerSet => {
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)
    const { effects, activeEffectIds } = racerSet.powerUpStep.world.effects
    const slick = effects.find((effect) => effect.kind === PowerUpEffectKind.OIL_SLICK)
    if (slick === undefined) throw new Error('The fixture has no oil slick')
    const stepped = getStepWithEffect(racerSet.powerUpStep, { ...slick, state, level: 0 })
    return Object.freeze({
      ...racerSet,
      powerUpStep: Object.freeze({
        ...stepped,
        world: Object.freeze({
          ...stepped.world,
          effects: Object.freeze({
            ...stepped.world.effects,
            activeEffectIds: Object.freeze([slick.id, ...activeEffectIds]),
          }),
        }),
      }),
      projectileWorld: Object.freeze({
        ...racerSet.projectileWorld,
        motions: Object.freeze(
          racerSet.projectileWorld.motions.map((motion, index) =>
            index === slick.id
              ? Object.freeze({
                  kind: 'hazard' as const,
                  position: Object.freeze({ x: 0, y: 0, z: 0 }),
                  groundNormal: null,
                  routeNormal: Object.freeze({ x: 1, y: 0, z: 0 }),
                  landingMilliseconds: 0,
                })
              : motion
          )
        ),
      }),
    })
  }

  it('stays registered in the frame its state becomes 6 and ends when the pool takes it back', () => {
    // Arrange
    const arithmetic = createFixtureRace().context.arithmetic
    const active = getRacerSetWithProjectileRegistry(
      arithmetic,
      getRacerSetWithSlick(EffectState.ACTIVE)
    )
    const finished = getRacerSetWithProjectileRegistry(
      arithmetic,
      getRacerSetWithSlick(EffectState.FINISHED)
    )

    // Act
    const counts = [active, finished].map(
      (racerSet) => racerSet.registryEntries.filter((entry) => entry.isActive).length
    )

    // Assert
    expect(counts).toEqual([1, 1])
  })
})
