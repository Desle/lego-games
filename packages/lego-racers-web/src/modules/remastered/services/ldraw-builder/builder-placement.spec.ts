import { getPartPhase, getPlacementPosition, getRotatedBox } from './builder-placement.ts'

// A 2 x 4 brick (3001) in its own frame: 80 wide in x, 40 deep in z, body 24 down from its origin, studs 4 up.
const BRICK_BOX = { minimum: [-40, -4, -20], maximum: [40, 24, 20] } as const
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]

describe('getPlacementPosition', () => {
  it('stands a brick on the ground with its box on the stud grid', () => {
    // Arrange
    const target = { point: [3, 0, 7], normal: [0, -1, 0], phase: [0, 0, 0] } as const

    // Act
    const position = getPlacementPosition(target, BRICK_BOX)

    // Assert
    expect(position).toEqual([0, -24, 0])
  })

  it('stacks on the top of a brick from a point on one of its studs', () => {
    // Arrange
    const below = {
      colorCode: 4,
      position: [10, -24, 0],
      rotation: IDENTITY,
      partName: '3001.dat',
      commentLines: [],
    } as const
    const target = {
      point: [10, -28, 5],
      normal: [0, -1, 0],
      phase: getPartPhase(BRICK_BOX, below),
    } as const

    // Act
    const position = getPlacementPosition(target, BRICK_BOX)

    // Assert
    expect(position).toEqual([10, -48, 0])
  })

  it('puts a brick beside a side face', () => {
    // Arrange
    const target = { point: [40, -10, 0], normal: [1, 0, 0], phase: [10, 0, 0] } as const

    // Act
    const position = getPlacementPosition(target, BRICK_BOX)

    // Assert
    expect(position[0]).toBe(90)
  })
})

describe('getRotatedBox', () => {
  it('swaps width and depth for a quarter turn', () => {
    // Arrange
    const quarter = [0, 0, 1, 0, 1, 0, -1, 0, 0]

    // Act
    const box = getRotatedBox(BRICK_BOX, quarter)

    // Assert
    expect(box.minimum.map((value) => value + 0)).toEqual([-20, -4, -40])
    expect(box.maximum.map((value) => value + 0)).toEqual([20, 24, 40])
  })
})
