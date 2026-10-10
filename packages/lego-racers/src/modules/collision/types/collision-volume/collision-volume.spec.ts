import type { BspVolume } from '../../../bsp-volume/index.ts'
import {
  createCollisionVolume,
  getCollisionMaterialName,
  getMirroredCollisionVolume,
} from './collision-volume.ts'

const PARSED: BspVolume = {
  materialNames: ['road', 'wall'],
  keyword34Vectors: [
    [1, 2, 3],
    [4, -5, 6],
  ],
  keyword2dEntries: [[0, 1, -32768, 1]],
  nodes: [{ childIndices: [-1, -2], vector: [0, 0.5, 1], shortValues: [0, 1] }],
  readByteCount: 0,
}

describe('createCollisionVolume', () => {
  it('reads indices and counts as unsigned 16-bit values, as 0x00403fa0 does', () => {
    // Arrange
    const parsed = PARSED

    // Act
    const volume = createCollisionVolume(parsed)

    // Assert
    expect(volume.triangles).toEqual([{ vertexIndices: [0, 1, 0x8000], materialIndex: 1 }])
    expect(volume.nodes).toEqual([
      {
        normal: { x: 0, y: 0.5, z: 1 },
        firstTriangleIndex: 0,
        triangleCount: 1,
        positiveChildIndex: 0xffff,
        negativeChildIndex: 0xfffe,
      },
    ])
    expect(volume.vertices[1]).toEqual({ x: 4, y: -5, z: 6 })
  })
})

describe('getMirroredCollisionVolume', () => {
  it('negates y of node normals and vertices and swaps the second and third vertex (0x004045e0)', () => {
    // Arrange
    const volume = createCollisionVolume(PARSED)

    // Act
    const mirrored = getMirroredCollisionVolume(volume)

    // Assert
    expect(mirrored.vertices).toEqual([
      { x: 1, y: -2, z: 3 },
      { x: 4, y: 5, z: 6 },
    ])
    expect(mirrored.nodes[0]?.normal).toEqual({ x: 0, y: -0.5, z: 1 })
    expect(mirrored.triangles[0]?.vertexIndices).toEqual([0, 0x8000, 1])
  })
})

describe('getCollisionMaterialName', () => {
  it('prefers the instance material list over the volume one', () => {
    // Arrange
    const volume = createCollisionVolume(PARSED)
    const frame = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1] as const, position: { x: 0, y: 0, z: 0 } }

    // Act
    const names = [
      getCollisionMaterialName({ frame, volume, materialNames: undefined }, 1),
      getCollisionMaterialName({ frame, volume, materialNames: ['ice', 'snow'] }, 1),
    ]

    // Assert
    expect(names).toEqual(['wall', 'snow'])
  })
})
