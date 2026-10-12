import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { BoxGeometry, Group, Line, Mesh, MeshBasicMaterial, Scene } from 'three'
import { RACER_SHADOW_DECAL_NAME } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { hideBlobShadows, hideNonCasters, showAgain } from './shadow-casters.ts'
import { ShadowMode } from './shadow-mode.types.ts'

const createSolid = () => new Mesh(new BoxGeometry(), new MeshBasicMaterial())
const createGlass = () => new Mesh(new BoxGeometry(), new MeshBasicMaterial({ transparent: true }))

const createInstance = (kind: string) => {
  const instance = new Group()
  instance.userData['instanceKind'] = kind
  instance.add(createSolid())
  return instance
}

const createRace = () => {
  const scene = new Scene()
  const trackGroup = new Group()
  const surface = createInstance(SceneInstanceKind.BSP_TREE)
  const scenery = createInstance(SceneInstanceKind.MESH)
  const hazard = createInstance(SceneInstanceKind.SKELETON)
  trackGroup.add(surface, scenery, hazard)
  const car = new Group()
  car.add(createSolid(), createGlass(), new Line())
  const blob = createGlass()
  blob.name = RACER_SHADOW_DECAL_NAME
  scene.add(trackGroup, car, blob)
  return { scene, trackGroup, surface, scenery, hazard, car, blob }
}

describe('hideNonCasters', () => {
  it('keeps the cars and the hazards, and hides the surface, the scenery, glass, lines and blobs', () => {
    // Arrange
    const { scene, trackGroup, surface, scenery, hazard, car, blob } = createRace()

    // Act
    const hidden = hideNonCasters(scene, trackGroup, ShadowMode.REAL)

    // Assert
    expect([surface.visible, scenery.visible, hazard.visible]).toEqual([false, false, true])
    expect(car.children.map((child) => child.visible)).toEqual([true, false, false])
    expect(hidden).toContain(blob)
  })

  it('lets the scenery cast when asked, and shows everything again afterwards', () => {
    // Arrange
    const { scene, trackGroup, scenery, car } = createRace()

    // Act
    const hidden = hideNonCasters(scene, trackGroup, ShadowMode.SCENERY)
    const isSceneryCasting = scenery.visible
    showAgain(hidden)

    // Assert
    expect(isSceneryCasting).toBe(true)
    expect(car.children.every((child) => child.visible)).toBe(true)
  })
})

describe('hideBlobShadows', () => {
  it('hides the original racer shadow decals only', () => {
    // Arrange
    const { scene, blob, car } = createRace()

    // Act
    hideBlobShadows(scene)

    // Assert
    expect([blob.visible, car.visible]).toEqual([false, true])
  })
})
