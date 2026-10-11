import { createRace, loadRaceDefinition } from '../../../race/index.ts'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { BrickState } from '../../../power-ups/index.ts'
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
})
