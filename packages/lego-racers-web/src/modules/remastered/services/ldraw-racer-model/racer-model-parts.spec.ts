import { BoxGeometry, Group, Mesh } from 'three'
import { takeWheelsAndFigures } from './racer-model-parts.ts'

const createPart = (category: string | null, x: number, fileName = 'part.dat'): Group => {
  const part = new Group()
  part.userData['category'] = category
  part.userData['fileName'] = fileName
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
    model.add(subModel, createPart('Wheel', 200), createPart(null, 0, 'parts/973p01.dat'))

    // Act
    const wheels = takeWheelsAndFigures(model)

    // Assert
    expect([
      wheels.map(({ unit }) => unit.children.length),
      model.children.length,
      subModel.children.length,
    ]).toEqual([[2, 1], 1, 1])
  })

  it('takes what the figure wears with it and leaves a minifig accessory elsewhere on the car', () => {
    // Arrange
    const model = new Group()
    const head = createPart(null, 0, '3626b.dat')
    const hat = createPart('Minifig', 8, '30167.dat')
    const spear = createPart('Minifig', 100, '93789.dat')
    model.add(head, hat, spear)

    // Act
    takeWheelsAndFigures(model)

    // Assert
    expect(model.children).toEqual([spear])
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
