import { createGltfBuilder } from './gltf-builder.ts'

describe('createGltfBuilder', () => {
  it('writes accessors with bounds, four-byte aligned buffer views and no empty arrays', () => {
    // Arrange
    const builder = createGltfBuilder()
    const positions = builder.addAccessor({
      values: Float32Array.from([0, 1, 2, -1, 5, 3]),
      type: 'VEC3',
      target: 'vertices',
      isNormalized: false,
      isBounded: true,
    })
    const indices = builder.addAccessor({
      values: Uint16Array.from([0, 1, 1]),
      type: 'SCALAR',
      target: 'indices',
      isNormalized: false,
      isBounded: false,
    })
    const material = builder.addMaterial({
      name: 'plain',
      baseColorFactor: [1, 1, 1, 1],
      baseColorTexture: null,
      alphaMode: 'OPAQUE',
      alphaCutoff: 0,
    })
    const mesh = builder.addMesh('triangle', [
      { attributes: { POSITION: positions }, indices, material },
    ])
    const node = builder.addNode({ name: 'node', mesh })
    builder.addScene('scene', [node])

    // Act
    const output = builder.build('triangle.bin')

    // Assert
    const document = JSON.parse(output.json) as {
      accessors: { min?: number[]; max?: number[]; count: number }[]
      bufferViews: { byteOffset: number }[]
      images?: unknown
    }
    expect(document.accessors[0]).toMatchObject({ min: [-1, 1, 2], max: [0, 5, 3], count: 2 })
    expect(document.bufferViews[1]?.byteOffset).toBe(24)
    expect(output.binary.length).toBe(32)
    expect(document.images).toBeUndefined()
  })
})
