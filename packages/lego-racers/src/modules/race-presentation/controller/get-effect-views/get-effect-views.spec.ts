import { createRace, loadRaceDefinition } from '../../../race/index.ts'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { BrickState, EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import type { PowerUpEffect } from '../../../power-ups/index.ts'
import { createBallisticFlight } from '../../../projectiles/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { getEffectViews } from './get-effect-views.ts'

const isPresent = getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

describe('getEffectViews', () => {
  it.skipIf(!isPresent)('has nothing to draw before anything has been launched', () => {
    // Arrange
    const raceState = createRace(loadRaceDefinition(readOriginalJam(), readOriginalExecutable()))

    // Act
    const views = getEffectViews(raceState)

    // Assert
    expect(views.effects).toEqual([])
    expect(views.explosions).toEqual([])
  })

  it.skipIf(!isPresent)('draws the bricks that are on the track, not the hidden ones', () => {
    // Arrange
    const raceState = createRace(loadRaceDefinition(readOriginalJam(), readOriginalExecutable()))
    const { bricks } = raceState.powerUpStep.world
    const shown = {
      ...raceState,
      powerUpStep: {
        ...raceState.powerUpStep,
        world: {
          ...raceState.powerUpStep.world,
          bricks: bricks.map((brick, index) => ({
            ...brick,
            state: index === 0 ? BrickState.AVAILABLE : BrickState.HIDDEN,
            scale: 0.8,
          })),
        },
      },
    }

    // Act
    const views = getEffectViews(shown)

    // Assert
    expect(bricks.length).toBeGreaterThan(1)
    const powerUpBricks = views.bricks.filter((brick) => !brick.isEnhancement)
    expect(powerUpBricks).toHaveLength(1)
    expect(powerUpBricks[0]).toMatchObject({ isEnhancement: false, scale: 0.8 })
  })

  // 0x004542d0 draws the hook frame +0x268 (the power-up world's first mesh instance) in states 3 and 4 only.
  const getRaceWithGrapple = (raceState: RaceState, state: PowerUpEffect['state']): RaceState => {
    const { effects } = raceState.powerUpStep.world
    const effect = effects.effects[0]
    if (effect === undefined) throw new Error('No pooled effect')
    const hookFrame = {
      rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1] as const,
      position: { x: 10, y: 20, z: 30 },
    }
    return {
      ...raceState,
      powerUpStep: {
        ...raceState.powerUpStep,
        world: {
          ...raceState.powerUpStep.world,
          effects: {
            ...effects,
            effects: [{ ...effect, kind: PowerUpEffectKind.GRAPPLE, state, ownerRacer: 0 }],
            activeEffectIds: [effect.id],
          },
        },
      },
      projectileWorld: {
        ...raceState.projectileWorld,
        hookFrame,
        motions: [
          {
            kind: 'grapple',
            hook: {
              flight: { ...createBallisticFlight(), framePosition: { x: 1, y: 2, z: 3 } },
              hookTarget: { x: 0, y: 0, z: 0 },
              isRetracting: state === EffectState.FINAL_STAGE,
              isHookArrived: false,
              tension: 0,
              ropeOwnerPosition: { x: 0, y: 0, z: 0 },
            },
          },
        ],
      },
    }
  }

  it.skipIf(!isPresent)(
    'draws the grapple hook at the shared hook frame while it flies and holds a racer, not while it retracts',
    () => {
      // Arrange
      const raceState = createRace(loadRaceDefinition(readOriginalJam(), readOriginalExecutable()))

      // Act
      const flying = getEffectViews(getRaceWithGrapple(raceState, EffectState.ACTIVE))
      const holding = getEffectViews(getRaceWithGrapple(raceState, EffectState.ENDING))
      const retracting = getEffectViews(getRaceWithGrapple(raceState, EffectState.FINAL_STAGE))

      // Assert
      expect(flying.effects).toHaveLength(1)
      expect(flying.effects[0]).toMatchObject({
        kind: PowerUpEffectKind.GRAPPLE,
        position: { x: 10, y: 20, z: 30 },
        rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
      })
      expect(flying.effects[0]?.boundingSphere?.radius).toBeGreaterThan(0)
      expect(holding.effects).toHaveLength(1)
      expect(retracting.effects).toEqual([])
    }
  )
})
