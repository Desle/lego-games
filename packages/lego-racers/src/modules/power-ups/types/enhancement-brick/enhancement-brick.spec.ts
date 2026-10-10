import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickState } from '../power-up-effect-kind/power-up-effect-kind.ts'
import type { EnhancementBrick } from '../power-ups.types.ts'
import {
  advanceEnhancementBrick,
  collectEnhancementBrick,
  createEnhancementBrick,
  dropEnhancementBrick,
  getDropPosition,
  releaseEnhancementBrick,
} from './enhancement-brick.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const HOME = Object.freeze({ position: [10, 20, 30] as const })

const getAvailable = (): EnhancementBrick =>
  advanceEnhancementBrick(SINGLE, createEnhancementBrick(HOME), 1)

describe('advanceEnhancementBrick', () => {
  it('is available after the first update, its timer having started at 3000 ms (0x00453620)', () => {
    // Arrange
    const brick = createEnhancementBrick(HOME)

    // Act
    const advanced = advanceEnhancementBrick(SINGLE, brick, 1)

    // Assert
    expect(brick.state).toBe(BrickState.APPEARING)
    expect([advanced.state, advanced.scale]).toEqual([BrickState.AVAILABLE, Math.fround(0.8)])
  })

  it('stays hidden after a collect until it is released (0x00453690 has no respawn timer)', () => {
    // Arrange
    const collected = collectEnhancementBrick(getAvailable())

    // Act
    const hidden = advanceEnhancementBrick(SINGLE, collected, 251)
    const later = advanceEnhancementBrick(SINGLE, hidden, 60000)

    // Assert
    expect(hidden.state).toBe(BrickState.HIDDEN)
    expect(later.state).toBe(BrickState.HIDDEN)
  })

  it('goes home after 10 s on the ground once dropped', () => {
    // Arrange
    const dropped = dropEnhancementBrick(SINGLE, getAvailable(), { x: 1, y: 2, z: 3 }, () => null)
    const settled = advanceEnhancementBrick(SINGLE, dropped, 600)

    // Act
    const waiting = advanceEnhancementBrick(SINGLE, settled, 9400)
    const leaving = advanceEnhancementBrick(SINGLE, waiting, 1)
    const home = advanceEnhancementBrick(SINGLE, leaving, 251)

    // Assert
    expect(settled.state).toBe(BrickState.AVAILABLE)
    expect(waiting.state).toBe(BrickState.AVAILABLE)
    expect([leaving.state, leaving.isReturningHome]).toEqual([BrickState.COLLECTED, true])
    expect([home.state, home.position]).toEqual([BrickState.APPEARING, { x: 10, y: 20, z: 30 }])
  })
})

describe('releaseEnhancementBrick', () => {
  it('puts a hidden brick back at home, growing in (0x004537f0)', () => {
    // Arrange
    const hidden = advanceEnhancementBrick(SINGLE, collectEnhancementBrick(getAvailable()), 251)

    // Act
    const released = releaseEnhancementBrick(hidden)

    // Assert
    expect(released).toMatchObject({
      state: BrickState.APPEARING,
      timerMilliseconds: 0,
      position: { x: 10, y: 20, z: 30 },
    })
  })
})

describe('getDropPosition', () => {
  it('probes from 25 above to 25 below and lands 5 above the hit (0x00453840)', () => {
    // Arrange
    const probes: unknown[] = []
    const getGroundPoint = (start: unknown, end: unknown) => {
      probes.push(start, end)
      return { x: 1, y: 2, z: -4 }
    }

    // Act
    const position = getDropPosition(SINGLE, { x: 1, y: 2, z: 3 }, getGroundPoint)

    // Assert
    expect(probes).toEqual([
      { x: 1, y: 2, z: 28 },
      { x: 1, y: 2, z: -22 },
    ])
    expect(position).toEqual({ x: 1, y: 2, z: 1 })
  })

  it('keeps the racer’s position when the probe misses', () => {
    // Arrange
    const getGroundPoint = () => null

    // Act
    const position = getDropPosition(SINGLE, { x: 1, y: 2, z: 3 }, getGroundPoint)

    // Assert
    expect(position).toEqual({ x: 1, y: 2, z: 8 })
  })
})
