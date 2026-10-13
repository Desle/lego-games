import {
  createFloatArithmetic,
  IDENTITY_MATRIX3,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import { IDENTITY_TABLES } from '../racer-fixtures/racer-fixtures.ts'
import type { RacerTables } from '../racer.types.ts'
import {
  getCurseOrbitIdle,
  getCurseOrbitWithFigure,
  getCurseOrbitWithoutFigure,
  INITIAL_CURSE_ORBIT,
  stepCurseOrbit,
} from './curse-orbit.ts'
import type { CurseOrbit } from './curse-orbit.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const tables: RacerTables = Object.freeze({
  ...IDENTITY_TABLES,
  cosineValues: Object.freeze(
    Array.from({ length: 1024 }, (_, index) => Math.fround(Math.cos((index * 2 * Math.PI) / 1024)))
  ),
})
const CAR_POSITION = { x: 100, y: 200, z: 5 }

const createBoundOrbit = (position: { x: number; y: number; z: number }): CurseOrbit =>
  getCurseOrbitWithFigure(INITIAL_CURSE_ORBIT, { position, rotation: IDENTITY_MATRIX3 })

const step = (orbit: CurseOrbit, stepMilliseconds: number, carSpeed = 1): CurseOrbit =>
  stepCurseOrbit(orbit, {
    arithmetic,
    tables,
    carPosition: CAR_POSITION,
    carSpeed,
    stepMilliseconds,
  })

describe('stepCurseOrbit (0x0043f530)', () => {
  it('starts the clock over from 1000 when the step passes it, and counts it down after', () => {
    // Arrange
    const orbit = createBoundOrbit(CAR_POSITION)

    // Act
    const first = step(orbit, 33)
    const second = step(first, 33)

    // Assert
    expect([first.clockMilliseconds, second.clockMilliseconds]).toEqual([1000, 967])
  })

  it('counts the blend down to 0 and keeps it there', () => {
    // Arrange
    const orbit = getCurseOrbitIdle(createBoundOrbit(CAR_POSITION))

    // Act
    const first = step(orbit, 600)
    const second = step(first, 600)
    const third = step(second, 600)

    // Assert
    expect([first.blendMilliseconds, second.blendMilliseconds, third.blendMilliseconds]).toEqual([
      400, 0, 0,
    ])
  })

  it('moves a far figure toward its place on the circle by the step times the car speed', () => {
    // Arrange
    const orbit = createBoundOrbit({ x: 100, y: 500, z: 5 })

    // Act
    const stepped = step(orbit, 33, 2)

    // Assert
    const moved = Math.hypot(
      stepped.figure!.position.x - 100,
      stepped.figure!.position.y - 500,
      stepped.figure!.position.z - 5
    )
    expect(moved).toBeCloseTo(66, 3)
    expect(stepped.figure?.position.y).toBeLessThan(500)
  })

  it("moves a slow car's figure at least 0.1 a millisecond", () => {
    // Arrange
    const orbit = createBoundOrbit({ x: 100, y: 500, z: 5 })

    // Act
    const stepped = step(orbit, 33, 0)

    // Assert
    const moved = Math.hypot(
      stepped.figure!.position.x - 100,
      stepped.figure!.position.y - 500,
      stepped.figure!.position.z - 5
    )
    expect(moved).toBeCloseTo(3.3, 3)
  })

  it('puts a figure that is near enough on the circle, 6 from the car and 9 above it', () => {
    // Arrange
    const orbit = createBoundOrbit({ x: 100, y: 206, z: 14 })

    // Act
    const stepped = step(orbit, 33)

    // Assert
    const angle = (stepped.clockMilliseconds * 2 * Math.PI) / 1000
    expect(stepped.figure?.position.x).toBeCloseTo(CAR_POSITION.x + 6 * Math.sin(angle), 1)
    expect(stepped.figure?.position.y).toBeCloseTo(CAR_POSITION.y + 6 * Math.cos(angle), 1)
    expect(stepped.figure?.position.z).toBe(14)
  })

  it('shrinks the figure from full size to two thirds and no further', () => {
    // Arrange
    const orbit = createBoundOrbit(CAR_POSITION)

    // Act
    const once = step(orbit, 33)
    const settled = Array.from({ length: 30 }).reduce<CurseOrbit>(
      (current) => step(current, 33),
      once
    )

    // Assert
    expect(once.figure?.scale).toBeCloseTo(0.9782, 4)
    expect(settled.figure?.scale).toBeCloseTo(0.666, 3)
  })

  it("plays the figure's clip for as long as it circles", () => {
    // Arrange
    const orbit = createBoundOrbit(CAR_POSITION)

    // Act
    const stepped = step(step(orbit, 33), 20)

    // Assert
    expect(stepped.figure?.animationMilliseconds).toBe(53)
  })

  it('faces the figure along the circle with the world up once the blend has ended', () => {
    // Arrange
    const orbit = createBoundOrbit({ x: 100, y: 206, z: 14 })

    // Act
    const stepped = step(step(orbit, 1000), 1)

    // Assert
    const rotation = stepped.figure?.rotation
    expect(rotation?.slice(6)).toEqual([0, 0, 1])
    expect(Math.hypot(rotation?.[0] ?? 0, rotation?.[1] ?? 0)).toBeCloseTo(1, 5)
  })

  it('counts the clocks but moves nothing without a figure', () => {
    // Arrange
    const orbit = getCurseOrbitWithoutFigure(INITIAL_CURSE_ORBIT)

    // Act
    const stepped = step(orbit, 33)

    // Assert
    expect(stepped).toEqual({ clockMilliseconds: 1000, blendMilliseconds: 0, figure: null })
  })
})

describe('the curse orbit between curses', () => {
  it('binds a figure at full size at the frame it is given (0x00439900)', () => {
    // Arrange
    const frame = { position: { x: 1, y: 2, z: 3 }, rotation: IDENTITY_MATRIX3 }

    // Act
    const orbit = getCurseOrbitWithFigure(INITIAL_CURSE_ORBIT, frame)

    // Assert
    expect(orbit.figure).toEqual({ ...frame, scale: 1, animationMilliseconds: 0 })
  })

  it('lets the figure go and starts the blend over on an update without the curse (0x00439b00)', () => {
    // Arrange
    const orbit = step(createBoundOrbit(CAR_POSITION), 33)

    // Act
    const idle = getCurseOrbitIdle(getCurseOrbitWithoutFigure(orbit))

    // Assert
    expect(idle.figure).toBeNull()
    expect(idle.blendMilliseconds).toBe(1000)
  })
})
