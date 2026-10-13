import {
  findSideStud,
  getPartPhase,
  getPlacedStuds,
  getPlacementPosition,
  getRotatedBox,
  getSideStudPosition,
} from './builder-placement.ts'
import { getFacingRotation } from './builder-rotation.ts'

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

// A 87087 (Brick 1 x 1 with Stud on 1 Side) standing on the ground: its top stud and its side stud facing -z.
const SIDE_STUD_BRICK = {
  colorCode: 4,
  position: [0, -24, 0],
  rotation: IDENTITY,
  partName: '87087.dat',
} as const
const SIDE_STUD_BRICK_STUDS = [
  { position: [0, 0, 0], direction: [0, -1, 0] },
  { position: [0, 10, -10], direction: [0, 0, -1] },
] as const

describe('findSideStud', () => {
  it('finds the side stud from its face, its top or its base, but leaves the top stud alone', () => {
    // Arrange
    const studs = getPlacedStuds(SIDE_STUD_BRICK_STUDS, SIDE_STUD_BRICK)

    // Act
    const onFace = findSideStud(studs, [3, -20, -10], [0, 0, -1])
    const onStudTop = findSideStud(studs, [1, -14, -14], [0, 0, -1])
    const onStudSide = findSideStud(studs, [6, -14, -12], [1, 0, 0])
    const inStudHole = findSideStud(studs, [-3, -12, -8.5], [0.8, -0.6, 0])
    const onTop = findSideStud(studs, [2, -24, 2], [0, -1, 0])
    const onOtherFace = findSideStud(studs, [10, -12, 0], [1, 0, 0])

    // Assert
    expect(onFace?.position).toEqual([0, -14, -10])
    expect(onStudTop?.direction).toEqual([0, 0, -1])
    expect(onStudSide?.direction).toEqual([0, 0, -1])
    expect(inStudHole?.direction).toEqual([0, 0, -1])
    expect(onTop).toBeNull()
    expect(onOtherFace).toBeNull()
  })
})

describe('getSideStudPosition', () => {
  it('puts a 2 x 4 brick on a side stud, bottom flush with the face and its anti-studs on the stud', () => {
    // Arrange
    const [stud] = getPlacedStuds([SIDE_STUD_BRICK_STUDS[1]], SIDE_STUD_BRICK)
    const rotation = getFacingRotation(IDENTITY, [0, 0, -1])
    const box = getRotatedBox(BRICK_BOX, rotation)

    // Act
    const position = stud === undefined ? null : getSideStudPosition([3, -12, -10], stud, box)

    // Assert
    expect(position).toEqual([10, -4, -34])
    expect((position?.[2] ?? 0) + box.maximum[2]).toBe(-10)
  })
})
