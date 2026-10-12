import { DirectionalLight, Group, Matrix4, Scene } from 'three'
import type { Object3D } from 'three'
import { createCarStudio, ensureStudioLights } from './studio-scene-lights.ts'

const getKeyLightX = (root: Object3D): number | undefined => {
  let keyLightX: number | undefined
  root.traverse((child) => {
    if (keyLightX === undefined && child instanceof DirectionalLight) keyLightX = child.position.x
  })
  return keyLightX
}

describe('ensureStudioLights', () => {
  it('has nothing to light while the object is in no scene', () => {
    // Arrange
    const object = new Group()

    // Act
    const isLit = ensureStudioLights(object)

    // Assert
    expect(isLit).toBe(false)
  })

  it('gives the scene the studio once, whoever asks', () => {
    // Arrange
    const scene = new Scene()
    const first = new Group()
    const second = new Group()
    scene.add(first, second)

    // Act
    ensureStudioLights(first)
    ensureStudioLights(second)

    // Assert
    expect(scene.children.length).toBe(3)
  })

  it('leaves a scene that has lights of its own alone', () => {
    // Arrange
    const scene = new Scene()
    const object = new Group()
    scene.add(new DirectionalLight(), object)

    // Act
    const isLit = ensureStudioLights(object)

    // Assert
    expect([isLit, scene.children.length]).toEqual([true, 2])
  })

  it('gives a figure seen from its front a studio of its own, whose key light comes from the front', () => {
    // Arrange
    const fromBehind = new Scene()
    const fromFront = new Scene()
    const behindObject = new Group()
    const frontObject = new Group()
    fromBehind.add(behindObject)
    fromFront.add(frontObject)

    // Act
    ensureStudioLights(behindObject)
    ensureStudioLights(frontObject, true)

    // Assert
    expect([(getKeyLightX(fromBehind) ?? 0) < 0, (getKeyLightX(frontObject) ?? 0) > 0]).toEqual([
      true,
      true,
    ])
  })
})

describe('createCarStudio', () => {
  it('gives a scene of several cars one studio, whoever poses first', () => {
    // Arrange
    const scene = new Scene()
    const first = new Group()
    const second = new Group()
    scene.add(first, second)
    const firstStudio = createCarStudio()
    const secondStudio = createCarStudio()

    // Act
    firstStudio.follow(first, new Matrix4())
    secondStudio.follow(second, new Matrix4())

    // Assert
    expect(scene.children.length).toBe(3)
  })

  it('moves the studio with the car that owns it, and with no other', () => {
    // Arrange
    const scene = new Scene()
    const first = new Group()
    const second = new Group()
    scene.add(first, second)
    const firstStudio = createCarStudio()
    const secondStudio = createCarStudio()

    // Act
    firstStudio.follow(first, new Matrix4().makeTranslation(1, 2, 3))
    secondStudio.follow(second, new Matrix4().makeTranslation(7, 8, 9))

    // Assert
    expect(scene.children[2]?.matrix.elements.slice(12, 15)).toEqual([1, 2, 3])
  })

  it('takes over the studio a wheel or a driver brought first', () => {
    // Arrange
    const scene = new Scene()
    const wheel = new Group()
    const car = new Group()
    scene.add(wheel, car)
    ensureStudioLights(wheel)

    // Act
    createCarStudio().follow(car, new Matrix4().makeTranslation(4, 5, 6))

    // Assert
    expect([scene.children.length, scene.children[2]?.matrix.elements.slice(12, 15)]).toEqual([
      3,
      [4, 5, 6],
    ])
  })

  it('takes the studio away with its car, and the next car brings it back', () => {
    // Arrange
    const scene = new Scene()
    const car = new Group()
    const next = new Group()
    scene.add(car, next)
    const carStudio = createCarStudio()
    carStudio.follow(car, new Matrix4())

    // Act
    carStudio.release()
    const lightsAfterRelease = scene.children.length
    createCarStudio().follow(next, new Matrix4())

    // Assert
    expect([lightsAfterRelease, scene.children.length]).toEqual([2, 3])
  })
})
