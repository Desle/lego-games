import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickState } from '../power-up-effect-kind/power-up-effect-kind.ts'
import type { BrickBase } from '../power-ups.types.ts'
import {
  advanceBrickBase,
  createBrickBase,
  getIsBrickCollectable,
  getTouchedBrick,
} from './brick-base.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const createBrick = (state: BrickBase['state'], timerMilliseconds: number): BrickBase =>
  Object.freeze({
    ...createBrickBase({ x: 0, y: 0, z: 0 }),
    state,
    timerMilliseconds,
  })

describe('advanceBrickBase', () => {
  it('grows an appearing brick by 0.0025 per millisecond below 400 ms (0x00453a20)', () => {
    // Arrange
    const brick = createBrick(BrickState.APPEARING, 0)

    // Act
    const advanced = advanceBrickBase(SINGLE, brick, 100)

    // Assert
    expect(advanced.timerMilliseconds).toBe(100)
    expect(advanced.scale).toBe(Math.fround(100 * Math.fround(0.0025)))
  })

  it('settles from 1.0 by 0.002 per millisecond between 400 and 499 ms', () => {
    // Arrange
    const brick = createBrick(BrickState.APPEARING, 400)

    // Act
    const advanced = advanceBrickBase(SINGLE, brick, 50)

    // Assert
    expect(advanced.scale).toBe(Math.fround(1 - Math.fround(50 * Math.fround(0.002))))
  })

  it('leaves the scale alone from 500 ms on', () => {
    // Arrange
    const brick = createBrick(BrickState.APPEARING, 480)

    // Act
    const advanced = advanceBrickBase(SINGLE, brick, 20)

    // Assert
    expect(advanced.scale).toBe(1)
  })

  it('shrinks a collected brick as (0.01 · 0.8) · ((250 - t) · 0.4)', () => {
    // Arrange
    const brick = createBrick(BrickState.COLLECTED, 0)
    const first = Math.fround(Math.fround(1 / 100) * Math.fround(0.8))
    const second = Math.fround(150 * Math.fround(100 * Math.fround(0.004)))

    // Act
    const advanced = advanceBrickBase(SINGLE, brick, 100)

    // Assert
    expect(advanced.scale).toBe(Math.fround(first * second))
  })

  it('does nothing to an unused brick', () => {
    // Arrange
    const brick = createBrick(BrickState.UNUSED, 7)

    // Act
    const advanced = advanceBrickBase(SINGLE, brick, 100)

    // Assert
    expect(advanced).toBe(brick)
  })

  it('moves this frame’s touch to last frame and clears it', () => {
    // Arrange
    const brick = getTouchedBrick(createBrick(BrickState.AVAILABLE, 0))

    // Act
    const once = advanceBrickBase(SINGLE, brick, 10)
    const twice = advanceBrickBase(SINGLE, once, 10)

    // Assert
    expect([once.isTouchedThisFrame, once.isTouchedLastFrame]).toEqual([false, true])
    expect([twice.isTouchedThisFrame, twice.isTouchedLastFrame]).toEqual([false, false])
  })
})

describe('getIsBrickCollectable', () => {
  it('needs an available brick and a racer that is not warping', () => {
    // Arrange
    const available = createBrick(BrickState.AVAILABLE, 0)
    const hidden = createBrick(BrickState.HIDDEN, 0)

    // Act
    const results = [
      getIsBrickCollectable(available, false, false),
      getIsBrickCollectable(available, true, true),
      getIsBrickCollectable(hidden, false, true),
    ]

    // Assert
    expect(results).toEqual([true, false, false])
  })

  it('lets a racer sitting on a brick collect again only when it holds nothing (0x00453af0)', () => {
    // Arrange
    const brick = Object.freeze({
      ...createBrick(BrickState.AVAILABLE, 0),
      isTouchedLastFrame: true,
    })

    // Act
    const results = [
      getIsBrickCollectable(brick, false, false),
      getIsBrickCollectable(brick, false, true),
    ]

    // Assert
    expect(results).toEqual([false, true])
  })
})
