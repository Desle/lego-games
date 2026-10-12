import type { SceneMesh } from '@lego-games/lego-racers/scene'
import { findWheels } from './wheel-analysis.ts'

const SIDES = 8
const RADIUS = 100
const FULL_TURN = Math.PI * 2

type Drum = {
  readonly boneIndex: number
  readonly centre: readonly [number, number, number]
  readonly width: number
}

// A model of drums with the axle along y, as the original builds its wheels: every face has vertices of its own (quads of two
// triangles), so only their positions say which faces meet.
const createMesh = (drums: readonly Drum[]): SceneMesh => {
  const positions: number[] = []
  const vertexIndices: number[] = []
  const transformIndices: number[] = []
  const addVertex = (x: number, y: number, z: number, boneIndex: number): number => {
    positions.push(x, y, z)
    transformIndices.push(boneIndex)
    return positions.length / 3 - 1
  }
  for (const { boneIndex, centre, width } of drums) {
    for (let side = 0; side < SIDES; side += 1) {
      const [first, second] = [side, side + 1].map((index) => (index * FULL_TURN) / SIDES)
      const [x1, z1, x2, z2] = [
        Math.cos(first ?? 0) * RADIUS,
        Math.sin(first ?? 0) * RADIUS,
        Math.cos(second ?? 0) * RADIUS,
        Math.sin(second ?? 0) * RADIUS,
      ]
      const corners = [
        addVertex(centre[0] + x1, centre[1] - width / 2, centre[2] + z1, boneIndex),
        addVertex(centre[0] + x2, centre[1] - width / 2, centre[2] + z2, boneIndex),
        addVertex(centre[0] + x2, centre[1] + width / 2, centre[2] + z2, boneIndex),
        addVertex(centre[0] + x1, centre[1] + width / 2, centre[2] + z1, boneIndex),
      ]
      const [a = 0, b = 0, c = 0, d = 0] = corners
      vertexIndices.push(a, b, c, a, c, d)
    }
  }
  return {
    name: 'drums',
    path: 'DRUMS.GDB',
    vertexCount: positions.length / 3,
    positions: Float32Array.from(positions),
    textureCoordinates: new Float32Array((positions.length / 3) * 2),
    colors: null,
    normals: null,
    materialIndices: [0],
    drawBatches: [
      {
        materialSlot: 0,
        firstCommand: 0,
        vertexIndices: Uint32Array.from(vertexIndices),
        transformIndices: Uint8Array.from(
          vertexIndices.map((vertex) => transformIndices[vertex] ?? 0)
        ),
      },
    ],
  }
}

describe('findWheels', () => {
  it('finds each drum with its bone, centre, radius, width and axle', () => {
    // Arrange
    const mesh = createMesh([
      { boneIndex: 1, centre: [0, 30, 0], width: 40 },
      { boneIndex: 1, centre: [0, -230, 0], width: 40 },
    ])

    // Act
    const wheels = findWheels(mesh)

    // Assert
    expect(
      wheels
        .map((wheel) => [wheel.boneIndex, wheel.axisIndex, wheel.centre[1], wheel.width])
        .sort((first, second) => (first[2] ?? 0) - (second[2] ?? 0))
    ).toEqual([
      [1, 1, -230, 40],
      [1, 1, 30, 40],
    ])
  })

  it('measures the radius across the drum', () => {
    // Arrange
    const mesh = createMesh([{ boneIndex: 2, centre: [10, 0, -5], width: 60 }])

    // Act
    const [wheel] = findWheels(mesh)

    // Assert
    expect(wheel?.radius).toBeCloseTo(RADIUS)
  })

  it('makes a hubcap beside a tyre one wheel', () => {
    // Arrange
    const mesh = createMesh([
      { boneIndex: 1, centre: [0, 0, 0], width: 40 },
      { boneIndex: 1, centre: [0, 25, 0], width: 10 },
    ])

    // Act
    const wheels = findWheels(mesh)

    // Assert
    expect(wheels.map((wheel) => wheel.width)).toEqual([50])
  })

  it('keeps the wheels of different bones apart', () => {
    // Arrange
    const mesh = createMesh([
      { boneIndex: 1, centre: [0, 0, 0], width: 40 },
      { boneIndex: 2, centre: [0, 0, 0], width: 40 },
    ])

    // Act
    const wheels = findWheels(mesh)

    // Assert
    expect(wheels.map((wheel) => wheel.boneIndex).sort()).toEqual([1, 2])
  })
})
