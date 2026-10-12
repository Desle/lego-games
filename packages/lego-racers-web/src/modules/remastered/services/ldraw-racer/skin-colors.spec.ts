import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial } from 'three'
import { restoreDisplayColors } from './skin-colors.ts'

describe('restoreDisplayColors', () => {
  it('gives a flesh colour back as the library names it, with a share of it showing unlit', () => {
    // Arrange
    const material = new MeshPhysicalMaterial({ color: 0xfac80a })
    const model = new Group().add(new Mesh(new BoxGeometry(), material))
    const linearGreen = material.color.g

    // Act
    restoreDisplayColors(model)

    // Assert
    expect([material.color.g > linearGreen, material.emissive.g > 0]).toEqual([true, true])
  })
})
