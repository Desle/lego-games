import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { Mesh } from 'three'
import type { Group, Object3D, Scene } from 'three'
import { RACER_SHADOW_DECAL_NAME } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { getInstanceKind } from './track-triangles.ts'
import type { StaticSceneryView, VisibilityChange } from './baked-scenery-shadow.types.ts'

const setVisible = (object: Object3D, isVisible: boolean) => {
  // eslint-disable-next-line no-param-reassign -- the shadow pass shows and hides the scene's objects for its own draw
  object.visible = isVisible
}

const getIsTranslucent = (mesh: Mesh): boolean => {
  const materials = mesh.material
  return (Array.isArray(materials) ? materials : [materials]).some(
    (material) => material.transparent
  )
}

// Only solid meshes make a shadow: lines, points, sprites, decals, glass and effects drawn with a blend do not.
const hideUnlessCaster = (object: Object3D, hidden: Object3D[]) => {
  if (!object.visible) return
  const isSolidMesh = object instanceof Mesh && !getIsTranslucent(object as Mesh)
  if (!isSolidMesh && object.children.length === 0) {
    setVisible(object, false)
    hidden.push(object)
    return
  }
  for (const child of object.children) hideUnlessCaster(child, hidden)
}

// Hides what must not be drawn into the live shadow map, and returns it so it can be shown again: the track's static instances
// (the baked map holds those), decals, particles and translucent effects. What stays are the cars, wheels, drivers,
// power-up bricks, projectiles and the track's moving hazards.
export const hideNonCasters = (trackScene: Scene, trackGroup: Group): readonly Object3D[] => {
  const hidden: Object3D[] = []
  for (const child of trackScene.children) {
    if (child !== trackGroup) hideUnlessCaster(child, hidden)
  }
  for (const instance of trackGroup.children) {
    if (!instance.visible) continue
    if (getInstanceKind(instance) === SceneInstanceKind.SKELETON) {
      hideUnlessCaster(instance, hidden)
    } else {
      setVisible(instance, false)
      hidden.push(instance)
    }
  }
  return hidden
}

export const showAgain = (hidden: readonly Object3D[]) => {
  for (const object of hidden) setVisible(object, true)
}

export const hideBlobShadows = (trackScene: Scene) => {
  for (const child of trackScene.children) {
    if (child.name === RACER_SHADOW_DECAL_NAME) setVisible(child, false)
  }
}

const getInstanceKey = (instance: Object3D): string =>
  `${instance.name}|${instance.matrix.elements.join(',')}`

// Shows the static scenery for the one-off baked shadow draw: every solid mesh of the BSP trees (all leaves, not only the ones the
// camera sees) and the plain mesh instances at their nearest level of detail (one group per level share name and matrix).
// Cars, hazards and effects are hidden. `restore` puts every visibility back.
export const showStaticSceneryOnly = (trackScene: Scene, trackGroup: Group): StaticSceneryView => {
  const changes: VisibilityChange[] = []
  const setVisibility = (object: Object3D, isVisible: boolean) => {
    if (object.visible === isVisible) return
    changes.push({ object, isVisibleBefore: object.visible })
    setVisible(object, isVisible)
  }
  for (const child of trackScene.children) {
    if (child !== trackGroup) setVisibility(child, false)
  }
  const seenKeys = new Set<string>()
  const shown: Object3D[] = []
  for (const instance of trackGroup.children) {
    const key = getInstanceKey(instance)
    if (getInstanceKind(instance) === SceneInstanceKind.SKELETON || seenKeys.has(key)) {
      setVisibility(instance, false)
      continue
    }
    seenKeys.add(key)
    setVisibility(instance, true)
    shown.push(instance)
    instance.traverse((child) => {
      if (child === instance) return
      const isSolidMesh = child instanceof Mesh && !getIsTranslucent(child as Mesh)
      setVisibility(child, isSolidMesh || child.children.length > 0)
    })
  }
  const restore = () => {
    for (const { object, isVisibleBefore } of changes.reverse()) setVisible(object, isVisibleBefore)
  }
  return { shown, restore }
}
