import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { setDrawingOpacity } from './drawing-opacity.ts'

const createDrawing = () => {
  const solid = new MeshStandardMaterial()
  const translucent = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const drawing = new Group()
  drawing.add(new Mesh(new BoxGeometry(), solid), new Mesh(new BoxGeometry(), translucent))
  return { drawing, solid, translucent }
}

describe('setDrawingOpacity', () => {
  it('keeps a translucent brick see-through when the drawing is fully shown', () => {
    // Arrange
    const { drawing, solid, translucent } = createDrawing()

    // Act
    setDrawingOpacity(drawing, 1)

    // Assert
    expect([solid.opacity, solid.transparent, solid.depthWrite]).toEqual([1, false, true])
    expect([translucent.opacity, translucent.transparent, translucent.depthWrite]).toEqual([
      0.5,
      true,
      false,
    ])
  })

  it('fades every brick by the drawing opacity times its own, and restores them', () => {
    // Arrange
    const { drawing, solid, translucent } = createDrawing()

    // Act
    setDrawingOpacity(drawing, 0.4)
    const faded = [solid.opacity, translucent.opacity, solid.transparent, solid.depthWrite]
    setDrawingOpacity(drawing, 1)

    // Assert
    expect(faded).toEqual([0.4, 0.2, true, false])
    expect([solid.opacity, solid.transparent, solid.depthWrite]).toEqual([1, false, true])
    expect(translucent.opacity).toBe(0.5)
  })
})
