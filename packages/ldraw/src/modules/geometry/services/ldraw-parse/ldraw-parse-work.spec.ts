import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { deserializeModel } from './ldraw-parse-client.ts'
import { getTransferables, serializeModel } from './ldraw-parse-work.ts'

const createMergedModel = (): Group => {
  const mesh = new BufferGeometry()
  mesh.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
  mesh.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  const edges = new BufferGeometry()
  edges.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3))
  const model = new Group()
  model.add(
    new Mesh(
      mesh,
      new MeshStandardMaterial({
        color: 0xb40000,
        roughness: 0.3,
        metalness: 0.25,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    ),
    new LineSegments(edges, new LineBasicMaterial({ color: 0x333333 }))
  )
  return model
}

describe('serializeModel', () => {
  it('lists each primitive with its attributes and its material', () => {
    // Arrange
    const model = createMergedModel()

    // Act
    const serialized = serializeModel(model)

    // Assert
    expect(
      serialized.primitives.map((primitive) => [
        primitive.kind,
        primitive.materialIndex,
        primitive.attributes.map((attribute) => attribute.name),
      ])
    ).toEqual([
      ['triangles', 0, ['position', 'normal']],
      ['lines', 1, ['position']],
    ])
  })

  it('moves every buffer of a model instead of copying it', () => {
    // Arrange
    const serialized = serializeModel(createMergedModel())

    // Act
    const buffers = getTransferables({ body: serialized, subModels: [], grid: null })

    // Assert
    expect(buffers.length).toBe(3)
  })
})

describe('deserializeModel', () => {
  it('gives back the meshes and lines of a model with their materials', () => {
    // Arrange
    const serialized = serializeModel(createMergedModel())

    // Act
    const model = deserializeModel(serialized)

    // Assert
    const [mesh, lines] = model.children
    expect([
      mesh instanceof Mesh && mesh.material instanceof MeshStandardMaterial
        ? [mesh.material.roughness, mesh.material.metalness, mesh.material.opacity]
        : null,
      lines instanceof LineSegments && lines.material instanceof LineBasicMaterial,
    ]).toEqual([[0.3, 0.25, 0.5], true])
  })

  it('keeps the colour of a material as the library made it', () => {
    // Arrange
    const serialized = serializeModel(createMergedModel())

    // Act
    const [mesh] = deserializeModel(serialized).children

    // Assert
    expect(
      mesh instanceof Mesh && mesh.material instanceof MeshStandardMaterial
        ? mesh.material.color.getHexString()
        : null
    ).toBe('b40000')
  })
})
