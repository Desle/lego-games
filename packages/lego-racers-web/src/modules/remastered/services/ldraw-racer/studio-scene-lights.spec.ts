import { DirectionalLight, Group, Scene } from 'three'
import { ensureStudioLights } from './studio-scene-lights.ts'

const getKeyLightX = (scene: Scene): number | undefined =>
  scene.children
    .flatMap((child) => child.children)
    .find((light): light is DirectionalLight => light instanceof DirectionalLight)?.position.x

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

  it('turns the studio to light a figure from its front', () => {
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
    expect(getKeyLightX(fromFront)).toBe(-(getKeyLightX(fromBehind) ?? 0))
  })
})
