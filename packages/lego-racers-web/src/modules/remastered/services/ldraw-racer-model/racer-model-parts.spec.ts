import { BoxGeometry, Group, Mesh } from 'three'
import { takeWheelsAndFigures } from './racer-model-parts.ts'

const createPart = (category: string, x: number): Group => {
  const part = new Group()
  part.userData['category'] = category
  const mesh = new Mesh(new BoxGeometry(10, 10, 10))
  mesh.position.set(x, 0, 0)
  part.add(mesh)
  return part
}

describe('takeWheelsAndFigures', () => {
  it('gathers the tyre and rim of a wheel in one unit and takes a minifigure out of the model', () => {
    // Arrange
    const model = new Group()
    const subModel = new Group()
    subModel.add(createPart('Tyre', 0), createPart('Wheel', 1), createPart('Brick', 50))
    model.add(subModel, createPart('Wheel', 200), createPart('Minifig Torso', 0))

    // Act
    const wheels = takeWheelsAndFigures(model)

    // Assert
    expect([
      wheels.map(({ unit }) => unit.children.length),
      model.children.length,
      subModel.children.length,
    ]).toEqual([[2, 1], 1, 1])
  })

  it('keeps the places the parts had in the model', () => {
    // Arrange
    const model = new Group()
    const subModel = new Group()
    subModel.position.set(100, 0, 0)
    subModel.add(createPart('Wheel', 0))
    model.add(subModel)

    // Act
    const [wheel] = takeWheelsAndFigures(model)

    // Assert
    expect(wheel?.centre.x).toBeCloseTo(100)
  })
})
