import { blendFigureAnimation, createFigure, playFigureAnimation } from '../../../racer/index.ts'
import type { FigureAnimation } from '../../../racer/index.ts'
import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { getFigureAnimationState } from './get-figure-animation-state.ts'

const ANIMATION: FigureAnimation = Object.freeze({
  rate: 0.03,
  vector: ZERO_VECTOR3,
  boundsCentre: ZERO_VECTOR3,
  boundsRadius: 1,
  frameCount: 10,
  period: 11,
})
const FIGURE = createFigure([ANIMATION, ANIMATION, ANIMATION], null)

describe('getFigureAnimationState', () => {
  it('reads a playing figure as its first clip, looping', () => {
    // Arrange
    const figure = playFigureAnimation(FIGURE, 2)

    // Act
    const state = getFigureAnimationState(figure)

    // Assert
    expect(state.clip).toMatchObject({ clipIndex: 2, timeInFrames: 0, framesPerMillisecond: 0.03 })
    expect(state.isLooping).toBe(true)
    expect(state.isBlending).toBe(false)
  })

  it('reads a blend as the target clip mixed in by the blend factor', () => {
    // Arrange
    const figure = Object.freeze({
      ...blendFigureAnimation(playFigureAnimation(FIGURE, 0), 1),
      blend: 0.25,
    })

    // Act
    const state = getFigureAnimationState(figure)

    // Assert
    expect(state.isBlending).toBe(true)
    expect(state.secondClip.clipIndex).toBe(1)
    expect(state.isSecondLooping).toBe(true)
    expect(state.blendFactor).toBe(0.25)
    expect(state.blendFactorPerMillisecond).toBeCloseTo(1 / 300, 6)
  })
})
