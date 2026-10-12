import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { BoxGeometry, Group, Line, Mesh, MeshBasicMaterial, Scene } from 'three'
import { RACER_SHADOW_DECAL_NAME } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import {
  hideBlobShadows,
  hideNonCasters,
  showAgain,
  showStaticSceneryOnly,
} from './shadow-casters.ts'

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
    const hidden = hideNonCasters(scene, trackGroup)

    // Assert
    expect([surface.visible, scenery.visible, hazard.visible]).toEqual([false, false, true])
    expect(car.children.map((child) => child.visible)).toEqual([true, false, false])
    expect(hidden).toContain(blob)
    showAgain(hidden)
    expect([surface.visible, car.children.every((child) => child.visible)]).toEqual([true, true])
  })
})

describe('showStaticSceneryOnly', () => {
  it('shows the scenery and nothing else, then puts every visibility back', () => {
    // Arrange
    const { scene, trackGroup, surface, scenery, hazard, car } = createRace()
    surface.visible = false
    const farLevel = createInstance(SceneInstanceKind.MESH)
    trackGroup.add(farLevel)
    scenery.name = 'wall'
    farLevel.name = 'wall'

    // Act
    const view = showStaticSceneryOnly(scene, trackGroup)
    const during = [surface, scenery, farLevel, hazard, car].map((object) => object.visible)
    view.restore()
    const after = [surface, scenery, farLevel, hazard, car].map((object) => object.visible)

    // Assert
    expect(during).toEqual([true, true, false, false, false])
    expect(after).toEqual([false, true, true, true, true])
    expect(view.shown).toEqual([surface, scenery])
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
