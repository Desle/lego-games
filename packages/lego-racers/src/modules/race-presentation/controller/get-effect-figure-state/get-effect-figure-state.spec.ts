import type { FigureAnimation } from '../../../racer/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { getEffectFigureState } from './get-effect-figure-state.ts'

const animation: FigureAnimation = {
  rate: 0.02,
  vector: ZERO_VECTOR3,
  boundsCentre: ZERO_VECTOR3,
  boundsRadius: 1,
  frameCount: 11,
  period: 10,
}

describe('getEffectFigureState', () => {
  it('advances the played clip by the rate times the milliseconds', () => {
    // Arrange
    const request = { animationId: 0, isLooping: false, elapsedMilliseconds: 250 }

    // Act
    const state = getEffectFigureState([animation], request)

    // Assert
    expect(state.clip.clipIndex).toBe(0)
    expect(state.clip.timeInFrames).toBeCloseTo(5)
  })

  it('stops a clip that does not loop on its last frame', () => {
    // Arrange
    const request = { animationId: 0, isLooping: false, elapsedMilliseconds: 5000 }

    // Act
    const state = getEffectFigureState([animation], request)

    // Assert
    expect(state.clip.timeInFrames).toBe(10)
    expect(state.isFinished).toBe(true)
  })

  it('wraps a looping clip', () => {
    // Arrange
    const request = { animationId: 0, isLooping: true, elapsedMilliseconds: 1000 }

    // Act
    const state = getEffectFigureState([animation], request)

    // Assert
    expect(state.clip.timeInFrames).toBeLessThan(10)
    expect(state.isLooping).toBe(true)
  })
})
