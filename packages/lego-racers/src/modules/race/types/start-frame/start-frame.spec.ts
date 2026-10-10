import { FIXTURE_ARITHMETIC } from '../race-fixtures/race-fixtures.ts'
import { getStartFrame } from './start-frame.ts'

describe('getStartFrame', () => {
  it('puts a racer on its slot of the start grid, rotated by the two axes', () => {
    // Arrange
    const startPositions = [
      { slot: 0, position: [1, 2, 3], firstAxis: [0, 1, 0], secondAxis: [0, 0, 1] },
    ] as const

    // Act
    const frame = getStartFrame(FIXTURE_ARITHMETIC, startPositions, 0, null)

    // Assert
    expect(frame.position).toEqual({ x: 1, y: 2, z: 3 })
    expect(frame.rotation).toEqual([0, 1, 0, -1, 0, 0, 0, 0, 1])
  })

  it('starts a racer with a route at the route start', () => {
    // Arrange
    const route = {
      firstVector: [4, 5, 6],
      firstQuaternion: [0, 0, 0, 1],
      secondVector: [0, 0, 0],
      secondQuaternion: [0, 0, 0, 1],
      firstInteger: 0,
      sampleIndex: 0,
      samples: [],
      readByteCount: 0,
    } as const

    // Act
    const frame = getStartFrame(FIXTURE_ARITHMETIC, [], 3, route)

    // Assert
    expect(frame.position).toEqual({ x: 4, y: 5, z: 6 })
    expect(frame.rotation).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1])
  })
})
