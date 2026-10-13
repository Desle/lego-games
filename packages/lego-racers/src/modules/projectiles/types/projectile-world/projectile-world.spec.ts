import { EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import { NO_BARREL_SPIN } from '../barrel-spin/barrel-spin.ts'
import { getWorldWithBarrelSpin, getWorldWithStartedBarrelsReset } from './projectile-world.ts'
import type { ProjectileWorld } from './projectile-world.types.ts'

const SPUN = Object.freeze({ angle: 43.7, rotation: IDENTITY_MATRIX3 })

const createEffect = (state: PowerUpEffect['state'], timerMilliseconds: number): PowerUpEffect =>
  ({ id: 0, kind: PowerUpEffectKind.BARREL, state, timerMilliseconds }) as PowerUpEffect

const createWorld = (): ProjectileWorld =>
  getWorldWithBarrelSpin({ barrelSpins: [NO_BARREL_SPIN] } as unknown as ProjectileWorld, 0, SPUN)

describe('getWorldWithStartedBarrelsReset', () => {
  it('zeroes the spin of a barrel that has just started (0x00452f60: state 2, timer 0, spin 0)', () => {
    // Arrange
    const world = createWorld()

    // Act
    const reset = getWorldWithStartedBarrelsReset(world, [createEffect(EffectState.STARTING, 0)])

    // Assert
    expect(reset.barrelSpins[0]).toBe(NO_BARREL_SPIN)
  })

  it('keeps the spin of a barrel that has been updated or finished', () => {
    // Arrange
    const world = createWorld()

    // Act
    const counted = getWorldWithStartedBarrelsReset(world, [createEffect(EffectState.STARTING, 33)])
    const finished = getWorldWithStartedBarrelsReset(world, [createEffect(EffectState.FINISHED, 0)])

    // Assert
    expect(counted).toBe(world)
    expect(finished).toBe(world)
  })
})
