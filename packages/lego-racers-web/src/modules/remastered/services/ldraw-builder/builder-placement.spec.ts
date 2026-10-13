import {
  findSideStud,
  getGridPoint,
  getPartPhase,
  getPlacedStuds,
  getPlacementPosition,
  getRotatedBox,
  getSideStudPosition,
} from './builder-placement.ts'
import { turnQuarter } from './builder-document.ts'
import { getFacingRotation } from './builder-rotation.ts'
import type { PartStud } from './builder-studs.types.ts'
import type { BuilderBox, Vector } from './ldraw-builder.types.ts'

// A 2 x 4 brick (3001) in its own frame: 80 wide in x, 40 deep in z, body 24 down from its origin, studs 4 up.
const BRICK_BOX = { minimum: [-40, -4, -20], maximum: [40, 24, 20] } as const
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const BRICK_GRID_POINT = getGridPoint([], BRICK_BOX, IDENTITY)

describe('getPlacementPosition', () => {
  it('stands a brick on the ground with its box on the stud grid', () => {
    // Arrange
    const target = { point: [3, 0, 7], normal: [0, -1, 0], phase: [0, 0, 0] } as const

    // Act
    const position = getPlacementPosition(target, BRICK_BOX, BRICK_GRID_POINT)

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
      phase: getPartPhase(BRICK_GRID_POINT, below),
    } as const

    // Act
    const position = getPlacementPosition(target, BRICK_BOX, BRICK_GRID_POINT)

    // Assert
    expect(position).toEqual([10, -48, 0])
  })

  it('puts a brick beside a side face', () => {
    // Arrange
    const target = { point: [40, -10, 0], normal: [1, 0, 0], phase: [10, 0, 0] } as const

    // Act
    const position = getPlacementPosition(target, BRICK_BOX, BRICK_GRID_POINT)

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
    const position =
      stud === undefined
        ? null
        : getSideStudPosition([3, -12, -10], stud, box, getGridPoint([], BRICK_BOX, rotation))

    // Assert
    expect(position).toEqual([10, -4, -34])
    expect((position?.[2] ?? 0) + box.maximum[2]).toBe(-10)
  })
})

// Parts with their boxes (from their geometry) and their upward studs, read from the LDraw library. Overhangs (handles, wheel pins)
// put the box corner off the stud grid.
const createUpwardStuds = (positions: readonly Vector[]): readonly PartStud[] =>
  positions.map((position) => ({ position, direction: [0, -1, 0] }))
const getTwoByTwoStuds = (height: number) =>
  createUpwardStuds([
    [-10, height, -10],
    [-10, height, 10],
    [10, height, -10],
    [10, height, 10],
  ])
const LIBRARY_PARTS: Readonly<
  Record<string, { readonly box: BuilderBox; readonly studs: readonly PartStud[] }>
> = {
  '3001': {
    box: BRICK_BOX,
    studs: createUpwardStuds(
      [-30, -10, 10, 30].flatMap((x): Vector[] => [
        [x, 0, -10],
        [x, 0, 10],
      ])
    ),
  },
  '3839b': {
    box: { minimum: [-30, -4, -30], maximum: [30, 10, 10] },
    studs: createUpwardStuds([
      [-10, 0, 0],
      [10, 0, 0],
    ]),
  },
  '3023b': {
    box: { minimum: [-20, -4, -10], maximum: [20, 8, 10] },
    studs: createUpwardStuds([
      [-10, 0, 0],
      [10, 0, 0],
    ]),
  },
  '3070b': { box: { minimum: [-10, 0, -10], maximum: [10, 8, 10] }, studs: [] },
  '4600': { box: { minimum: [-34, -4, -20], maximum: [34, 10, 20] }, studs: getTwoByTwoStuds(0) },
  '6157': { box: { minimum: [-44, 0, -20], maximum: [44, 16, 20] }, studs: getTwoByTwoStuds(8) },
  '4488': { box: { minimum: [-20, -4, -20], maximum: [34, 16, 20] }, studs: getTwoByTwoStuds(0) },
  '2926': {
    box: { minimum: [-54, -4, -10], maximum: [54, 10, 10] },
    studs: createUpwardStuds([-30, -10, 10, 30].map((x): Vector => [x, 0, 0])),
  },
}
const BRICK_BELOW = {
  colorCode: 4,
  position: [10, -24, 0],
  rotation: IDENTITY,
  partName: '3001.dat',
} as const
const getRemainder = (value: number) => (((value % 20) + 20) % 20) + 0

// Where each stud (or, for a tile, its box's middle) of a part ends up across, as remainders of the stud grid.
const getStudRemainders = (name: string, rotation: readonly number[], position: Vector) => {
  const part = LIBRARY_PARTS[name]
  if (part === undefined) return []
  const placed = { colorCode: 4, position, rotation, partName: `${name}.dat` }
  const points =
    part.studs.length > 0
      ? getPlacedStuds(part.studs, placed).map((stud) => stud.position)
      : [[position[0], 0, position[2]] as const]
  return points.map((point) => [getRemainder(point[0]), getRemainder(point[2])])
}

describe('stud alignment', () => {
  const below = LIBRARY_PARTS['3001']
  const phase =
    below === undefined
      ? ([0, 0, 0] as const)
      : getPartPhase(getGridPoint(below.studs, below.box, IDENTITY), BRICK_BELOW)
  const brickStudRemainders = getStudRemainders('3001', IDENTITY, BRICK_BELOW.position)
  const names = ['3001', '3839b', '3023b', '3070b', '4600', '6157', '4488', '2926']
  const rotations = [IDENTITY, turnQuarter(IDENTITY)]

  it.each(names)('puts the studs of %s on the studs of a 3001 below, turned or not', (name) => {
    // Arrange
    const part = LIBRARY_PARTS[name]
    const cursors: readonly Vector[] = [
      [3, -28, 7],
      [-13, -28, 2],
      [27, -28, -6],
    ]

    // Act
    const remainders = rotations.flatMap((rotation) =>
      cursors.flatMap((point) => {
        if (part === undefined) return []
        const box = getRotatedBox(part.box, rotation)
        const position = getPlacementPosition(
          { point, normal: [0, -1, 0], phase },
          box,
          getGridPoint(part.studs, part.box, rotation)
        )
        return getStudRemainders(name, rotation, position)
      })
    )

    // Assert
    expect(brickStudRemainders[0]).toEqual([0, 10])
    expect(remainders.length).toBeGreaterThan(0)
    expect(new Set(remainders.map((remainder) => remainder.join(' ')))).toEqual(new Set(['0 10']))
  })

  it('stands each part on the top of the 3001, handles hanging below or not', () => {
    // Arrange
    const standing = ['3001', '3839b', '3023b', '3070b', '6157']

    // Act
    const heights = standing.map((name) => {
      const part = LIBRARY_PARTS[name]
      return part === undefined
        ? null
        : getPlacementPosition(
            { point: [3, -28, 7], normal: [0, -1, 0], phase },
            part.box,
            getGridPoint(part.studs, part.box, IDENTITY)
          )[1]
    })

    // Assert
    expect(heights).toEqual([-48, -32, -32, -32, -40])
  })

  it('offers the grid of a placed part by its studs, not by its overhanging box', () => {
    // Arrange
    const handles = LIBRARY_PARTS['3839b']
    const placed = { ...BRICK_BELOW, position: [20, -8, 10] as const, partName: '3839b.dat' }

    // Act
    const handlesPhase =
      handles === undefined
        ? null
        : getPartPhase(getGridPoint(handles.studs, handles.box, IDENTITY), placed)

    // Assert
    expect(handlesPhase).toEqual([0, 0, 0])
  })
})
