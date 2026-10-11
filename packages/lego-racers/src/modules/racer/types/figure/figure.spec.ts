import {
  createFloatArithmetic,
  FpuPrecision,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { Figure, FigureAnimation } from '../racer.types.ts'
import {
  blendFigureAnimation,
  chainFigureAnimation,
  createFigure,
  getFigureAnimationId,
  getFigureBounds,
  playFigureAnimation,
  updateFigure,
} from './figure.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const PLAYS = 0x10000
const BLENDS = 0x20000
const LOOPS = 0x40000
const ENDED = 0x80000
const WRAPPED = 0x2000000

const createAnimation = (change: Partial<FigureAnimation>): FigureAnimation => ({
  rate: 0.5,
  vector: ZERO_VECTOR3,
  boundsCentre: ZERO_VECTOR3,
  boundsRadius: 1,
  frameCount: 11,
  period: 10,
  ...change,
})

const createPlaying = (animations: readonly FigureAnimation[]): Figure => ({
  ...playFigureAnimation(createFigure(animations, null), 0),
  flags: PLAYS | LOOPS,
})

describe('playFigureAnimation, 0x0040dad0', () => {
  it('starts the animation at time 0 with its rate and vector, looping', () => {
    // Arrange
    const figure = createFigure(
      [createAnimation({}), createAnimation({ rate: 0.25, vector: { x: 1, y: 2, z: 3 } })],
      null
    )

    // Act
    const played = playFigureAnimation(figure, 1)

    // Assert
    expect(played.currentId).toBe(1)
    expect(played.currentRate).toBe(0.25)
    expect(played.currentTime).toBe(0)
    expect(played.outputVector).toEqual({ x: 1, y: 2, z: 3 })
    expect(played.flags & LOOPS).toBe(LOOPS)
  })

  it('chains to a second animation: the target id and flags 0x500000', () => {
    // Arrange
    const figure = createPlaying([createAnimation({}), createAnimation({})])

    // Act
    const chained = chainFigureAnimation(figure, 1, 0)

    // Assert
    expect(chained.currentId).toBe(1)
    expect(chained.targetId).toBe(0)
    expect(chained.flags & 0x500000).toBe(0x500000)
    expect(chained.flags & LOOPS).toBe(0)
  })
})

describe('blendFigureAnimation, 0x0040db80', () => {
  it('blends towards another animation over 300 ms, and ignores the one that already shows', () => {
    // Arrange
    const figure = createPlaying([createAnimation({}), createAnimation({ rate: 0.25 })])

    // Act
    const blending = blendFigureAnimation(figure, 1)
    const same = blendFigureAnimation(blending, 1)

    // Assert
    expect(blending.flags & BLENDS).toBe(BLENDS)
    expect(getFigureAnimationId(blending)).toBe(1)
    expect(blending.blendRate).toBe(1 / 300)
    expect(blending.targetRate).toBe(0.25)
    expect(same).toBe(blending)
  })
})

describe('updateFigure, 0x0040dd60', () => {
  it('advances the time by rate × milliseconds and clears the wrapped flag', () => {
    // Arrange
    const figure = { ...createPlaying([createAnimation({})]), flags: PLAYS | LOOPS | WRAPPED }

    // Act
    const updated = updateFigure(arithmetic, figure, 4)

    // Assert
    expect(updated.currentTime).toBe(2)
    expect(updated.flags & WRAPPED).toBe(0)
  })

  it('wraps a looping animation past the last frame by whole periods and flags it', () => {
    // Arrange
    const figure = { ...createPlaying([createAnimation({})]), currentTime: 9 }

    // Act
    const updated = updateFigure(arithmetic, figure, 8)

    // Assert
    expect(updated.currentTime).toBe(3)
    expect(updated.flags & WRAPPED).toBe(WRAPPED)
  })

  it('stops at the last frame when it does not loop, or plays the next animation when it chains', () => {
    // Arrange
    const animations = [createAnimation({}), createAnimation({ rate: 0.1 })]
    const stopping = { ...createPlaying(animations), flags: PLAYS, currentTime: 9 }
    const chaining = chainFigureAnimation(createPlaying(animations), 0, 1)
    const chained = { ...chaining, flags: chaining.flags | PLAYS, currentTime: 9 }

    // Act
    const stopped = updateFigure(arithmetic, stopping, 8)
    const next = updateFigure(arithmetic, chained, 8)

    // Assert
    expect(stopped.currentTime).toBe(10)
    expect(stopped.flags & ENDED).toBe(ENDED)
    expect(next.currentId).toBe(1)
    expect(next.currentRate).toBe(0.1)
    expect(next.flags & ENDED).toBe(ENDED)
  })

  it('moves a blend on by its rate and mixes the vectors', () => {
    // Arrange
    const animations = [
      createAnimation({ vector: { x: 0, y: 0, z: 0 } }),
      createAnimation({ vector: { x: 10, y: 20, z: 30 } }),
    ]
    const blending = blendFigureAnimation(createPlaying(animations), 1)

    // Act
    const updated = updateFigure(arithmetic, blending, 150)

    // Assert
    expect(updated.blend).toBe(0.5)
    expect(updated.outputVector).toEqual({ x: 5, y: 10, z: 15 })
  })

  it('ends a blend and plays the left-over milliseconds on the target', () => {
    // Arrange
    const animations = [createAnimation({}), createAnimation({ rate: 1 })]
    const blending = blendFigureAnimation(createPlaying(animations), 1)

    // Act
    const updated = updateFigure(arithmetic, blending, 350)

    // Assert
    expect(updated.flags & BLENDS).toBe(0)
    expect(updated.currentId).toBe(1)
    expect(updated.currentTime).toBeGreaterThan(0)
  })

  it('does nothing to a figure that is not playing', () => {
    // Arrange
    const figure = createFigure([createAnimation({})], null)

    // Act
    const updated = updateFigure(arithmetic, figure, 16)

    // Assert
    expect(updated).toEqual(figure)
  })
})

describe('getFigureBounds, 0x0040e0b0', () => {
  const child = { centre: { x: 1, y: 2, z: 3 }, radius: 4, radiusScale: 0.5 }

  it('has no sphere without a model part', () => {
    // Arrange
    const figure = createFigure([], null)

    // Act
    const bounds = getFigureBounds(arithmetic, figure)

    // Assert
    expect(bounds).toBeNull()
  })

  it("takes the model part's sphere times the scale while nothing plays", () => {
    // Arrange
    const figure = { ...createFigure([], child), scale: 2 }

    // Act
    const bounds = getFigureBounds(arithmetic, figure)

    // Assert
    expect(bounds).toEqual({ centre: { x: 2, y: 4, z: 6 }, radius: 8 })
  })

  it("takes the animation's sphere times the radius scale while it plays, and averages with the target when blending", () => {
    // Arrange
    const first = createAnimation({ boundsCentre: { x: 2, y: 0, z: 0 }, boundsRadius: 2 })
    const second = createAnimation({ boundsCentre: { x: 4, y: 0, z: 0 }, boundsRadius: 3 })
    const playing = { ...createFigure([first, second], child), flags: PLAYS }
    const blending = { ...playing, flags: PLAYS | BLENDS, targetId: 1 }

    // Act
    const single = getFigureBounds(arithmetic, playing)
    const mixed = getFigureBounds(arithmetic, blending)

    // Assert
    expect(single).toEqual({ centre: { x: 1, y: 0, z: 0 }, radius: 1 })
    expect(mixed).toEqual({ centre: { x: 1.5, y: 0, z: 0 }, radius: 2 })
  })
})
