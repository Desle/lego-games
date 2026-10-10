import { getDrawBatches } from './draw-batches.ts'
import type { DrawCommand, DrawFace } from './draw-batches.types.ts'

describe('getDrawBatches', () => {
  it('reads face corners through the vertex cache and splits batches at material selections', () => {
    // Arrange
    const commands: readonly DrawCommand[] = [
      { kind: 'select_material', materialIndex: 1 },
      { kind: 'transform_vertices', cacheIndex: 0, firstVertex: 10, vertexCount: 3 },
      { kind: 'draw_faces', firstFace: 0, faceCount: 1 },
      { kind: 'select_transform', transformIndex: 2 },
      { kind: 'transform_vertices', cacheIndex: 1, firstVertex: 20, vertexCount: 1 },
      { kind: 'select_material', materialIndex: 0 },
      { kind: 'draw_faces', firstFace: 1, faceCount: 1 },
    ]
    const faces: readonly DrawFace[] = [
      [0, 1, 2],
      [2, 1, 0],
    ]

    // Act
    const batches = getDrawBatches(commands, faces)

    // Assert
    expect(batches).toHaveLength(2)
    expect(batches[0]?.materialSlot).toBe(1)
    expect([...(batches[0]?.vertexIndices ?? [])]).toEqual([10, 11, 12])
    expect([...(batches[1]?.vertexIndices ?? [])]).toEqual([12, 20, 10])
    expect([...(batches[1]?.transformIndices ?? [])]).toEqual([0, 2, 0])
  })

  it('skips faces that use an empty cache slot and drops empty batches', () => {
    // Arrange
    const commands: readonly DrawCommand[] = [
      { kind: 'select_material', materialIndex: 0 },
      { kind: 'transform_vertices', cacheIndex: 0, firstVertex: 0, vertexCount: 2 },
      { kind: 'draw_faces', firstFace: 0, faceCount: 1 },
    ]

    // Act
    const batches = getDrawBatches(commands, [[0, 1, 5]])

    // Assert
    expect(batches).toEqual([])
  })
})
