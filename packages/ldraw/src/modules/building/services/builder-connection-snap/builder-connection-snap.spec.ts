import { getPartConnections } from '../builder-connections/builder-connections.ts'
import { ConnectionKind } from '../builder-connections/builder-connections.types.ts'
import { applyConnectionSnap, findConnectionSnap } from './builder-connection-snap.ts'
import type { ConnectedPart } from '../builder-connections/builder-connections.types.ts'
import type { PartShape } from '../builder-studs/builder-studs.types.ts'
import type { ConnectionSnapOptions } from './builder-connection-snap.types.ts'
import type { BuilderPart, BuilderPartLine, Vector } from '../../types/building.types.ts'

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const UP: Vector = [0, -1, 0]
// `973c01`'s left arm and left hand, as the library's complete figures place them (the top of the hips at the origin).
const LEFT_ARM_TURN = [0.985467, 0.169866, 0, -0.169866, 0.985467, 0, 0, 0, 1]
const LEFT_HAND_TURN = [0.985, 0.1202, -0.1202, -0.17, 0.6964, -0.6964, 0, 0.707, 0.707]

const createShape = (overrides: Partial<PartShape>): PartShape => ({
  studs: [],
  holes: [],
  box: null,
  footprint: null,
  bottom: null,
  description: '',
  ...overrides,
})

// A 2 x 4 brick (3001): eight studs on top at y 0, its bottom 24 down.
const BRICK = createShape({
  studs: [-30, -10, 10, 30].flatMap((x) =>
    [-10, 10].map((z) => ({ position: [x, 0, z], direction: UP }) as const)
  ),
  box: { minimum: [-40, -4, -20], maximum: [40, 24, 20] },
  footprint: { minimum: [-40, 24, -20], maximum: [40, 24, 20] },
  bottom: 24,
})
const HEAD = createShape({
  studs: [{ position: [0, 0, 0], direction: UP }],
  description: 'Minifig Head',
})
const SHAPES: Readonly<Record<string, PartShape>> = {
  '3001.dat': BRICK,
  '3626b.dat': HEAD,
  '973.dat': createShape({ description: 'Minifig Torso' }),
  '3819.dat': createShape({ description: 'Minifig Arm Left' }),
  '3820.dat': createShape({ description: 'Minifig Hand' }),
  '3624.dat': createShape({
    holes: [{ position: [0, 0, 0], direction: UP }],
    description: 'Minifig Police Hat',
  }),
}

const createPart = (partName: string, position: Vector, rotation = IDENTITY): BuilderPartLine => ({
  colorCode: 16,
  partName,
  position,
  rotation,
})

const connect = (part: BuilderPartLine): ConnectedPart => ({
  part,
  connections: getPartConnections(part.partName, SHAPES[part.partName] ?? createShape({})),
})

// Seen from the front, a little from above and the side, without perspective.
const OPTIONS: ConnectionSnapOptions = {
  project: (point) => [point[0] + point[2] / 4, point[1] + point[2] / 4],
  radius: 20,
  isTurnAllowed: true,
  groundHeight: 0,
  pointer: null,
  getIsOffsetAllowed: () => true,
}

const round = (values: readonly number[]) => values.map((value) => Number(value.toFixed(3)) + 0)

const getPlaced = (
  part: BuilderPartLine,
  standing: readonly BuilderPartLine[],
  options = OPTIONS
) => {
  const snap = findConnectionSnap([connect(part)], standing.map(connect), options)
  if (snap === null) return null
  const [placed] = applyConnectionSnap(
    [{ ...part, commentLines: [] } satisfies BuilderPart],
    [0],
    snap
  )
  return placed === undefined
    ? null
    : { snap, position: round(placed.position), rotation: round(placed.rotation) }
}

describe('findConnectionSnap', () => {
  it('puts a brick on the free studs of a stack, not the covered ones', () => {
    // Arrange
    const stack = [createPart('3001.dat', [0, -24, 0]), createPart('3001.dat', [0, -48, 0])]
    const held = createPart('3001.dat', [3, -70, 2])

    // Act
    const placed = getPlaced(held, stack)

    // Assert
    expect(placed?.position).toEqual([0, -72, 0])
    expect(placed?.snap.kind).toBe(ConnectionKind.STUD)
  })

  it('puts a brick under a raised one by its studs, but none into the ground', () => {
    // Arrange
    const raised = [createPart('3001.dat', [0, -100, 0])]
    const onGround = [createPart('3001.dat', [0, -24, 0])]

    // Act
    const under = getPlaced(createPart('3001.dat', [1, -70, 1]), raised)
    const intoGround = getPlaced(createPart('3001.dat', [1, 0, 1]), onGround, {
      ...OPTIONS,
      radius: 30,
    })

    // Assert
    expect(under?.position).toEqual([0, -76, 0])
    expect(intoGround).toBeNull()
  })

  it('keeps a brick off studs that do not point its way', () => {
    // Arrange
    const tilted = createPart('3001.dat', [0, -60, 0], [1, 0, 0, 0, 0, -1, 0, 1, 0])

    // Act
    const placed = getPlaced(tilted, [createPart('3001.dat', [0, -24, 0])])

    // Assert
    expect(placed).toBeNull()
  })

  it('puts a head on the neck of a torso', () => {
    // Arrange
    const torso = createPart('973.dat', [0, -32, 0])

    // Act
    const placed = getPlaced(createPart('3626b.dat', [4, -50, 3]), [torso])

    // Assert
    expect(placed?.position).toEqual([0, -56, 0])
    expect(placed?.snap.kind).toBe(ConnectionKind.NECK)
  })

  it('puts a head on the neck the cursor points at, wherever the head is', () => {
    // Arrange
    const torso = createPart('973.dat', [0, -32, 0])
    const pointing = { ...OPTIONS, pointer: [1, -31] as const }

    // Act
    const placed = getPlaced(createPart('3626b.dat', [200, -50, 0]), [torso], pointing)

    // Assert
    expect(placed?.position).toEqual([0, -56, 0])
  })

  it('puts a hat on the stud of a head', () => {
    // Arrange
    const head = createPart('3626b.dat', [0, -56, 0])

    // Act
    const placed = getPlaced(createPart('3624.dat', [2, -60, 0]), [head])

    // Assert
    expect(placed?.position).toEqual([0, -56, 0])
    expect(placed?.rotation).toEqual(IDENTITY)
  })

  it('puts a hand on the wrist of an arm, turned as the arm holds it', () => {
    // Arrange
    const arm = createPart('3819.dat', [15.552, -23, 0], LEFT_ARM_TURN)

    // Act
    const placed = getPlaced(createPart('3820.dat', [26, -8, -8]), [arm])

    // Assert
    expect(placed?.snap.kind).toBe(ConnectionKind.WRIST)
    expect(placed?.position.map((value) => Math.round(value * 100) / 100)).toEqual([
      23.69, -5.23, -9.9,
    ])
    placed?.rotation.forEach((value, index) =>
      expect(value).toBeCloseTo(LEFT_HAND_TURN[index] ?? 0, 2)
    )
  })

  it('does not turn several parts moving together, nor leave the allowed moves', () => {
    // Arrange
    const arm = connect(createPart('3819.dat', [15.552, -23, 0], LEFT_ARM_TURN))
    const hands = [
      connect(createPart('3820.dat', [26, -8, -8])),
      connect(createPart('3820.dat', [60, -8, -8])),
    ]
    const stack = [connect(createPart('3001.dat', [0, -24, 0]))]

    // Act
    const together = findConnectionSnap(hands, [arm], OPTIONS)
    const heldUpright = findConnectionSnap([connect(createPart('3001.dat', [5, -40, 0]))], stack, {
      ...OPTIONS,
      getIsOffsetAllowed: (offset) => Math.abs(offset[0]) < 0.5,
    })

    // Assert
    expect(together).toBeNull()
    expect(heldUpright).toBeNull()
  })
})
