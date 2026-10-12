import { SceneInstanceKind } from '@lego-games/lego-racers/scene'
import { Mesh } from 'three'
import type { Group, Object3D, Scene } from 'three'
import { RACER_SHADOW_DECAL_NAME } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { getInstanceKind } from './track-triangles.ts'
import { ShadowMode } from './shadow-mode.types.ts'

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

const getIsCastingInstance = (instance: Object3D, mode: ShadowMode): boolean => {
  const kind = getInstanceKind(instance)
  if (kind === SceneInstanceKind.SKELETON) return true
  return mode === ShadowMode.SCENERY
}

// Hides what must not be drawn into the shadow map, and returns it so it can be shown again: the track's surface and (unless
// the scenery casts, the BSP tree that holds the ground, walls and bridges) its static instances, decals, particles and translucent effects. What stays are the cars, wheels, drivers,
// power-up bricks, projectiles and the track's moving hazards.
export const hideNonCasters = (
  trackScene: Scene,
  trackGroup: Group,
  mode: ShadowMode
): readonly Object3D[] => {
  const hidden: Object3D[] = []
  for (const child of trackScene.children) {
    if (child !== trackGroup) hideUnlessCaster(child, hidden)
  }
  for (const instance of trackGroup.children) {
    if (!instance.visible) continue
    if (getIsCastingInstance(instance, mode)) {
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
