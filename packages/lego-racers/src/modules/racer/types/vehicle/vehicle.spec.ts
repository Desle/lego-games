import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { createFigure, getFigureAnimationId } from '../figure/figure.ts'
import { createTestCarBodyWith, createTestContext } from '../racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../racer-state/racer-state.ts'
import type { Figure, Racer, RacerSet, Vehicle } from '../racer.types.ts'
import { createVehicle, updateVehicle } from './vehicle.ts'

const PLAYS = 0x10000
const ANIMATION_COUNT = 0x12

const createAnimations = () =>
  Array.from({ length: ANIMATION_COUNT }, () => ({
    rate: 0.5,
    vector: ZERO_VECTOR3,
    boundsCentre: ZERO_VECTOR3,
    boundsRadius: 1,
    frameCount: 100,
    period: 99,
  }))

const createDriver = (id: number): Figure => ({
  ...createFigure(createAnimations(), null),
  flags: PLAYS,
  currentId: id,
  blend: 1,
})

type CarChange = {
  readonly forwardSpeed?: number
  readonly x?: number
  readonly y?: number
  readonly driverId?: number
  readonly vehicle?: Partial<Vehicle>
  readonly racer?: Partial<Racer>
  readonly curvature?: number
  readonly throttle?: number
}

const createCar = (change: CarChange = {}): Racer => {
  const racer = createRacer(
    createTestCarBodyWith({
      forwardSpeed: change.forwardSpeed ?? 1,
      displayFrame: {
        rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        position: { x: change.x ?? 0, y: change.y ?? 0, z: 0 },
      },
    }),
    createFigure(createAnimations(), null)
  )
  return {
    ...racer,
    driver: { ...racer.driver, curvature: change.curvature ?? 0, throttle: change.throttle ?? 0 },
    vehicle: {
      ...createVehicle(createDriver(change.driverId ?? 9)),
      lookMilliseconds: 1000,
      ...change.vehicle,
    },
    ...change.racer,
  }
}

const update = (racers: readonly Racer[], stepMilliseconds = 16): RacerSet =>
  updateVehicle(createTestContext(), createRacerSet(racers, 0, 0), 0, stepMilliseconds)

const getDriverId = (racerSet: RacerSet): number =>
  getFigureAnimationId(getRacer(racerSet, 0).vehicle.driverFigure)

describe('updateVehicle, 0x00437740', () => {
  it('spins the wheels at |forward speed| × 1.8, forwards on animation 0', () => {
    // Arrange
    const car = createCar({ forwardSpeed: 0.5 })

    // Act
    const racerSet = update([car])

    // Assert
    expect(getRacer(racerSet, 0).figure.currentRate).toBe(0.8999999761581421)
    expect(getFigureAnimationId(getRacer(racerSet, 0).figure)).toBe(0)
  })

  it('treats a speed within 0.0001 as standing, and plays animation 1 when going backwards', () => {
    // Arrange
    const standing = createCar({ forwardSpeed: 0.00005 })
    const reversing = createCar({ forwardSpeed: -0.5 })

    // Act
    const standingSet = update([standing])
    const reversingSet = update([reversing])

    // Assert
    expect(getRacer(standingSet, 0).figure.currentRate).toBe(0)
    expect(getFigureAnimationId(getRacer(reversingSet, 0).figure)).toBe(1)
    expect(getRacer(reversingSet, 0).figure.currentRate).toBe(0.8999999761581421)
  })
})

describe('updateVehicle, the driver 0x0043ec10', () => {
  it('lets the winner of a finished race celebrate with one draw: an odd value plays 0xe, then 0xf', () => {
    // Arrange
    const car = createCar({ racer: { currentLap: 3, racePosition: 1 } })

    // Act
    const racerSet = update([car])

    // Assert
    expect(getDriverId(racerSet)).toBe(0xe)
    expect(getRacer(racerSet, 0).vehicle.driverFigure.targetId).toBe(0xf)
    expect(racerSet.randomPosition).toBe(1)
  })

  it('lets the others sulk: animation 0xb, then 0xc, without a draw', () => {
    // Arrange
    const car = createCar({ racer: { currentLap: 3, racePosition: 2 } })

    // Act
    const racerSet = update([car])

    // Assert
    expect(getDriverId(racerSet)).toBe(0xb)
    expect(getRacer(racerSet, 0).vehicle.driverFigure.targetId).toBe(0xc)
    expect(racerSet.randomPosition).toBe(0)
  })

  it('plays animation 1 for a start boost and 0xa with 500 feedback for a hit, then returns to 9', () => {
    // Arrange
    const boosted = createCar({ vehicle: { reactionFlags: 1 } })
    const hit = createCar({
      vehicle: { reactionFlags: 2 },
      racer: {
        forceFeedback: {
          isPresent: true,
          strength: 0,
          duration: 0,
          phase: 0,
          state: 0,
          elapsed: 0,
        },
      },
    })

    // Act
    const boostedSet = update([boosted])
    const hitSet = update([hit])

    // Assert
    expect(getDriverId(boostedSet)).toBe(1)
    expect(getRacer(boostedSet, 0).vehicle.reactionFlags).toBe(0)
    expect(getDriverId(hitSet)).toBe(0xa)
    expect(getRacer(hitSet, 0).forceFeedback.strength).toBe(500)
    expect(getRacer(hitSet, 0).vehicle.driverFigure.targetId).toBe(9)
  })

  it('stops with a voice line and animation 0 after braking from above 0.05 to below 0.01', () => {
    // Arrange
    const car = createCar({ forwardSpeed: 0.005, vehicle: { previousForwardSpeed: 0.5 } })

    // Act
    const racerSet = update([car])

    // Assert
    expect(getDriverId(racerSet)).toBe(0)
    expect(getRacer(racerSet, 0).vehicle.previousForwardSpeed).toBe(0)
    expect(getRacer(racerSet, 0).voiceMilliseconds).toBe(2 * 4 + 5000)
  })

  it('reverses while braking backwards, steers with the curvature and rests when straight', () => {
    // Arrange
    const reversing = createCar({ forwardSpeed: -0.5, throttle: -100, driverId: 5 })
    const left = createCar({ curvature: -40, driverId: 9 })
    const right = createCar({ curvature: 40, driverId: 9 })
    const straight = createCar({ driverId: 5 })

    // Act
    const reversingSet = update([reversing])
    const leftSet = update([left])
    const rightSet = update([right])
    const straightSet = update([straight])

    // Assert
    expect(getDriverId(reversingSet)).toBe(2)
    expect(getDriverId(leftSet)).toBe(5)
    expect(getDriverId(rightSet)).toBe(6)
    expect(getDriverId(straightSet)).toBe(9)
  })

  it('looks at a racer within 200 units after a draw for the next look', () => {
    // Arrange
    const watcher = createCar({ vehicle: { lookMilliseconds: 0 } })
    const watched = createCar({ y: 5 })

    // Act
    const racerSet = update([watcher, watched])

    // Assert
    expect(getDriverId(racerSet)).toBe(0x10)
    expect(getRacer(racerSet, 0).vehicle.watchedRacerIndex).toBe(1)
    expect(getRacer(racerSet, 0).vehicle.lookMilliseconds).toBe(5001)
  })
})
