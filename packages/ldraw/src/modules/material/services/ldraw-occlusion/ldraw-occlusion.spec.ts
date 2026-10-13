import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'
import {
  bakeOcclusionVolume,
  OCCLUSION_NORMAL_ATTRIBUTE,
  OCCLUSION_POSITION_ATTRIBUTE,
} from './ldraw-occlusion.ts'

describe('bakeOcclusionVolume', () => {
  it('fills a grid around the surface and gives the vertices their position and normal in the model frame', () => {
    // Arrange
    const geometry = new BoxGeometry(20, 20, 20)
    const mesh = new Mesh(geometry, new MeshBasicMaterial())
    mesh.position.set(100, 0, 0)

    // Act
    const volume = bakeOcclusionVolume(mesh)

    // Assert
    const positions = geometry.getAttribute(OCCLUSION_POSITION_ATTRIBUTE)
    expect(positions.count).toBe(geometry.getAttribute('position').count)
    expect(geometry.hasAttribute(OCCLUSION_NORMAL_ATTRIBUTE)).toBe(true)
    expect(volume).not.toBeNull()
    const data = volume?.texture.image.data
    expect(data?.some((value) => value > 0)).toBe(true)
    expect(data?.length).toBe(
      (volume?.texture.image.width ?? 0) *
        (volume?.texture.image.height ?? 0) *
        (volume?.texture.image.depth ?? 0)
    )
  })

  it('has nothing to bake for a model without a mesh', () => {
    // Arrange / Act
    const volume = bakeOcclusionVolume(new Mesh())

    // Assert
    expect(volume).toBeNull()
  })
})
