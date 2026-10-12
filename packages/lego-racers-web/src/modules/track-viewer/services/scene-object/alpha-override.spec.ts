import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { setAlphaOverride } from './alpha-override.ts'

const createGroup = () => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'color',
    new BufferAttribute(new Uint8Array([255, 255, 255, 64, 255, 255, 255, 128]), 4, true)
  )
  const group = new Group()
  group.add(new Mesh(geometry, new MeshBasicMaterial()))
  return { group, geometry }
}

describe('setAlphaOverride', () => {
  it('writes the alpha into every vertex and takes it off again', () => {
    // Arrange
    const { group, geometry } = createGroup()
    const colors = geometry.getAttribute('color').array

    // Act
    setAlphaOverride(group, 10)
    const overridden = [colors[3], colors[7]]
    setAlphaOverride(group, null)

    // Assert
    expect(overridden).toEqual([10, 10])
    expect([colors[3], colors[7]]).toEqual([64, 128])
  })
})
