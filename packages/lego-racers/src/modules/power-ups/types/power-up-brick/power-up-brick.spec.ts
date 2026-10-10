import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { BrickKind, RaceModeFlag } from '../brick-kind/brick-kind.ts'
import { BrickState } from '../power-up-effect-kind/power-up-effect-kind.ts'
import type { PowerUpBrick } from '../power-ups.types.ts'
import { createRacerPowerUps, getRacerWithBrick } from '../racer-power-ups/racer-power-ups.ts'
import { advancePowerUpBrick, createPowerUpBrick, touchPowerUpBrick } from './power-up-brick.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const PLACEMENT = Object.freeze({ position: [1, 2, 3] as const, kind: 4, identifier: 7 })

const getAvailableBrick = (): PowerUpBrick => {
  const created = createPowerUpBrick(PLACEMENT, 0)
  const appearing = advancePowerUpBrick(SINGLE, created, 12)
  return advancePowerUpBrick(SINGLE, appearing, 501)
}

describe('createPowerUpBrick', () => {
  it('starts hidden with 3000 ms already elapsed (0x004539b0)', () => {
    // Arrange
    const placement = PLACEMENT

    // Act
    const brick = createPowerUpBrick(placement, 0)

    // Assert
    expect(brick).toMatchObject({
      position: { x: 1, y: 2, z: 3 },
      state: BrickState.HIDDEN,
      timerMilliseconds: 3000,
      kind: BrickKind.HAZARD,
      placedKind: BrickKind.HAZARD,
      nextKind: BrickKind.TURBO,
      identifier: 7,
    })
  })

  it('applies the race-mode override (0x00458a80)', () => {
    // Arrange
    const flags = RaceModeFlag.ONLY_TURBOS

    // Act
    const brick = createPowerUpBrick(PLACEMENT, flags)

    // Assert
    expect(brick.kind).toBe(BrickKind.TURBO)
  })
})

describe('advancePowerUpBrick', () => {
  it('appears on the first update, then becomes available after 501 ms at scale 0.8', () => {
    // Arrange
    const brick = createPowerUpBrick(PLACEMENT, 0)

    // Act
    const appearing = advancePowerUpBrick(SINGLE, brick, 12)
    const stillAppearing = advancePowerUpBrick(SINGLE, appearing, 500)
    const available = advancePowerUpBrick(SINGLE, stillAppearing, 1)

    // Assert
    expect([appearing.state, appearing.timerMilliseconds]).toEqual([BrickState.APPEARING, 0])
    expect(stillAppearing.state).toBe(BrickState.APPEARING)
    expect([available.state, available.scale]).toEqual([BrickState.AVAILABLE, Math.fround(0.8)])
  })

  it('comes back 3000 ms after a collect by a racer that held nothing', () => {
    // Arrange
    const collected = touchPowerUpBrick(getAvailableBrick(), createRacerPowerUps(0, 0), false).brick

    // Act
    const hidden = advancePowerUpBrick(SINGLE, collected, 251)
    const waiting = advancePowerUpBrick(SINGLE, hidden, 2999)
    const appearing = advancePowerUpBrick(SINGLE, waiting, 1)

    // Assert
    expect([hidden.state, hidden.scale]).toEqual([BrickState.HIDDEN, 0])
    expect(waiting.state).toBe(BrickState.HIDDEN)
    expect(appearing.state).toBe(BrickState.APPEARING)
  })
})

describe('touchPowerUpBrick', () => {
  it('gives the racer the brick and sets its use check to 300 ms (0x00439210)', () => {
    // Arrange
    const racer = createRacerPowerUps(0, 0)

    // Act
    const touch = touchPowerUpBrick(getAvailableBrick(), racer, false)

    // Assert
    expect(touch.isCollected).toBe(true)
    expect(touch.racer.heldBrickKind).toBe(BrickKind.HAZARD)
    expect(touch.racer.useCheckIntervalMilliseconds).toBe(300)
    expect(touch.brick.state).toBe(BrickState.COLLECTED)
  })

  it('swaps: the brick reappears at once as the racer’s previous kind (0x00457820)', () => {
    // Arrange
    const racer = getRacerWithBrick(createRacerPowerUps(0, 0), BrickKind.SHIELD)
    const touched = touchPowerUpBrick(getAvailableBrick(), racer, false)

    // Act
    const reappearing = advancePowerUpBrick(SINGLE, touched.brick, 251)

    // Assert
    expect(touched.racer.heldBrickKind).toBe(BrickKind.HAZARD)
    expect(reappearing.state).toBe(BrickState.APPEARING)
    expect(reappearing.kind).toBe(BrickKind.SHIELD)
  })

  it('only marks the touch when the racer is warping', () => {
    // Arrange
    const racer = createRacerPowerUps(0, 0)

    // Act
    const touch = touchPowerUpBrick(getAvailableBrick(), racer, true)

    // Assert
    expect(touch.isCollected).toBe(false)
    expect(touch.brick.isTouchedThisFrame).toBe(true)
    expect(touch.racer).toBe(racer)
  })
})
