import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import type { Material } from 'three'
import { mergeModelByMaterial } from './ldraw-model-merge.ts'

const createTriangle = (material: Material): Mesh => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
  geometry.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  return new Mesh(geometry, material)
}

const getMeshes = (group: Group): Mesh[] =>
  group.children.filter((child): child is Mesh => child instanceof Mesh)

describe('mergeModelByMaterial', () => {
  it('draws the meshes that share a material as one mesh', () => {
    // Arrange
    const red = new MeshBasicMaterial({ color: 0xff0000 })
    const blue = new MeshBasicMaterial({ color: 0x0000ff })
    const model = new Group()
    const moved = createTriangle(red)
    moved.position.set(5, 0, 0)
    model.add(createTriangle(red), moved, createTriangle(blue))

    // Act
    const merged = mergeModelByMaterial(model)

    // Assert
    expect(getMeshes(merged).map((mesh) => mesh.geometry.getAttribute('position').count)).toEqual([
      6, 3,
    ])
  })

  it('puts each triangle where its part stood in the model', () => {
    // Arrange
    const material = new MeshBasicMaterial()
    const model = new Group()
    const part = new Group()
    part.position.set(10, 20, 30)
    part.add(createTriangle(material))
    model.add(part)

    // Act
    const merged = mergeModelByMaterial(model)

    // Assert
    const [mesh] = getMeshes(merged)
    const first = new Vector3().fromBufferAttribute(
      mesh?.geometry.getAttribute('position') ?? new Float32BufferAttribute([], 3),
      0
    )
    expect(first.toArray()).toEqual([10, 20, 30])
  })

  it('turns the winding of a mirrored part so it still faces the same way', () => {
    // Arrange
    const material = new MeshBasicMaterial()
    const model = new Group()
    const mirrored = createTriangle(material)
    mirrored.scale.set(-1, 1, 1)
    model.add(mirrored)

    // Act
    const merged = mergeModelByMaterial(model)

    // Assert
    const [mesh] = getMeshes(merged)
    const position = mesh?.geometry.getAttribute('position')
    const second = new Vector3().fromBufferAttribute(
      position ?? new Float32BufferAttribute([], 3),
      1
    )
    expect(second.toArray()).toEqual([0, 1, 0])
  })

  it('draws the edge lines of one material as one set of line segments', () => {
    // Arrange
    const edge = new LineBasicMaterial()
    const model = new Group()
    for (let index = 0; index < 3; index += 1) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, index, 1, 0], 3))
      model.add(new LineSegments(geometry, edge))
    }

    // Act
    const merged = mergeModelByMaterial(model)

    // Assert
    const lines = merged.children.filter((child) => child instanceof LineSegments)
    expect(lines.length).toBe(1)
  })

  it('keeps the material of each group of a mesh that has several', () => {
    // Arrange
    const red = new MeshBasicMaterial({ color: 0xff0000 })
    const blue = new MeshBasicMaterial({ color: 0x0000ff })
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1], 3)
    )
    geometry.addGroup(0, 3, 0)
    geometry.addGroup(3, 3, 1)
    const model = new Group()
    model.add(new Mesh(geometry, [red, blue]))

    // Act
    const merged = mergeModelByMaterial(model)

    // Assert
    expect(getMeshes(merged).map((mesh) => mesh.material)).toEqual([[red], [blue]])
  })

  it('keeps a mesh that had a list of materials as a list, drawn by one group', () => {
    // Arrange
    const material = new MeshBasicMaterial()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    geometry.addGroup(0, 3, 0)
    const model = new Group()
    model.add(new Mesh(geometry, [material]))

    // Act
    const [mesh] = getMeshes(mergeModelByMaterial(model))

    // Assert
    expect([mesh?.material, mesh?.geometry.groups.length]).toEqual([[material], 1])
  })
})
