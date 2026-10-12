import { createGhostSession, EMPTY_GHOST_RUN } from '../../../ghost/index.ts'
import type { GhostRun, GhostSession } from '../../../ghost/index.ts'
import type { RaceState } from '../../../race/index.ts'
import { getGhostCars } from './get-ghost-cars.ts'

const getRun = (startX: number): GhostRun => ({
  ...EMPTY_GHOST_RUN,
  samples: [
    { position: [startX * 32, 0, 0], orientationBytes: [0, 0, 0, 127] },
    { position: [(startX + 10) * 32, 0, 0], orientationBytes: [0, 0, 0, 127] },
    { position: [(startX + 20) * 32, 0, 0], orientationBytes: [0, 0, 0, 127] },
  ],
  startPosition: [startX, 0, 0],
  startQuaternion: [0, 0, 0, 1],
})

const getRaceState = (ghost: GhostSession | null): RaceState =>
  ({
    ghost,
    playerRacerIndices: [0],
    racerSet: { racers: [{ vehicle: { seatPoint: { x: 1, y: 2, z: 3 } } }] },
  }) as unknown as RaceState

const getGhost = (changes: Partial<GhostSession>): GhostSession => ({
  ...createGhostSession(false),
  championRun: getRun(100),
  ...changes,
})

describe('getGhostCars', () => {
  it('draws nothing in a race without a ghost', () => {
    // Arrange
    const raceState = getRaceState(null)

    // Act
    const step = getGhostCars(raceState)

    // Assert
    expect(step.cars).toEqual([])
    expect(step.raceState).toBe(raceState)
  })

  it('sets the champion at the start of its run before the clock runs', () => {
    // Arrange
    const raceState = getRaceState(getGhost({}))

    // Act
    const { cars } = getGhostCars(raceState)

    // Assert
    expect(cars).toHaveLength(1)
    expect(cars[0]?.kind).toBe('champion')
    expect(cars[0]?.position).toEqual({ x: 100, y: 0, z: 0 })
  })

  it('moves the champion between the recorded samples while the clock runs', () => {
    // Arrange
    const raceState = getRaceState(getGhost({ isRunning: true, elapsedMilliseconds: 125 }))

    // Act
    const { cars } = getGhostCars(raceState)

    // Assert
    expect(cars[0]?.position.x).toBeCloseTo(105, 3)
    expect(cars[0]?.speed).toBeGreaterThan(0)
  })

  it('places the driver at the seat point carried by the car', () => {
    // Arrange
    const raceState = getRaceState(getGhost({}))

    // Act
    const { cars } = getGhostCars(raceState)

    // Assert
    const { position, driverPosition } = cars[0] ?? { position: null, driverPosition: null }
    expect(driverPosition?.z).toBeCloseTo((position?.z ?? 0) + 1.608, 3)
  })

  it('draws the best run first with the seat point of the player, then the champion', () => {
    // Arrange
    const ghost = getGhost({
      bestRun: getRun(50),
      isBestRunShown: true,
      isRunning: true,
      elapsedMilliseconds: 0,
    })

    // Act
    const { cars } = getGhostCars(getRaceState(ghost))

    // Assert
    expect(cars.map((car) => car.kind)).toEqual(['best', 'champion'])
    expect(cars[0]?.position.x).toBeCloseTo(50, 3)
  })

  it('stops drawing a run whose last sample has passed and remembers it', () => {
    // Arrange
    const raceState = getRaceState(getGhost({ isRunning: true, elapsedMilliseconds: 600 }))

    // Act
    const step = getGhostCars(raceState)

    // Assert
    expect(step.cars).toEqual([])
    expect(step.raceState.ghost?.isChampionPlaybackFinished).toBe(true)
  })
})
